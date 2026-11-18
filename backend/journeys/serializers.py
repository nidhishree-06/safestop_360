"""Serializers for private Journey Watch and Trusted Contacts."""

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from journeys.models import Journey, JourneyCheckIn, TrustedContact


class TrustedContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrustedContact
        fields = [
            "id",
            "name",
            "relationship",
            "phone",
            "email",
            "notify_on_journey_start",
            "notify_on_missed_checkin",
            "notify_on_arrival",
            "is_primary",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class JourneyCheckInSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = JourneyCheckIn
        fields = [
            "id",
            "status",
            "status_display",
            "note",
            "latitude",
            "longitude",
            "created_at",
        ]
        read_only_fields = fields


class JourneySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    trusted_contacts = TrustedContactSerializer(many=True, read_only=True)
    checkins = JourneyCheckInSerializer(many=True, read_only=True)
    next_checkin_due_at = serializers.SerializerMethodField()
    is_checkin_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Journey
        fields = [
            "id",
            "origin_label",
            "destination_label",
            "destination_latitude",
            "destination_longitude",
            "expected_arrival_at",
            "checkin_interval_minutes",
            "status",
            "status_display",
            "location_sharing_enabled",
            "last_known_latitude",
            "last_known_longitude",
            "last_checkin_at",
            "completed_at",
            "next_checkin_due_at",
            "is_checkin_overdue",
            "trusted_contacts",
            "checkins",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def _compute_next_due(self, obj: Journey):
        if obj.status not in (Journey.Status.ACTIVE, Journey.Status.OVERDUE):
            return None
        anchor = obj.last_checkin_at or obj.created_at
        interval_due = anchor + timedelta(minutes=obj.checkin_interval_minutes)
        return min(interval_due, obj.expected_arrival_at)

    def get_next_checkin_due_at(self, obj: Journey):
        return self._compute_next_due(obj)

    def get_is_checkin_overdue(self, obj: Journey) -> bool:
        due = self._compute_next_due(obj)
        if not due:
            return False
        return timezone.now() > due


class JourneyCreateSerializer(serializers.Serializer):
    origin_label = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    destination_label = serializers.CharField(max_length=200, min_length=2)
    expected_arrival_at = serializers.DateTimeField()
    checkin_interval_minutes = serializers.IntegerField(min_value=5, max_value=180, default=15)
    location_sharing_enabled = serializers.BooleanField(default=False)
    trusted_contact_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )

    def validate_expected_arrival_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError("Expected arrival time must be in the future.")
        return value

    def validate_trusted_contact_ids(self, ids):
        user = self.context["request"].user
        if not ids:
            return []
        owned = list(TrustedContact.objects.filter(owner=user, id__in=ids))
        if len(owned) != len(set(ids)):
            raise serializers.ValidationError(
                "One or more selected trusted contacts do not belong to your account."
            )
        return owned


class JourneyCheckInCreateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[JourneyCheckIn.CheckInStatus.SAFE, JourneyCheckIn.CheckInStatus.DELAYED],
        default=JourneyCheckIn.CheckInStatus.SAFE,
    )
    note = serializers.CharField(max_length=240, required=False, allow_blank=True, default="")
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
