"""Community Safety Reports and Rule-Based AI Intelligence views."""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.views import log_audit
from analysis.analyzer import analyze_reports as analyze_safety_reports
from reports.models import SafetyReport
from reports.serializers import (
    AdminReportReviewSerializer,
    SafetyReportAdminSerializer,
    SafetyReportCreateSerializer,
    SafetyReportPublicSerializer,
)
from safestop.permissions import IsAdminRole


class SafetyReportListCreateView(APIView):
    """List anonymized community safety reports or submit a new report."""

    def get_permissions(self):
        if self.request.method == "POST":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get(self, request: Request) -> Response:
        qs = SafetyReport.objects.exclude(
            review_status=SafetyReport.ReviewStatus.DISMISSED
        )
        category = request.query_params.get("category", "").strip().upper()
        if category and category != "ALL":
            qs = qs.filter(category=category)

        review_status = request.query_params.get("review_status", "").strip().upper()
        if review_status and review_status != "ALL":
            qs = qs.filter(review_status=review_status)

        data = SafetyReportPublicSerializer(qs[:100], many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)

    def post(self, request: Request) -> Response:
        serializer = SafetyReportCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        report = serializer.save(
            reporter=request.user,
            review_status=SafetyReport.ReviewStatus.UNREVIEWED,
        )
        log_audit(
            actor=request.user,
            action="SAFETY_REPORT_SUBMITTED",
            target_type="SAFETY_REPORT",
            target_id=str(report.id),
            summary=f"Submitted {report.category} report near {report.area_label}",
            request=request,
        )
        return Response(
            SafetyReportPublicSerializer(report).data, status=status.HTTP_201_CREATED
        )


class SafetyReportDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request: Request, pk) -> Response:
        report = get_object_or_404(
            SafetyReport.objects.exclude(review_status=SafetyReport.ReviewStatus.DISMISSED),
            pk=pk,
        )
        return Response(SafetyReportPublicSerializer(report).data, status=status.HTTP_200_OK)


class SafetyIntelligenceView(APIView):
    """Transparent rule-based AI Safety Intelligence summary."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        reports = SafetyReport.objects.all()
        summary = analyze_safety_reports(reports)
        return Response(summary, status=status.HTTP_200_OK)


class AdminSafetyReportListView(APIView):
    """Admin moderation list across all review statuses + intelligence summary."""

    permission_classes = [IsAdminRole]

    def get(self, request: Request) -> Response:
        qs = SafetyReport.objects.select_related("reviewed_by").all()
        status_filter = request.query_params.get("review_status", "").strip().upper()
        if status_filter and status_filter != "ALL":
            qs = qs.filter(review_status=status_filter)

        category_filter = request.query_params.get("category", "").strip().upper()
        if category_filter and category_filter != "ALL":
            qs = qs.filter(category=category_filter)

        all_reports = list(SafetyReport.objects.all())
        return Response(
            {
                "count": qs.count(),
                "results": SafetyReportAdminSerializer(qs[:150], many=True).data,
                "intelligence": analyze_safety_reports(all_reports),
            },
            status=status.HTTP_200_OK,
        )


class AdminSafetyReportReviewView(APIView):
    """Administrator review status update with audit trail."""

    permission_classes = [IsAdminRole]

    def patch(self, request: Request, pk) -> Response:
        return self._handle_review(request, pk)

    def post(self, request: Request, pk) -> Response:
        return self._handle_review(request, pk)

    def _handle_review(self, request: Request, pk) -> Response:
        report = get_object_or_404(SafetyReport, pk=pk)
        serializer = AdminReportReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        report.review_status = serializer.validated_data["review_status"]
        report.admin_notes = serializer.validated_data.get("admin_notes", "").strip()
        report.reviewed_by = request.user
        report.reviewed_at = timezone.now()
        report.save()

        log_audit(
            actor=request.user,
            action="SAFETY_REPORT_REVIEWED",
            target_type="SAFETY_REPORT",
            target_id=str(report.id),
            summary=f"Marked report at {report.area_label} as {report.review_status}",
            request=request,
        )
        return Response(SafetyReportAdminSerializer(report).data, status=status.HTTP_200_OK)
