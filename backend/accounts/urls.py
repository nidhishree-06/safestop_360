"""Authentication, profile, and notification routes."""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from accounts.views import (
    ChangePasswordView,
    LoginView,
    LogoutView,
    MeView,
    NotificationListView,
    NotificationReadAllView,
    NotificationReadView,
    RegisterView,
    WomanDashboardSummaryView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("token/refresh/", TokenRefreshView.as_view(), name="auth-token-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("dashboard-summary/", WomanDashboardSummaryView.as_view(), name="auth-dashboard-summary"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("notifications/", NotificationListView.as_view(), name="auth-notifications"),
    path("notifications/read-all/", NotificationReadAllView.as_view(), name="auth-notifications-read-all"),
    path("notifications/<uuid:pk>/read/", NotificationReadView.as_view(), name="auth-notification-read"),
]
