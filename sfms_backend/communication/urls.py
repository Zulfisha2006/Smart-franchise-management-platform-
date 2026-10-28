from django.urls import path
from .views import (
    AnnouncementCreateView,
    AnnouncementListView,
    SupportTicketCreateView,
    SupportTicketListView,
    SupportTicketUpdateView,
)
from .benchmarks import BenchmarkDataView, ExportPDFView, ExportExcelView, PublishReportView

urlpatterns = [
    # Announcements
    path("announcements/", AnnouncementListView.as_view(), name="announcement-list"),
    path("announcements/create/", AnnouncementCreateView.as_view(), name="announcement-create"),

    # Support Tickets
    path("tickets/", SupportTicketListView.as_view(), name="ticket-list"),
    path("tickets/create/", SupportTicketCreateView.as_view(), name="ticket-create"),
    path("tickets/<int:pk>/update/", SupportTicketUpdateView.as_view(), name="ticket-update"),
    path("tickets/<int:pk>/", SupportTicketUpdateView.as_view(), name="ticket-detail-update"),

    # Benchmarking & Reports
    path("benchmarks/data/", BenchmarkDataView.as_view(), name="benchmark-data"),
    path("benchmarks/export/pdf/", ExportPDFView.as_view(), name="benchmark-export-pdf"),
    path("benchmarks/export/excel/", ExportExcelView.as_view(), name="benchmark-export-excel"),
    path("benchmarks/publish/", PublishReportView.as_view(), name="benchmark-publish"),
]
