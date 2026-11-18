"""Private Journey Watch, Trusted Contacts, and short-lived LocationPing models."""

import secrets
import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q


def generate_share_token() -> str:
    return secrets.token_urlsafe(32)


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
        MISSED = "MISSED", "Missed Check-In"
        OVERDUE = "OVERDUE", "Overdue"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

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
    expected_checkin_at = models.DateTimeField(null=True, blank=True)
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
    share_token = models.CharField(
        max_length=64,
        unique=True,
        null=True,
        blank=True,
        default=generate_share_token,
        db_index=True,
    )
    share_token_revoked = models.BooleanField(default=False)
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

    @property
    def is_active_session(self) -> bool:
        return self.status in (self.Status.ACTIVE, self.Status.MISSED, self.Status.OVERDUE)

    @property
    def is_share_link_valid(self) -> bool:
        return self.is_active_session and not self.share_token_revoked

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


class LocationPing(models.Model):
    """Short-lived GPS ping scoped to either an active Journey or an active HelpRequest.

    Deleted automatically when the journey or help request ends, or when the user
    stops sharing / deletes their location data.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="location_pings",
    )
    journey = models.ForeignKey(
        Journey,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="location_pings",
    )
    help_request = models.ForeignKey(
        "assistance.HelpRequest",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="location_pings",
    )
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
    accuracy_m = models.FloatField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(50000)],
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["journey", "-created_at"]),
            models.Index(fields=["help_request", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(journey__isnull=False) | Q(help_request__isnull=False),
                name="location_ping_scoped_to_journey_or_request",
            )
        ]

    def __str__(self) -> str:
        scope = f"journey={self.journey_id}" if self.journey_id else f"request={self.help_request_id}"
        return f"LocationPing<{self.id}> ({scope})"
