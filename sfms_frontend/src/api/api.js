import axios from "axios";

// In production, reads from VITE_API_BASE_URL (e.g. https://your-backend.onrender.com/api).
// Defaults to local Django server if not configured.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthEndpoint =
        error.config?.url?.includes("/login/") ||
        error.config?.url?.includes("/verify-otp/") ||
        error.config?.url?.includes("/register/");
      if (!isAuthEndpoint) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const registerUser = (data) => api.post("/register/", data);
export const verifyOtp = (data) => api.post("/verify-otp/", data);
export const resendOtp = (data) => api.post("/resend-otp/", data);
export const loginUser = (data) => api.post("/login/", data);
export const getProfile = () => api.get("/profile/");
export const createOutlet = (data) => api.post("/outlets/create/", data);
export const getOutlets = () => api.get("/outlets/");
export const approveOutlet = (id, status) => api.patch(`/outlets/${id}/approve/`, { status });
export const deleteOutlet = (id) => api.delete(`/outlets/${id}/`);

export const logSale = (data) => api.post("/sales/create/", data);
export const getSales = (outletId) => api.get("/sales/", outletId ? { params: { outlet: outletId } } : {});
export const getSalesSummary = () => api.get("/sales/summary/");
export const getSalesPrediction = (params = {}) => api.get("/sales/predict/", { params });
export const getNetworkSalesForecast = (params = {}) => api.get("/sales/network-forecast/", { params });

// ---------- Inventory API calls ----------
export const createStockItem = (data) => api.post("/inventory/create/", data);
export const getStockItems = (outletId) => api.get("/inventory/", outletId ? { params: { outlet: outletId } } : {});
export const adjustStock = (id, change) => api.patch(`/inventory/${id}/adjust/`, { change });
export const deliverStock = (id, data = {}) => api.post(`/inventory/${id}/deliver/`, data);
export const getLowStock = () => api.get("/inventory/low-stock/");

// ---------- Restock Request API calls ----------
export const getRestockRequests = (outletId) => api.get("/inventory/restock-requests/", outletId ? { params: { outlet: outletId } } : {});
export const createRestockRequest = (data) => api.post("/inventory/restock-requests/create/", data);
export const updateRestockRequest = (id, data) => api.patch(`/inventory/restock-requests/${id}/update/`, data);

// ---------- Royalty API calls ----------
export const getRoyaltyInvoices = (outletId) => api.get("/royalty/", outletId ? { params: { outlet: outletId } } : {});
export const markRoyaltyPaid = (id) => api.patch(`/royalty/${id}/mark-paid/`);
export const getRoyaltySummary = () => api.get("/royalty/summary/");

// ---------- Communication Hub API calls ----------
export const getAnnouncements = () => api.get("/announcements/");
export const createAnnouncement = (data) => api.post("/announcements/create/", data);
export const getTickets = (params = {}) => api.get("/tickets/", { params });
export const createTicket = (data) => api.post("/tickets/create/", data);
export const updateTicket = (id, data) => api.patch(`/tickets/${id}/update/`, data);

// ---------- Predictive Depletion API calls ----------
export const getInventoryDepletion = (outletId) =>
  api.get("/inventory/depletion/", outletId ? { params: { outlet: outletId } } : {});
export const submitDraftRestock = (data) =>
  api.post("/inventory/depletion/submit-restock/", data);

// ---------- Benchmarking & Reports API calls ----------
export const getBenchmarkData = (params = {}) => api.get("/benchmarks/data/", { params });
export const exportBenchmarkPDF = (data) =>
  api.post("/benchmarks/export/pdf/", data, { responseType: "blob" });
export const exportBenchmarkExcel = (data) =>
  api.post("/benchmarks/export/excel/", data, { responseType: "blob" });
export const publishBenchmarkReport = (data) => api.post("/benchmarks/publish/", data);

// ---------- Staff & Employee Management API calls ----------
export const getStaff = (outletId) =>
  api.get("/staff/", outletId ? { params: { outlet: outletId } } : {});
export const createStaff = (data) => api.post("/staff/create/", data);
export const updateStaff = (id, data) => api.patch(`/staff/${id}/update/`, data);
export const deleteStaff = (id) => api.delete(`/staff/${id}/delete/`);
export const getStaffSummary = (outletId) =>
  api.get("/staff/summary/", outletId ? { params: { outlet: outletId } } : {});

