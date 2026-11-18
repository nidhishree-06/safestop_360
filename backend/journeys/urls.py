"""Journey Watch and Trusted Contacts routes."""

from django.urls import path

from journeys.views import (
    JourneyCheckInView,
    JourneyCompleteView,
    JourneyDetailView,
    JourneyListCreateView,
    JourneyStopSharingView,
    TrustedContactDetailView,
    TrustedContactListCreateView,
)

urlpatterns = [
    path("contacts/", TrustedContactListCreateView.as_view(), name="trusted-contact-list"),
    path("contacts/<uuid:pk>/", TrustedContactDetailView.as_view(), name="trusted-contact-detail"),
    path("", JourneyListCreateView.as_view(), name="journey-list-create"),
    path("<uuid:pk>/", JourneyDetailView.as_view(), name="journey-detail"),
    path("<uuid:pk>/checkin/", JourneyCheckInView.as_view(), name="journey-checkin"),
    path("<uuid:pk>/complete/", JourneyCompleteView.as_view(), name="journey-complete"),
    path("<uuid:pk>/stop-sharing/", JourneyStopSharingView.as_view(), name="journey-stop-sharing"),
]
