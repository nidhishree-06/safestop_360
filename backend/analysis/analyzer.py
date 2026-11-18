"""Pure-Python rule-based community safety report analyzer.

Capabilities:
- Keyword theme classification (lighting, harassment, isolation, infrastructure, transit)
- Spatial grouping within ~300 m via Haversine distance
- Repeat-report detection (>= 2 reports within 300 m)
- Time-of-day trend breakdown (Morning, Afternoon, Evening, Late Night)
- Transparent, explainable outputs using rounded public coordinates (~3 decimals)

Ethical boundary:
NEVER labels any area as "safe" or "dangerous". Reports are community-submitted
observations phrased strictly as "N unverified reports in this area in the last 30 days".
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
import math
from typing import Any, Iterable

CLUSTER_RADIUS_KM = 0.3  # ~300 metres
MIN_PUBLIC_CLUSTER_COUNT = 2
WINDOW_DAYS = 30

NON_CLAIM_NOTICE = (
    "Rule-based summary of community-submitted observations. Never labels any area "
    "as 'safe' or 'dangerous'. For emergencies call 112 or Women Helpline 181."
)

KEYWORD_RULES: dict[str, list[str]] = {
    "Poor Street Lighting": [
        "dark",
        "light",
        "lighting",
        "streetlight",
        "lamp",
        "unlit",
        "broken light",
        "dim",
        "flicker",
    ],
    "Verbal / Street Harassment": [
        "harass",
        "catcall",
        "follow",
        "stalk",
        "stare",
        "comment",
        "eve",
        "group of men",
        "intimidat",
    ],
    "Isolated / Low Footfall": [
        "isolated",
        "deserted",
        "empty",
        "lonely",
        "no shops",
        "closed early",
        "quiet stretch",
        "desolate",
    ],
    "Public Infrastructure": [
        "footpath",
        "broken",
        "construction",
        "barricade",
        "underpass",
        "subway",
        "bus stop",
        "shelter",
        "drain",
        "pothole",
    ],
    "Transit / Last-Mile Wait": [
        "auto",
        "cab",
        "bus",
        "station",
        "stand",
        "wait",
        "stop",
        "rickshaw",
    ],
}

CATEGORY_DEFAULT_THEME: dict[str, str] = {
    "POOR_LIGHTING": "Poor Street Lighting",
    "HARASSMENT": "Verbal / Street Harassment",
    "ISOLATED_AREA": "Isolated / Low Footfall",
    "UNSAFE_INFRASTRUCTURE": "Public Infrastructure",
    "OTHER": "General Observation",
}


def haversine_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Pure-Python great-circle distance in kilometres."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def classify_report_text(description: str, category: str = "OTHER") -> dict[str, Any]:
    """Deterministic keyword classifier returning matched themes and transparent rationale."""
    lowered = (description or "").lower()
    matched_themes: list[str] = []
    matched_keywords: list[str] = []

    for theme, keywords in KEYWORD_RULES.items():
        hits = [kw for kw in keywords if kw in lowered]
        if hits:
            matched_themes.append(theme)
            matched_keywords.extend(hits)

    if not matched_themes:
        default_theme = CATEGORY_DEFAULT_THEME.get(category, "General Observation")
        matched_themes.append(default_theme)

    rationale = (
        f"Matched keywords ({', '.join(sorted(set(matched_keywords))[:5])})"
        if matched_keywords
        else f"Classified from report category ({CATEGORY_DEFAULT_THEME.get(category, category)})"
    )
    return {
        "primary_theme": matched_themes[0],
        "themes": matched_themes,
        "matched_keywords": sorted(set(matched_keywords)),
        "rationale": rationale,
    }


def time_of_day_bucket(dt: datetime | None) -> str:
    if dt is None:
        return "Unspecified"
    hour = dt.hour
    if 5 <= hour < 12:
        return "Morning (05:00–12:00)"
    if 12 <= hour < 17:
        return "Afternoon (12:00–17:00)"
    if 17 <= hour < 21:
        return "Evening (17:00–21:00)"
    return "Late Night (21:00–05:00)"


def _get_attr(item: Any, name: str, default: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(name, default)
    return getattr(item, name, default)


def analyze_reports(
    reports: Iterable[Any],
    *,
    now: datetime | None = None,
    cluster_radius_km: float = CLUSTER_RADIUS_KM,
    min_public_cluster_count: int = MIN_PUBLIC_CLUSTER_COUNT,
) -> dict[str, Any]:
    """Group reports within ~300 m, detect repeats, compute time trends, and explain outputs."""
    reference_now = now or datetime.now(timezone.utc)
    window_cutoff = reference_now - timedelta(days=WINDOW_DAYS)

    valid_reports = [
        r for r in reports if _get_attr(r, "review_status", "") != "DISMISSED"
    ]

    theme_counter: Counter[str] = Counter()
    time_counter: Counter[str] = Counter()
    clusters: list[dict[str, Any]] = []

    for rep in valid_reports:
        lat = float(_get_attr(rep, "latitude"))
        lng = float(_get_attr(rep, "longitude"))
        desc = str(_get_attr(rep, "description", ""))
        category = str(_get_attr(rep, "category", "OTHER"))
        area_label = str(_get_attr(rep, "area_label", "Reported Area"))
        review_status = str(_get_attr(rep, "review_status", "UNREVIEWED"))
        created_at = _get_attr(rep, "created_at")
        incident_time = _get_attr(rep, "incident_time") or created_at

        in_window = True
        if created_at is not None:
            dt_check = (
                created_at
                if created_at.tzinfo is not None
                else created_at.replace(tzinfo=timezone.utc)
            )
            in_window = dt_check >= window_cutoff

        classification = classify_report_text(desc, category)
        for theme in classification["themes"]:
            theme_counter[theme] += 1

        bucket = time_of_day_bucket(incident_time)
        time_counter[bucket] += 1

        assigned = None
        for cluster in clusters:
            dist = haversine_distance_km(
                lat, lng, cluster["_sum_lat"] / cluster["report_count"], cluster["_sum_lng"] / cluster["report_count"]
            )
            if dist <= cluster_radius_km:
                assigned = cluster
                break

        if assigned is None:
            clusters.append(
                {
                    "area_label": area_label,
                    "_sum_lat": lat,
                    "_sum_lng": lng,
                    "report_count": 1,
                    "recent_30d_count": 1 if in_window else 0,
                    "unverified_30d_count": (
                        1 if (in_window and review_status != "REVIEWED") else 0
                    ),
                    "reviewed_count": 1 if review_status == "REVIEWED" else 0,
                    "_themes": Counter(classification["themes"]),
                    "_times": Counter([bucket]),
                }
            )
        else:
            assigned["_sum_lat"] += lat
            assigned["_sum_lng"] += lng
            assigned["report_count"] += 1
            if in_window:
                assigned["recent_30d_count"] += 1
                if review_status != "REVIEWED":
                    assigned["unverified_30d_count"] += 1
            if review_status == "REVIEWED":
                assigned["reviewed_count"] += 1
            assigned["_themes"].update(classification["themes"])
            assigned["_times"].update([bucket])

    formatted_clusters: list[dict[str, Any]] = []
    for idx, cl in enumerate(
        sorted(clusters, key=lambda c: (-c["report_count"], c["area_label"])), start=1
    ):
        center_lat = round(cl["_sum_lat"] / cl["report_count"], 3)
        center_lng = round(cl["_sum_lng"] / cl["report_count"], 3)
        top_theme = cl["_themes"].most_common(1)[0][0]
        peak_time = cl["_times"].most_common(1)[0][0]
        is_repeat = cl["report_count"] >= 2
        n_unverified = cl["unverified_30d_count"]
        n_recent = cl["recent_30d_count"]

        summary_statement = (
            f"{n_unverified} unverified report{'s' if n_unverified != 1 else ''} "
            f"in this area in the last {WINDOW_DAYS} days"
            if n_unverified > 0
            else f"{n_recent} reviewed community report{'s' if n_recent != 1 else ''} "
            f"in this area in the last {WINDOW_DAYS} days"
        )
        explanation = (
            f"Grouped {cl['report_count']} report(s) within {int(cluster_radius_km * 1000)} m "
            f"around (~{center_lat:.3f}, ~{center_lng:.3f}). "
            f"Primary theme: {top_theme}. Most frequently reported window: {peak_time}."
        )
        formatted_clusters.append(
            {
                "cluster_id": f"cluster-{idx}",
                "area_label": cl["area_label"],
                "center_lat": center_lat,
                "center_lng": center_lng,
                "radius_m": int(cluster_radius_km * 1000),
                "report_count": cl["report_count"],
                "recent_30d_count": n_recent,
                "unverified_30d_count": n_unverified,
                "reviewed_count": cl["reviewed_count"],
                "is_repeat_area": is_repeat,
                "primary_theme": top_theme,
                "peak_time_window": peak_time,
                "summary_statement": summary_statement,
                "explanation": explanation,
                "meets_public_threshold": cl["report_count"] >= min_public_cluster_count,
            }
        )

    public_clusters = [c for c in formatted_clusters if c["meets_public_threshold"]]
    repeat_areas_count = sum(1 for c in formatted_clusters if c["is_repeat_area"])

    return {
        "total_reports_analyzed": len(valid_reports),
        "window_days": WINDOW_DAYS,
        "cluster_radius_m": int(cluster_radius_km * 1000),
        "repeat_areas_count": repeat_areas_count,
        "non_claim_notice": NON_CLAIM_NOTICE,
        "theme_breakdown": [
            {"theme": theme, "count": count}
            for theme, count in theme_counter.most_common()
        ],
        "time_of_day_trends": [
            {"window": window, "count": count}
            for window, count in time_counter.most_common()
        ],
        "clusters": formatted_clusters,
        "public_map_clusters": public_clusters,
    }
