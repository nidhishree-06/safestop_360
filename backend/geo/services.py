"""Upstream geospatial proxy helpers (Nominatim, Overpass, OSRM) with caching and fallbacks.

Privacy rule: never log raw user coordinates.
"""

from __future__ import annotations

import hashlib
import math
import time
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache

from partners.models import haversine_km

NOMINATIM_CACHE_TTL = 60 * 60 * 24  # 24 hours
OVERPASS_CACHE_TTL = 60 * 10  # 10 minutes
ROUTE_CACHE_TTL = 60 * 5  # 5 minutes

OSM_CATEGORY_TAGS: dict[str, list[tuple[str, str]]] = {
    "PHARMACY": [("amenity", "pharmacy")],
    "HOSPITAL": [("amenity", "hospital"), ("amenity", "clinic")],
    "PETROL_STATION": [("amenity", "fuel")],
    "SHOP": [("shop", "convenience")],
    "HOTEL": [("tourism", "hotel")],
    "COLLEGE_FACILITY": [("amenity", "college")],
}

ALL_OSM_TAGS: list[tuple[str, str]] = [
    ("amenity", "pharmacy"),
    ("amenity", "hospital"),
    ("amenity", "clinic"),
    ("amenity", "fuel"),
    ("shop", "convenience"),
    ("tourism", "hotel"),
    ("amenity", "college"),
]


def _nominatim_headers() -> dict[str, str]:
    return {
        "User-Agent": settings.NOMINATIM_USER_AGENT,
        "Accept": "application/json",
    }


def _respect_nominatim_rate_limit() -> None:
    """Enforce >= 1 request/second politeness interval against public Nominatim."""
    key = "geo:nominatim:last_req_ts"
    last_ts = cache.get(key)
    now = time.monotonic()
    if last_ts is not None:
        elapsed = now - last_ts
        if 0 < elapsed < 1.0:
            time.sleep(min(1.0 - elapsed, 1.0))
    cache.set(key, time.monotonic(), timeout=10)


def geocode_search(query: str, limit: int = 6) -> dict[str, Any]:
    """Search places in India via Nominatim with 24h caching and graceful degradation."""
    cleaned = query.strip()
    if len(cleaned) < 2:
        return {"query": cleaned, "count": 0, "results": [], "unavailable": False}

    cache_key = "geo:search:" + hashlib.sha256(f"{cleaned.lower()}:{limit}".encode()).hexdigest()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    _respect_nominatim_rate_limit()
    url = f"{settings.NOMINATIM_BASE_URL}/search"
    params = {
        "q": cleaned,
        "format": "jsonv2",
        "addressdetails": 1,
        "countrycodes": "in",
        "limit": max(1, min(limit, 10)),
    }
    try:
        resp = requests.get(
            url, params=params, headers=_nominatim_headers(), timeout=6
        )
        resp.raise_for_status()
        raw = resp.json()
        results = []
        for item in raw:
            try:
                results.append(
                    {
                        "display_name": item.get("display_name", ""),
                        "lat": float(item["lat"]),
                        "lng": float(item["lon"]),
                        "type": item.get("type", "place"),
                    }
                )
            except (KeyError, ValueError, TypeError):
                continue
        payload = {
            "query": cleaned,
            "count": len(results),
            "results": results,
            "unavailable": False,
        }
        cache.set(cache_key, payload, timeout=NOMINATIM_CACHE_TTL)
        return payload
    except (requests.RequestException, ValueError):
        return {
            "query": cleaned,
            "count": 0,
            "results": [],
            "unavailable": True,
            "detail": "Address search service is temporarily unavailable. You can still tap directly on the map to set your location.",
        }


def reverse_geocode(lat: float, lng: float) -> dict[str, Any]:
    """Reverse geocode coordinates via Nominatim with 24h caching and graceful fallback."""
    rlat = round(lat, 4)
    rlng = round(lng, 4)
    cache_key = f"geo:reverse:{rlat}:{rlng}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    _respect_nominatim_rate_limit()
    url = f"{settings.NOMINATIM_BASE_URL}/reverse"
    params = {
        "lat": f"{lat:.6f}",
        "lon": f"{lng:.6f}",
        "format": "jsonv2",
        "zoom": 17,
    }
    try:
        resp = requests.get(
            url, params=params, headers=_nominatim_headers(), timeout=6
        )
        resp.raise_for_status()
        data = resp.json()
        display_name = data.get("display_name") or f"Pinned location ({lat:.4f}, {lng:.4f})"
        payload = {
            "display_name": display_name,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "unavailable": False,
        }
        cache.set(cache_key, payload, timeout=NOMINATIM_CACHE_TTL)
        return payload
    except (requests.RequestException, ValueError):
        return {
            "display_name": f"Pinned location ({lat:.4f}, {lng:.4f})",
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "unavailable": True,
        }


