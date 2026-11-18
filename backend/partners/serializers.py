"""Serializers for partner establishments, verification, and availability."""

from rest_framework import serializers

from partners.models import Partner, PartnerAvailability, PartnerVerification


class PartnerAvailabilitySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PartnerAvailability
        fields = ["status", "status_display", "status_note", "updated_at"]
        read_only_fields = ["updated_at"]


class PartnerVerificationSerializer(serializers.ModelSerializer):
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PartnerVerification
        fields = ["id", "status", "notes", "reviewed_by_name", "reviewed_at"]
        read_only_fields = fields

    def get_reviewed_by_name(self, obj: PartnerVerification) -> str:
        if not obj.reviewed_by:
            return "System"
        return obj.reviewed_by.full_name or obj.reviewed_by.email


class PartnerPublicSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    verification_status_display = serializers.CharField(
        source="get_verification_status_display", read_only=True
    )
    availability = PartnerAvailabilitySerializer(read_only=True)
    distance_km = serializers.SerializerMethodField()

    class Meta:
        model = Partner
        fields = [
            "id",
            "name",
            "category",
            "category_display",
            "description",
            "address",
            "area",
            "city",
            "latitude",
            "longitude",
            "contact_phone",
            "operating_hours",
            "support_services",
            "verification_status",
            "verification_status_display",
            "is_demo",
            "availability",
            "distance_km",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_distance_km(self, obj: Partner) -> float | None:
        dist = getattr(obj, "distance_km", None)
        return round(float(dist), 2) if dist is not None else None


class PartnerOwnerSerializer(PartnerPublicSerializer):
    verifications = PartnerVerificationSerializer(many=True, read_only=True)
    owner_email = serializers.EmailField(source="owner.email", read_only=True)
    owner_name = serializers.CharField(source="owner.full_name", read_only=True)

    class Meta(PartnerPublicSerializer.Meta):
        fields = [
            *PartnerPublicSerializer.Meta.fields,
            "owner_email",
            "owner_name",
            "verifications",
        ]
        read_only_fields = fields


class PartnerCreateUpdateSerializer(serializers.ModelSerializer):
    support_services = serializers.ListField(
        child=serializers.CharField(max_length=80),
        required=False,
        default=list,
    )

    class Meta:
        model = Partner
        fields = [
            "name",
            "category",
            "description",
            "address",
            "area",
            "city",
            "latitude",
            "longitude",
            "contact_phone",
            "operating_hours",
            "support_services",
        ]

    def validate_support_services(self, value: list[str]) -> list[str]:
        return [item.strip() for item in value if item.strip()][:12]


class PartnerAvailabilityUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=PartnerAvailability.Status.choices)
    status_note = serializers.CharField(max_length=180, required=False, allow_blank=True, default="")


class AdminPartnerReviewSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            Partner.VerificationStatus.APPROVED,
            Partner.VerificationStatus.REJECTED,
            Partner.VerificationStatus.SUSPENDED,
            Partner.VerificationStatus.PENDING,
        ]
    )
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
