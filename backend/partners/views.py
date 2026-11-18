"""Partner directory and nearby geolocation search views."""

import math

from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Notification
from accounts.views import log_audit
from partners.models import Partner, PartnerAvailability, PartnerVerification, haversine_km
from partners.serializers import (
    AdminPartnerReviewSerializer,
    PartnerAvailabilitySerializer,
    PartnerAvailabilityUpdateSerializer,
    PartnerCreateUpdateSerializer,
    PartnerOwnerSerializer,
    PartnerPublicSerializer,
)
from safestop.exceptions import error_response
from safestop.permissions import IsAdminRole, IsPartnerOrAdmin

DEFAULT_MYSURU_LAT = 12.2958
DEFAULT_MYSURU_LNG = 76.6394
MAX_NEARBY_RADIUS_KM = 25.0


def bounding_box_for_radius(lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    """Compute a conservative WGS84 bounding box (min_lat, max_lat, min_lng, max_lng)."""
    lat_delta = radius_km / 111.32
    cos_lat = max(math.cos(math.radians(lat)), 0.01)
    lng_delta = radius_km / (111.32 * cos_lat)
    return (
        max(-90.0, lat - lat_delta),
        min(90.0, lat + lat_delta),
        max(-180.0, lng - lng_delta),
        min(180.0, lng + lng_delta),
    )


def _filter_partners_queryset(request: Request, qs):
    category = request.query_params.get("category", "").strip().upper()
    if category and category != "ALL":
        qs = qs.filter(category=category)

    city = request.query_params.get("city", "").strip()
    if city:
        qs = qs.filter(city__icontains=city)

    search = request.query_params.get("search", "").strip()
    if search:
        qs = qs.filter(
            Q(name__icontains=search)
            | Q(area__icontains=search)
            | Q(address__icontains=search)
        )

    available_only = request.query_params.get("available_only", "").strip().lower()
    if available_only in ("true", "1", "yes"):
        qs = qs.filter(availability__status=PartnerAvailability.Status.AVAILABLE)

    return qs


class PartnerListView(APIView):
    """Public list of admin-APPROVED partner establishments."""

    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        qs = Partner.objects.select_related("availability").filter(
            verification_status=Partner.VerificationStatus.APPROVED
        )
        qs = _filter_partners_queryset(request, qs)
        serializer = PartnerPublicSerializer(qs, many=True)
        return Response(
            {"count": len(serializer.data), "results": serializer.data},
            status=status.HTTP_200_OK,
        )


class NearbyPartnersView(APIView):
    """Nearby APPROVED partners via bounding-box prefilter + Haversine. Never persists user coordinates."""

    permission_classes = [permissions.AllowAny]

    def get(self, request: Request) -> Response:
        try:
            lat = float(request.query_params.get("lat", DEFAULT_MYSURU_LAT))
            lng = float(request.query_params.get("lng", DEFAULT_MYSURU_LNG))
            radius_km = float(request.query_params.get("radius_km", 5.0))
        except ValueError:
            return error_response(
                "Invalid latitude, longitude, or radius_km value.",
                "invalid_coordinates",
                status.HTTP_400_BAD_REQUEST,
            )

        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            return error_response(
                "Coordinates out of valid geographic bounds.",
                "coordinates_out_of_range",
                status.HTTP_400_BAD_REQUEST,
            )

        if radius_km <= 0 or radius_km > MAX_NEARBY_RADIUS_KM:
            return error_response(
                f"radius_km must be between 0.1 and {MAX_NEARBY_RADIUS_KM} km.",
                "invalid_radius",
                status.HTTP_400_BAD_REQUEST,
            )

        min_lat, max_lat, min_lng, max_lng = bounding_box_for_radius(lat, lng, radius_km)

        qs = Partner.objects.select_related("availability").filter(
            verification_status=Partner.VerificationStatus.APPROVED,
            latitude__gte=min_lat,
            latitude__lte=max_lat,
            longitude__gte=min_lng,
            longitude__lte=max_lng,
        )
        qs = _filter_partners_queryset(request, qs)

        matched: list[Partner] = []
        for partner in qs:
            dist = haversine_km(lat, lng, float(partner.latitude), float(partner.longitude))
            if dist <= radius_km:
                partner.distance_km = dist  # type: ignore[attr-defined]
                matched.append(partner)

        matched.sort(key=lambda item: getattr(item, "distance_km", 9999.0))
        serializer = PartnerPublicSerializer(matched, many=True)
        return Response(
            {
                "origin": {"lat": round(lat, 6), "lng": round(lng, 6)},
                "radius_km": radius_km,
                "count": len(serializer.data),
                "results": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class PartnerDetailView(APIView):
    """Detail view for an approved partner (or own/admin reviewable partner)."""

    permission_classes = [permissions.AllowAny]

    def get(self, request: Request, pk) -> Response:
        partner = get_object_or_404(
            Partner.objects.select_related("availability"), pk=pk
        )
        user = request.user
        is_owner = bool(user and user.is_authenticated and partner.owner_id == user.id)
        is_admin = bool(
            user
            and user.is_authenticated
            and (getattr(user, "role", None) == "ADMIN" or user.is_superuser)
        )
        if partner.verification_status != Partner.VerificationStatus.APPROVED and not (
            is_owner or is_admin
        ):
            return Response(
                {"detail": "Partner establishment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(PartnerPublicSerializer(partner).data, status=status.HTTP_200_OK)

    def patch(self, request: Request, pk) -> Response:
        if not request.user or not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        partner = get_object_or_404(
            Partner.objects.select_related("availability").prefetch_related("verifications"),
            pk=pk,
        )
        is_owner = partner.owner_id == request.user.id
        is_admin = getattr(request.user, "role", None) == "ADMIN" or request.user.is_superuser
        if not (is_owner or is_admin):
            return Response(
                {"detail": "You do not have permission to edit this establishment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PartnerCreateUpdateSerializer(partner, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()

        log_audit(
            actor=request.user,
            action="PARTNER_UPDATED",
            target_type="PARTNER",
            target_id=str(updated.id),
            summary=f"Updated establishment details for {updated.name}",
            request=request,
        )
        return Response(PartnerOwnerSerializer(updated).data, status=status.HTTP_200_OK)


class PartnerRegisterView(APIView):
    """Register a new partner establishment (strictly starts as PENDING admin approval)."""

    permission_classes = [IsPartnerOrAdmin]

    def post(self, request: Request) -> Response:
        serializer = PartnerCreateUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        partner = serializer.save(
            owner=request.user,
            verification_status=Partner.VerificationStatus.PENDING,
        )
        PartnerAvailability.objects.create(
            partner=partner,
            status=PartnerAvailability.Status.OFFLINE,
            status_note="Awaiting administrator verification",
        )
        log_audit(
            actor=request.user,
            action="PARTNER_REGISTERED",
            target_type="PARTNER",
            target_id=str(partner.id),
            summary=f"Submitted partner establishment '{partner.name}' for review",
            request=request,
        )
        partner.refresh_from_db()
        return Response(
            PartnerOwnerSerializer(partner).data, status=status.HTTP_201_CREATED
        )


class MyPartnersView(APIView):
    """List establishments owned by the authenticated Partner user."""

    permission_classes = [IsPartnerOrAdmin]

    def get(self, request: Request) -> Response:
        qs = (
            Partner.objects.select_related("availability", "owner")
            .prefetch_related("verifications__reviewed_by")
            .filter(owner=request.user)
            .order_by("-created_at")
        )
        data = PartnerOwnerSerializer(qs, many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)


class PartnerAvailabilityView(APIView):
    """Toggle real-time availability status for an approved partner."""

    permission_classes = [IsPartnerOrAdmin]

    def patch(self, request: Request, pk) -> Response:
        partner = get_object_or_404(Partner, pk=pk)
        is_admin = getattr(request.user, "role", None) == "ADMIN" or request.user.is_superuser
        if partner.owner_id != request.user.id and not is_admin:
            return Response(
                {"detail": "You can only manage availability for your own establishment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PartnerAvailabilityUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        next_status = serializer.validated_data["status"]
        note = serializer.validated_data.get("status_note", "").strip()

        if (
            partner.verification_status != Partner.VerificationStatus.APPROVED
            and next_status != PartnerAvailability.Status.OFFLINE
        ):
            return Response(
                {
                    "detail": (
                        "Only administrator-approved establishments can switch to "
                        "AVAILABLE or BUSY."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        availability, _ = PartnerAvailability.objects.get_or_create(partner=partner)
        availability.status = next_status
        availability.status_note = note
        availability.save()

        log_audit(
            actor=request.user,
            action="PARTNER_AVAILABILITY_UPDATED",
            target_type="PARTNER",
            target_id=str(partner.id),
            summary=f"{partner.name} availability set to {next_status}",
            request=request,
        )
        return Response(
            {
                "partner_id": str(partner.id),
                "availability": PartnerAvailabilitySerializer(availability).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminPartnerListView(APIView):
    """Administrator list of all partner establishments across all verification states."""

    permission_classes = [IsAdminRole]

    def get(self, request: Request) -> Response:
        qs = (
            Partner.objects.select_related("availability", "owner")
            .prefetch_related("verifications__reviewed_by")
            .all()
            .order_by("-created_at")
        )
        status_filter = request.query_params.get("status", "").strip().upper()
        if status_filter and status_filter != "ALL":
            qs = qs.filter(verification_status=status_filter)

        category_filter = request.query_params.get("category", "").strip().upper()
        if category_filter and category_filter != "ALL":
            qs = qs.filter(category=category_filter)

        data = PartnerOwnerSerializer(qs, many=True).data
        return Response({"count": len(data), "results": data}, status=status.HTTP_200_OK)


class AdminPartnerReviewView(APIView):
    """Administrator approval / rejection / suspension decision with audit trail."""

    permission_classes = [IsAdminRole]

    def post(self, request: Request, pk) -> Response:
        partner = get_object_or_404(
            Partner.objects.select_related("availability", "owner"), pk=pk
        )
        serializer = AdminPartnerReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        decision = serializer.validated_data["status"]
        notes = serializer.validated_data.get("notes", "").strip()

        partner.verification_status = decision
        partner.save(update_fields=["verification_status", "updated_at"])

        PartnerVerification.objects.create(
            partner=partner,
            reviewed_by=request.user,
            status=decision,
            notes=notes,
        )

        availability, _ = PartnerAvailability.objects.get_or_create(partner=partner)
        if decision == Partner.VerificationStatus.APPROVED:
            if availability.status == PartnerAvailability.Status.OFFLINE:
                availability.status = PartnerAvailability.Status.AVAILABLE
                availability.status_note = "Approved and ready"
                availability.save()
        else:
            availability.status = PartnerAvailability.Status.OFFLINE
            availability.status_note = f"Status: {decision}"
            availability.save()

        Notification.objects.create(
            recipient=partner.owner,
            title=f"Partner Verification Update: {decision}",
            body=(
                f"Your establishment '{partner.name}' has been marked {decision}."
                + (f" Admin note: {notes}" if notes else "")
            ),
            category=Notification.Category.PARTNER,
            metadata={"partner_id": str(partner.id), "status": decision},
        )
        log_audit(
            actor=request.user,
            action="PARTNER_VERIFICATION_DECISION",
            target_type="PARTNER",
            target_id=str(partner.id),
            summary=f"Marked '{partner.name}' as {decision}",
            metadata={"notes": notes},
            request=request,
        )
        partner.refresh_from_db()
        return Response(PartnerOwnerSerializer(partner).data, status=status.HTTP_200_OK)