def _classify_osm_element(tags: dict[str, str]) -> tuple[str, str]:
    amenity = tags.get("amenity", "")
    shop = tags.get("shop", "")
    tourism = tags.get("tourism", "")
    if amenity == "pharmacy":
        return "PHARMACY", "Pharmacy"
    if amenity in ("hospital", "clinic"):
        return "HOSPITAL", "Hospital / Clinic"
    if amenity == "fuel":
        return "PETROL_STATION", "Petrol Station"
    if shop == "convenience":
        return "SHOP", "Convenience Shop"
    if tourism == "hotel":
        return "HOTEL", "Hotel"
    if amenity == "college":
        return "COLLEGE_FACILITY", "College Facility"
    return "OTHER", "Public Place"


def fetch_osm_nearby_places(
    lat: float, lng: float, radius_m: int = 2000, category: str = "ALL"
) -> dict[str, Any]:
    """Query Overpass API (with mirror fallback + 10-min rounded cache) for unverified OSM places."""
    radius_m = max(250, min(int(radius_m), 10000))
    cat_key = (category or "ALL").strip().upper()
    rlat = round(lat, 3)
    rlng = round(lng, 3)
    cache_key = f"geo:overpass:{rlat}:{rlng}:{radius_m}:{cat_key}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    tag_pairs = OSM_CATEGORY_TAGS.get(cat_key, ALL_OSM_TAGS)
    clauses = []
    for k, v in tag_pairs:
        clauses.append(f'node["{k}"="{v}"](around:{radius_m},{lat:.5f},{lng:.5f});')
        clauses.append(f'way["{k}"="{v}"](around:{radius_m},{lat:.5f},{lng:.5f});')
    overpass_ql = f"[out:json][timeout:8];({''.join(clauses)});out center 60;"

    mirrors = settings.OVERPASS_URLS or ["https://overpass-api.de/api/interpreter"]
    raw_elements: list[dict[str, Any]] | None = None

    for mirror_url in mirrors:
        try:
            resp = requests.post(
                mirror_url,
                data={"data": overpass_ql},
                headers={"User-Agent": settings.NOMINATIM_USER_AGENT},
                timeout=9,
            )
            resp.raise_for_status()
            body = resp.json()
            raw_elements = body.get("elements", [])
            break
        except (requests.RequestException, ValueError):
            continue

    if raw_elements is None:
        return {
            "source": "OSM_UNVERIFIED",
            "label": "OpenStreetMap listing, not verified by SafeStop",
            "count": 0,
            "results": [],
            "unavailable": True,
            "detail": "OpenStreetMap places service is temporarily unreachable. Verified SafeStop partners are unaffected.",
        }

    places: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for el in raw_elements:
        el_id = f"osm-{el.get('type', 'n')}-{el.get('id')}"
        if el_id in seen_ids:
            continue
        el_lat = el.get("lat") or (el.get("center") or {}).get("lat")
        el_lng = el.get("lon") or (el.get("center") or {}).get("lon")
        if el_lat is None or el_lng is None:
            continue
        tags = el.get("tags") or {}
        cat_code, cat_label = _classify_osm_element(tags)
        name = tags.get("name") or f"Unnamed {cat_label}"
        address_parts = [
            tags.get("addr:housenumber", ""),
            tags.get("addr:street", ""),
            tags.get("addr:suburb", ""),
            tags.get("addr:city", ""),
        ]
        address = ", ".join(p for p in address_parts if p) or "OpenStreetMap location"
        dist_km = round(haversine_km(lat, lng, float(el_lat), float(el_lng)), 2)

        seen_ids.add(el_id)
        places.append(
            {
                "id": el_id,
                "name": name,
                "category": cat_code,
                "category_display": cat_label,
                "address": address,
                "latitude": round(float(el_lat), 6),
                "longitude": round(float(el_lng), 6),
                "distance_km": dist_km,
                "opening_hours": tags.get("opening_hours", ""),
                "phone": tags.get("phone") or tags.get("contact:phone") or "",
                "source": "OSM_UNVERIFIED",
                "verified": False,
                "disclaimer": "OpenStreetMap listing, not verified by SafeStop",
            }
        )

    places.sort(key=lambda item: item["distance_km"])
    payload = {
        "source": "OSM_UNVERIFIED",
        "label": "OpenStreetMap listing, not verified by SafeStop",
        "count": len(places),
        "results": places[:60],
        "unavailable": False,
    }
    cache.set(cache_key, payload, timeout=OVERPASS_CACHE_TTL)
    return payload


