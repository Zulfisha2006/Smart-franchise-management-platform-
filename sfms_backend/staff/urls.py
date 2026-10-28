from django.urls import path
from .views import (
    EmployeeListView,
    EmployeeCreateView,
    EmployeeUpdateView,
    EmployeeDeleteView,
    StaffSummaryView,
)

urlpatterns = [
    path("", EmployeeListView.as_view(), name="staff-list"),
    path("create/", EmployeeCreateView.as_view(), name="staff-create"),
    path("<int:pk>/update/", EmployeeUpdateView.as_view(), name="staff-update"),
    path("<int:pk>/delete/", EmployeeDeleteView.as_view(), name="staff-delete"),
    path("summary/", StaffSummaryView.as_view(), name="staff-summary"),
]
