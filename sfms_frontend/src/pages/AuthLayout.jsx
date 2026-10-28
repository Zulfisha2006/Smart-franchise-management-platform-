import { Link } from "react-router-dom";
import "./Auth.css";

export default function AuthLayout({ children, mode = "login" }) {
  return (
    <div className="auth-page-root">
      {/* Top Operations Status Bar */}
      <header className="auth-top-bar">
        <Link to="/login" className="auth-brand-lockup">
          <div className="auth-brand-mark">CH</div>
          <div className="auth-brand-text">
            <span className="auth-brand-title">Chainhub</span>
            <span className="auth-brand-tag">Franchise Operating System</span>
          </div>
        </Link>

        <div className="auth-top-status">
          <div className="auth-status-pill">
            <span className="auth-pulse-dot"></span>
            <span>Network: Operational</span>
          </div>
          <div className="auth-top-meta">
            <span>v2.4.0 • Enterprise Edition</span>
          </div>
        </div>
      </header>

      {/* Main Split Body */}
      <main className="auth-main-container">
        {/* Left Hero: Operations Showcase */}
        <section className="auth-hero-panel">
          <div className="auth-hero-content">
            <div className="auth-badge-kicker">
              <span>◆ Centralized Ledger Gateway</span>
            </div>

            {mode === "register" ? (
              <>
                <h1 className="auth-hero-heading">
                  Scale your brand with <span>real-time precision.</span>
                </h1>
                <p className="auth-hero-subtext">
                  Onboard your franchise outlet to automate daily revenue settlement, 
                  centralize inventory replenishment, and eliminate manual royalty paperwork.
                </p>

                <div className="auth-steps-flow">
                  <div className="auth-step-pill">
                    <span className="auth-step-num">01</span>
                    <span>Create owner credentials & link outlet profile</span>
                  </div>
                  <div className="auth-step-pill">
                    <span className="auth-step-num">02</span>
                    <span>Verify email via 6-digit cryptographic OTP</span>
                  </div>
                  <div className="auth-step-pill">
                    <span className="auth-step-num">03</span>
                    <span>HQ Admin review & rapid outlet activation</span>
                  </div>
                </div>
              </>
            ) : mode === "verify" ? (
              <>
                <h1 className="auth-hero-heading">
                  Securing your <span>franchise access.</span>
                </h1>
                <p className="auth-hero-subtext">
                  Chainhub implements dual-factor verification to safeguard financial ledgers, 
                  settlement records, and private franchise operations.
                </p>

                <div className="auth-steps-flow">
                  <div className="auth-step-pill">
                    <span className="auth-step-num">OK</span>
                    <span>Credentials created successfully</span>
                  </div>
                  <div className="auth-step-pill" style={{ borderColor: "var(--amber)", background: "rgba(226, 139, 38, 0.1)" }}>
                    <span className="auth-step-num" style={{ background: "var(--amber)", color: "var(--charcoal)" }}>02</span>
                    <span style={{ color: "#fff", fontWeight: 600 }}>Verify 6-digit one-time passcode</span>
                  </div>
                  <div className="auth-step-pill" style={{ opacity: 0.6 }}>
                    <span className="auth-step-num">03</span>
                    <span>Direct access to outlet dashboard</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h1 className="auth-hero-heading">
                  Every outlet. <span>One unified ledger.</span>
                </h1>
                <p className="auth-hero-subtext">
                  Real-time sales reconciliation, automated royalty invoicing, and multi-unit 
                  inventory intelligence across your entire franchise network.
                </p>

                {/* Real-time Telemetry Card */}
                <div className="auth-telemetry-card">
                  <div className="auth-telemetry-header">
                    <span className="auth-telemetry-title">
                      <span>Live Network Telemetry</span>
                    </span>
                    <span className="auth-telemetry-node">NODE: HQ-DEL-01</span>
                  </div>
                  <div className="auth-ticker-list">
                    <div className="auth-ticker-item">
                      <div className="auth-ticker-outlet">
                        <span className="auth-ticker-badge sale">SALE</span>
                        <span>Outlet #002 — Delhi Connaught</span>
                      </div>
                      <span className="auth-ticker-val">₹34,250</span>
                    </div>
                    <div className="auth-ticker-item">
                      <div className="auth-ticker-outlet">
                        <span className="auth-ticker-badge stock">STOCK</span>
                        <span>Outlet #014 — Ludhiana Mall</span>
                      </div>
                      <span className="auth-ticker-val">Reorder #881</span>
                    </div>
                    <div className="auth-ticker-item">
                      <div className="auth-ticker-outlet">
                        <span className="auth-ticker-badge royalty">ROYALTY</span>
                        <span>Outlet #009 — Chandigarh Sec 35</span>
                      </div>
                      <span className="auth-ticker-val">Paid ₹12,800</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Metric Pills */}
            <div className="auth-metric-row">
              <div className="auth-metric-box">
                <div className="auth-metric-num">34+</div>
                <div className="auth-metric-label">Active Outlets</div>
              </div>
              <div className="auth-metric-box">
                <div className="auth-metric-num">99.9%</div>
                <div className="auth-metric-label">POS Sync Rate</div>
              </div>
              <div className="auth-metric-box">
                <div className="auth-metric-num">₹18.4M</div>
                <div className="auth-metric-label">Monthly Volume</div>
              </div>
            </div>
          </div>

          <div className="auth-hero-footer">
            <span>256-Bit Encrypted Ledger</span>
            <span>•</span>
            <span>Role-Based Multi-Tenant Architecture</span>
          </div>
        </section>

        {/* Right Auth Card Container */}
        <section className="auth-form-panel">
          <div className="auth-form-wrapper">{children}</div>
        </section>
      </main>
    </div>
  );
}
