"""Authentication, profile management, and notification API views."""

from django.contrib.auth.models import update_last_login
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import AuditLog, Notification, UserProfile
from assistance.models import HelpRequest
from journeys.models import Journey, JourneyCheckIn, LocationPing, TrustedContact
from partners.models import Partner, PartnerAvailability
from reports.models import SafetyReport
from accounts.serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    LogoutSerializer,
    NotificationSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)


def _client_ip(request: Request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _issue_tokens(user) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
    }


def log_audit(
    *,
    actor,
    action: str,
    target_type: str,
    target_id: str = "",
    summary: str = "",
    metadata: dict | None = None,
    request: Request | None = None,
) -> AuditLog:
    return AuditLog.objects.create(
        actor=actor if (actor and getattr(actor, "is_authenticated", False)) else None,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        summary=summary[:255],
        metadata=metadata or {},
        ip_address=_client_ip(request) if request else None,
    )


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth_register"

    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        tokens = _issue_tokens(user)

        Notification.objects.create(
            recipient=user,
            title="Welcome to SafeStop 360",
            body=(
                "Your account is ready. Remember: SafeStop 360 is an independent "
                "assistance platform—in an immediate emergency, call 112 or 181."
            ),
            category=Notification.Category.SYSTEM,
        )
        log_audit(
            actor=user,
            action="USER_REGISTERED",
            target_type="USER",
            target_id=str(user.id),
            summary=f"Registered new {user.role} account ({user.email})",
            request=request,
        )
        return Response(
            {"user": UserSerializer(user).data, "tokens": tokens},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth_login"

    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        UserProfile.objects.get_or_create(user=user)
        update_last_login(None, user)
        tokens = _issue_tokens(user)

        log_audit(
            actor=user,
            action="USER_LOGIN",
            target_type="USER",
            target_id=str(user.id),
            summary=f"{user.role} logged in ({user.email})",
            request=request,
        )
        return Response(
            {"user": UserSerializer(user).data, "tokens": tokens},
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refresh_str = serializer.validated_data.get("refresh", "").strip()
        if refresh_str:
            try:
                token = RefreshToken(refresh_str)
                token.blacklist()
            except TokenError:
                pass

        log_audit(
            actor=request.user,
            action="USER_LOGOUT",
            target_type="USER",
            target_id=str(request.user.id),
            summary=f"Logged out ({request.user.email})",
            request=request,
        )
        return Response({"detail": "Signed out successfully."}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        UserProfile.objects.get_or_create(user=request.user)
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)

    def patch(self, request: Request) -> Response:
        serializer = ProfileUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.update(request.user, serializer.validated_data)
        log_audit(
            actor=user,
            action="PROFILE_UPDATED",
            target_type="USER",
            target_id=str(user.id),
            summary="Updated profile and privacy preferences",
            request=request,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])
        log_audit(
            actor=user,
            action="PASSWORD_CHANGED",
            target_type="USER",
            target_id=str(user.id),
            summary="Changed account password",
            request=request,
        )
        return Response(
            {"detail": "Password updated successfully."}, status=status.HTTP_200_OK
        )


class DeleteMyLocationDataView(APIView):
    """Privacy action: permanently delete all stored location pings and coordinates for the user."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request: Request) -> Response:
        deleted_pings, _ = LocationPing.objects.filter(user=request.user).delete()
        Journey.objects.filter(owner=request.user).update(
            location_sharing_enabled=False,
            last_known_latitude=None,
            last_known_longitude=None,
        )
        JourneyCheckIn.objects.filter(journey__owner=request.user).update(
            latitude=None,
            longitude=None,
        )
        HelpRequest.objects.filter(requester=request.user).update(
            share_live_location=False,
            requester_latitude=None,
            requester_longitude=None,
        )
        log_audit(
            actor=request.user,
            action="USER_LOCATION_DATA_DELETED",
            target_type="USER",
            target_id=str(request.user.id),
            summary=f"Deleted {deleted_pings} location ping(s) and cleared saved coordinates",
            request=request,
        )
        return Response(
            {
                "detail": "All your stored location data has been deleted.",
                "deleted_pings": deleted_pings,
            },
            status=status.HTTP_200_OK,
        )


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        queryset = Notification.objects.filter(recipient=request.user)[:30]
        return Response(
            {
                "unread_count": Notification.objects.filter(
                    recipient=request.user, is_read=False
                ).count(),
                "results": NotificationSerializer(queryset, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        notification = get_object_or_404(
            Notification, pk=pk, recipient=request.user
        )
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification).data, status=status.HTTP_200_OK)


class NotificationReadAllView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        updated = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).update(is_read=True)
        return Response({"marked_read": updated}, status=status.HTTP_200_OK)


class WomanDashboardSummaryView(APIView):
    """Aggregated real-data summary for the authenticated woman's dashboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        approved_partners = Partner.objects.filter(
            verification_status=Partner.VerificationStatus.APPROVED
        )
        available_partners = approved_partners.filter(
            availability__status=PartnerAvailability.Status.AVAILABLE
        )

        active_request = (
            HelpRequest.objects.select_related("partner")
            .filter(
                requester=request.user,
                status__in=[
                    HelpRequest.Status.PENDING,
                    HelpRequest.Status.ACCEPTED,
                    HelpRequest.Status.ARRIVED,
                ],
            )
            .first()
        )

        active_journey = (
            Journey.objects.prefetch_related("trusted_contacts")
            .filter(
                owner=request.user,
                status__in=[Journey.Status.ACTIVE, Journey.Status.MISSED, Journey.Status.OVERDUE],
            )
            .first()
        )

        contacts = list(
            TrustedContact.objects.filter(owner=request.user).values(
                "id", "name", "relationship", "phone", "is_primary"
            )[:5]
        )
        contacts_count = TrustedContact.objects.filter(owner=request.user).count()

        recent_reports = list(
            SafetyReport.objects.exclude(
                review_status=SafetyReport.ReviewStatus.DISMISSED
            ).values(
                "id",
                "category",
                "area_label",
                "city",
                "review_status",
                "is_demo",
                "created_at",
            )[:4]
        )

        return Response(
            {
                "approved_partners_count": approved_partners.count(),
                "available_partners_count": available_partners.count(),
                "active_help_request": (
                    {
                        "id": str(active_request.id),
                        "status": active_request.status,
                        "partner_id": str(active_request.partner_id),
                        "partner_name": active_request.partner.name,
                        "partner_area": active_request.partner.area,
                        "created_at": active_request.created_at,
                    }
                    if active_request
                    else None
                ),
                "active_journey": (
                    {
                        "id": str(active_journey.id),
                        "destination_label": active_journey.destination_label,
                        "status": active_journey.status,
                        "expected_arrival_at": active_journey.expected_arrival_at,
                        "location_sharing_enabled": active_journey.location_sharing_enabled,
                        "trusted_contacts_count": active_journey.trusted_contacts.count(),
                    }
                    if active_journey
                    else None
                ),
                "trusted_contacts_count": contacts_count,
                "trusted_contacts": contacts,
                "recent_reports": recent_reports,
                "unread_notifications_count": Notification.objects.filter(
                    recipient=request.user, is_read=False
                ).count(),
            },
            status=status.HTTP_200_OK,
        )
