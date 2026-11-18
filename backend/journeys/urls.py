"""Journey Watch, Trusted Contacts, live location, and private shared link routes."""

from django.urls import path

from journeys.views import (
    JourneyCancelView,
    JourneyCheckInView,
    JourneyCompleteView,
    JourneyDetailView,
    JourneyListCreateView,
    JourneyLocationPingView,
    JourneyStopSharingView,
    SharedJourneyStatusView,
    TrustedContactDetailView,
    TrustedContactListCreateView,
)

urlpatterns = [
    path("contacts/", TrustedContactListCreateView.as_view(), name="trusted-contact-list"),
    path("contacts/<uuid:pk>/", TrustedContactDetailView.as_view(), name="trusted-contact-detail"),
    path("shared/<str:token>/", SharedJourneyStatusView.as_view(), name="journey-shared-status"),
    path("", JourneyListCreateView.as_view(), name="journey-list-create"),
    path("<uuid:pk>/", JourneyDetailView.as_view(), name="journey-detail"),
    path("<uuid:pk>/checkin/", JourneyCheckInView.as_view(), name="journey-checkin"),
    path("<uuid:pk>/location/", JourneyLocationPingView.as_view(), name="journey-location"),
    path("<uuid:pk>/complete/", JourneyCompleteView.as_view(), name="journey-complete"),
    path("<uuid:pk>/cancel/", JourneyCancelView.as_view(), name="journey-cancel"),
    path("<uuid:pk>/stop-sharing/", JourneyStopSharingView.as_view(), name="journey-stop-sharing"),
]
