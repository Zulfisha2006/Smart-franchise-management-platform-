import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyOtp from "./pages/VerifyOtp";
import OwnerDashboard from "./pages/OwnerDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      {/* Owner Dashboard Dedicated Routes */}
      <Route
        path="/owner-dashboard"
        element={
          <ProtectedRoute allowedRole="franchise_owner">
            <OwnerDashboard initialSection="overview" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/inventory"
        element={
          <ProtectedRoute allowedRole="franchise_owner">
            <OwnerDashboard initialSection="inventory" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/royalty"
        element={
          <ProtectedRoute allowedRole="franchise_owner">
            <OwnerDashboard initialSection="royalty" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/announcements"
        element={
          <ProtectedRoute allowedRole="franchise_owner">
            <OwnerDashboard initialSection="announcements" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/support"
        element={
          <ProtectedRoute allowedRole="franchise_owner">
            <OwnerDashboard initialSection="support" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/restock"
        element={
          <ProtectedRoute allowedRole="franchise_owner">
            <OwnerDashboard initialSection="restock" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/forecast"
        element={
          <ProtectedRoute allowedRole="franchise_owner">
            <OwnerDashboard initialSection="forecast" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/staff"
        element={
          <ProtectedRoute allowedRole="franchise_owner">
            <OwnerDashboard initialSection="staff" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/owner-dashboard/employees"
        element={
          <ProtectedRoute allowedRole="franchise_owner">
            <OwnerDashboard initialSection="staff" />
          </ProtectedRoute>
        }
      />

      {/* Admin Dashboard Dedicated Routes */}
      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard initialSection="overview" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard/outlets"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard initialSection="outlets" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard/inventory"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard initialSection="inventory" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard/royalty"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard initialSection="royalty" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard/announcements"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard initialSection="announcements" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard/support"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard initialSection="support" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard/restock"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard initialSection="restock" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard/communication"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard initialSection="announcements" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard/forecast"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard initialSection="forecast" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard/benchmarks"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminDashboard initialSection="benchmarks" />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
