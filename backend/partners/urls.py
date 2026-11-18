"""Partner directory and operational endpoints."""

from django.urls import path

from partners.views import (
    MyPartnersView,
    NearbyPartnersView,
    PartnerAvailabilityView,
    PartnerDetailView,
    PartnerListView,
    PartnerRegisterView,
)

urlpatterns = [
    path("", PartnerListView.as_view(), name="partner-list"),
    path("nearby/", NearbyPartnersView.as_view(), name="partner-nearby"),
    path("register/", PartnerRegisterView.as_view(), name="partner-register"),
    path("mine/", MyPartnersView.as_view(), name="partner-mine"),
    path("<uuid:pk>/", PartnerDetailView.as_view(), name="partner-detail"),
    path("<uuid:pk>/availability/", PartnerAvailabilityView.as_view(), name="partner-availability"),
]
