import { useState, useEffect, useCallback } from "react";
import { apiGetMyNotifications } from "../api";

const TYPE_ICON = {
  APPOINTMENT_CONFIRMATION:   "✅",
  APPOINTMENT_CANCELLATION:   "❌",
  APPOINTMENT_REMINDER_1HR:   "⏰",
  APPOINTMENT_REMINDER_15MIN: "⚡",
  PRESCRIPTION_ISSUED:        "💊",
  TRIAGE_CRITICAL_ALERT:      "🚨",
  PASSWORD_RESET:             "🔑",
  GENERAL:                    "📢",
};

const STATUS_BADGE = {
  SENT:    "badge-green",
  FAILED:  "badge-red",
  PENDING: "badge-yellow",
};

const STATUS_LABEL = {
  SENT:    "Sent",
  FAILED:  "Failed",
  PENDING: "Queued",
};

export default function NotificationPanel({ onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [page, setPage]                   = useState(1);
  const [total, setTotal]                 = useState(0);
  const LIMIT = 10;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await apiGetMyNotifications({ page: p, limit: LIMIT });
      setNotifications(p === 1 ? data.notifications : prev => [...prev, ...data.notifications]);
      setTotal(data.total);
      setPage(p);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const hasMore = notifications.length < total;

  return (
    <div style={{
      position: "absolute", top: 54, right: 0, width: "100%", maxWidth: 430,
      background: "#fff", zIndex: 200, borderTop: "2px solid #1e40af",
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: "70dvh",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.75rem 1rem", borderBottom: "1px solid #e8edf2", flexShrink: 0,
      }}>
        <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#1e293b" }}>
          🔔 Notifications
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", fontSize: "1.1rem", cursor: "pointer", color: "#64748b" }}
        >
          ✕
        </button>
      </div>

      {/* List */}
      <div style={{ overflowY: "auto", flex: 1, padding: "0.5rem 0" }}>
        {loading && notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.82rem" }}>
            ⏳ Loading…
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8", fontSize: "0.82rem" }}>
            No notifications yet
          </div>
        ) : (
          notifications.map(n => (
            <div key={n._id} style={{
              padding: "0.75rem 1rem", borderBottom: "1px solid #f1f5f9",
              display: "flex", gap: "0.65rem", alignItems: "flex-start",
            }}>
              <div style={{ fontSize: "1.1rem", flexShrink: 0, marginTop: "0.1rem" }}>
                {TYPE_ICON[n.type] || "📢"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.4rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {n.subject || n.type.replace(/_/g, " ")}
                  </div>
                  <span className={`badge ${STATUS_BADGE[n.status] || "badge-gray"}`} style={{ flexShrink: 0 }}>
                    {STATUS_LABEL[n.status] || n.status}
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.15rem", lineHeight: 1.5 }}>
                  {n.message}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                  {new Date(n.createdAt).toLocaleString("en-IN")} · {n.channel}
                </div>
              </div>
            </div>
          ))
        )}

        {hasMore && !loading && (
          <div style={{ textAlign: "center", padding: "0.75rem" }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => load(page + 1)}
            >
              Load more
            </button>
          </div>
        )}
        {loading && notifications.length > 0 && (
          <div style={{ textAlign: "center", padding: "0.5rem", fontSize: "0.78rem", color: "#94a3b8" }}>⏳</div>
        )}
      </div>
    </div>
  );
}
