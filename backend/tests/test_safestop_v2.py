"""Comprehensive pytest suite for SafeStop 360 v2 (GPS-First)."""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
import requests
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from analysis.analyzer import analyze_reports, classify_report_text, haversine_distance_km
from assistance.models import HelpRequest
from journeys.models import Journey, LocationPing, TrustedContact
from partners.models import Partner, PartnerAvailability, haversine_km
from partners.views import bounding_box_for_radius
from reports.models import SafetyReport


@pytest.fixture(autouse=True)
def clear_cache_and_disable_throttles(settings):
    cache.clear()
    settings.REST_FRAMEWORK = {
        **settings.REST_FRAMEWORK,
        "DEFAULT_THROTTLE_CLASSES": [],
    }
    yield
    cache.clear()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def demo_users(db):
    woman = User.objects.create_user(
        email="woman.test@safestop.demo",
        password="Woman@12345",
        full_name="Test Woman",
        role=User.Role.WOMAN,
    )
    partner_owner = User.objects.create_user(
        email="partner.test@safestop.demo",
        password="Partner@12345",
        full_name="Test Partner",
        role=User.Role.PARTNER,
    )
    admin = User.objects.create_superuser(
        email="admin.test@safestop.demo",
        password="Admin@12345",
        full_name="Test Admin",
    )
    return {"woman": woman, "partner": partner_owner, "admin": admin}


