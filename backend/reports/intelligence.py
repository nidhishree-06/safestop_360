"""Explainable rule-based AI Safety Intelligence module.

Strict ethical boundaries:
- Uses transparent keyword rules, Haversine spatial grouping, and timestamp aggregation.
- NEVER claims any area is guaranteed safe or guaranteed dangerous.
- NEVER makes automated emergency response decisions.
"""

from collections import Counter
from datetime import timedelta
from typing import Iterable

from django.utils import timezone

from partners.models import haversine_km
from reports.models import SafetyReport

METHODOLOGY_LIMITATIONS = (
    "This summary uses deterministic, rule-based spatial clustering (500m radius), "
    "keyword theme matching, and time-of-day counting over submitted community reports. "
    "It does NOT guarantee that any area is safe or dangerous, does NOT verify "
    "unreviewed reports automatically, and does NOT make emergency response decisions."
)

THEME_KEYWORDS: dict[str, tuple[str, ...]] = {
    "lighting": ("dark", "light", "lamp", "streetlamp", "unlit", "dim", "blackout"),
    "harassment": ("harass", "stalk", "follow", "catcall", "eve", "intimidat", "threat"),
    "isolation": ("isolated", "empty", "deserted", "lonely", "quiet", "underpass", "alley"),
    "infrastructure": ("footpath", "broken", "pothole", "bus stop", "cctv", "sidewalk", "drain"),
    "transit": ("metro", "auto", "cab", "bus", "station", "feeder", "junction"),
}


def classify_report_text(description: str, declared_category: str) -> dict:
    """Return explainable rule-based theme tags and keyword matches for a report."""
    lower = (description or "").lower()
    matched_themes: list[str] = []
    matched_keywords: list[str] = []

    for theme, keywords in THEME_KEYWORDS.items():
        hits = [kw for kw in keywords if kw in lower]
        if hits:
            matched_themes.append(theme)
            matched_keywords.extend(hits[:2])

    return {
        "declared_category": declared_category,
        "matched_themes": matched_themes or ["general"],
        "matched_keywords": matched_keywords[:5],
    }


def _time_bucket(dt) -> str:
    local_dt = timezone.localtime(dt) if dt else timezone.localtime(timezone.now())
    hour = local_dt.hour
    if 6 <= hour < 12:
        return "Morning (06:00–12:00)"
    if 12 <= hour < 17:
        return "Afternoon (12:00–17:00)"
    if 17 <= hour < 21:
        return "Evening (17:00–21:00)"
    return "Late Night (21:00–06:00)"


def cluster_nearby_reports(
    reports: Iterable[SafetyReport], radius_km: float = 0.5
) -> list[dict]:
    """Group reports within `radius_km` using deterministic Haversine proximity."""
    clusters: list[dict] = []

    for report in reports:
        lat = float(report.latitude)
        lng = float(report.longitude)
        placed = False

        for cluster in clusters:
            dist = haversine_km(lat, lng, cluster["center_lat"], cluster["center_lng"])
            if dist <= radius_km:
                n = cluster["report_count"]
                cluster["center_lat"] = round((cluster["center_lat"] * n + lat) / (n + 1), 6)
                cluster["center_lng"] = round((cluster["center_lng"] * n + lng) / (n + 1), 6)
                cluster["report_count"] += 1
                cluster["categories"][report.category] += 1
                if report.review_status == SafetyReport.ReviewStatus.UNREVIEWED:
                    cluster["unreviewed_count"] += 1
                if report.area_label not in cluster["area_labels"]:
                    cluster["area_labels"].append(report.area_label)
                placed = True
                break

        if not placed:
            clusters.append(
                {
                    "cluster_id": f"cluster-{len(clusters) + 1}",
                    "center_lat": round(lat, 6),
                    "center_lng": round(lng, 6),
                    "report_count": 1,
                    "unreviewed_count": (
                        1 if report.review_status == SafetyReport.ReviewStatus.UNREVIEWED else 0
                    ),
                    "categories": Counter([report.category]),
                    "area_labels": [report.area_label],
                    "city": report.city,
                }
            )

    formatted: list[dict] = []
    for c in clusters:
        dominant_category, dominant_count = c["categories"].most_common(1)[0]
        formatted.append(
            {
                "cluster_id": c["cluster_id"],
                "primary_area": c["area_labels"][0],
                "area_labels": c["area_labels"],
                "city": c["city"],
                "center_lat": c["center_lat"],
                "center_lng": c["center_lng"],
                "report_count": c["report_count"],
                "unreviewed_count": c["unreviewed_count"],
                "is_repeated_pattern": c["report_count"] >= 2,
                "dominant_category": dominant_category,
                "dominant_category_count": dominant_count,
                "category_breakdown": dict(c["categories"]),
            }
        )

    formatted.sort(key=lambda item: (-item["report_count"], item["primary_area"]))
    return formatted


