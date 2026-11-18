"""URL configuration for SafeStop 360."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from safestop.views import HealthCheckView

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/health/", HealthCheckView.as_view(), name="api-health"),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="api-docs"),
    # Domain routes (populated progressively across Phases 3–9)
    path("api/auth/", include("accounts.urls")),
    path("api/partners/", include("partners.urls")),
    path("api/requests/", include("assistance.urls")),
    path("api/journeys/", include("journeys.urls")),
    path("api/reports/", include("reports.urls")),
    path("api/companions/", include("companions.urls")),
    path("api/admin/", include("accounts.admin_urls")),
]
