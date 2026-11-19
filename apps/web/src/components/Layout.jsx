import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      <aside className="sidebar" aria-label="Application sidebar">
        <h2 className="brand">PayFlow<span aria-hidden="true">.</span></h2>

        <p className="sidebar-label">WORKSPACE</p>

        <nav aria-label="Main navigation">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/send">Send money</NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/profile">Profile</NavLink>
        </nav>

        <div className="sidebar-bottom">
          <p>{user?.name || "PayFlow User"}</p>
          <button type="button" className="logout-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <span>Digital Wallet</span>
          <span className="user-email">{user?.email}</span>
        </header>

        <main id="main-content" className="main-content-area" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
