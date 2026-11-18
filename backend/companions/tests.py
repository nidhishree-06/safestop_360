"""Tests for companion verification gating, companion requests, and admin analytics."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User


class CompanionAndAdminAnalyticsApiTests(APITestCase):
    def setUp(self):
        self.applicant = User.objects.create_user(
            email="volunteer@demo.local",
            password="DemoWoman@2026!",
            full_name="Volunteer Divya",
            role=User.Role.WOMAN,
        )
        self.requester = User.objects.create_user(
            email="commuter@demo.local",
            password="DemoWoman@2026!",
            full_name="Commuter Ananya",
            role=User.Role.WOMAN,
        )
        self.admin = User.objects.create_user(
            email="admin.comp@demo.local",
            password="DemoAdmin@2026!",
            full_name="Admin User",
            role=User.Role.ADMIN,
            is_staff=True,
        )

    def test_companion_requires_admin_approval_before_visibility_and_requests(self):
        self.client.force_authenticate(user=self.applicant)
        reg = self.client.post(
            reverse("companion-register"),
            {
                "display_name": "[DEMO] Divya Companion",
                "bio": "Commute companion near Indiranagar.",
                "service_areas": ["Indiranagar", "MG Road"],
                "languages": ["English", "Kannada"],
            },
            format="json",
        )
        self.assertEqual(reg.status_code, status.HTTP_201_CREATED)
        comp_id = reg.data["id"]
        self.assertEqual(reg.data["verification_status"], "PENDING")

        # Cannot set available while pending
        avail_fail = self.client.patch(
            reverse("companion-availability"), {"is_available": True}, format="json"
        )
        self.assertEqual(avail_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Hidden from public list while pending
        self.client.force_authenticate(user=self.requester)
        listed = self.client.get(reverse("companion-list"))
        self.assertEqual(listed.data["count"], 0)

        # Admin approves companion
        self.client.force_authenticate(user=self.admin)
        approved = self.client.post(
            reverse("admin-companion-review", kwargs={"pk": comp_id}),
            {"status": "APPROVED"},
            format="json",
        )
        self.assertEqual(approved.status_code, status.HTTP_200_OK)

        # Companion toggles available
        self.client.force_authenticate(user=self.applicant)
        avail_ok = self.client.patch(
            reverse("companion-availability"), {"is_available": True}, format="json"
        )
        self.assertEqual(avail_ok.status_code, status.HTTP_200_OK)

        # Commuter requests approved companion -> companion accepts
        self.client.force_authenticate(user=self.requester)
        req_res = self.client.post(
            reverse("companion-request-list"),
            {
                "companion": comp_id,
                "pickup_area": "Indiranagar Metro",
                "destination_area": "100ft Road",
                "scheduled_for": (timezone.now() + timedelta(hours=2)).isoformat(),
                "note": "Evening walk back from metro",
            },
            format="json",
        )
        self.assertEqual(req_res.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.applicant)
        acc = self.client.post(
            reverse("companion-request-accept", kwargs={"pk": req_res.data["id"]}),
            {"response_note": "See you at Gate B!"},
            format="json",
        )
        self.assertEqual(acc.status_code, status.HTTP_200_OK)
        self.assertEqual(acc.data["status"], "ACCEPTED")

    def test_admin_analytics_role_restriction_and_payload(self):
        self.client.force_authenticate(user=self.requester)
        denied = self.client.get(reverse("admin-analytics"))
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        ok = self.client.get(reverse("admin-analytics"))
        self.assertEqual(ok.status_code, status.HTTP_200_OK)
        self.assertIn("counts", ok.data)
        self.assertIn("intelligence", ok.data)
        self.assertIn("audit_logs", ok.data)
