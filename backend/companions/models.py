"""Companion support foundation models (admin verification strictly required)."""

import uuid

from django.conf import settings
from django.db import models


class Companion(models.Model):
    """Registered companion; must be APPROVED by an administrator before appearing as verified."""

    class VerificationStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Verification"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"
        SUSPENDED = "SUSPENDED", "Suspended"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="companion_profile",
    )
    display_name = models.CharField(max_length=120)
    bio = models.TextField(blank=True)
    service_areas = models.JSONField(
        default=list,
        blank=True,
        help_text="List of Bengaluru neighbourhoods served.",
    )
    languages = models.JSONField(default=list, blank=True)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        db_index=True,
    )
    is_available = models.BooleanField(default=False, db_index=True)
    is_demo = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True for clearly labelled demo companions in local development.",
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_companions",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_available", "display_name"]

    def __str__(self) -> str:
        prefix = "[DEMO] " if self.is_demo and not self.display_name.startswith("[DEMO]") else ""
        return f"{prefix}{self.display_name} ({self.verification_status})"


class CompanionRequest(models.Model):
    """Request for an approved companion to accompany a user between two areas."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        DECLINED = "DECLINED", "Declined"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="companion_requests",
    )
    companion = models.ForeignKey(
        Companion,
        on_delete=models.CASCADE,
        related_name="requests",
    )
    pickup_area = models.CharField(max_length=180)
    destination_area = models.CharField(max_length=180)
    scheduled_for = models.DateTimeField()
    note = models.CharField(max_length=280, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    response_note = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"CompanionRequest<{self.id}> {self.status}"
