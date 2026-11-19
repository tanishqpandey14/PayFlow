import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Auth({ mode = "login" }) {
  const isRegister = mode === "register";
  const { user, login, register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Unable to complete your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} aria-labelledby="auth-title">
        <h1 className="brand">PayFlow<span aria-hidden="true">.</span></h1>
        <h2 id="auth-title">{isRegister ? "Create your account" : "Welcome back"}</h2>
        <p className="muted">
          {isRegister
            ? "Start managing your digital wallet."
            : "Sign in to access your wallet."}
        </p>

        {error && <p id="auth-error" className="error-message" role="alert">{error}</p>}

        {isRegister && (
          <label htmlFor="auth-name">
            Full name
            <input
              id="auth-name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={80}
              autoComplete="name"
              autoCapitalize="words"
            />
          </label>
        )}

        <label htmlFor="auth-email">
          Email address
          <input
            id="auth-email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
          />
        </label>

        <label htmlFor="auth-password">
          Password
          <input
            id="auth-password"
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete={isRegister ? "new-password" : "current-password"}
            aria-describedby={error ? "auth-error" : undefined}
          />
        </label>

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting
            ? "Please wait..."
            : isRegister
              ? "Create account"
              : "Sign in"}
        </button>

        <p className="auth-switch">
          {isRegister ? "Already registered?" : "New to PayFlow?"}{" "}
          <Link to={isRegister ? "/login" : "/register"}>
            {isRegister ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <p className="auth-disclaimer">PayFlow is a simulated wallet. No real money is transferred.</p>
      </form>
    </main>
  );
}
