"""Serializers for anonymized community safety reports and admin moderation."""

from rest_framework import serializers

from reports.intelligence import classify_report_text
from reports.models import SafetyReport


class SafetyReportPublicSerializer(serializers.ModelSerializer):
    """Public/community projection — strictly strips reporter identity."""

    category_display = serializers.CharField(source="get_category_display", read_only=True)
    review_status_display = serializers.CharField(
        source="get_review_status_display", read_only=True
    )
    is_unreviewed = serializers.SerializerMethodField()
    ai_classification = serializers.SerializerMethodField()

    class Meta:
        model = SafetyReport
        fields = [
            "id",
            "category",
            "category_display",
            "description",
            "area_label",
            "city",
            "latitude",
            "longitude",
            "incident_time",
            "review_status",
            "review_status_display",
            "is_unreviewed",
            "is_demo",
            "ai_classification",
            "created_at",
        ]
        read_only_fields = fields

    def get_is_unreviewed(self, obj: SafetyReport) -> bool:
        return obj.review_status == SafetyReport.ReviewStatus.UNREVIEWED

    def get_ai_classification(self, obj: SafetyReport) -> dict:
        return classify_report_text(obj.description, obj.category)


class SafetyReportAdminSerializer(SafetyReportPublicSerializer):
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta(SafetyReportPublicSerializer.Meta):
        fields = [
            *SafetyReportPublicSerializer.Meta.fields,
            "admin_notes",
            "reviewed_by_name",
            "reviewed_at",
        ]
        read_only_fields = fields

    def get_reviewed_by_name(self, obj: SafetyReport) -> str | None:
        if not obj.reviewed_by:
            return None
        return obj.reviewed_by.full_name or obj.reviewed_by.email


class SafetyReportCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SafetyReport
        fields = [
            "category",
            "description",
            "area_label",
            "city",
            "latitude",
            "longitude",
            "incident_time",
        ]

    def validate_description(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 10:
            raise serializers.ValidationError(
                "Please provide at least 10 characters describing the safety observation."
            )
        return cleaned


class AdminReportReviewSerializer(serializers.Serializer):
    review_status = serializers.ChoiceField(choices=SafetyReport.ReviewStatus.choices)
    admin_notes = serializers.CharField(max_length=600, required=False, allow_blank=True, default="")
