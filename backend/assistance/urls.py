"""Assistance Confirmation Loop API routes."""

from django.urls import path

from assistance.views import (
    HelpRequestAcceptView,
    HelpRequestArrivedView,
    HelpRequestCancelView,
    HelpRequestCloseView,
    HelpRequestDeclineView,
    HelpRequestDetailView,
    HelpRequestFeedbackView,
    HelpRequestListCreateView,
)

urlpatterns = [
    path("", HelpRequestListCreateView.as_view(), name="help-request-list-create"),
    path("<uuid:pk>/", HelpRequestDetailView.as_view(), name="help-request-detail"),
    path("<uuid:pk>/accept/", HelpRequestAcceptView.as_view(), name="help-request-accept"),
    path("<uuid:pk>/decline/", HelpRequestDeclineView.as_view(), name="help-request-decline"),
    path("<uuid:pk>/arrived/", HelpRequestArrivedView.as_view(), name="help-request-arrived"),
    path("<uuid:pk>/close/", HelpRequestCloseView.as_view(), name="help-request-close"),
    path("<uuid:pk>/cancel/", HelpRequestCancelView.as_view(), name="help-request-cancel"),
    path("<uuid:pk>/feedback/", HelpRequestFeedbackView.as_view(), name="help-request-feedback"),
]
