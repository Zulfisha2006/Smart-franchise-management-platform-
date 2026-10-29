import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { verifyOtp, resendOtp } from "../api/api";
import "./Auth.css";

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();

  // Username and email passed from Register or Login, or entered manually if refreshed
  const [username, setUsername] = useState(location.state?.username || "");
  const emailHint = location.state?.email || "";
  const initialNotice = location.state?.warning || "";
  const initialDevOtp = location.state?.dev_otp || "";

  const [code, setCode] = useState(initialDevOtp || "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(initialNotice);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please enter your username or email.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await verifyOtp({ username: username.trim(), code: code.trim() });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 1400);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!username.trim()) {
      setError("Please enter your username or email first.");
      return;
    }
    setResendMessage("");
    setError("");
    setResendLoading(true);
    try {
      const res = await resendOtp({ username: username.trim() });
      setResendMessage(res.data?.detail || "A fresh 6-digit verification code has been sent.");
      if (res.data?.dev_otp) {
        setCode(res.data.dev_otp);
        setNotice(`OTP generated: ${res.data.dev_otp}`);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Could not resend code. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="auth-page">
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
          <h2 className="auth-header-title">Verify Your Email</h2>
          <p className="auth-header-sub">
            {username ? (
              <>
                Enter the 6-digit verification code sent to {emailHint ? <strong>{emailHint}</strong> : "your email"} for user <code style={{ color: "var(--teal)", fontFamily: "var(--font-mono)" }}>@{username}</code>.
              </>
            ) : (
              "Enter your username and the 6-digit verification code sent to your email."
            )}
          </p>
        </div>

        {/* Alerts */}
        {notice && !error && (
          <div className="auth-alert-box info" style={{ background: "rgba(20, 184, 166, 0.1)", border: "1px solid rgba(20, 184, 166, 0.3)", color: "var(--teal)", padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
            ℹ️ {notice}
          </div>
        )}

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
            <div>Account verified! Redirecting to sign in...</div>
          </div>
        )}

        {resendMessage && !error && (
          <div className="auth-alert-box success">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ flexShrink: 0, marginTop: 1 }}>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>{resendMessage}</div>
          </div>
        )}

        {/* Verification Form */}
        <form onSubmit={handleSubmit}>
          {!location.state?.username && (
            <div className="auth-form-group" style={{ marginBottom: "16px" }}>
              <label className="auth-field-label" htmlFor="otp-username">
                <span>Username or Email</span>
              </label>
              <div className="auth-input-wrapper">
                <input
                  id="otp-username"
                  className="auth-input-field"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username or email"
                  required
                />
              </div>
            </div>
          )}

          <div className="auth-form-group" style={{ margin: "22px 0" }}>
            <label className="auth-field-label" htmlFor="otp-input" style={{ justifyContent: "center", marginBottom: "10px" }}>
              <span>Enter 6-Digit Passcode</span>
            </label>
            <input
              id="otp-input"
              className="auth-code-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              required
              autoFocus
              autoComplete="one-time-code"
            />
          </div>

          <button
            className="auth-submit-btn"
            type="submit"
            disabled={loading || code.length !== 6}
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" stroke="currentColor" />
                  <path d="M4 12a8 8 0 018-8" strokeLinecap="round" />
                </svg>
                <span>Verifying code...</span>
              </>
            ) : (
              <>
                <span>Complete Verification</span>
                <span>→</span>
              </>
            )}
          </button>

          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--teal)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "4px",
              }}
            >
              {resendLoading ? "Dispatching new code..." : "Didn't receive a code? Resend OTP"}
            </button>
          </div>
        </form>

        <div className="auth-card-footer">
          <span>Wrong email? </span>
          <Link to="/register" className="auth-card-link">
            Register again
          </Link>
        </div>
      </div>
    </div>
  );
}
