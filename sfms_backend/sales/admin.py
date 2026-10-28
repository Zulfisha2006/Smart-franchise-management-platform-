from django.contrib import admin
from .models import Sale

@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("outlet", "date", "amount")
    list_filter = ("outlet", "date")
