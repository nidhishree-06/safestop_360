"""Serializers for verified companions and companion requests."""

from django.utils import timezone
from rest_framework import serializers

from companions.models import Companion, CompanionRequest


class CompanionSerializer(serializers.ModelSerializer):
    verification_status_display = serializers.CharField(
        source="get_verification_status_display", read_only=True
    )
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = Companion
        fields = [
            "id",
            "user",
            "user_email",
            "display_name",
            "bio",
            "service_areas",
            "languages",
            "verification_status",
            "verification_status_display",
            "is_available",
            "is_demo",
            "verified_at",
            "created_at",
        ]
        read_only_fields = fields


class CompanionRegisterSerializer(serializers.ModelSerializer):
    service_areas = serializers.ListField(
        child=serializers.CharField(max_length=80), min_length=1
    )
    languages = serializers.ListField(
        child=serializers.CharField(max_length=50), required=False, default=list
    )

    class Meta:
        model = Companion
        fields = ["display_name", "bio", "service_areas", "languages"]

    def validate_service_areas(self, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if not cleaned:
            raise serializers.ValidationError("Specify at least one service area.")
        return cleaned[:10]

    def validate_languages(self, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item.strip()][:8]


class CompanionRequestSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.full_name", read_only=True)
    companion_name = serializers.CharField(source="companion.display_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CompanionRequest
        fields = [
            "id",
            "requester",
            "requester_name",
            "companion",
            "companion_name",
            "pickup_area",
            "destination_area",
            "scheduled_for",
            "note",
            "status",
            "status_display",
            "response_note",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CompanionRequestCreateSerializer(serializers.Serializer):
    companion = serializers.PrimaryKeyRelatedField(queryset=Companion.objects.all())
    pickup_area = serializers.CharField(max_length=180, min_length=2)
    destination_area = serializers.CharField(max_length=180, min_length=2)
    scheduled_for = serializers.DateTimeField()
    note = serializers.CharField(max_length=280, required=False, allow_blank=True, default="")

    def validate_companion(self, companion: Companion) -> Companion:
        if companion.verification_status != Companion.VerificationStatus.APPROVED:
            raise serializers.ValidationError(
                "Only administrator-verified companions can receive requests."
            )
        if not companion.is_available:
            raise serializers.ValidationError("This companion is currently unavailable.")
        return companion

    def validate_scheduled_for(self, value):
        if value < timezone.now():
            raise serializers.ValidationError("Scheduled time must be in the future.")
        return value


class AdminCompanionReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            Companion.VerificationStatus.APPROVED,
            Companion.VerificationStatus.REJECTED,
            Companion.VerificationStatus.SUSPENDED,
        ]
    )
