"""Geo proxy API views: search, reverse geocode, OSM nearby places, and OSRM routing."""

from rest_framework import permissions, status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from geo.services import (
    fetch_osm_nearby_places,
    fetch_route,
    geocode_search,
    reverse_geocode,
)
from safestop.exceptions import error_response


def _parse_lat_lng(
    request: Request, lat_param: str = "lat", lng_param: str = "lng"
) -> tuple[float, float] | Response:
    try:
        lat = float(request.query_params.get(lat_param, ""))
        lng = float(request.query_params.get(lng_param, ""))
    except ValueError:
        return error_response(
            f"Valid numeric {lat_param} and {lng_param} query parameters are required.",
            "invalid_coordinates",
            status.HTTP_400_BAD_REQUEST,
        )
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return error_response(
            "Coordinates are out of valid latitude/longitude bounds.",
            "coordinates_out_of_range",
            status.HTTP_400_BAD_REQUEST,
        )
    return lat, lng


class GeoSearchView(APIView):
    """Nominatim search proxy (India-scoped, 24h cached, throttled)."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "geo_proxy"

    def get(self, request: Request) -> Response:
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return error_response(
                "Please enter at least 2 characters to search.",
                "query_too_short",
                status.HTTP_400_BAD_REQUEST,
            )
        try:
            limit = int(request.query_params.get("limit", "6"))
        except ValueError:
            limit = 6
        return Response(geocode_search(query, limit=limit), status=status.HTTP_200_OK)


class GeoReverseView(APIView):
    """Nominatim reverse-geocode proxy (24h cached, throttled)."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "geo_proxy"

    def get(self, request: Request) -> Response:
        parsed = _parse_lat_lng(request)
        if isinstance(parsed, Response):
            return parsed
        lat, lng = parsed
        return Response(reverse_geocode(lat, lng), status=status.HTTP_200_OK)


class GeoPlacesView(APIView):
    """Overpass API proxy for unverified OpenStreetMap places (separate from SafeStop partners)."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "geo_proxy"

    def get(self, request: Request) -> Response:
        parsed = _parse_lat_lng(request)
        if isinstance(parsed, Response):
            return parsed
        lat, lng = parsed
        try:
            radius_m = int(float(request.query_params.get("radius", "2000")))
        except ValueError:
            return error_response(
                "radius must be a valid number in metres.",
                "invalid_radius",
                status.HTTP_400_BAD_REQUEST,
            )
        if radius_m < 250 or radius_m > 10000:
            return error_response(
                "radius must be between 250 and 10000 metres.",
                "invalid_radius",
                status.HTTP_400_BAD_REQUEST,
            )
        category = request.query_params.get("category", "ALL").strip().upper()
        return Response(
            fetch_osm_nearby_places(lat, lng, radius_m=radius_m, category=category),
            status=status.HTTP_200_OK,
        )


class GeoRouteView(APIView):
    """OSRM directions proxy with walking/driving toggle and straight-line + deep-link fallback."""

    permission_classes = [permissions.AllowAny]
    throttle_scope = "geo_proxy"

    def get(self, request: Request) -> Response:
        origin = _parse_lat_lng(request, "from_lat", "from_lng")
        if isinstance(origin, Response):
            return origin
        dest = _parse_lat_lng(request, "to_lat", "to_lng")
        if isinstance(dest, Response):
            return dest
        profile = request.query_params.get("profile", "foot").strip().lower()
        if profile not in ("foot", "driving"):
            return error_response(
                "profile must be 'foot' or 'driving'.",
                "invalid_profile",
                status.HTTP_400_BAD_REQUEST,
            )
        data = fetch_route(origin[0], origin[1], dest[0], dest[1], profile=profile)
        return Response(data, status=status.HTTP_200_OK)
