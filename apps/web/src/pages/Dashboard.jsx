import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/formatCurrency";

export default function Dashboard() {
  const { user, wallet } = useAuth();

  return (
    <section className="page" aria-labelledby="dashboard-title">
      <div className="page-heading">
        <div>
          <p className="muted">OVERVIEW</p>
          <h1 id="dashboard-title">Good to see you, {user?.name?.split(" ")[0]}.</h1>
          <p className="muted">Here's your wallet at a glance.</p>
        </div>
        <Link className="primary-button link-button" to="/send">
          Send money
        </Link>
      </div>

      <section className="balance-card" aria-label="Wallet balance">
        <p>Total wallet balance</p>
        <h2>{formatCurrency(wallet?.balance ?? 0)}</h2>
        <span>{wallet?.currency || "INR"} · Simulated wallet</span>
      </section>

      <div className="dashboard-grid">
        <section className="info-card" aria-label="Wallet status">
          <p>Wallet status</p>
          <h3>{wallet?.status || "Unavailable"}</h3>
        </section>

        <section className="info-card" aria-label="Account email">
          <p>Account email</p>
          <h3>{user?.email}</h3>
        </section>
      </div>

      <div className="section-heading">
        <h2>Quick actions</h2>
      </div>

      <div className="quick-actions">
        <Link to="/send" className="action-card">
          <span aria-hidden="true">↗</span>
          <strong>Send money</strong>
          <p>Transfer funds to another PayFlow user.</p>
        </Link>

        <Link to="/transactions" className="action-card">
          <span aria-hidden="true">↔</span>
          <strong>Transactions</strong>
          <p>View your payment activity.</p>
        </Link>
      </div>
    </section>
  );
}
