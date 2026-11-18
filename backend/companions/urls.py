"""Companion foundation API routes."""

from django.urls import path

from companions.views import (
    CompanionAvailabilityView,
    CompanionListView,
    CompanionRegisterView,
    CompanionRequestAcceptView,
    CompanionRequestCancelView,
    CompanionRequestCompleteView,
    CompanionRequestDeclineView,
    CompanionRequestListCreateView,
    MyCompanionProfileView,
)

urlpatterns = [
    path("", CompanionListView.as_view(), name="companion-list"),
    path("register/", CompanionRegisterView.as_view(), name="companion-register"),
    path("me/", MyCompanionProfileView.as_view(), name="companion-me"),
    path("availability/", CompanionAvailabilityView.as_view(), name="companion-availability"),
    path("requests/", CompanionRequestListCreateView.as_view(), name="companion-request-list"),
    path("requests/<uuid:pk>/accept/", CompanionRequestAcceptView.as_view(), name="companion-request-accept"),
    path("requests/<uuid:pk>/decline/", CompanionRequestDeclineView.as_view(), name="companion-request-decline"),
    path("requests/<uuid:pk>/complete/", CompanionRequestCompleteView.as_view(), name="companion-request-complete"),
    path("requests/<uuid:pk>/cancel/", CompanionRequestCancelView.as_view(), name="companion-request-cancel"),
]
