"""Companion registration, admin verification, availability, and request views."""

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Notification
from accounts.views import log_audit
from companions.models import Companion, CompanionRequest
from companions.serializers import (
    AdminCompanionReviewSerializer,
    CompanionRegisterSerializer,
    CompanionRequestCreateSerializer,
    CompanionRequestSerializer,
    CompanionSerializer,
)
from safestop.permissions import IsAdminRole


class CompanionListView(APIView):
    """List strictly APPROVED companions. Unverified volunteers are never exposed here."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        qs = Companion.objects.select_related("user").filter(
            verification_status=Companion.VerificationStatus.APPROVED
        )
        available_only = request.query_params.get("available_only", "").strip().lower()
        if available_only in ("true", "1", "yes"):
            qs = qs.filter(is_available=True)

        area = request.query_params.get("area", "").strip().lower()
        items = list(qs)
        if area:
            items = [
                c
                for c in items
                if any(area in str(a).lower() for a in (c.service_areas or []))
            ]

        data = CompanionSerializer(items, many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)


class CompanionRegisterView(APIView):
    """Register as a companion (strictly starts PENDING admin verification)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request) -> Response:
        if hasattr(request.user, "companion_profile"):
            return Response(
                {"detail": "You have already registered a companion profile."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CompanionRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        companion = serializer.save(
            user=request.user,
            verification_status=Companion.VerificationStatus.PENDING,
            is_available=False,
        )
        log_audit(
            actor=request.user,
            action="COMPANION_REGISTERED",
            target_type="COMPANION",
            target_id=str(companion.id),
            summary=f"Submitted companion application for {companion.display_name}",
            request=request,
        )
        return Response(
            CompanionSerializer(companion).data, status=status.HTTP_201_CREATED
        )


class MyCompanionProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        companion = Companion.objects.filter(user=request.user).first()
        if not companion:
            return Response({"companion": None}, status=status.HTTP_200_OK)
        return Response(
            {"companion": CompanionSerializer(companion).data}, status=status.HTTP_200_OK
        )


class CompanionAvailabilityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request: Request) -> Response:
        companion = get_object_or_404(Companion, user=request.user)
        desired = bool(request.data.get("is_available", False))
        if (
            desired
            and companion.verification_status != Companion.VerificationStatus.APPROVED
        ):
            return Response(
                {
                    "detail": (
                        "Only administrator-approved companions can mark themselves "
                        "available."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        companion.is_available = desired
        companion.save(update_fields=["is_available", "updated_at"])
        return Response(CompanionSerializer(companion).data, status=status.HTTP_200_OK)


class CompanionRequestListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        qs = CompanionRequest.objects.select_related(
            "requester", "companion", "companion__user"
        ).filter(
            Q(requester=request.user) | Q(companion__user=request.user)
        )
        data = CompanionRequestSerializer(qs[:40], many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)

    def post(self, request: Request) -> Response:
        serializer = CompanionRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        companion = serializer.validated_data["companion"]
        if companion.user_id == request.user.id:
            return Response(
                {"detail": "You cannot send a companion request to yourself."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        req_obj = CompanionRequest.objects.create(
            requester=request.user,
            companion=companion,
            pickup_area=serializer.validated_data["pickup_area"].strip(),
            destination_area=serializer.validated_data["destination_area"].strip(),
            scheduled_for=serializer.validated_data["scheduled_for"],
            note=serializer.validated_data.get("note", "").strip(),
        )
        Notification.objects.create(
            recipient=companion.user,
            title="New Companion Request",
            body=(
                f"{request.user.full_name} requested accompaniment from "
                f"{req_obj.pickup_area} to {req_obj.destination_area}."
            ),
            category=Notification.Category.COMPANION,
            metadata={"companion_request_id": str(req_obj.id)},
        )
        return Response(
            CompanionRequestSerializer(req_obj).data, status=status.HTTP_201_CREATED
        )


class CompanionRequestActionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    target_status: str = ""
    actor_role: str = "companion"  # "companion" | "requester"

    def post(self, request: Request, pk) -> Response:
        req_obj = get_object_or_404(
            CompanionRequest.objects.select_related("companion__user", "requester"),
            pk=pk,
        )
        is_companion = req_obj.companion.user_id == request.user.id
        is_requester = req_obj.requester_id == request.user.id

        if self.actor_role == "companion" and not is_companion:
            return Response(
                {"detail": "Only the assigned companion can perform this action."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if self.actor_role == "requester" and not is_requester:
            return Response(
                {"detail": "Only the requester can cancel this companion request."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if self.target_status in (
            CompanionRequest.Status.ACCEPTED,
            CompanionRequest.Status.DECLINED,
        ) and req_obj.status != CompanionRequest.Status.PENDING:
            return Response(
                {"detail": "Only pending companion requests can be accepted or declined."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        req_obj.status = self.target_status
        note = str(request.data.get("response_note", "")).strip()
        if note:
            req_obj.response_note = note[:240]
        req_obj.save()

        recipient = req_obj.requester if is_companion else req_obj.companion.user
        Notification.objects.create(
            recipient=recipient,
            title=f"Companion Request {self.target_status.title()}",
            body=f"Your companion request ({req_obj.pickup_area} -> {req_obj.destination_area}) is now {self.target_status}.",
            category=Notification.Category.COMPANION,
        )
        return Response(CompanionRequestSerializer(req_obj).data, status=status.HTTP_200_OK)


class CompanionRequestAcceptView(CompanionRequestActionView):
    target_status = CompanionRequest.Status.ACCEPTED
    actor_role = "companion"


class CompanionRequestDeclineView(CompanionRequestActionView):
    target_status = CompanionRequest.Status.DECLINED
    actor_role = "companion"


class CompanionRequestCompleteView(CompanionRequestActionView):
    target_status = CompanionRequest.Status.COMPLETED
    actor_role = "companion"


class CompanionRequestCancelView(CompanionRequestActionView):
    target_status = CompanionRequest.Status.CANCELLED
    actor_role = "requester"


class AdminCompanionListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request: Request) -> Response:
        qs = Companion.objects.select_related("user").all().order_by("-created_at")
        status_filter = request.query_params.get("status", "").strip().upper()
        if status_filter and status_filter != "ALL":
            qs = qs.filter(verification_status=status_filter)
        data = CompanionSerializer(qs, many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)


class AdminCompanionReviewView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request: Request, pk) -> Response:
        companion = get_object_or_404(Companion.objects.select_related("user"), pk=pk)
        serializer = AdminCompanionReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data["status"]

        companion.verification_status = decision
        companion.verified_by = request.user
        companion.verified_at = timezone.now()
        if decision != Companion.VerificationStatus.APPROVED:
            companion.is_available = False
        companion.save()

        Notification.objects.create(
            recipient=companion.user,
            title=f"Companion Verification: {decision}",
            body=f"Your SafeStop Companion application has been marked {decision}.",
            category=Notification.Category.COMPANION,
        )
        log_audit(
            actor=request.user,
            action="COMPANION_VERIFICATION_DECISION",
            target_type="COMPANION",
            target_id=str(companion.id),
            summary=f"Marked companion '{companion.display_name}' as {decision}",
            request=request,
        )
        return Response(CompanionSerializer(companion).data, status=status.HTTP_200_OK)
