"""Core platform endpoints (health check)."""

from django.db import connection
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """Lightweight liveness and database readiness probe."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        db_ok = True
        db_engine = connection.vendor
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            db_ok = False

        payload = {
            "service": "safestop-360-api",
            "status": "ok" if db_ok else "degraded",
            "database": {
                "connected": db_ok,
                "vendor": db_engine,
            },
            "timestamp": timezone.now().isoformat(),
            "emergency_helplines_india": {
                "emergency": "112",
                "women_helpline": "181",
                "notice": (
                    "SafeStop 360 is an independent assistance platform and does not "
                    "replace official emergency services."
                ),
            },
        }
        return Response(
            payload,
            status=status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )
