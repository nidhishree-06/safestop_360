"""Authentication, profile, role restriction, and token lifecycle tests."""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import AuditLog, User


class AuthenticationApiTests(APITestCase):
    def test_register_woman_and_login_flow(self):
        register_url = reverse("auth-register")
        payload = {
            "email": "priya@example.com",
            "password": "SafeStop#2026Strong",
            "full_name": "Priya Menon",
            "role": "WOMAN",
            "phone": "+91-9876543210",
            "city": "Bengaluru",
        }
        res = self.client.post(register_url, payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["user"]["role"], "WOMAN")
        self.assertIn("access", res.data["tokens"])
        self.assertIn("refresh", res.data["tokens"])
        self.assertTrue(
            AuditLog.objects.filter(action="USER_REGISTERED").exists()
        )

        # Duplicate email rejected
        dup = self.client.post(register_url, payload, format="json")
        self.assertEqual(dup.status_code, status.HTTP_400_BAD_REQUEST)

        # Login succeeds with case-insensitive email
        login_res = self.client.post(
            reverse("auth-login"),
            {"email": "PRIYA@example.com", "password": "SafeStop#2026Strong"},
            format="json",
        )
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        access = login_res.data["tokens"]["access"]
        refresh = login_res.data["tokens"]["refresh"]

        # Protected /me endpoint works with Bearer token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        me_res = self.client.get(reverse("auth-me"))
        self.assertEqual(me_res.status_code, status.HTTP_200_OK)
        self.assertEqual(me_res.data["email"], "priya@example.com")

        # Profile update
        patch_res = self.client.patch(
            reverse("auth-me"),
            {"city": "Mysuru", "emergency_note": "Prefer well-lit front lobby"},
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data["profile"]["city"], "Mysuru")

        # Logout blacklists refresh token
        logout_res = self.client.post(
            reverse("auth-logout"), {"refresh": refresh}, format="json"
        )
        self.assertEqual(logout_res.status_code, status.HTTP_200_OK)

        refresh_after = self.client.post(
            reverse("auth-token-refresh"), {"refresh": refresh}, format="json"
        )
        self.assertEqual(refresh_after.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cannot_self_register_as_admin(self):
        res = self.client.post(
            reverse("auth-register"),
            {
                "email": "attacker@example.com",
                "password": "SafeStop#2026Strong",
                "full_name": "Unauthorized Admin",
                "role": "ADMIN",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="attacker@example.com").exists())

    def test_weak_password_rejected(self):
        res = self.client.post(
            reverse("auth-register"),
            {
                "email": "weak@example.com",
                "password": "password123",
                "full_name": "Weak Pass",
                "role": "WOMAN",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_requires_authentication(self):
        res = self.client.get(reverse("auth-me"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password(self):
        user = User.objects.create_user(
            email="change@example.com",
            password="InitialPassword#2026",
            full_name="Change User",
            role=User.Role.PARTNER,
        )
        login_res = self.client.post(
            reverse("auth-login"),
            {"email": "change@example.com", "password": "InitialPassword#2026"},
            format="json",
        )
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {login_res.data['tokens']['access']}"
        )
        res = self.client.post(
            reverse("auth-change-password"),
            {
                "current_password": "InitialPassword#2026",
                "new_password": "UpdatedPassword#2026!",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password("UpdatedPassword#2026!"))
