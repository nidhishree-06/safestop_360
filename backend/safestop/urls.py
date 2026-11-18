"""URL configuration for SafeStop 360 (v2)."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from journeys.views import TrustedContactDetailView, TrustedContactListCreateView
from safestop.views import HealthCheckView

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/health/", HealthCheckView.as_view(), name="api-health"),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="api-docs"),
    # Domain routes
    path("api/auth/", include("accounts.urls")),
    path("api/partners/", include("partners.urls")),
    path("api/requests/", include("assistance.urls")),
    path("api/journeys/", include("journeys.urls")),
    path(
        "api/trusted-contacts/",
        TrustedContactListCreateView.as_view(),
        name="trusted-contacts-root-list",
    ),
    path(
        "api/trusted-contacts/<uuid:pk>/",
        TrustedContactDetailView.as_view(),
        name="trusted-contacts-root-detail",
    ),
    path("api/reports/", include("reports.urls")),
    path("api/companions/", include("companions.urls")),
    path("api/geo/", include("geo.urls")),
    path("api/admin/", include("accounts.admin_urls")),
]
