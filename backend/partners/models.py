"""Partner establishments, administrative verification, and availability models."""

import math
import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance between two WGS84 coordinates in kilometres."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class Partner(models.Model):
    """A verified (or pending-approval) establishment offering safe assistance."""

    class Category(models.TextChoices):
        PHARMACY = "PHARMACY", "Pharmacy"
        HOSPITAL = "HOSPITAL", "Hospital"
        PETROL_STATION = "PETROL_STATION", "Petrol Station"
        SHOP = "SHOP", "Shop"
        HOTEL = "HOTEL", "Hotel"
        COLLEGE_FACILITY = "COLLEGE_FACILITY", "College Facility"
        OTHER = "OTHER", "Other Approved Establishment"

    class VerificationStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        SUSPENDED = "SUSPENDED", "Suspended"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="partners",
    )
    name = models.CharField(max_length=180)
    category = models.CharField(
        max_length=32, choices=Category.choices, db_index=True
    )
    description = models.TextField(blank=True)
    address = models.CharField(max_length=255)
    area = models.CharField(max_length=120, blank=True)
    city = models.CharField(max_length=100, default="Bengaluru", db_index=True)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    contact_phone = models.CharField(max_length=24)
    operating_hours = models.CharField(max_length=120, default="24/7")
    support_services = models.JSONField(
        default=list,
        blank=True,
        help_text="e.g. ['Safe waiting area', 'Phone charging', 'Staff escort to transport']",
    )
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        db_index=True,
    )
    is_demo = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True for clearly labelled local/prototype demo establishments.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["verification_status", "category"]),
            models.Index(fields=["latitude", "longitude"]),
        ]

    def __str__(self) -> str:
        prefix = "[DEMO] " if self.is_demo and not self.name.startswith("[DEMO]") else ""
        return f"{prefix}{self.name} ({self.verification_status})"


class PartnerVerification(models.Model):
    """Audit record for each administrative verification decision on a Partner."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partner = models.ForeignKey(
        Partner, on_delete=models.CASCADE, related_name="verifications"
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="partner_reviews",
    )
    status = models.CharField(
        max_length=20, choices=Partner.VerificationStatus.choices
    )
    notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-reviewed_at"]

    def __str__(self) -> str:
        return f"{self.partner.name} -> {self.status}"


class PartnerAvailability(models.Model):
    """Real-time operational availability status controlled by the partner."""

    class Status(models.TextChoices):
        AVAILABLE = "AVAILABLE", "Available"
        BUSY = "BUSY", "Busy"
        OFFLINE = "OFFLINE", "Offline"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    partner = models.OneToOneField(
        Partner, on_delete=models.CASCADE, related_name="availability"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
        db_index=True,
    )
    status_note = models.CharField(max_length=180, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.partner.name}: {self.status}"
