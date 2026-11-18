"""Serializers for the Assistance Confirmation Loop, consent-based live location, and feedback."""

from rest_framework import serializers

from assistance.models import HelpRequest, HelpRequestFeedback
from journeys.models import LocationPing
from partners.models import Partner, PartnerAvailability


class HelpRequestFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = HelpRequestFeedback
        fields = ["id", "rating", "felt_safe", "comment", "created_at"]
        read_only_fields = ["id", "created_at"]


class HelpRequestSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.full_name", read_only=True)
    partner_name = serializers.CharField(source="partner.name", read_only=True)
    partner_category = serializers.CharField(
        source="partner.get_category_display", read_only=True
    )
    partner_address = serializers.CharField(source="partner.address", read_only=True)
    partner_area = serializers.CharField(source="partner.area", read_only=True)
    partner_phone = serializers.CharField(source="partner.contact_phone", read_only=True)
    partner_hours = serializers.CharField(source="partner.operating_hours", read_only=True)
    partner_latitude = serializers.DecimalField(
        source="partner.latitude", max_digits=9, decimal_places=6, read_only=True
    )
    partner_longitude = serializers.DecimalField(
        source="partner.longitude", max_digits=9, decimal_places=6, read_only=True
    )
    partner_is_demo = serializers.BooleanField(source="partner.is_demo", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    feedback = HelpRequestFeedbackSerializer(read_only=True)
    latest_location = serializers.SerializerMethodField()
    location_sharing_status = serializers.SerializerMethodField()

    class Meta:
        model = HelpRequest
        fields = [
            "id",
            "requester",
            "requester_name",
            "partner",
            "partner_name",
            "partner_category",
            "partner_address",
            "partner_area",
            "partner_phone",
            "partner_hours",
            "partner_latitude",
            "partner_longitude",
            "partner_is_demo",
            "status",
            "status_display",
            "note",
            "partner_response_note",
            "share_live_location",
            "location_sharing_status",
            "latest_location",
            "requester_latitude",
            "requester_longitude",
            "estimated_arrival_minutes",
            "accepted_at",
            "arrived_at",
            "closed_at",
            "expires_at",
            "created_at",
            "updated_at",
            "feedback",
        ]
        read_only_fields = fields

    def _can_view_requester_location(self, obj: HelpRequest) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or not user.is_authenticated:
            return False
        if not obj.share_live_location:
            return False
        if obj.status in HelpRequest.TERMINAL_STATUSES:
            return False
        # Assigned partner sees requester position ONLY after ACCEPTED
        if obj.partner.owner_id == user.id:
            return obj.status == HelpRequest.Status.ACCEPTED
        # Owner or Admin can see during active request
        return obj.requester_id == user.id or getattr(user, "role", None) == "ADMIN"

    def get_location_sharing_status(self, obj: HelpRequest) -> str:
        if obj.status in HelpRequest.TERMINAL_STATUSES:
            return "ENDED"
        if not obj.share_live_location:
            return "STOPPED"
        if obj.status == HelpRequest.Status.PENDING:
            return "PENDING_ACCEPTANCE"
        if obj.status == HelpRequest.Status.ACCEPTED:
            return "ACTIVE"
        return "ENDED"

    def get_latest_location(self, obj: HelpRequest) -> dict | None:
        if not self._can_view_requester_location(obj):
            return None
        ping = (
            LocationPing.objects.filter(help_request=obj)
            .order_by("-created_at")
            .first()
        )
        if ping:
            return {
                "lat": float(ping.latitude),
                "lng": float(ping.longitude),
                "accuracy_m": ping.accuracy_m,
                "updated_at": ping.created_at.isoformat(),
            }
        if obj.requester_latitude is not None and obj.requester_longitude is not None:
            return {
                "lat": float(obj.requester_latitude),
                "lng": float(obj.requester_longitude),
                "accuracy_m": None,
                "updated_at": obj.updated_at.isoformat(),
            }
        return None

    def to_representation(self, instance: HelpRequest) -> dict:
        data = super().to_representation(instance)
        # Never leak raw requester coordinates to partner before ACCEPTED or when sharing is off
        if not self._can_view_requester_location(instance):
            data["requester_latitude"] = None
            data["requester_longitude"] = None
        return data


class HelpRequestCreateSerializer(serializers.Serializer):
    partner = serializers.PrimaryKeyRelatedField(
        queryset=Partner.objects.select_related("availability")
    )
    note = serializers.CharField(
        max_length=320, required=False, allow_blank=True, default=""
    )
    share_live_location = serializers.BooleanField(required=False, default=False)
    requester_latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    requester_longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, required=False, allow_null=True
    )
    estimated_arrival_minutes = serializers.IntegerField(
        min_value=1, max_value=180, required=False, allow_null=True
    )

    def validate_partner(self, partner: Partner) -> Partner:
        if partner.verification_status != Partner.VerificationStatus.APPROVED:
            raise serializers.ValidationError(
                "Assistance requests can only be sent to administrator-approved partners."
            )
        avail = getattr(partner, "availability", None)
        if not avail or avail.status != PartnerAvailability.Status.AVAILABLE:
            raise serializers.ValidationError(
                "This partner is currently unavailable. Please select an available SafeStop."
            )
        return partner


class PartnerResponseNoteSerializer(serializers.Serializer):
    response_note = serializers.CharField(
        max_length=320, required=False, allow_blank=True, default=""
    )


class LocationPingCreateSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, min_value=-90, max_value=90
    )
    longitude = serializers.DecimalField(
        max_digits=9, decimal_places=6, min_value=-180, max_value=180
    )
    accuracy_m = serializers.FloatField(
        min_value=0, max_value=50000, required=False, allow_null=True
    )
