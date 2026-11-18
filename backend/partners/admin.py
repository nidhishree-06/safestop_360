from django.contrib import admin

from partners.models import Partner, PartnerAvailability, PartnerVerification


@admin.register(Partner)
class PartnerAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "city", "verification_status", "is_demo", "created_at")
    list_filter = ("category", "verification_status", "is_demo", "city")
    search_fields = ("name", "address", "area")


@admin.register(PartnerVerification)
class PartnerVerificationAdmin(admin.ModelAdmin):
    list_display = ("partner", "status", "reviewed_by", "reviewed_at")
    list_filter = ("status",)


@admin.register(PartnerAvailability)
class PartnerAvailabilityAdmin(admin.ModelAdmin):
    list_display = ("partner", "status", "updated_at")
    list_filter = ("status",)
