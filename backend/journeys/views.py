"""Private Journey Watch, Trusted Contacts, live location ping, and shared status views."""

from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Notification
from accounts.views import log_audit
from journeys.models import Journey, JourneyCheckIn, LocationPing, TrustedContact
from journeys.serializers import (
    JourneyCheckInCreateSerializer,
    JourneyCreateSerializer,
    JourneyLocationPingSerializer,
    JourneySerializer,
    SharedJourneyStatusSerializer,
    TrustedContactSerializer,
)
from partners.models import haversine_km
from safestop.exceptions import error_response

ARRIVAL_PROMPT_RADIUS_METERS = 100.0


def _purge_journey_location_data(journey: Journey) -> int:
    deleted, _ = LocationPing.objects.filter(journey=journey).delete()
    journey.location_sharing_enabled = False
    journey.last_known_latitude = None
    journey.last_known_longitude = None
    return deleted


def _refresh_missed_journeys(user) -> None:
    now = timezone.now()
    active_journeys = Journey.objects.filter(
        owner=user, status=Journey.Status.ACTIVE
    ).prefetch_related("trusted_contacts")
    for journey in active_journeys:
        anchor = journey.last_checkin_at or journey.created_at
        due = journey.expected_checkin_at or min(
            anchor + timedelta(minutes=journey.checkin_interval_minutes),
            journey.expected_arrival_at,
        )
        if now > due:
            journey.status = Journey.Status.MISSED
            journey.save(update_fields=["status", "updated_at"])
            JourneyCheckIn.objects.create(
                journey=journey,
                status=JourneyCheckIn.CheckInStatus.MISSED_REMINDER,
                note="Expected check-in time passed. Reminder created.",
            )
            contact_names = [
                c.name
                for c in journey.trusted_contacts.all()
                if c.notify_on_missed_checkin
            ]
            Notification.objects.create(
                recipient=user,
                title="Journey Watch Missed Check-In",
                body=(
                    f"Your expected check-in for {journey.destination_label} passed. "
                    "Tap Check In Safe or End Journey."
                    + (
                        f" Trusted contacts flagged: {', '.join(contact_names)}."
                        if contact_names
                        else ""
                    )
                ),
                category=Notification.Category.JOURNEY,
                metadata={
                    "journey_id": str(journey.id),
                    "missed": True,
                    "notified_contacts": contact_names,
                },
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
        _refresh_missed_journeys(request.user)
        journeys = (
            Journey.objects.filter(owner=request.user)
            .prefetch_related("trusted_contacts", "checkins", "location_pings")
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

        if Journey.objects.filter(
            owner=request.user,
            status__in=[
                Journey.Status.ACTIVE,
                Journey.Status.MISSED,
                Journey.Status.OVERDUE,
            ],
        ).exists():
            return error_response(
                "You already have an active Journey Watch session. Complete or cancel it first.",
                "active_journey_exists",
                status.HTTP_409_CONFLICT,
            )

        now = timezone.now()
        interval = serializer.validated_data["checkin_interval_minutes"]
        expected_arrival = serializer.validated_data["expected_arrival_at"]
        expected_checkin = min(now + timedelta(minutes=interval), expected_arrival)

        journey = Journey.objects.create(
            owner=request.user,
            origin_label=serializer.validated_data.get("origin_label", "").strip(),
            destination_label=serializer.validated_data["destination_label"].strip(),
            destination_latitude=serializer.validated_data.get("destination_latitude"),
            destination_longitude=serializer.validated_data.get("destination_longitude"),
            expected_arrival_at=expected_arrival,
            expected_checkin_at=expected_checkin,
            checkin_interval_minutes=interval,
            location_sharing_enabled=serializer.validated_data["location_sharing_enabled"],
            last_checkin_at=now,
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
        _refresh_missed_journeys(request.user)
        journey = get_object_or_404(
            Journey.objects.prefetch_related("trusted_contacts", "checkins", "location_pings"),
            pk=pk,
            owner=request.user,
        )
        return Response(JourneySerializer(journey).data, status=status.HTTP_200_OK)


class JourneyCheckInView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        journey = get_object_or_404(Journey, pk=pk, owner=request.user)
        if not journey.is_active_session:
            return error_response(
                "Cannot check in on a completed or cancelled journey.",
                "journey_not_active",
                status.HTTP_409_CONFLICT,
            )

        serializer = JourneyCheckInCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        now = timezone.now()

        lat = serializer.validated_data.get("latitude")
        lng = serializer.validated_data.get("longitude")
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
        journey.expected_checkin_at = min(
            now + timedelta(minutes=journey.checkin_interval_minutes),
            journey.expected_arrival_at,
        )
        if journey.location_sharing_enabled and lat is not None and lng is not None:
            journey.last_known_latitude = lat
            journey.last_known_longitude = lng
        journey.save()

        journey.refresh_from_db()
        return Response(JourneySerializer(journey).data, status=status.HTTP_200_OK)


class JourneyLocationPingView(APIView):
    """Foreground tab posts live location every ~15s while opt-in Journey Watch is active."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "location_ping"

    def post(self, request: Request, pk) -> Response:
        journey = get_object_or_404(Journey, pk=pk, owner=request.user)
        if not journey.is_active_session:
            return error_response(
                "Cannot send location pings for an ended journey.",
                "journey_not_active",
                status.HTTP_409_CONFLICT,
            )
        if not journey.location_sharing_enabled:
            return error_response(
                "Location sharing is paused for this journey.",
                "location_sharing_disabled",
                status.HTTP_400_BAD_REQUEST,
            )

        serializer = JourneyLocationPingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        lat = serializer.validated_data["latitude"]
        lng = serializer.validated_data["longitude"]
        accuracy_m = serializer.validated_data.get("accuracy_m")

        ping = LocationPing.objects.create(
            user=request.user,
            journey=journey,
            latitude=lat,
            longitude=lng,
            accuracy_m=accuracy_m,
        )
        # Keep only the most recent 60 pings per active journey
        stale_ids = list(
            LocationPing.objects.filter(journey=journey)
            .order_by("-created_at")
            .values_list("id", flat=True)[60:]
        )
        if stale_ids:
            LocationPing.objects.filter(id__in=stale_ids).delete()

        journey.last_known_latitude = lat
        journey.last_known_longitude = lng
        journey.save(
            update_fields=["last_known_latitude", "last_known_longitude", "updated_at"]
        )

        distance_to_dest_m = None
        within_arrival_radius = False
        if (
            journey.destination_latitude is not None
            and journey.destination_longitude is not None
        ):
            distance_to_dest_m = round(
                haversine_km(
                    float(lat),
                    float(lng),
                    float(journey.destination_latitude),
                    float(journey.destination_longitude),
                )
                * 1000.0,
                1,
            )
            within_arrival_radius = distance_to_dest_m <= ARRIVAL_PROMPT_RADIUS_METERS

        return Response(
            {
                "id": str(ping.id),
                "created_at": ping.created_at.isoformat(),
                "distance_to_destination_m": distance_to_dest_m,
                "within_arrival_radius": within_arrival_radius,
            },
            status=status.HTTP_201_CREATED,
        )


class JourneyCompleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        journey = get_object_or_404(Journey, pk=pk, owner=request.user)
        if not journey.is_active_session:
            return error_response(
                "This journey has already ended.",
                "journey_already_ended",
                status.HTTP_409_CONFLICT,
            )

        now = timezone.now()
        deleted = _purge_journey_location_data(journey)
        journey.status = Journey.Status.COMPLETED
        journey.completed_at = now
        journey.share_token_revoked = True
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
            summary=f"Confirmed safe arrival, expired share link, deleted {deleted} ping(s)",
            request=request,
        )
        journey.refresh_from_db()
        return Response(JourneySerializer(journey).data, status=status.HTTP_200_OK)


class JourneyCancelView(APIView):
    """Cancel an active Journey Watch, expire its share token, and purge LocationPings."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        journey = get_object_or_404(Journey, pk=pk, owner=request.user)
        if not journey.is_active_session:
            return error_response(
                "This journey has already ended.",
                "journey_already_ended",
                status.HTTP_409_CONFLICT,
            )

        deleted = _purge_journey_location_data(journey)
        journey.status = Journey.Status.CANCELLED
        journey.completed_at = timezone.now()
        journey.share_token_revoked = True
        journey.save()

        log_audit(
            actor=request.user,
            action="JOURNEY_CANCELLED",
            target_type="JOURNEY",
            target_id=str(journey.id),
            summary=f"Cancelled Journey Watch, expired share link, deleted {deleted} ping(s)",
            request=request,
        )
        journey.refresh_from_db()
        return Response(JourneySerializer(journey).data, status=status.HTTP_200_OK)


class JourneyStopSharingView(APIView):
    """Immediate user control to stop opt-in location sharing, revoke link, or end journey."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request: Request, pk) -> Response:
        journey = get_object_or_404(Journey, pk=pk, owner=request.user)
        end_journey = bool(request.data.get("end_journey", False))
        revoke_link = bool(request.data.get("revoke_link", False))

        deleted = _purge_journey_location_data(journey)
        if revoke_link or end_journey:
            journey.share_token_revoked = True
        if end_journey and journey.is_active_session:
            journey.status = Journey.Status.CANCELLED
            journey.completed_at = timezone.now()
        journey.save()

        log_audit(
            actor=request.user,
            action="JOURNEY_SHARING_STOPPED",
            target_type="JOURNEY",
            target_id=str(journey.id),
            summary=(
                f"Stopped journey location sharing (end={end_journey}, "
                f"revoked={journey.share_token_revoked}, deleted={deleted} pings)"
            ),
            request=request,
        )
        journey.refresh_from_db()
        return Response(JourneySerializer(journey).data, status=status.HTTP_200_OK)


class SharedJourneyStatusView(APIView):
    """Private read-only status page for trusted contacts via an unguessable, expiring token.

    Automatically expires when the journey completes, cancels, or the link is revoked.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request: Request, token: str) -> Response:
        journey = (
            Journey.objects.select_related("owner")
            .prefetch_related("checkins", "location_pings")
            .filter(share_token=token)
            .first()
        )
        if not journey:
            return error_response(
                "This journey status link is invalid.",
                "invalid_share_token",
                status.HTTP_404_NOT_FOUND,
            )
        if not journey.is_share_link_valid:
            return error_response(
                "This journey status link has expired or been revoked by the traveler.",
                "share_token_expired",
                status.HTTP_410_GONE,
            )
        return Response(
            SharedJourneyStatusSerializer(journey).data, status=status.HTTP_200_OK
        )
