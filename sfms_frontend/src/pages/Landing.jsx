import { Link } from "react-router-dom";
import "./Landing.css";

export default function Landing() {
  return (
    <div className="lp-root">

      {/* ─── Navbar ─── */}
      <header className="lp-nav">
        <Link to="/" className="lp-brand">
          <div className="lp-brand-badge">CH</div>
          <span className="lp-brand-name">Chainhub</span>
        </Link>

        <nav className="lp-nav-links">
          <a href="#features" className="lp-nav-link">Our Brand</a>
          <a href="#how"      className="lp-nav-link">How It Works</a>
          <a href="#about"    className="lp-nav-link">Support</a>
        </nav>

        <div className="lp-nav-actions">
          <Link to="/login"    className="lp-btn-ghost">Sign In</Link>
          <Link to="/register" className="lp-btn-solid">Get Started</Link>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <main className="lp-hero">

        {/* Left: Headline + CTA */}
        <div className="lp-hero-text">
          <h1 className="lp-headline">
            Let's Build Your<br />
            Franchise<br />
            <span className="lp-headline-accent">Network</span>
          </h1>

          <p className="lp-sub">
            One powerful platform to manage every outlet,
            track sales, automate royalties and grow your franchise chain.
          </p>

          <div className="lp-cta-group">
            <Link to="/register" className="lp-cta-primary">
              Register Your Outlet
            </Link>
            <Link to="/login" className="lp-cta-ghost">
              Sign In →
            </Link>
          </div>
        </div>

      </main>

      {/* ─── Footer ─── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-brand-badge sm">CH</div>
            <span>Chainhub</span>
          </div>
          <span className="lp-footer-copy">
            © {new Date().getFullYear()} Chainhub · Smart Franchise Management System
          </span>
        </div>
      </footer>

    </div>
  );
}
