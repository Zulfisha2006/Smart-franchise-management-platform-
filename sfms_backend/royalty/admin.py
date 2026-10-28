from django.contrib import admin
from .models import RoyaltyInvoice


@admin.register(RoyaltyInvoice)
class RoyaltyInvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "outlet",
        "period_name",
        "month",
        "year",
        "total_sales",
        "royalty_percentage",
        "amount_due",
        "status",
        "paid_at",
        "created_at",
    )
    list_filter = ("status", "year", "month", "outlet")
    search_fields = ("outlet__outlet_name", "outlet__city")
    readonly_fields = ("created_at", "updated_at")
