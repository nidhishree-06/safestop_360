"""Administrator governance, moderation, and analytics API routes."""

from django.urls import path

from accounts.admin_views import AdminAnalyticsView
from companions.views import AdminCompanionListView, AdminCompanionReviewView
from partners.views import AdminPartnerListView, AdminPartnerReviewView
from reports.views import AdminSafetyReportListView, AdminSafetyReportReviewView

urlpatterns = [
    path("partners/", AdminPartnerListView.as_view(), name="admin-partner-list"),
    path("partners/<uuid:pk>/review/", AdminPartnerReviewView.as_view(), name="admin-partner-review"),
    path("reports/", AdminSafetyReportListView.as_view(), name="admin-report-list"),
    path("reports/<uuid:pk>/review/", AdminSafetyReportReviewView.as_view(), name="admin-report-review"),
    path("companions/", AdminCompanionListView.as_view(), name="admin-companion-list"),
    path("companions/<uuid:pk>/review/", AdminCompanionReviewView.as_view(), name="admin-companion-review"),
    path("analytics/", AdminAnalyticsView.as_view(), name="admin-analytics"),
]
