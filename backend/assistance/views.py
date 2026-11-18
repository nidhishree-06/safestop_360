"""Assistance Confirmation Loop views with strict role and state-machine enforcement."""

from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
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
    PartnerResponseNoteSerializer,
)
from safestop.permissions import IsWomanRole


def _expire_stale_pending_requests() -> None:
    now = timezone.now()
    HelpRequest.objects.filter(
        status=HelpRequest.Status.PENDING,
        expires_at__isnull=False,
        expires_at__lt=now,
    ).update(status=HelpRequest.Status.EXPIRED, updated_at=now)


def _get_scoped_queryset(user):
    qs = HelpRequest.objects.select_related("partner", "requester", "feedback")
    if getattr(user, "role", None) == "ADMIN" or user.is_superuser:
        return qs
    if getattr(user, "role", None) == "PARTNER":
        return qs.filter(partner__owner=user)
    return qs.filter(requester=user)


def _is_partner_owner_or_admin(user, help_request: HelpRequest) -> bool:
    return bool(
        help_request.partner.owner_id == user.id
        or getattr(user, "role", None) == "ADMIN"
        or user.is_superuser
    )


class HelpRequestListCreateView(APIView):
    """List role-scoped help requests or create a new assistance request (WOMAN role)."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "help_request"

    def get(self, request: Request) -> Response:
        _expire_stale_pending_requests()
        qs = _get_scoped_queryset(request.user)
        status_filter = request.query_params.get("status", "").strip().upper()
        if status_filter and status_filter != "ALL":
            qs = qs.filter(status=status_filter)

        partner_id = request.query_params.get("partner_id", "").strip()
        if partner_id:
            qs = qs.filter(partner_id=partner_id)

        data = HelpRequestSerializer(qs[:50], many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)

    def post(self, request: Request) -> Response:
        if not IsWomanRole().has_permission(request, self):
            return Response(
                {"detail": "Only authenticated Woman users can initiate assistance requests."},
                status=status.HTTP_403_FORBIDDEN,
            )

        _expire_stale_pending_requests()
        serializer = HelpRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        partner = serializer.validated_data["partner"]

        # Avoid accidental duplicate active requests to the same partner
        duplicate = HelpRequest.objects.filter(
            requester=request.user,
            partner=partner,
            status__in=[HelpRequest.Status.PENDING, HelpRequest.Status.ACCEPTED],
        ).exists()
        if duplicate:
            return Response(
                {
                    "detail": (
                        "You already have an active assistance request with this "
                        "establishment."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        help_req = HelpRequest.objects.create(
            requester=request.user,
            partner=partner,
            note=serializer.validated_data.get("note", "").strip(),
            requester_latitude=serializer.validated_data.get("requester_latitude"),
            requester_longitude=serializer.validated_data.get("requester_longitude"),
            estimated_arrival_minutes=serializer.validated_data.get(
                "estimated_arrival_minutes"
            ),
            expires_at=timezone.now() + timedelta(minutes=30),
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
            summary=f"Created assistance request to {partner.name}",
            request=request,
        )
        return Response(
            HelpRequestSerializer(help_req).data, status=status.HTTP_201_CREATED
        )


class HelpRequestDetailView(APIView):
    """Retrieve a single assistance request (restricted to participants & admin)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request, pk) -> Response:
        _expire_stale_pending_requests()
        help_req = get_object_or_404(_get_scoped_queryset(request.user), pk=pk)
        return Response(HelpRequestSerializer(help_req).data, status=status.HTTP_200_OK)


class _HelpRequestTransitionBaseView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    next_status: str = ""
    audit_action: str = ""
    allowed_actor: str = "partner"  # "partner" | "requester" | "either"

    def post(self, request: Request, pk) -> Response:
        _expire_stale_pending_requests()
        help_req = get_object_or_404(
            HelpRequest.objects.select_related("partner", "requester"), pk=pk
        )

        is_requester = help_req.requester_id == request.user.id
        is_partner_side = _is_partner_owner_or_admin(request.user, help_req)

        if self.allowed_actor == "partner" and not is_partner_side:
            return Response(
                {"detail": "Only the assigned partner establishment can perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if self.allowed_actor == "requester" and not (
            is_requester or getattr(request.user, "role", None) == "ADMIN"
        ):
            return Response(
                {"detail": "Only the requesting user can perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if self.allowed_actor == "either" and not (is_requester or is_partner_side):
            return Response(
                {"detail": "You are not authorized to update this assistance request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        response_note = None
        if self.allowed_actor == "partner":
            note_ser = PartnerResponseNoteSerializer(data=request.data)
            note_ser.is_valid(raise_exception=True)
            note_val = note_ser.validated_data.get("response_note", "").strip()
            if note_val:
                response_note = note_val

        try:
            help_req.transition_to(self.next_status, response_note=response_note)
        except DjangoValidationError as exc:
            return Response(
                {"detail": exc.messages[0] if exc.messages else str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notify_recipient = (
            help_req.requester if is_partner_side else help_req.partner.owner
        )
        Notification.objects.create(
            recipient=notify_recipient,
            title=f"Assistance Request {self.next_status.title()}",
            body=f"Request at {help_req.partner.name} is now {self.next_status}.",
            category=Notification.Category.ASSISTANCE,
            metadata={"help_request_id": str(help_req.id), "status": self.next_status},
        )
        log_audit(
            actor=request.user,
            action=self.audit_action,
            target_type="HELP_REQUEST",
            target_id=str(help_req.id),
            summary=f"Transitioned request at {help_req.partner.name} to {self.next_status}",
            request=request,
        )
        return Response(HelpRequestSerializer(help_req).data, status=status.HTTP_200_OK)


class HelpRequestAcceptView(_HelpRequestTransitionBaseView):
    next_status = HelpRequest.Status.ACCEPTED
    audit_action = "HELP_REQUEST_ACCEPTED"
    allowed_actor = "partner"


class HelpRequestDeclineView(_HelpRequestTransitionBaseView):
    next_status = HelpRequest.Status.DECLINED
    audit_action = "HELP_REQUEST_DECLINED"
    allowed_actor = "partner"


class HelpRequestArrivedView(_HelpRequestTransitionBaseView):
    next_status = HelpRequest.Status.ARRIVED
    audit_action = "HELP_REQUEST_ARRIVED"
    allowed_actor = "either"


class HelpRequestCloseView(_HelpRequestTransitionBaseView):
    next_status = HelpRequest.Status.CLOSED
    audit_action = "HELP_REQUEST_CLOSED"
    allowed_actor = "partner"


class HelpRequestCancelView(_HelpRequestTransitionBaseView):
    next_status = HelpRequest.Status.CANCELLED
    audit_action = "HELP_REQUEST_CANCELLED"
    allowed_actor = "requester"


class HelpRequestFeedbackView(APIView):
    """Optional post-completion feedback from the requester once a request is CLOSED."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        help_req = get_object_or_404(HelpRequest, pk=pk, requester=request.user)
        if help_req.status != HelpRequest.Status.CLOSED:
            return Response(
                {"detail": "Feedback can only be submitted after the request is CLOSED."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if hasattr(help_req, "feedback"):
            return Response(
                {"detail": "Feedback has already been submitted for this request."},
                status=status.HTTP_400_BAD_REQUEST,
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
