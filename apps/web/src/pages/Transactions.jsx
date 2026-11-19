import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import { formatCurrency } from "../utils/formatCurrency";

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTransactions = useCallback(async (page) => {
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest(`/transfers?page=${page}&limit=10`);
      setTransactions(result.transactions);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message || "Unable to load transactions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions(pagination.page);
  }, [pagination.page, loadTransactions]);

  const pageCount = Math.max(pagination.totalPages, 1);

  return (
    <section className="page" aria-labelledby="transactions-title">
      <p className="muted">ACTIVITY</p>
      <h1 id="transactions-title">Transactions</h1>
      <p className="muted">Review money you've sent and received.</p>

      <div className="transaction-summary" aria-label="Transaction summary">
        <div className="info-card">
          <p>Total transactions</p>
          <h2>{pagination.total}</h2>
        </div>
        <div className="info-card">
          <p>Current page</p>
          <h2>{pagination.page} / {pageCount}</h2>
        </div>
      </div>

      {error && (
        <div className="info-card" role="alert">
          <p className="error-message">{error}</p>
          <button type="button" className="primary-button" onClick={() => loadTransactions(pagination.page)}>
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div className="info-card" role="status" aria-live="polite" aria-busy="true">
          <p>Loading your transactions...</p>
        </div>
      ) : !error && transactions.length === 0 ? (
        <div className="info-card empty-state" role="status">
          <h2>No transactions yet</h2>
          <p>Your sent and received payments will appear here.</p>
        </div>
      ) : !error ? (
        <>
          <div className="transaction-list" aria-label="Transaction history">
            {transactions.map((transaction) => {
              const directionLabel = transaction.direction === "sent" ? "Sent money" : "Received money";
              const counterpartyName = transaction.counterparty?.name || transaction.counterparty?.email || "PayFlow user";
              const transactionDate = new Date(transaction.createdAt);

              return (
                <article className="transaction-row" key={transaction.id} aria-label={`${directionLabel} ${formatCurrency(transaction.amount)} ${transactionDate.toLocaleDateString("en-IN")}`}>
                  <div className="transaction-direction">
                    <span
                      className={transaction.direction === "sent" ? "direction-icon sent" : "direction-icon received"}
                      aria-hidden="true"
                    >
                      {transaction.direction === "sent" ? "↗" : "↙"}
                    </span>

                    <div>
                      <strong>{directionLabel}</strong>
                      <p>{counterpartyName}</p>
                      <time className="transaction-date" dateTime={transactionDate.toISOString()}>
                        {transactionDate.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      </time>
                    </div>
                  </div>

                  <div className="transaction-amount">
                    <strong className={transaction.direction === "sent" ? "amount-sent" : "amount-received"}>
                      <span className="visually-hidden">{transaction.direction === "sent" ? "Debited: " : "Credited: "}</span>
                      {transaction.direction === "sent" ? "−" : "+"}{formatCurrency(transaction.amount)}
                    </strong>
                    <span className={`status-pill status-${transaction.status}`}>Status: {transaction.status}</span>
                  </div>

                  <div className="transaction-reference">
                    <span>Reference</span>
                    <code>{transaction.reference}</code>
                    {transaction.description && <small>{transaction.description}</small>}
                  </div>
                </article>
              );
            })}
          </div>

          <nav className="pagination" aria-label="Transaction history pages">
            <button
              type="button"
              className="secondary-button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
            >
              Previous page
            </button>

            <span aria-live="polite" aria-atomic="true">Page {pagination.page} of {pageCount}</span>

            <button
              type="button"
              className="secondary-button"
              disabled={pagination.page >= pagination.totalPages || loading}
              onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
            >
              Next page
            </button>
          </nav>
        </>
      ) : null}
    </section>
  );
}
