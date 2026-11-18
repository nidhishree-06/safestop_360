from django.contrib import admin

from reports.models import SafetyReport


@admin.register(SafetyReport)
class SafetyReportAdmin(admin.ModelAdmin):
    list_display = ("category", "area_label", "city", "review_status", "is_demo", "created_at")
    list_filter = ("category", "review_status", "is_demo", "city")
    search_fields = ("area_label", "description")
