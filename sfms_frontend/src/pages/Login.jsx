import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser, getProfile } from "../api/api";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { loginSuccess } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setLoading(true);

    try {
      const tokenRes = await loginUser({ username, password });
      localStorage.setItem("access_token", tokenRes.data.access);
      const profileRes = await getProfile();
      loginSuccess(tokenRes.data, profileRes.data);
      navigate(profileRes.data.role === "admin" ? "/admin-dashboard" : "/owner-dashboard");
    } catch (err) {
      if (!err.response) {
        setError("Cannot connect to server. Please ensure the Django backend server is running on http://127.0.0.1:8000 (run: python manage.py runserver).");
        return;
      }

      const detail = err.response?.data?.detail;
      const detailText = Array.isArray(detail) ? detail[0] : detail;

      if (err.response?.data?.needs_verification) {
        setNeedsVerification(true);
        setError(detailText || "Please verify your email before logging in.");
      } else {
        setError(detailText || "Invalid username or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Top Back Navigation */}
      <div className="auth-top-nav">
        <Link to="/" className="auth-back-btn">
          <span>←</span>
          <span>Back to Chainhub</span>
        </Link>
      </div>

      <div className="auth-card">
        {/* Brand Lockup */}
        <div className="auth-card-brand">
          <div className="auth-card-brand-mark">CH</div>
          <span className="auth-card-brand-name">Chainhub</span>
        </div>

        {/* Header */}
        <div className="auth-header">
          <h2 className="auth-header-title">Sign In</h2>
          <p className="auth-header-sub">
            Enter your credentials to access your franchise or HQ management portal.
          </p>
        </div>

        {/* Alert / Error Box */}
        {error && (
          <div className="auth-alert-box error">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <span>{error}</span>
              {needsVerification && (
                <div style={{ marginTop: "6px" }}>
                  <Link
                    to="/verify-otp"
                    state={{ username }}
                    style={{ color: "var(--red)", fontWeight: 700, textDecoration: "underline" }}
                  >
                    Click here to enter your 6-digit OTP →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <label className="auth-field-label" htmlFor="login-username">
              <span>Username or Email</span>
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <input
                id="login-username"
                className="auth-input-field"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or email address"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="auth-form-group">
            <label className="auth-field-label" htmlFor="login-password">
              <span>Password</span>
            </label>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                id="login-password"
                className="auth-input-field"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-toggle-pwd"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button className="auth-submit-btn" type="submit" disabled={loading}>
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" stroke="currentColor" />
                  <path d="M4 12a8 8 0 018-8" strokeLinecap="round" />
                </svg>
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Portal</span>
                <span>→</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-card-footer">
          <span>New franchise operator? </span>
          <Link to="/register" className="auth-card-link">
            Register your outlet
          </Link>
        </div>
      </div>
    </div>
  );
}
