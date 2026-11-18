"""Assistance Confirmation Loop models with strict status transitions."""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone


class HelpRequest(models.Model):
    """Closed-loop assistance request between a woman and an approved partner."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        DECLINED = "DECLINED", "Declined"
        EXPIRED = "EXPIRED", "Expired"
        ARRIVED = "ARRIVED", "Arrived"
        CLOSED = "CLOSED", "Closed"
        CANCELLED = "CANCELLED", "Cancelled"

    ALLOWED_TRANSITIONS: dict[str, set[str]] = {
        Status.PENDING: {
            Status.ACCEPTED,
            Status.DECLINED,
            Status.EXPIRED,
            Status.CANCELLED,
        },
        Status.ACCEPTED: {
            Status.ARRIVED,
            Status.CANCELLED,
            Status.EXPIRED,
        },
        Status.ARRIVED: {
            Status.CLOSED,
        },
        Status.DECLINED: set(),
        Status.EXPIRED: set(),
        Status.CLOSED: set(),
        Status.CANCELLED: set(),
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="help_requests",
    )
    partner = models.ForeignKey(
        "partners.Partner",
        on_delete=models.CASCADE,
        related_name="help_requests",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    note = models.CharField(max_length=320, blank=True)
    partner_response_note = models.CharField(max_length=320, blank=True)
    # Opt-in approximate origin shared ONLY with the assigned partner during an active request
    requester_latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    requester_longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    estimated_arrival_minutes = models.PositiveSmallIntegerField(null=True, blank=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    arrived_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["partner", "status", "-created_at"]),
            models.Index(fields=["requester", "status", "-created_at"]),
        ]

    def can_transition_to(self, next_status: str) -> bool:
        return next_status in self.ALLOWED_TRANSITIONS.get(self.status, set())

    def transition_to(self, next_status: str, response_note: str | None = None) -> None:
        if not self.can_transition_to(next_status):
            raise ValidationError(
                f"Invalid assistance status transition: {self.status} -> {next_status}."
            )
        now = timezone.now()
        self.status = next_status
        if response_note is not None:
            self.partner_response_note = response_note
        if next_status == self.Status.ACCEPTED:
            self.accepted_at = now
        elif next_status == self.Status.ARRIVED:
            self.arrived_at = now
        elif next_status == self.Status.CLOSED:
            self.closed_at = now
        self.save()

    def __str__(self) -> str:
        return f"HelpRequest<{self.id}> {self.status}"


class HelpRequestFeedback(models.Model):
    """Optional post-completion feedback from the user."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    help_request = models.OneToOneField(
        HelpRequest, on_delete=models.CASCADE, related_name="feedback"
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    felt_safe = models.BooleanField(default=True)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Feedback<{self.help_request_id}> ({self.rating}/5)"
