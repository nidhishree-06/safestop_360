from django.contrib import admin

from assistance.models import HelpRequest, HelpRequestFeedback


@admin.register(HelpRequest)
class HelpRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "requester", "partner", "status", "created_at")
    list_filter = ("status",)


@admin.register(HelpRequestFeedback)
class HelpRequestFeedbackAdmin(admin.ModelAdmin):
    list_display = ("help_request", "rating", "felt_safe", "created_at")
