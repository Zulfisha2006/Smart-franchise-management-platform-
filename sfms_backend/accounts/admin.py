from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Outlet, OTPCode

class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "role", "is_verified", "is_staff")
    fieldsets = UserAdmin.fieldsets + (("Franchise Info", {"fields": ("role", "phone_number", "is_verified")}),)

admin.site.register(User, CustomUserAdmin)
admin.site.register(Outlet)
admin.site.register(OTPCode)
