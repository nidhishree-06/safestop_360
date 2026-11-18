"""Private Journey Watch and Trusted Contacts API views."""

from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Notification
from accounts.views import log_audit
from journeys.models import Journey, JourneyCheckIn, TrustedContact
from journeys.serializers import (
    JourneyCheckInCreateSerializer,
    JourneyCreateSerializer,
    JourneySerializer,
    TrustedContactSerializer,
)


def _refresh_overdue_journeys(user) -> None:
    now = timezone.now()
    active_journeys = Journey.objects.filter(owner=user, status=Journey.Status.ACTIVE)
    for journey in active_journeys:
        anchor = journey.last_checkin_at or journey.created_at
        due = min(
            anchor + timedelta(minutes=journey.checkin_interval_minutes),
            journey.expected_arrival_at,
        )
        if now > due:
            journey.status = Journey.Status.OVERDUE
            journey.save(update_fields=["status", "updated_at"])
            JourneyCheckIn.objects.create(
                journey=journey,
                status=JourneyCheckIn.CheckInStatus.MISSED_REMINDER,
                note="Check-in reminder triggered.",
            )
            Notification.objects.create(
                recipient=user,
                title="Journey Watch Check-In Reminder",
                body=(
                    f"Time to check in for your journey to {journey.destination_label}. "
                    "Tap Check In Safe or End Journey."
                ),
                category=Notification.Category.JOURNEY,
                metadata={"journey_id": str(journey.id)},
            )


class TrustedContactListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        contacts = TrustedContact.objects.filter(owner=request.user)
        data = TrustedContactSerializer(contacts, many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)

    def post(self, request: Request) -> Response:
        serializer = TrustedContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        contact = serializer.save(owner=request.user)
        return Response(
            TrustedContactSerializer(contact).data, status=status.HTTP_201_CREATED
        )


class TrustedContactDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request: Request, pk) -> Response:
        contact = get_object_or_404(TrustedContact, pk=pk, owner=request.user)
        serializer = TrustedContactSerializer(contact, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(TrustedContactSerializer(updated).data, status=status.HTTP_200_OK)

    def delete(self, request: Request, pk) -> Response:
        contact = get_object_or_404(TrustedContact, pk=pk, owner=request.user)
        contact.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class JourneyListCreateView(APIView):
    """Strictly private to the journey owner. Never exposes journeys publicly."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request) -> Response:
        _refresh_overdue_journeys(request.user)
        journeys = (
            Journey.objects.filter(owner=request.user)
            .prefetch_related("trusted_contacts", "checkins")
            .order_by("-created_at")[:25]
        )
        data = JourneySerializer(journeys, many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)

    def post(self, request: Request) -> Response:
        serializer = JourneyCreateSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        contacts = serializer.validated_data.pop("trusted_contact_ids", [])

        # Complete/cancel any prior lingering active journey before starting a new one?
        # Keep validation clear: one active journey at a time prevents confusion.
        if Journey.objects.filter(
            owner=request.user, status__in=[Journey.Status.ACTIVE, Journey.Status.OVERDUE]
        ).exists():
            return Response(
                {
                    "detail": (
                        "You already have an active Journey Watch session. Complete or "
                        "end it before starting a new one."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        journey = Journey.objects.create(
            owner=request.user,
            origin_label=serializer.validated_data.get("origin_label", "").strip(),
            destination_label=serializer.validated_data["destination_label"].strip(),
            expected_arrival_at=serializer.validated_data["expected_arrival_at"],
            checkin_interval_minutes=serializer.validated_data["checkin_interval_minutes"],
            location_sharing_enabled=serializer.validated_data["location_sharing_enabled"],
            last_checkin_at=timezone.now(),
        )
        if contacts:
            journey.trusted_contacts.set(contacts)

        JourneyCheckIn.objects.create(
            journey=journey,
            status=JourneyCheckIn.CheckInStatus.SAFE,
            note="Journey Watch started.",
        )
        log_audit(
            actor=request.user,
            action="JOURNEY_STARTED",
            target_type="JOURNEY",
            target_id=str(journey.id),
            summary=f"Started private Journey Watch (opt-in sharing={journey.location_sharing_enabled})",
            request=request,
        )
        journey.refresh_from_db()
        return Response(JourneySerializer(journey).data, status=status.HTTP_201_CREATED)


class JourneyDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Request, pk) -> Response:
        _refresh_overdue_journeys(request.user)
        journey = get_object_or_404(
            Journey.objects.prefetch_related("trusted_contacts", "checkins"),
            pk=pk,
            owner=request.user,
        )
        return Response(JourneySerializer(journey).data, status=status.HTTP_200_OK)


class JourneyCheckInView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        journey = get_object_or_404(Journey, pk=pk, owner=request.user)
        if journey.status not in (Journey.Status.ACTIVE, Journey.Status.OVERDUE):
            return Response(
                {"detail": "Cannot check in on a completed or ended journey."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = JourneyCheckInCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        now = timezone.now()

        lat = serializer.validated_data.get("latitude")
        lng = serializer.validated_data.get("longitude")
        # Strictly respect opt-in sharing control
        if not journey.location_sharing_enabled:
            lat = None
            lng = None

        JourneyCheckIn.objects.create(
            journey=journey,
            status=serializer.validated_data["status"],
            note=serializer.validated_data.get("note", "").strip(),
            latitude=lat,
            longitude=lng,
        )
        journey.status = Journey.Status.ACTIVE
        journey.last_checkin_at = now
        if journey.location_sharing_enabled and lat is not None and lng is not None:
            journey.last_known_latitude = lat
            journey.last_known_longitude = lng
        journey.save()

        journey.refresh_from_db()
        return Response(JourneySerializer(journey).data, status=status.HTTP_200_OK)


class JourneyCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        journey = get_object_or_404(Journey, pk=pk, owner=request.user)
        if journey.status in (Journey.Status.COMPLETED, Journey.Status.CANCELLED):
            return Response(
                {"detail": "This journey has already ended."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        journey.status = Journey.Status.COMPLETED
        journey.completed_at = now
        journey.location_sharing_enabled = False
        journey.last_known_latitude = None
        journey.last_known_longitude = None
        journey.save()

        JourneyCheckIn.objects.create(
            journey=journey,
            status=JourneyCheckIn.CheckInStatus.ARRIVED,
            note="Arrived safely and ended Journey Watch.",
        )
        log_audit(
            actor=request.user,
            action="JOURNEY_COMPLETED",
            target_type="JOURNEY",
            target_id=str(journey.id),
            summary="Confirmed safe arrival and disabled location sharing",
            request=request,
        )
        journey.refresh_from_db()
        return Response(JourneySerializer(journey).data, status=status.HTTP_200_OK)


class JourneyStopSharingView(APIView):
    """Immediate user control to stop opt-in location sharing and/or end journey."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        journey = get_object_or_404(Journey, pk=pk, owner=request.user)
        end_journey = bool(request.data.get("end_journey", False))

        journey.location_sharing_enabled = False
        journey.last_known_latitude = None
        journey.last_known_longitude = None
        if end_journey and journey.status in (Journey.Status.ACTIVE, Journey.Status.OVERDUE):
            journey.status = Journey.Status.CANCELLED
            journey.completed_at = timezone.now()
        journey.save()

        log_audit(
            actor=request.user,
            action="JOURNEY_SHARING_STOPPED",
            target_type="JOURNEY",
            target_id=str(journey.id),
            summary=f"Revoked journey location sharing (end_journey={end_journey})",
            request=request,
        )
        journey.refresh_from_db()
        return Response(JourneySerializer(journey).data, status=status.HTTP_200_OK)
