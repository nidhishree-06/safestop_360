"""Role-based access control permissions for SafeStop 360."""

from rest_framework.permissions import BasePermission


class IsWomanRole(BasePermission):
    """Allow access only to authenticated users with role WOMAN."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "WOMAN"
        )


class IsPartnerRole(BasePermission):
    """Allow access only to authenticated users with role PARTNER."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == "PARTNER"
        )


class IsAdminRole(BasePermission):
    """Allow access only to authenticated users with role ADMIN (or superuser)."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (getattr(request.user, "role", None) == "ADMIN" or request.user.is_superuser)
        )


class IsWomanOrAdmin(BasePermission):
    """Allow WOMAN or ADMIN users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) in ("WOMAN", "ADMIN")
        )


class IsPartnerOrAdmin(BasePermission):
    """Allow PARTNER or ADMIN users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) in ("PARTNER", "ADMIN")
        )