def analyze_safety_reports(reports: Iterable[SafetyReport]) -> dict:
    """Produce explainable patterns, clusters, and time trends for administrators."""
    report_list = [
        r for r in reports if r.review_status != SafetyReport.ReviewStatus.DISMISSED
    ]
    total = len(report_list)

    category_counts = Counter(r.category for r in report_list)
    status_counts = Counter(r.review_status for r in report_list)
    time_counts = Counter(_time_bucket(r.incident_time or r.created_at) for r in report_list)

    # 7-day daily frequency trend
    today = timezone.localdate()
    day_counts = Counter(
        timezone.localtime(r.created_at).date() for r in report_list if r.created_at
    )
    daily_frequency = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        daily_frequency.append({"date": day.isoformat(), "count": day_counts.get(day, 0)})

    clusters = cluster_nearby_reports(report_list, radius_km=0.5)
    repeated_clusters = [c for c in clusters if c["is_repeated_pattern"]]

    summary_notes: list[str] = []
    if total == 0:
        summary_notes.append("No active community safety reports recorded yet.")
    else:
        top_cat, top_cat_count = category_counts.most_common(1)[0]
        summary_notes.append(
            f"Most frequently reported category: {top_cat.replace('_', ' ').title()} "
            f"({top_cat_count} of {total} active reports)."
        )
        if repeated_clusters:
            top_cluster = repeated_clusters[0]
            summary_notes.append(
                f"Repeated reports detected near {top_cluster['primary_area']} "
                f"({top_cluster['report_count']} reports within 500m, primarily "
                f"{top_cluster['dominant_category'].replace('_', ' ').lower()})."
            )
        else:
            summary_notes.append(
                "No repeated multi-report spatial clusters detected within 500m."
            )

        peak_window, peak_count = time_counts.most_common(1)[0]
        summary_notes.append(
            f"Highest report frequency window: {peak_window} ({peak_count} reports)."
        )
        unrev = status_counts.get(SafetyReport.ReviewStatus.UNREVIEWED, 0)
        if unrev:
            summary_notes.append(
                f"{unrev} report(s) are currently UNREVIEWED and awaiting administrator moderation."
            )

    time_order = [
        "Morning (06:00–12:00)",
        "Afternoon (12:00–17:00)",
        "Evening (17:00–21:00)",
        "Late Night (21:00–06:00)",
    ]

    return {
        "total_active_reports": total,
        "review_breakdown": {
            "unreviewed": status_counts.get(SafetyReport.ReviewStatus.UNREVIEWED, 0),
            "under_review": status_counts.get(SafetyReport.ReviewStatus.UNDER_REVIEW, 0),
            "reviewed": status_counts.get(SafetyReport.ReviewStatus.REVIEWED, 0),
        },
        "category_distribution": [
            {
                "category": cat,
                "label": dict(SafetyReport.Category.choices).get(cat, cat),
                "count": count,
                "percentage": round((count / total) * 100, 1) if total else 0.0,
            }
            for cat, count in category_counts.most_common()
        ],
        "time_of_day_trends": [
            {"window": win, "count": time_counts.get(win, 0)} for win in time_order
        ],
        "daily_frequency": daily_frequency,
        "spatial_clusters": clusters,
        "repeated_report_clusters": repeated_clusters,
        "summary_notes": summary_notes,
        "methodology_and_limitations": METHODOLOGY_LIMITATIONS,
    }
