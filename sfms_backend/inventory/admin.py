from django.contrib import admin
from .models import StockItem, RestockRequest


@admin.register(StockItem)
class StockItemAdmin(admin.ModelAdmin):
    list_display = ("outlet", "name", "current_quantity", "unit", "low_stock_threshold", "is_low_stock", "updated_at")
    list_filter = ("outlet", "unit")
    search_fields = ("name", "outlet__outlet_name")


@admin.register(RestockRequest)
class RestockRequestAdmin(admin.ModelAdmin):
    list_display = ("outlet", "stock_item", "requested_qty", "status", "requested_at", "updated_at")
    list_filter = ("status", "outlet")
    search_fields = ("outlet__outlet_name", "stock_item__name")
    readonly_fields = ("requested_at", "updated_at")
