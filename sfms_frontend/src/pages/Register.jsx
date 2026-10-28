import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser } from "../api/api";
import "./Auth.css";

export default function Register() {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await registerUser(form);
      setSuccess(true);
      setTimeout(() => {
        navigate("/verify-otp", {
          state: { username: form.username, email: form.email },
        });
      }, 1000);
    } catch (err) {
      const data = err.response?.data;
      const firstError = data ? Object.values(data)[0] : "Something went wrong.";
      setError(Array.isArray(firstError) ? firstError[0] : firstError);
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
          <h2 className="auth-header-title">Register Franchise</h2>
          <p className="auth-header-sub">
            Create an owner account to onboard your outlet and automate sales & royalty tracking.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="auth-alert-box error">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="auth-alert-box success">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>Account created! Directing you to verify your email OTP...</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="auth-form-group">
            <div className="auth-field-label">
              <label htmlFor="reg-username">Username</label>
              <span className="auth-field-hint">e.g. rohit_delhi01</span>
            </div>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <input
                id="reg-username"
                className="auth-input-field"
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="Choose a username"
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="auth-form-group">
            <div className="auth-field-label">
              <label htmlFor="reg-email">Business Email</label>
              <span className="auth-field-hint">OTP will be sent here</span>
            </div>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </span>
              <input
                id="reg-email"
                className="auth-input-field"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="owner@franchisedomain.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-form-group">
            <div className="auth-field-label">
              <label htmlFor="reg-password">Password</label>
              <span className="auth-field-hint">Min. 6 characters</span>
            </div>
            <div className="auth-input-wrapper">
              <span className="auth-input-icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                id="reg-password"
                className="auth-input-field"
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••••••"
                required
                minLength={6}
                autoComplete="new-password"
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
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Continue to OTP Verification</span>
                <span>→</span>
              </>
            )}
          </button>
        </form>

        <div className="auth-card-footer">
          <span>Already registered? </span>
          <Link to="/login" className="auth-card-link">
            Sign in to portal
          </Link>
        </div>
      </div>
    </div>
  );
}
