"""Community Safety Reports models (reporter identity is never exposed publicly)."""

import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class SafetyReport(models.Model):
    """Structured community safety report reviewed by administrators."""

    class Category(models.TextChoices):
        POOR_LIGHTING = "POOR_LIGHTING", "Poor Lighting"
        HARASSMENT = "HARASSMENT", "Harassment"
        ISOLATED_AREA = "ISOLATED_AREA", "Isolated Area"
        UNSAFE_INFRASTRUCTURE = (
            "UNSAFE_INFRASTRUCTURE",
            "Unsafe Public Infrastructure",
        )
        OTHER = "OTHER", "Other"

    class ReviewStatus(models.TextChoices):
        UNREVIEWED = "UNREVIEWED", "Unreviewed"
        UNDER_REVIEW = "UNDER_REVIEW", "Under Review"
        REVIEWED = "REVIEWED", "Reviewed"
        DISMISSED = "DISMISSED", "Dismissed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="safety_reports",
    )
    category = models.CharField(
        max_length=32, choices=Category.choices, db_index=True
    )
    description = models.TextField()
    area_label = models.CharField(max_length=180)
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
    incident_time = models.DateTimeField(null=True, blank=True)
    review_status = models.CharField(
        max_length=20,
        choices=ReviewStatus.choices,
        default=ReviewStatus.UNREVIEWED,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_reports",
    )
    admin_notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    is_demo = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["review_status", "category"]),
            models.Index(fields=["latitude", "longitude"]),
        ]

    def __str__(self) -> str:
        return f"{self.category} @ {self.area_label} ({self.review_status})"
