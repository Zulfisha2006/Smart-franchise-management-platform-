from django.urls import path
from .views import RoyaltyInvoiceListView, RoyaltyMarkPaidView, RoyaltySummaryView

urlpatterns = [
    path("", RoyaltyInvoiceListView.as_view(), name="royalty-list"),
    path("<int:pk>/mark-paid/", RoyaltyMarkPaidView.as_view(), name="royalty-mark-paid"),
    path("summary/", RoyaltySummaryView.as_view(), name="royalty-summary"),
]