def _auth_client(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ---------------------------------------------------------------------------
# 1. Auth, Role Permissions & Error Shape {"detail", "code"}
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_auth_register_login_me_and_role_permissions(api_client, demo_users):
    # Register new woman
    res = api_client.post(
        "/api/auth/register/",
        {
            "email": "new.woman@safestop.demo",
            "password": "StrongPassword@123",
            "full_name": "Asha K",
            "role": "WOMAN",
        },
        format="json",
    )
    assert res.status_code == 201
    assert "tokens" in res.data

    # Invalid login returns {"detail", "code"}
    bad_login = api_client.post(
        "/api/auth/login/",
        {"email": "new.woman@safestop.demo", "password": "wrong"},
        format="json",
    )
    assert bad_login.status_code == 400
    assert "detail" in bad_login.data and "code" in bad_login.data

    # Woman cannot access admin analytics or audit-logs
    woman_client = _auth_client(demo_users["woman"])
    assert woman_client.get("/api/admin/analytics/").status_code == 403
    assert woman_client.get("/api/admin/audit-logs/").status_code == 403

    # Admin can access both
    admin_client = _auth_client(demo_users["admin"])
    assert admin_client.get("/api/admin/analytics/").status_code == 200
    assert admin_client.get("/api/admin/audit-logs/").status_code == 200


# ---------------------------------------------------------------------------
# 2. Haversine, Bounding-Box Prefilter & Nearby Radius Validation
# ---------------------------------------------------------------------------


def test_haversine_and_bounding_box_math():
    # Mysuru Palace (12.3052, 76.6552) to KR Circle (12.3078, 76.6525) ~ 0.41 km
    d = haversine_km(12.3052, 76.6552, 12.3078, 76.6525)
    assert 0.35 < d < 0.50

    min_lat, max_lat, min_lng, max_lng = bounding_box_for_radius(12.2958, 76.6394, 5.0)
    assert min_lat < 12.2958 < max_lat
    assert min_lng < 76.6394 < max_lng


@pytest.mark.django_db
def test_nearby_partners_bbox_sorting_and_radius_validation(api_client, demo_users):
    near = Partner.objects.create(
        owner=demo_users["partner"],
        name="Near Pharmacy",
        category=Partner.Category.PHARMACY,
        address="Near KR Circle",
        city="Mysuru",
        latitude=Decimal("12.297000"),
        longitude=Decimal("76.640000"),
        contact_phone="+91-821-0001",
        verification_status=Partner.VerificationStatus.APPROVED,
    )
    PartnerAvailability.objects.create(partner=near, status=PartnerAvailability.Status.AVAILABLE)

    far = Partner.objects.create(
        owner=demo_users["partner"],
        name="Far Hospital",
        category=Partner.Category.HOSPITAL,
        address="Far Ring Road",
        city="Mysuru",
        latitude=Decimal("12.330000"),
        longitude=Decimal("76.640000"),
        contact_phone="+91-821-0002",
        verification_status=Partner.VerificationStatus.APPROVED,
    )
    PartnerAvailability.objects.create(partner=far, status=PartnerAvailability.Status.AVAILABLE)

    pending = Partner.objects.create(
        owner=demo_users["partner"],
        name="Unapproved Shop",
        category=Partner.Category.SHOP,
        address="Pending Lane",
        city="Mysuru",
        latitude=Decimal("12.296000"),
        longitude=Decimal("76.639500"),
        contact_phone="+91-821-0003",
        verification_status=Partner.VerificationStatus.PENDING,
    )
    PartnerAvailability.objects.create(partner=pending, status=PartnerAvailability.Status.AVAILABLE)

    # Radius > 25 km rejected with 400 and {"detail", "code"}
    bad = api_client.get("/api/partners/nearby/?lat=12.2958&lng=76.6394&radius_km=30")
    assert bad.status_code == 400
    assert bad.data["code"] == "invalid_radius"

    # Radius 2 km returns only Near Pharmacy (excludes Far Hospital >3.8 km and Unapproved Shop)
    ok = api_client.get("/api/partners/nearby/?lat=12.2958&lng=76.6394&radius_km=2")
    assert ok.status_code == 200
    assert ok.data["count"] == 1
    assert ok.data["results"][0]["name"] == "Near Pharmacy"

    # Radius 10 km returns both approved sorted by distance
    both = api_client.get("/api/partners/nearby/?lat=12.2958&lng=76.6394&radius_km=10")
    assert both.status_code == 200
    assert [p["name"] for p in both.data["results"]] == ["Near Pharmacy", "Far Hospital"]


# ---------------------------------------------------------------------------
# 3. Full E2E Assistance Loop + State Machine (409) + Location Cleanup
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_full_assistance_loop_and_location_ping_cleanup(demo_users):
    partner_client = _auth_client(demo_users["partner"])
    admin_client = _auth_client(demo_users["admin"])
    woman_client = _auth_client(demo_users["woman"])

    # 1. Partner registers -> starts PENDING
    reg = partner_client.post(
        "/api/partners/register/",
        {
            "name": "Demo Gokulam Safe Pharmacy",
            "category": "PHARMACY",
            "address": "Contour Road, Mysuru",
            "area": "Gokulam",
            "city": "Mysuru",
            "latitude": "12.301000",
            "longitude": "76.638000",
            "contact_phone": "+91-821-5555",
            "operating_hours": "24/7",
        },
        format="json",
    )
    assert reg.status_code == 201
    partner_id = reg.data["id"]

    # Blocked before approval
    blocked = woman_client.post(
        "/api/requests/",
        {"partner": partner_id, "note": "Need shelter"},
        format="json",
    )
    assert blocked.status_code == 400

    # 2. Admin approves partner
    approve = admin_client.post(
        f"/api/admin/partners/{partner_id}/review/",
        {"status": "APPROVED", "notes": "Verified ID & address"},
        format="json",
    )
    assert approve.status_code == 200

    # Partner now appears in nearby search
    nearby = woman_client.get("/api/partners/nearby/?lat=12.2958&lng=76.6394&radius_km=5")
    assert any(p["id"] == partner_id for p in nearby.data["results"])

    # 3. Woman sends request with live location consent
    req = woman_client.post(
        "/api/requests/",
        {
            "partner": partner_id,
            "note": "Walking over from bus stop",
            "share_live_location": True,
            "requester_latitude": "12.296200",
            "requester_longitude": "76.639200",
        },
        format="json",
    )
    assert req.status_code == 201
    req_id = req.data["id"]
    assert LocationPing.objects.filter(help_request_id=req_id).count() == 1

    # Before ACCEPTED, partner MUST NOT see requester's live coordinates
    partner_view_pending = partner_client.get(f"/api/requests/{req_id}/")
    assert partner_view_pending.status_code == 200
    assert partner_view_pending.data["latest_location"] is None
    assert partner_view_pending.data["requester_latitude"] is None

    # Invalid transition: woman cannot accept; partner cannot arrive; PENDING->CLOSED returns 409
    assert woman_client.post(f"/api/requests/{req_id}/accept/").status_code == 403
    assert partner_client.post(f"/api/requests/{req_id}/arrived/").status_code == 403
    conflict = partner_client.post(f"/api/requests/{req_id}/close/")
    assert conflict.status_code == 409
    assert conflict.data["code"] == "invalid_transition"

    # 4. Partner accepts
    accepted = partner_client.post(
        f"/api/requests/{req_id}/accept/",
        {"response_note": "Front desk ready for you"},
        format="json",
    )
    assert accepted.status_code == 200
    assert accepted.data["status"] == "ACCEPTED"
    # After ACCEPTED, assigned partner sees requester's live position
    assert accepted.data["latest_location"] is not None

    # Woman posts another live location ping
    ping_res = woman_client.post(
        f"/api/requests/{req_id}/location/",
        {"latitude": "12.299500", "longitude": "76.638500", "accuracy_m": 18.0},
        format="json",
    )
    assert ping_res.status_code == 201
    assert LocationPing.objects.filter(help_request_id=req_id).count() == 2

    # 5. Woman confirms arrival
    arrived = woman_client.post(f"/api/requests/{req_id}/arrived/")
    assert arrived.status_code == 200
    assert arrived.data["status"] == "ARRIVED"

    # 6. Partner closes -> LocationPing rows MUST BE DELETED
    closed = partner_client.post(f"/api/requests/{req_id}/close/")
    assert closed.status_code == 200
    assert closed.data["status"] == "CLOSED"
    assert LocationPing.objects.filter(help_request_id=req_id).count() == 0

    # 7. Woman saves feedback
    fb = woman_client.post(
        f"/api/requests/{req_id}/feedback/",
        {"rating": 5, "felt_safe": True, "comment": "Very supportive staff"},
        format="json",
    )
    assert fb.status_code == 201


@pytest.mark.django_db
def test_pending_request_auto_expires_after_10_minutes_and_purges_pings(demo_users):
    partner = Partner.objects.create(
        owner=demo_users["partner"],
        name="Expiry Test Place",
        category=Partner.Category.HOTEL,
        address="MG Road, Mysuru",
        city="Mysuru",
        latitude=Decimal("12.297400"),
        longitude=Decimal("76.664500"),
        contact_phone="+91-821-7777",
        verification_status=Partner.VerificationStatus.APPROVED,
    )
    PartnerAvailability.objects.create(partner=partner, status=PartnerAvailability.Status.AVAILABLE)

    hr = HelpRequest.objects.create(
        requester=demo_users["woman"],
        partner=partner,
        share_live_location=True,
        requester_latitude=Decimal("12.296000"),
        requester_longitude=Decimal("76.660000"),
        expires_at=timezone.now() - timedelta(minutes=1),
    )
    LocationPing.objects.create(
        user=demo_users["woman"],
        help_request=hr,
        latitude=Decimal("12.296000"),
        longitude=Decimal("76.660000"),
    )

    woman_client = _auth_client(demo_users["woman"])
    detail = woman_client.get(f"/api/requests/{hr.id}/")
    assert detail.status_code == 200
    assert detail.data["status"] == "EXPIRED"
    assert LocationPing.objects.filter(help_request=hr).count() == 0


# ---------------------------------------------------------------------------
# 4. Geo Proxies (Mocked Nominatim, Overpass, OSRM + Unreachable Fallbacks)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_geo_search_and_reverse_mocked_and_fallback(api_client):
    mock_resp = MagicMock()
    mock_resp.raise_for_status.return_value = None
    mock_resp.json.return_value = [
        {"display_name": "Mysuru Palace, Mysuru, Karnataka, India", "lat": "12.3052", "lon": "76.6552", "type": "attraction"}
    ]
    with patch("geo.services.requests.get", return_value=mock_resp):
        res = api_client.get("/api/geo/search/?q=Mysuru+Palace")
        assert res.status_code == 200
        assert res.data["count"] == 1
        assert res.data["results"][0]["lat"] == 12.3052

    # Unreachable Nominatim fails gracefully (no 500 crash)
    cache.clear()
    with patch("geo.services.requests.get", side_effect=requests.ConnectionError("offline")):
        res_down = api_client.get("/api/geo/search/?q=Kuvempunagar")
        assert res_down.status_code == 200
        assert res_down.data["unavailable"] is True
        assert res_down.data["results"] == []

        rev_down = api_client.get("/api/geo/reverse/?lat=12.2958&lng=76.6394")
        assert rev_down.status_code == 200
        assert rev_down.data["unavailable"] is True
        assert "12.2958" in rev_down.data["display_name"]


@pytest.mark.django_db
def test_geo_places_overpass_mirror_fallback_and_unverified_label(api_client):
    good_resp = MagicMock()
    good_resp.raise_for_status.return_value = None
    good_resp.json.return_value = {
        "elements": [
            {
                "type": "node",
                "id": 9991,
                "lat": 12.2965,
                "lon": 76.6401,
                "tags": {"amenity": "pharmacy", "name": "City Medicals"},
            }
        ]
    }
    # First mirror fails, second succeeds
    with patch(
        "geo.services.requests.post",
        side_effect=[requests.Timeout("mirror 1 down"), good_resp],
    ):
        res = api_client.get("/api/geo/places/?lat=12.2958&lng=76.6394&radius=2000&category=PHARMACY")
        assert res.status_code == 200
        assert res.data["source"] == "OSM_UNVERIFIED"
        assert res.data["count"] == 1
        assert res.data["results"][0]["verified"] is False


@pytest.mark.django_db
def test_geo_route_osrm_and_straight_line_fallback(api_client):
    osrm_resp = MagicMock()
    osrm_resp.raise_for_status.return_value = None
    osrm_resp.json.return_value = {
        "routes": [
            {
                "distance": 850.4,
                "duration": 660.2,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[76.6394, 12.2958], [76.645, 12.301]],
                },
            }
        ]
    }
    with patch("geo.services.requests.get", return_value=osrm_resp):
        res = api_client.get(
            "/api/geo/route/?from_lat=12.2958&from_lng=76.6394&to_lat=12.3010&to_lng=76.6450&profile=foot"
        )
        assert res.status_code == 200
        assert res.data["fallback"] is False
        assert res.data["distance_m"] == 850
        assert "google.com/maps" in res.data["google_maps_url"]

    # When OSRM times out, returns straight-line fallback + deep links (never crashes)
    cache.clear()
    with patch("geo.services.requests.get", side_effect=requests.Timeout("osrm timeout")):
        fb = api_client.get(
            "/api/geo/route/?from_lat=12.2958&from_lng=76.6394&to_lat=12.3010&to_lng=76.6450&profile=foot"
        )
        assert fb.status_code == 200
        assert fb.data["fallback"] is True
        assert fb.data["distance_m"] > 0
        assert len(fb.data["geometry"]["coordinates"]) == 2
        assert "openstreetmap.org/directions" in fb.data["osm_url"]


