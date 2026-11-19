import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, wallet } = useAuth();

  return (
    <section className="page" aria-labelledby="profile-title">
      <p className="muted">ACCOUNT</p>
      <h1 id="profile-title">Your profile</h1>

      <dl className="info-card profile-card profile-details">
        <div>
          <dt>Full name</dt>
          <dd>{user?.name || "Not available"}</dd>
        </div>
        <div>
          <dt>Email address</dt>
          <dd>{user?.email || "Not available"}</dd>
        </div>
        <div>
          <dt>Account role</dt>
          <dd>{user?.role || "Not available"}</dd>
        </div>
        <div>
          <dt>Wallet currency</dt>
          <dd>{wallet?.currency || "INR"}</dd>
        </div>
      </dl>
    </section>
  );
}
