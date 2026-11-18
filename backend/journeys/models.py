"""Private Journey Watch and Trusted Contacts models."""

import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class TrustedContact(models.Model):
    """User-managed trusted contact for optional journey check-in alerts."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trusted_contacts",
    )
    name = models.CharField(max_length=120)
    relationship = models.CharField(max_length=80, blank=True)
    phone = models.CharField(max_length=24)
    email = models.EmailField(blank=True)
    notify_on_journey_start = models.BooleanField(default=True)
    notify_on_missed_checkin = models.BooleanField(default=True)
    notify_on_arrival = models.BooleanField(default=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_primary", "name"]
        indexes = [
            models.Index(fields=["owner", "-is_primary"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.owner.email})"


class Journey(models.Model):
    """Private opt-in Journey Watch session. Never exposed on public maps."""

    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        OVERDUE = "OVERDUE", "Missed Check-In"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Ended Early"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="journeys",
    )
    origin_label = models.CharField(max_length=200, blank=True)
    destination_label = models.CharField(max_length=200)
    destination_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    destination_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    expected_arrival_at = models.DateTimeField()
    checkin_interval_minutes = models.PositiveSmallIntegerField(
        default=15,
        validators=[MinValueValidator(5), MaxValueValidator(180)],
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    # Strictly opt-in; user can revoke at any moment
    location_sharing_enabled = models.BooleanField(default=False)
    last_known_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    last_known_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    last_checkin_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    trusted_contacts = models.ManyToManyField(
        TrustedContact, blank=True, related_name="journeys"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["owner", "status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"Journey to {self.destination_label} ({self.status})"


class JourneyCheckIn(models.Model):
    """Individual check-in event during an active Journey Watch."""

    class CheckInStatus(models.TextChoices):
        SAFE = "SAFE", "Checked In Safe"
        DELAYED = "DELAYED", "Running Late"
        ARRIVED = "ARRIVED", "Arrived Safely"
        MISSED_REMINDER = "MISSED_REMINDER", "Missed Check-In Reminder"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    journey = models.ForeignKey(
        Journey, on_delete=models.CASCADE, related_name="checkins"
    )
    status = models.CharField(
        max_length=24, choices=CheckInStatus.choices, default=CheckInStatus.SAFE
    )
    note = models.CharField(max_length=240, blank=True)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"CheckIn<{self.journey_id}> {self.status}"
