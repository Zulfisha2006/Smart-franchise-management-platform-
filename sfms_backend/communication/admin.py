from django.contrib import admin
from .models import Announcement, SupportTicket


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "created_by", "created_at")
    search_fields = ("title", "message")
    list_filter = ("created_at",)


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ("subject", "outlet", "status", "created_at", "updated_at")
    list_filter = ("status", "created_at", "outlet")
    search_fields = ("subject", "description", "admin_reply", "outlet__outlet_name")
    readonly_fields = ("created_at", "updated_at")
