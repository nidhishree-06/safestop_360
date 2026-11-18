"""Tests for Community Safety Reports, reporter anonymity, moderation, and rule-based AI."""

from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from reports.models import SafetyReport


class SafetyReportsAndIntelligenceApiTests(APITestCase):
    def setUp(self):
        self.woman = User.objects.create_user(
            email="reporter@demo.local",
            password="DemoWoman@2026!",
            full_name="Private Reporter",
            role=User.Role.WOMAN,
        )
        self.admin = User.objects.create_user(
            email="admin.rep@demo.local",
            password="DemoAdmin@2026!",
            full_name="Report Admin",
            role=User.Role.ADMIN,
            is_staff=True,
        )

    def test_submit_anonymous_report_clustering_and_admin_review(self):
        self.client.force_authenticate(user=self.woman)

        # Submit two nearby reports within 500m
        r1 = self.client.post(
            reverse("safety-report-list-create"),
            {
                "category": "POOR_LIGHTING",
                "description": "Streetlamps are broken and the metro footpath is completely dark.",
                "area_label": "Indiranagar Metro Lane",
                "city": "Bengaluru",
                "latitude": "12.978500",
                "longitude": "77.639200",
            },
            format="json",
        )
        self.assertEqual(r1.status_code, status.HTTP_201_CREATED)
        self.assertTrue(r1.data["is_unreviewed"])
        self.assertNotIn("reporter", r1.data)
        self.assertNotIn("reporter@demo.local", str(r1.data))
        self.assertIn("lighting", r1.data["ai_classification"]["matched_themes"])

        r2 = self.client.post(
            reverse("safety-report-list-create"),
            {
                "category": "POOR_LIGHTING",
                "description": "Second unlit dark stretch right beside Indiranagar metro exit.",
                "area_label": "Indiranagar Metro Exit",
                "city": "Bengaluru",
                "latitude": "12.978700",
                "longitude": "77.639400",
            },
            format="json",
        )
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)

        # Intelligence detects repeated cluster and includes transparency disclaimer
        intel = self.client.get(reverse("safety-report-intelligence"))
        self.assertEqual(intel.status_code, status.HTTP_200_OK)
        self.assertEqual(len(intel.data["repeated_report_clusters"]), 1)
        self.assertEqual(intel.data["repeated_report_clusters"][0]["report_count"], 2)
        self.assertIn("does NOT guarantee", intel.data["methodology_and_limitations"])

        # Woman cannot moderate reports
        denied = self.client.patch(
            reverse("admin-report-review", kwargs={"pk": r1.data["id"]}),
            {"review_status": "REVIEWED"},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        # Admin reviews report
        self.client.force_authenticate(user=self.admin)
        reviewed = self.client.patch(
            reverse("admin-report-review", kwargs={"pk": r1.data["id"]}),
            {"review_status": "REVIEWED", "admin_notes": "Logged for civic lighting escalation."},
            format="json",
        )
        self.assertEqual(reviewed.status_code, status.HTTP_200_OK)
        self.assertEqual(reviewed.data["review_status"], SafetyReport.ReviewStatus.REVIEWED)
        self.assertFalse(reviewed.data["is_unreviewed"])
