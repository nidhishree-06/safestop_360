"""Community Safety Reports and Rule-Based AI Intelligence routes."""

from django.urls import path

from reports.views import (
    SafetyIntelligenceView,
    SafetyReportDetailView,
    SafetyReportListCreateView,
)

urlpatterns = [
    path("", SafetyReportListCreateView.as_view(), name="safety-report-list-create"),
    path("intelligence/", SafetyIntelligenceView.as_view(), name="safety-report-intelligence"),
    path("<uuid:pk>/", SafetyReportDetailView.as_view(), name="safety-report-detail"),
]