# ---------------------------------------------------------------------------
# 5. Pure-Python Analysis Module & Rounded Public Report Coordinates
# ---------------------------------------------------------------------------


def test_analysis_module_300m_grouping_and_non_claim_wording():
    now = timezone.now()
    sample = [
        {
            "latitude": 12.3112,
            "longitude": 76.6598,
            "description": "Streetlight is broken and dark near bus stop",
            "category": "POOR_LIGHTING",
            "area_label": "Bus Stand Lane",
            "review_status": "UNREVIEWED",
            "created_at": now - timedelta(days=2),
            "incident_time": now.replace(hour=22),
        },
        {
            "latitude": 12.3116,  # ~50m away -> same 300m cluster
            "longitude": 76.6600,
            "description": "Unlit isolated footpath after 9 PM",
            "category": "ISOLATED_AREA",
            "area_label": "Bus Stand Lane",
            "review_status": "UNREVIEWED",
            "created_at": now - timedelta(days=5),
            "incident_time": now.replace(hour=23),
        },
        {
            "latitude": 12.2850,  # >3 km away -> separate cluster
            "longitude": 76.6200,
            "description": "Broken footpath near junction",
            "category": "UNSAFE_INFRASTRUCTURE",
            "area_label": "Far Area",
            "review_status": "UNREVIEWED",
            "created_at": now - timedelta(days=1),
            "incident_time": now.replace(hour=14),
        },
    ]
    assert haversine_distance_km(12.3112, 76.6598, 12.3116, 76.6600) < 0.3
    cls = classify_report_text(sample[0]["description"], "POOR_LIGHTING")
    assert cls["primary_theme"] == "Poor Street Lighting"

    summary = analyze_reports(sample, now=now)
    assert summary["repeat_areas_count"] == 1
    assert len(summary["clusters"]) == 2
    assert len(summary["public_map_clusters"]) == 1  # min_count=2
    top = summary["clusters"][0]
    assert top["summary_statement"] == "2 unverified reports in this area in the last 30 days"
    assert "dangerous" not in top["summary_statement"].lower()
    assert "safe" not in top["summary_statement"].lower()


