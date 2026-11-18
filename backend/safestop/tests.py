"""Phase 2 core platform, schema, health-check, and state-machine tests."""

from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from accounts.models import User, UserProfile
from assistance.models import HelpRequest
from partners.models import Partner, PartnerAvailability, haversine_km


class Phase2FoundationTests(TestCase):
    def setUp(self):
        self.woman = User.objects.create_user(
            email="woman.test@example.com",
            password="StrongPassword!2026",
            full_name="Test Woman",
            role=User.Role.WOMAN,
        )
        UserProfile.objects.create(user=self.woman, city="Bengaluru")
        self.partner_user = User.objects.create_user(
            email="partner.test@example.com",
            password="StrongPassword!2026",
            full_name="Test Partner",
            role=User.Role.PARTNER,
        )
        self.partner = Partner.objects.create(
            owner=self.partner_user,
            name="[DEMO] Test Safe Pharmacy",
            category=Partner.Category.PHARMACY,
            address="Indiranagar, Bengaluru",
            city="Bengaluru",
            latitude=Decimal("12.978369"),
            longitude=Decimal("77.640836"),
            contact_phone="+91-80-0000-0000",
            verification_status=Partner.VerificationStatus.APPROVED,
            is_demo=True,
        )
        PartnerAvailability.objects.create(
            partner=self.partner,
            status=PartnerAvailability.Status.AVAILABLE,
        )

    def test_health_check_endpoint(self):
        response = self.client.get(reverse("api-health"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertTrue(data["database"]["connected"])
        self.assertEqual(data["emergency_helplines_india"]["emergency"], "112")
        self.assertEqual(data["emergency_helplines_india"]["women_helpline"], "181")

    def test_password_is_hashed_not_plaintext(self):
        self.assertNotEqual(self.woman.password, "StrongPassword!2026")
        self.assertTrue(self.woman.check_password("StrongPassword!2026"))

    def test_help_request_valid_and_invalid_transitions(self):
        req = HelpRequest.objects.create(
            requester=self.woman,
            partner=self.partner,
            note="Need a well-lit place to wait for my cab.",
        )
        self.assertEqual(req.status, HelpRequest.Status.PENDING)

        # Invalid shortcut PENDING -> CLOSED must be rejected
        with self.assertRaises(ValidationError):
            req.transition_to(HelpRequest.Status.CLOSED)

        # Valid lifecycle PENDING -> ACCEPTED -> ARRIVED -> CLOSED
        req.transition_to(HelpRequest.Status.ACCEPTED, response_note="Front desk ready.")
        self.assertEqual(req.status, HelpRequest.Status.ACCEPTED)
        self.assertIsNotNone(req.accepted_at)

        req.transition_to(HelpRequest.Status.ARRIVED)
        self.assertEqual(req.status, HelpRequest.Status.ARRIVED)
        self.assertIsNotNone(req.arrived_at)

        req.transition_to(HelpRequest.Status.CLOSED)
        self.assertEqual(req.status, HelpRequest.Status.CLOSED)
        self.assertIsNotNone(req.closed_at)

        # Terminal state cannot transition further
        with self.assertRaises(ValidationError):
            req.transition_to(HelpRequest.Status.CANCELLED)

    def test_haversine_distance_bengaluru(self):
        # Indiranagar to MG Road is roughly 3.7 km
        dist = haversine_km(12.978369, 77.640836, 12.975596, 77.606612)
        self.assertGreater(dist, 3.0)
        self.assertLess(dist, 4.5)