def build_external_map_links(
    from_lat: float, from_lng: float, to_lat: float, to_lng: float, profile: str
) -> dict[str, str]:
    gmaps_mode = "driving" if profile == "driving" else "walking"
    osm_engine = "fossgis_osrm_car" if profile == "driving" else "fossgis_osrm_foot"
    return {
        "google_maps_url": (
            f"https://www.google.com/maps/dir/?api=1"
            f"&origin={from_lat:.6f},{from_lng:.6f}"
            f"&destination={to_lat:.6f},{to_lng:.6f}"
            f"&travelmode={gmaps_mode}"
        ),
        "osm_url": (
            f"https://www.openstreetmap.org/directions?engine={osm_engine}"
            f"&route={from_lat:.6f}%2C{from_lng:.6f}%3B{to_lat:.6f}%2C{to_lng:.6f}"
        ),
    }


def _straight_line_fallback(
    from_lat: float, from_lng: float, to_lat: float, to_lng: float, profile: str, reason: str
) -> dict[str, Any]:
    dist_km = haversine_km(from_lat, from_lng, to_lat, to_lng)
    dist_m = round(dist_km * 1000.0)
    # Conservative estimates: 4.5 km/h walking, 25 km/h urban driving
    speed_mps = (25.0 / 3.6) if profile == "driving" else (4.5 / 3.6)
    duration_s = max(60, int(math.ceil(dist_m / speed_mps)))
    links = build_external_map_links(from_lat, from_lng, to_lat, to_lng, profile)
    return {
        "profile": profile,
        "fallback": True,
        "fallback_reason": reason,
        "distance_m": dist_m,
        "duration_s": duration_s,
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [round(from_lng, 6), round(from_lat, 6)],
                [round(to_lng, 6), round(to_lat, 6)],
            ],
        },
        **links,
    }


def fetch_route(
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    profile: str = "foot",
) -> dict[str, Any]:
    """Fetch walking or driving route from OSRM with straight-line + deep-link fallback."""
    normalized_profile = "driving" if profile == "driving" else "foot"
    osrm_profile = "driving" if normalized_profile == "driving" else "foot"

    cache_key = (
        f"geo:route:{normalized_profile}:"
        f"{round(from_lat, 4)}:{round(from_lng, 4)}:{round(to_lat, 4)}:{round(to_lng, 4)}"
    )
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    url = (
        f"{settings.OSRM_BASE_URL}/route/v1/{osrm_profile}/"
        f"{from_lng:.6f},{from_lat:.6f};{to_lng:.6f},{to_lat:.6f}"
    )
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
    }
    try:
        resp = requests.get(
            url,
            params=params,
            headers={"User-Agent": settings.NOMINATIM_USER_AGENT},
            timeout=6,
        )
        resp.raise_for_status()
        body = resp.json()
        routes = body.get("routes") or []
        if not routes or not routes[0].get("geometry"):
            return _straight_line_fallback(
                from_lat,
                from_lng,
                to_lat,
                to_lng,
                normalized_profile,
                "No street route returned by routing server; showing straight-line estimate.",
            )
        route = routes[0]
        links = build_external_map_links(
            from_lat, from_lng, to_lat, to_lng, normalized_profile
        )
        payload = {
            "profile": normalized_profile,
            "fallback": False,
            "fallback_reason": "",
            "distance_m": round(float(route.get("distance", 0))),
            "duration_s": round(float(route.get("duration", 0))),
            "geometry": route["geometry"],
            **links,
        }
        cache.set(cache_key, payload, timeout=ROUTE_CACHE_TTL)
        return payload
    except (requests.RequestException, ValueError, KeyError, TypeError):
        return _straight_line_fallback(
            from_lat,
            from_lng,
            to_lat,
            to_lng,
            normalized_profile,
            "Live street routing is temporarily unavailable; showing straight-line distance and map links.",
        )
