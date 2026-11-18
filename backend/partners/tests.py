"""Tests for approved partner directory, nearby haversine search, and privacy."""

from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from partners.models import Partner, PartnerAvailability


class PartnerDirectoryApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            email="owner@demo.local",
            password="DemoPartner@2026!",
            full_name="Partner Owner",
            role=User.Role.PARTNER,
        )
        self.approved_near = Partner.objects.create(
            owner=self.owner,
            name="[DEMO] Indiranagar Pharmacy",
            category=Partner.Category.PHARMACY,
            address="100ft Road, Indiranagar",
            area="Indiranagar",
            city="Bengaluru",
            latitude=Decimal("12.978369"),
            longitude=Decimal("77.640836"),
            contact_phone="+91-80-0000-0001",
            verification_status=Partner.VerificationStatus.APPROVED,
            is_demo=True,
        )
        PartnerAvailability.objects.create(
            partner=self.approved_near, status=PartnerAvailability.Status.AVAILABLE
        )

        self.approved_far = Partner.objects.create(
            owner=self.owner,
            name="[DEMO] Whitefield Clinic",
            category=Partner.Category.HOSPITAL,
            address="ITPL Main Road",
            area="Whitefield",
            city="Bengaluru",
            latitude=Decimal("12.985042"),
            longitude=Decimal("77.736410"),
            contact_phone="+91-80-0000-0002",
            verification_status=Partner.VerificationStatus.APPROVED,
            is_demo=True,
        )
        PartnerAvailability.objects.create(
            partner=self.approved_far, status=PartnerAvailability.Status.BUSY
        )

        self.pending_partner = Partner.objects.create(
            owner=self.owner,
            name="[DEMO] Unapproved Corner Shop",
            category=Partner.Category.SHOP,
            address="HSR Layout",
            area="HSR",
            city="Bengaluru",
            latitude=Decimal("12.912118"),
            longitude=Decimal("77.644555"),
            contact_phone="+91-80-0000-0003",
            verification_status=Partner.VerificationStatus.PENDING,
            is_demo=True,
        )
        PartnerAvailability.objects.create(
            partner=self.pending_partner, status=PartnerAvailability.Status.AVAILABLE
        )

    def test_public_list_hides_pending_partners(self):
        res = self.client.get(reverse("partner-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [p["name"] for p in res.data["results"]]
        self.assertIn("[DEMO] Indiranagar Pharmacy", names)
        self.assertNotIn("[DEMO] Unapproved Corner Shop", names)

    def test_nearby_sorts_by_distance_and_filters_category_and_availability(self):
        url = reverse("partner-nearby")
        res = self.client.get(url, {"lat": "12.978", "lng": "77.640", "radius_km": "20"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["count"], 2)
        self.assertEqual(res.data["results"][0]["name"], "[DEMO] Indiranagar Pharmacy")
        self.assertLess(
            res.data["results"][0]["distance_km"],
            res.data["results"][1]["distance_km"],
        )

        avail = self.client.get(
            url, {"lat": "12.978", "lng": "77.640", "available_only": "true"}
        )
        self.assertEqual(avail.data["count"], 1)
        self.assertEqual(avail.data["results"][0]["category"], "PHARMACY")

    def test_pending_partner_detail_returns_404_for_public(self):
        res = self.client.get(
            reverse("partner-detail", kwargs={"pk": self.pending_partner.id})
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_partner_registration_admin_approval_and_availability_workflow(self):
        woman = User.objects.create_user(
            email="woman@demo.local",
            password="DemoWoman@2026!",
            full_name="Woman User",
            role=User.Role.WOMAN,
        )
        admin = User.objects.create_user(
            email="admin@demo.local",
            password="DemoAdmin@2026!",
            full_name="Admin User",
            role=User.Role.ADMIN,
            is_staff=True,
        )

        # Woman cannot register a partner establishment
        self.client.force_authenticate(user=woman)
        denied = self.client.post(
            reverse("partner-register"),
            {
                "name": "Unauthorized Shop",
                "category": "SHOP",
                "address": "Test Road",
                "latitude": "12.970000",
                "longitude": "77.600000",
                "contact_phone": "+91-80-1111-1111",
            },
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        # Partner registers a new establishment -> strictly PENDING
        self.client.force_authenticate(user=self.owner)
        reg = self.client.post(
            reverse("partner-register"),
            {
                "name": "[DEMO] Koramangala Safe Hotel",
                "category": "HOTEL",
                "address": "5th Block, Koramangala",
                "area": "Koramangala",
                "city": "Bengaluru",
                "latitude": "12.934500",
                "longitude": "77.619200",
                "contact_phone": "+91-80-2222-3333",
                "operating_hours": "24/7",
                "support_services": ["24/7 Reception", "CCTV lobby"],
            },
            format="json",
        )
        self.assertEqual(reg.status_code, status.HTTP_201_CREATED)
        partner_id = reg.data["id"]
        self.assertEqual(reg.data["verification_status"], "PENDING")

        # Pending partner cannot switch availability to AVAILABLE
        avail_denied = self.client.patch(
            reverse("partner-availability", kwargs={"pk": partner_id}),
            {"status": "AVAILABLE"},
            format="json",
        )
        self.assertEqual(avail_denied.status_code, status.HTTP_400_BAD_REQUEST)

        # Partner cannot self-approve via admin endpoint
        self_approve = self.client.post(
            reverse("admin-partner-review", kwargs={"pk": partner_id}),
            {"status": "APPROVED"},
            format="json",
        )
        self.assertEqual(self_approve.status_code, status.HTTP_403_FORBIDDEN)

        # Admin approves partner
        self.client.force_authenticate(user=admin)
        approved = self.client.post(
            reverse("admin-partner-review", kwargs={"pk": partner_id}),
            {"status": "APPROVED", "notes": "Verified location and reception desk."},
            format="json",
        )
        self.assertEqual(approved.status_code, status.HTTP_200_OK)
        self.assertEqual(approved.data["verification_status"], "APPROVED")
        self.assertEqual(approved.data["availability"]["status"], "AVAILABLE")

        # Now approved partner appears in public directory and can toggle BUSY
        self.client.force_authenticate(user=self.owner)
        busy = self.client.patch(
            reverse("partner-availability", kwargs={"pk": partner_id}),
            {"status": "BUSY", "status_note": "High lobby traffic"},
            format="json",
        )
        self.assertEqual(busy.status_code, status.HTTP_200_OK)
        self.assertEqual(busy.data["availability"]["status"], "BUSY")

        self.client.force_authenticate(user=None)
        public_list = self.client.get(reverse("partner-list"))
        ids = [item["id"] for item in public_list.data["results"]]
        self.assertIn(partner_id, ids)
