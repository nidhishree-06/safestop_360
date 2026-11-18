"""Administrator analytics, request oversight, and immutable audit log views."""

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import AuditLog, User
from analysis.analyzer import analyze_reports as analyze_safety_reports
from assistance.models import HelpRequest
from assistance.serializers import HelpRequestSerializer
from companions.models import Companion
from journeys.models import Journey
from partners.models import Partner, PartnerAvailability
from partners.serializers import PartnerPublicSerializer
from reports.models import SafetyReport
from reports.serializers import SafetyReportPublicSerializer
from safestop.permissions import IsAdminRole


class AdminAuditLogListView(APIView):
    """Dedicated admin audit log viewer."""

    permission_classes = [IsAdminRole]

    def get(self, request: Request) -> Response:
        qs = AuditLog.objects.select_related("actor").all()
        action = request.query_params.get("action", "").strip()
        if action:
            qs = qs.filter(action__icontains=action)
        target_type = request.query_params.get("target_type", "").strip().upper()
        if target_type and target_type != "ALL":
            qs = qs.filter(target_type=target_type)
        items = [
            {
                "id": str(log.id),
                "action": log.action,
                "target_type": log.target_type,
                "target_id": log.target_id,
                "summary": log.summary,
                "actor_email": log.actor.email if log.actor else "System",
                "created_at": log.created_at,
            }
            for log in qs[:100]
        ]
        return Response({"count": len(items), "results": items}, status=status.HTTP_200_OK)


class AdminAnalyticsView(APIView):
    """Real-data platform analytics, rule-based safety summary, request oversight, and audit logs.

    Privacy guarantee: private Journey routes/coordinates are NEVER included here—only
    an aggregate active journey count.
    """

    permission_classes = [IsAdminRole]

    def get(self, request: Request) -> Response:
        all_reports = list(SafetyReport.objects.all())
        approved_partners = Partner.objects.select_related("availability").filter(
            verification_status=Partner.VerificationStatus.APPROVED
        )
        recent_requests = HelpRequest.objects.select_related(
            "partner", "requester", "feedback"
        ).all()[:20]
        recent_audits = AuditLog.objects.select_related("actor").all()[:30]

        return Response(
            {
                "counts": {
                    "users_total": User.objects.count(),
                    "users_woman": User.objects.filter(role=User.Role.WOMAN).count(),
                    "users_partner": User.objects.filter(role=User.Role.PARTNER).count(),
                    "partners_approved": approved_partners.count(),
                    "partners_pending": Partner.objects.filter(
                        verification_status=Partner.VerificationStatus.PENDING
                    ).count(),
                    "partners_available_now": approved_partners.filter(
                        availability__status=PartnerAvailability.Status.AVAILABLE
                    ).count(),
                    "requests_total": HelpRequest.objects.count(),
                    "requests_active": HelpRequest.objects.filter(
                        status__in=[
                            HelpRequest.Status.PENDING,
                            HelpRequest.Status.ACCEPTED,
                            HelpRequest.Status.ARRIVED,
                        ]
                    ).count(),
                    "requests_closed": HelpRequest.objects.filter(
                        status=HelpRequest.Status.CLOSED
                    ).count(),
                    "reports_total": SafetyReport.objects.count(),
                    "reports_unreviewed": SafetyReport.objects.filter(
                        review_status=SafetyReport.ReviewStatus.UNREVIEWED
                    ).count(),
                    "companions_approved": Companion.objects.filter(
                        verification_status=Companion.VerificationStatus.APPROVED
                    ).count(),
                    "companions_pending": Companion.objects.filter(
                        verification_status=Companion.VerificationStatus.PENDING
                    ).count(),
                    "active_journeys_count": Journey.objects.filter(
                        status__in=[
                            Journey.Status.ACTIVE,
                            Journey.Status.MISSED,
                            Journey.Status.OVERDUE,
                        ]
                    ).count(),
                },
                "intelligence": analyze_safety_reports(all_reports),
                "recent_requests": HelpRequestSerializer(
                    recent_requests, many=True, context={"request": request}
                ).data,
                "audit_logs": [
                    {
                        "id": str(log.id),
                        "action": log.action,
                        "target_type": log.target_type,
                        "target_id": log.target_id,
                        "summary": log.summary,
                        "actor_email": log.actor.email if log.actor else "System",
                        "created_at": log.created_at,
                    }
                    for log in recent_audits
                ],
                "map_overview": {
                    "partners": PartnerPublicSerializer(approved_partners, many=True).data,
                    "reports": SafetyReportPublicSerializer(
                        [
                            r
                            for r in all_reports
                            if r.review_status != SafetyReport.ReviewStatus.DISMISSED
                        ][:60],
                        many=True,
                    ).data,
                },
            },
            status=status.HTTP_200_OK,
        )
