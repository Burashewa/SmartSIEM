const isLocalDevPort = ["5173", "3000", "8080"].includes(window.location.port);
const apiOrigin =
  window.location.origin === "null" || isLocalDevPort ? "http://localhost:5000" : window.location.origin;
const API_BASE = `${apiOrigin}/api`;

const recTitleEl = document.getElementById("recTitle");
const recSummaryEl = document.getElementById("recSummary");
const recMetaEl = document.getElementById("recMeta");
const recBodyEl = document.getElementById("recBody");

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

const getRecommendationsFromAlert = (alert) => {
  if (Array.isArray(alert.recommendations)) return alert.recommendations;
  const ctx = alert.context;
  if (ctx && Array.isArray(ctx.recommendations)) return ctx.recommendations;
  return [];
};

const renderAlertMeta = (alert) => {
  recMetaEl.innerHTML = "";
  const rows = [
    ["Triggered", formatDate(alert.triggeredAt)],
    ["Severity", (alert.severity || "—").toString()],
    ["IP", alert.ip ?? "—"],
    ["Rule", alert.ruleId ?? "—"],
  ];
  rows.forEach(([dt, dd]) => {
    const dTerm = document.createElement("dt");
    dTerm.textContent = dt;
    const dDesc = document.createElement("dd");
    dDesc.textContent = dd;
    recMetaEl.appendChild(dTerm);
    recMetaEl.appendChild(dDesc);
  });
  recMetaEl.hidden = false;
};

const renderRecommendations = (items) => {
  recBodyEl.innerHTML = "";
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "rec-empty";
    p.textContent = "No recommendations are stored for this alert yet.";
    recBodyEl.appendChild(p);
    return;
  }
  const ol = document.createElement("ol");
  ol.className = "rec-list-page";
  items.forEach((text, i) => {
    const li = document.createElement("li");
    li.className = "rec-list-page-item";
    const span = document.createElement("span");
    span.className = "rec-list-page-num";
    span.textContent = String(i + 1);
    const body = document.createElement("div");
    body.className = "rec-list-page-text";
    body.textContent = text;
    li.appendChild(span);
    li.appendChild(body);
    ol.appendChild(li);
  });
  recBodyEl.appendChild(ol);
};

const setError = (message) => {
  recTitleEl.textContent = "Recommendations";
  recSummaryEl.textContent = "Something went wrong.";
  recMetaEl.hidden = true;
  recBodyEl.replaceChildren();
  const p = document.createElement("p");
  p.className = "rec-empty rec-empty--error";
  p.textContent = message;
  recBodyEl.appendChild(p);
};

const params = new URLSearchParams(window.location.search);
const alertId = params.get("id");

(async () => {
  if (!alertId) {
    setError("No alert was selected. Open this page from an alert card on the console.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/alerts/${encodeURIComponent(alertId)}`);
    if (res.status === 404) {
      setError("That alert could not be found. It may have been cleared.");
      return;
    }
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const alert = await res.json();

    recTitleEl.textContent = "Recommendations";
    recSummaryEl.textContent = alert.message || "Alert";
    renderAlertMeta(alert);
    renderRecommendations(getRecommendationsFromAlert(alert));
  } catch (err) {
    setError(err.message || "Failed to load alert.");
  }
})();
