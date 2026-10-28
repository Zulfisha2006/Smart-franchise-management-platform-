from django.urls import path
from .views import (
    StockItemCreateView,
    StockItemListView,
    StockAdjustView,
    LowStockView,
    RestockRequestCreateView,
    RestockRequestListView,
    RestockRequestUpdateView,
    InventoryDepletionView,
    DraftRestockSubmitView,
    AdminStockDeliverView,
)

urlpatterns = [
    path("create/", StockItemCreateView.as_view(), name="stock-create"),
    path("", StockItemListView.as_view(), name="stock-list"),
    path("<int:pk>/adjust/", StockAdjustView.as_view(), name="stock-adjust"),
    path("<int:pk>/deliver/", AdminStockDeliverView.as_view(), name="stock-deliver"),
    path("low-stock/", LowStockView.as_view(), name="stock-low"),
    # Restock Requests
    path("restock-requests/", RestockRequestListView.as_view(), name="restock-list"),
    path("restock-requests/create/", RestockRequestCreateView.as_view(), name="restock-create"),
    path("restock-requests/<int:pk>/update/", RestockRequestUpdateView.as_view(), name="restock-update"),
    # Predictive Depletion & Draft Restock
    path("depletion/", InventoryDepletionView.as_view(), name="inventory-depletion"),
    path("depletion/submit-restock/", DraftRestockSubmitView.as_view(), name="draft-restock-submit"),
]