@pytest.mark.django_db
def test_public_reports_round_coordinates_to_3_decimals(api_client, demo_users):
    SafetyReport.objects.create(
        reporter=demo_users["woman"],
        category=SafetyReport.Category.POOR_LIGHTING,
        description="Dark street near temple road crossing.",
        area_label="Temple Road",
        city="Mysuru",
        latitude=Decimal("12.319543"),
        longitude=Decimal("76.623876"),
    )
    res = api_client.get("/api/reports/")
    assert res.status_code == 200
    row = res.data["results"][0]
    assert row["latitude"] == 12.32
    assert row["longitude"] == 76.624


# ---------------------------------------------------------------------------
# 6. Journey Watch Live Location, Expiring Share Token & Delete Location Data
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_journey_live_pings_share_token_expiry_and_delete_my_location_data(demo_users):
    woman_client = _auth_client(demo_users["woman"])
    anon_client = APIClient()

    contact = TrustedContact.objects.create(
        owner=demo_users["woman"],
        name="Sister",
        relationship="Sister",
        phone="+91-99999-11111",
    )
    create_res = woman_client.post(
        "/api/journeys/",
        {
            "origin_label": "SJCE Gate",
            "destination_label": "Saraswathipuram Home",
            "destination_latitude": "12.301600",
            "destination_longitude": "76.634700",
            "expected_arrival_at": (timezone.now() + timedelta(minutes=30)).isoformat(),
            "checkin_interval_minutes": 15,
            "location_sharing_enabled": True,
            "trusted_contact_ids": [str(contact.id)],
        },
        format="json",
    )
    assert create_res.status_code == 201
    journey_id = create_res.data["id"]
    token = create_res.data["share_token"]
    assert token

    # Ping within 100 m of destination triggers within_arrival_radius prompt (never auto-completes)
    ping = woman_client.post(
        f"/api/journeys/{journey_id}/location/",
        {"latitude": "12.301650", "longitude": "76.634720", "accuracy_m": 12.0},
        format="json",
    )
    assert ping.status_code == 201
    assert ping.data["within_arrival_radius"] is True

    # Trusted contact can view private token status while active
    shared = anon_client.get(f"/api/journeys/shared/{token}/")
    assert shared.status_code == 200
    assert shared.data["destination_label"] == "Saraswathipuram Home"

    # Complete journey -> expires share link (410 Gone) and deletes LocationPing rows
    done = woman_client.post(f"/api/journeys/{journey_id}/complete/")
    assert done.status_code == 200
    assert LocationPing.objects.filter(journey_id=journey_id).count() == 0
    expired_shared = anon_client.get(f"/api/journeys/shared/{token}/")
    assert expired_shared.status_code == 410

    # Test DELETE /api/auth/me/location-data/
    j2 = Journey.objects.create(
        owner=demo_users["woman"],
        destination_label="Mysuru Station",
        expected_arrival_at=timezone.now() + timedelta(minutes=20),
        location_sharing_enabled=True,
        last_known_latitude=Decimal("12.300000"),
        last_known_longitude=Decimal("76.640000"),
    )
    LocationPing.objects.create(
        user=demo_users["woman"],
        journey=j2,
        latitude=Decimal("12.300000"),
        longitude=Decimal("76.640000"),
    )
    purge = woman_client.delete("/api/auth/me/location-data/")
    assert purge.status_code == 200
    assert purge.data["deleted_pings"] >= 1
    assert LocationPing.objects.filter(user=demo_users["woman"]).count() == 0
    j2.refresh_from_db()
    assert j2.last_known_latitude is None
