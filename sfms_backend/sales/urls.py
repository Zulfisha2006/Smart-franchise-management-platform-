from django.urls import path
from .views import (
    SaleCreateView,
    SaleListView,
    SaleSummaryView,
    SalePredictionView,
    NetworkSalesForecastView,
)

urlpatterns = [
    path("create/", SaleCreateView.as_view(), name="sale-create"),
    path("", SaleListView.as_view(), name="sale-list"),
    path("summary/", SaleSummaryView.as_view(), name="sale-summary"),
    path("predict/", SalePredictionView.as_view(), name="sale-predict"),
    path("network-forecast/", NetworkSalesForecastView.as_view(), name="network-sales-forecast"),
]
