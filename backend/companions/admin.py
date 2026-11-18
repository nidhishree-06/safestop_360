from django.contrib import admin

from companions.models import Companion, CompanionRequest


@admin.register(Companion)
class CompanionAdmin(admin.ModelAdmin):
    list_display = ("display_name", "verification_status", "is_available", "is_demo")
    list_filter = ("verification_status", "is_available", "is_demo")


@admin.register(CompanionRequest)
class CompanionRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "requester", "companion", "status", "scheduled_for")
    list_filter = ("status",)
