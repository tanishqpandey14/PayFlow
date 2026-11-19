import { useState } from "react";
import { apiRequest } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { formatCurrency } from "../utils/formatCurrency";

export default function SendMoney() {
  const { refreshWallet, wallet } = useAuth();

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const rupees = Number(amount);
    const paise = Math.round(rupees * 100);

    if (!Number.isFinite(rupees) || rupees <= 0 ||
        !Number.isSafeInteger(paise) || paise <= 0) {
      setError("Enter a valid positive amount.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await apiRequest("/transfers", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ receiverEmail: email, amount: paise, description }),
      });

      await refreshWallet();
      setMessage(`Transfer successful! Reference: ${result.reference || result.transfer?.reference || "Completed"}`);
      setEmail("");
      setAmount("");
      setDescription("");
    } catch (err) {
      setError(err.message || "Unable to complete the transfer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page" aria-labelledby="send-money-title">
      <p className="muted">PAYMENTS</p>
      <h1 id="send-money-title">Send money</h1>
      <p className="muted">Transfer funds to another PayFlow account.</p>

      <div className="transfer-layout">
        <form className="form-card" onSubmit={handleSubmit} aria-describedby="transfer-help">
          <p id="transfer-help" className="form-help">Enter the recipient's registered email and the amount in Indian rupees.</p>

          <label htmlFor="recipient-email">
            Recipient email
            <input
              id="recipient-email"
              name="receiverEmail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="recipient@example.com"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
              required
            />
          </label>

          <label htmlFor="transfer-amount">
            Amount (INR)
            <input
              id="transfer-amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
          </label>

          <label htmlFor="transfer-description">
            Description (optional)
            <input
              id="transfer-description"
              name="description"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={200}
              placeholder="What's this payment for?"
            />
          </label>

          {error && <p className="error-message" role="alert">{error}</p>}
          {message && <p className="success-message" role="status" aria-live="polite">{message}</p>}

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Processing transfer..." : "Confirm transfer"}
          </button>
        </form>

        <aside className="transfer-summary" aria-labelledby="transfer-summary-title">
          <p className="muted">IMPORTANT</p>
          <h2 id="transfer-summary-title">Before you send</h2>
          <p className="wallet-balance-note">Available wallet balance: <strong>{formatCurrency(wallet?.balance ?? 0)}</strong></p>
          <ul>
            <li>Check the recipient's email carefully.</li>
            <li>Transfers are simulated and do not move real money.</li>
            <li>Completed transfers cannot be reversed in this demo.</li>
          </ul>
        </aside>
      </div>
    </section>
  );
}
