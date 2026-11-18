"""Tests for private Journey Watch, opt-in sharing revocation, and Trusted Contacts."""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User


class JourneyWatchAndContactsApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="traveler@demo.local",
            password="DemoWoman@2026!",
            full_name="Ananya Traveler",
            role=User.Role.WOMAN,
        )
        self.other_user = User.objects.create_user(
            email="other.traveler@demo.local",
            password="DemoWoman@2026!",
            full_name="Other Traveler",
            role=User.Role.WOMAN,
        )

    def test_contacts_crud_and_private_journey_lifecycle(self):
        self.client.force_authenticate(user=self.user)

        # Create Trusted Contact
        c_res = self.client.post(
            reverse("trusted-contact-list"),
            {
                "name": "Meera Sister",
                "relationship": "Sister",
                "phone": "+91-90000-11111",
                "is_primary": True,
            },
            format="json",
        )
        self.assertEqual(c_res.status_code, status.HTTP_201_CREATED)
        contact_id = c_res.data["id"]

        # Update Trusted Contact
        upd = self.client.patch(
            reverse("trusted-contact-detail", kwargs={"pk": contact_id}),
            {"notify_on_missed_checkin": True, "relationship": "Elder Sister"},
            format="json",
        )
        self.assertEqual(upd.status_code, status.HTTP_200_OK)
        self.assertEqual(upd.data["relationship"], "Elder Sister")

        # Start Journey Watch with opt-in location sharing
        eta = (timezone.now() + timedelta(minutes=45)).isoformat()
        j_res = self.client.post(
            reverse("journey-list-create"),
            {
                "origin_label": "Indiranagar Metro",
                "destination_label": "Koramangala 4th Block",
                "expected_arrival_at": eta,
                "checkin_interval_minutes": 15,
                "location_sharing_enabled": True,
                "trusted_contact_ids": [contact_id],
            },
            format="json",
        )
        self.assertEqual(j_res.status_code, status.HTTP_201_CREATED)
        journey_id = j_res.data["id"]
        self.assertTrue(j_res.data["location_sharing_enabled"])

        # Another user CANNOT view private journey
        self.client.force_authenticate(user=self.other_user)
        private_check = self.client.get(
            reverse("journey-detail", kwargs={"pk": journey_id})
        )
        self.assertEqual(private_check.status_code, status.HTTP_404_NOT_FOUND)

        # Owner checks in with opt-in coordinates
        self.client.force_authenticate(user=self.user)
        ci = self.client.post(
            reverse("journey-checkin", kwargs={"pk": journey_id}),
            {
                "status": "SAFE",
                "note": "Boarded metro",
                "latitude": "12.978000",
                "longitude": "77.640000",
            },
            format="json",
        )
        self.assertEqual(ci.status_code, status.HTTP_200_OK)
        self.assertEqual(str(ci.data["last_known_latitude"]), "12.978000")

        # Owner revokes location sharing immediately
        stop = self.client.post(
            reverse("journey-stop-sharing", kwargs={"pk": journey_id}),
            {"end_journey": False},
            format="json",
        )
        self.assertEqual(stop.status_code, status.HTTP_200_OK)
        self.assertFalse(stop.data["location_sharing_enabled"])
        self.assertIsNone(stop.data["last_known_latitude"])

        # Complete Journey
        done = self.client.post(
            reverse("journey-complete", kwargs={"pk": journey_id})
        )
        self.assertEqual(done.status_code, status.HTTP_200_OK)
        self.assertEqual(done.data["status"], "COMPLETED")
