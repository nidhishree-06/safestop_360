"""Serializers for the Assistance Confirmation Loop and feedback."""

from rest_framework import serializers

from assistance.models import HelpRequest, HelpRequestFeedback
from partners.models import Partner, PartnerAvailability


class HelpRequestFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = HelpRequestFeedback
        fields = ["id", "rating", "felt_safe", "comment", "created_at"]
        read_only_fields = ["id", "created_at"]


class HelpRequestSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source="requester.full_name", read_only=True)
    partner_name = serializers.CharField(source="partner.name", read_only=True)
    partner_category = serializers.CharField(source="partner.get_category_display", read_only=True)
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
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    feedback = HelpRequestFeedbackSerializer(read_only=True)

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
            "status",
            "status_display",
            "note",
            "partner_response_note",
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


class HelpRequestCreateSerializer(serializers.Serializer):
    partner = serializers.PrimaryKeyRelatedField(queryset=Partner.objects.select_related("availability"))
    note = serializers.CharField(max_length=320, required=False, allow_blank=True, default="")
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
        if avail and avail.status == PartnerAvailability.Status.OFFLINE:
            raise serializers.ValidationError(
                "This partner is currently offline. Please select an available SafeStop."
            )
        return partner


class PartnerResponseNoteSerializer(serializers.Serializer):
    response_note = serializers.CharField(
        max_length=320, required=False, allow_blank=True, default=""
    )
