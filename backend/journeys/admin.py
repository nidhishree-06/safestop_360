from django.contrib import admin

from journeys.models import Journey, JourneyCheckIn, TrustedContact


@admin.register(TrustedContact)
class TrustedContactAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "relationship", "phone", "is_primary")


@admin.register(Journey)
class JourneyAdmin(admin.ModelAdmin):
    list_display = ("destination_label", "owner", "status", "location_sharing_enabled", "created_at")
    list_filter = ("status", "location_sharing_enabled")


@admin.register(JourneyCheckIn)
class JourneyCheckInAdmin(admin.ModelAdmin):
    list_display = ("journey", "status", "created_at")
