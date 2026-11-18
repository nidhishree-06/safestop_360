"""End-to-end API tests for the Assistance Confirmation Loop."""

from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from partners.models import Partner, PartnerAvailability


class AssistanceConfirmationLoopApiTests(APITestCase):
    def setUp(self):
        self.woman = User.objects.create_user(
            email="woman.loop@demo.local",
            password="DemoWoman@2026!",
            full_name="Ananya Loop",
            role=User.Role.WOMAN,
        )
        self.other_woman = User.objects.create_user(
            email="other.woman@demo.local",
            password="DemoWoman@2026!",
            full_name="Other Woman",
            role=User.Role.WOMAN,
        )
        self.partner_user = User.objects.create_user(
            email="partner.loop@demo.local",
            password="DemoPartner@2026!",
            full_name="Partner Staff",
            role=User.Role.PARTNER,
        )
        self.approved_partner = Partner.objects.create(
            owner=self.partner_user,
            name="[DEMO] Loop Care Pharmacy",
            category=Partner.Category.PHARMACY,
            address="100ft Road, Indiranagar",
            area="Indiranagar",
            city="Bengaluru",
            latitude=Decimal("12.978369"),
            longitude=Decimal("77.640836"),
            contact_phone="+91-80-0000-1111",
            verification_status=Partner.VerificationStatus.APPROVED,
            is_demo=True,
        )
        PartnerAvailability.objects.create(
            partner=self.approved_partner, status=PartnerAvailability.Status.AVAILABLE
        )
        self.pending_partner = Partner.objects.create(
            owner=self.partner_user,
            name="[DEMO] Pending Shop",
            category=Partner.Category.SHOP,
            address="HSR",
            latitude=Decimal("12.912000"),
            longitude=Decimal("77.644000"),
            contact_phone="+91-80-0000-2222",
            verification_status=Partner.VerificationStatus.PENDING,
            is_demo=True,
        )
        PartnerAvailability.objects.create(
            partner=self.pending_partner, status=PartnerAvailability.Status.OFFLINE
        )

    def test_full_closed_loop_and_access_controls(self):
        self.client.force_authenticate(user=self.woman)

        # Cannot request from unapproved partner
        bad = self.client.post(
            reverse("help-request-list-create"),
            {"partner": str(self.pending_partner.id), "note": "Need help"},
            format="json",
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        # 1. Woman sends help request -> PENDING
        created = self.client.post(
            reverse("help-request-list-create"),
            {
                "partner": str(self.approved_partner.id),
                "note": "Waiting for my cab, street is dimly lit.",
                "estimated_arrival_minutes": 5,
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        req_id = created.data["id"]
        self.assertEqual(created.data["status"], "PENDING")

        # Woman cannot accept her own request
        self_accept = self.client.post(
            reverse("help-request-accept", kwargs={"pk": req_id})
        )
        self.assertEqual(self_accept.status_code, status.HTTP_403_FORBIDDEN)

        # Unrelated user cannot view this private request
        self.client.force_authenticate(user=self.other_woman)
        other_view = self.client.get(
            reverse("help-request-detail", kwargs={"pk": req_id})
        )
        self.assertEqual(other_view.status_code, status.HTTP_404_NOT_FOUND)

        # 2. Partner sees request and accepts -> ACCEPTED
        self.client.force_authenticate(user=self.partner_user)
        queue = self.client.get(reverse("help-request-list-create"))
        self.assertEqual(queue.data["count"], 1)

        # Invalid shortcut PENDING -> CLOSED rejected
        shortcut = self.client.post(
            reverse("help-request-close", kwargs={"pk": req_id})
        )
        self.assertEqual(shortcut.status_code, status.HTTP_400_BAD_REQUEST)

        accepted = self.client.post(
            reverse("help-request-accept", kwargs={"pk": req_id}),
            {"response_note": "Front counter staff ready at the main entrance."},
            format="json",
        )
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        self.assertEqual(accepted.data["status"], "ACCEPTED")
        self.assertIn("Front counter", accepted.data["partner_response_note"])

        # 3. Woman confirms arrival -> ARRIVED
        self.client.force_authenticate(user=self.woman)
        arrived = self.client.post(
            reverse("help-request-arrived", kwargs={"pk": req_id})
        )
        self.assertEqual(arrived.status_code, status.HTTP_200_OK)
        self.assertEqual(arrived.data["status"], "ARRIVED")

        # 4. Partner closes completed request -> CLOSED
        self.client.force_authenticate(user=self.partner_user)
        closed = self.client.post(
            reverse("help-request-close", kwargs={"pk": req_id}),
            {"response_note": "Boarded verified cab safely."},
            format="json",
        )
        self.assertEqual(closed.status_code, status.HTTP_200_OK)
        self.assertEqual(closed.data["status"], "CLOSED")

        # 5. Woman leaves optional feedback
        self.client.force_authenticate(user=self.woman)
        fb = self.client.post(
            reverse("help-request-feedback", kwargs={"pk": req_id}),
            {"rating": 5, "felt_safe": True, "comment": "Very calm and supportive staff."},
            format="json",
        )
        self.assertEqual(fb.status_code, status.HTTP_201_CREATED)
        self.assertEqual(fb.data["rating"], 5)
