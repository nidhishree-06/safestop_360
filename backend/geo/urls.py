"""Geospatial proxy API routes."""

from django.urls import path

from geo.views import GeoPlacesView, GeoReverseView, GeoRouteView, GeoSearchView

urlpatterns = [
    path("search/", GeoSearchView.as_view(), name="geo-search"),
    path("reverse/", GeoReverseView.as_view(), name="geo-reverse"),
    path("places/", GeoPlacesView.as_view(), name="geo-places"),
    path("route/", GeoRouteView.as_view(), name="geo-route"),
]
