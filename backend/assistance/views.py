"""Assistance Confirmation Loop views with strict role, state-machine, and privacy enforcement."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Notification
from accounts.views import log_audit
from assistance.models import HelpRequest, HelpRequestFeedback
from assistance.serializers import (
    HelpRequestCreateSerializer,
    HelpRequestFeedbackSerializer,
    HelpRequestSerializer,
    LocationPingCreateSerializer,
    PartnerResponseNoteSerializer,
)
from assistance.services import (
    default_pending_expiry,
    delete_request_location_data,
    expire_stale_pending_requests,
    transition_help_request,
)
from journeys.models import LocationPing
from safestop.exceptions import error_response
from safestop.permissions import IsWomanRole


def _get_scoped_queryset(user):
    qs = HelpRequest.objects.select_related("partner", "requester", "feedback")
    if getattr(user, "role", None) == "ADMIN" or user.is_superuser:
        return qs
    if getattr(user, "role", None) == "PARTNER":
        return qs.filter(partner__owner=user)
    return qs.filter(requester=user)


class HelpRequestListCreateView(APIView):
    """List role-scoped help requests or create a new assistance request (WOMAN role)."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "help_request"

    def get(self, request: Request) -> Response:
        expire_stale_pending_requests()
        qs = _get_scoped_queryset(request.user)
        status_filter = request.query_params.get("status", "").strip().upper()
        if status_filter and status_filter != "ALL":
            qs = qs.filter(status=status_filter)

        partner_id = request.query_params.get("partner_id", "").strip()
        if partner_id:
            qs = qs.filter(partner_id=partner_id)

        data = HelpRequestSerializer(
            qs[:50], many=True, context={"request": request}
        ).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)

    def post(self, request: Request) -> Response:
        if not IsWomanRole().has_permission(request, self):
            return error_response(
                "Only authenticated Woman users can initiate assistance requests.",
                "forbidden_woman_only",
                status.HTTP_403_FORBIDDEN,
            )

        expire_stale_pending_requests()
        serializer = HelpRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        partner = serializer.validated_data["partner"]

        duplicate = HelpRequest.objects.filter(
            requester=request.user,
            partner=partner,
            status__in=[HelpRequest.Status.PENDING, HelpRequest.Status.ACCEPTED],
        ).exists()
        if duplicate:
            return error_response(
                "You already have an active assistance request with this establishment.",
                "duplicate_active_request",
                status.HTTP_409_CONFLICT,
            )

        share_live = bool(serializer.validated_data.get("share_live_location", False))
        req_lat = serializer.validated_data.get("requester_latitude") if share_live else None
        req_lng = serializer.validated_data.get("requester_longitude") if share_live else None

        help_req = HelpRequest.objects.create(
            requester=request.user,
            partner=partner,
            note=serializer.validated_data.get("note", "").strip(),
            share_live_location=share_live,
            requester_latitude=req_lat,
            requester_longitude=req_lng,
            estimated_arrival_minutes=serializer.validated_data.get(
                "estimated_arrival_minutes"
            ),
            expires_at=default_pending_expiry(),
        )

        if share_live and req_lat is not None and req_lng is not None:
            LocationPing.objects.create(
                user=request.user,
                help_request=help_req,
                latitude=req_lat,
                longitude=req_lng,
            )

        Notification.objects.create(
            recipient=partner.owner,
            title="New Incoming Assistance Request",
            body=(
                f"{request.user.full_name or 'A SafeStop user'} requested assistance at "
                f"{partner.name}."
            ),
            category=Notification.Category.ASSISTANCE,
            metadata={"help_request_id": str(help_req.id)},
        )
        log_audit(
            actor=request.user,
            action="HELP_REQUEST_CREATED",
            target_type="HELP_REQUEST",
            target_id=str(help_req.id),
            summary=f"Created assistance request to {partner.name} (share_live={share_live})",
            request=request,
        )
        return Response(
            HelpRequestSerializer(help_req, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class HelpRequestDetailView(APIView):
    """Retrieve a single assistance request (restricted to participants & admin)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request, pk) -> Response:
        expire_stale_pending_requests()
        help_req = get_object_or_404(_get_scoped_queryset(request.user), pk=pk)
        return Response(
            HelpRequestSerializer(help_req, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class _HelpRequestTransitionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    next_status: str = ""
    accepts_partner_note: bool = False

    def post(self, request: Request, pk) -> Response:
        help_req = get_object_or_404(
            HelpRequest.objects.select_related("partner", "requester"), pk=pk
        )
        response_note = None
        if self.accepts_partner_note:
            note_ser = PartnerResponseNoteSerializer(data=request.data)
            note_ser.is_valid(raise_exception=True)
            val = note_ser.validated_data.get("response_note", "").strip()
            if val:
                response_note = val

        updated = transition_help_request(
            help_req,
            self.next_status,
            actor=request.user,
            response_note=response_note,
            request=request,
        )
        return Response(
            HelpRequestSerializer(updated, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class HelpRequestAcceptView(_HelpRequestTransitionView):
    next_status = HelpRequest.Status.ACCEPTED
    accepts_partner_note = True


class HelpRequestDeclineView(_HelpRequestTransitionView):
    next_status = HelpRequest.Status.DECLINED
    accepts_partner_note = True


class HelpRequestArrivedView(_HelpRequestTransitionView):
    next_status = HelpRequest.Status.ARRIVED


class HelpRequestCloseView(_HelpRequestTransitionView):
    next_status = HelpRequest.Status.CLOSED
    accepts_partner_note = True


class HelpRequestCancelView(_HelpRequestTransitionView):
    next_status = HelpRequest.Status.CANCELLED


class HelpRequestLocationPingView(APIView):
    """Woman posts live location pings while an assistance request is active and opt-in."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "location_ping"

    def post(self, request: Request, pk) -> Response:
        expire_stale_pending_requests()
        help_req = get_object_or_404(HelpRequest, pk=pk, requester=request.user)
        if help_req.status not in (
            HelpRequest.Status.PENDING,
            HelpRequest.Status.ACCEPTED,
        ):
            return error_response(
                "Location pings are only accepted while a request is pending or accepted.",
                "request_not_active",
                status.HTTP_409_CONFLICT,
            )
        if not help_req.share_live_location:
            return error_response(
                "Live location sharing is disabled for this request.",
                "location_sharing_disabled",
                status.HTTP_400_BAD_REQUEST,
            )

        serializer = LocationPingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ping = LocationPing.objects.create(
            user=request.user,
            help_request=help_req,
            latitude=serializer.validated_data["latitude"],
            longitude=serializer.validated_data["longitude"],
            accuracy_m=serializer.validated_data.get("accuracy_m"),
        )
        # Retain at most the last 20 pings per request to keep storage short-lived
        stale_ids = list(
            LocationPing.objects.filter(help_request=help_req)
            .order_by("-created_at")
            .values_list("id", flat=True)[20:]
        )
        if stale_ids:
            LocationPing.objects.filter(id__in=stale_ids).delete()

        help_req.requester_latitude = ping.latitude
        help_req.requester_longitude = ping.longitude
        help_req.save(
            update_fields=["requester_latitude", "requester_longitude", "updated_at"]
        )
        return Response(
            {
                "id": str(ping.id),
                "created_at": ping.created_at.isoformat(),
                "share_live_location": True,
            },
            status=status.HTTP_201_CREATED,
        )


class HelpRequestStopSharingView(APIView):
    """Owner immediately stops live location sharing and deletes all pings for this request."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        help_req = get_object_or_404(HelpRequest, pk=pk, requester=request.user)
        deleted = delete_request_location_data(help_req)
        log_audit(
            actor=request.user,
            action="HELP_REQUEST_LOCATION_STOPPED",
            target_type="HELP_REQUEST",
            target_id=str(help_req.id),
            summary=f"Stopped live location sharing and deleted {deleted} ping(s)",
            request=request,
        )
        return Response(
            HelpRequestSerializer(help_req, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class HelpRequestFeedbackView(APIView):
    """Optional post-completion feedback from the requester once a request is CLOSED."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        help_req = get_object_or_404(HelpRequest, pk=pk, requester=request.user)
        if help_req.status != HelpRequest.Status.CLOSED:
            return error_response(
                "Feedback can only be submitted after the request is CLOSED.",
                "request_not_closed",
                status.HTTP_409_CONFLICT,
            )
        if hasattr(help_req, "feedback"):
            return error_response(
                "Feedback has already been submitted for this request.",
                "feedback_exists",
                status.HTTP_409_CONFLICT,
            )

        serializer = HelpRequestFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        feedback = HelpRequestFeedback.objects.create(
            help_request=help_req, **serializer.validated_data
        )
        log_audit(
            actor=request.user,
            action="HELP_REQUEST_FEEDBACK_SUBMITTED",
            target_type="HELP_REQUEST",
            target_id=str(help_req.id),
            summary=f"Submitted {feedback.rating}/5 feedback",
            request=request,
        )
        return Response(
            HelpRequestFeedbackSerializer(feedback).data,
            status=status.HTTP_201_CREATED,
        )
