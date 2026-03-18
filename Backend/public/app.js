const statusEl = document.getElementById("status");
const alertsEl = document.getElementById("alerts");
const activityEl = document.getElementById("activity");
const logsEl = document.getElementById("logs");
const refreshBtn = document.getElementById("refresh");
const clearLogsBtn = document.getElementById("clearLogs");
const clearAlertsBtn = document.getElementById("clearAlerts");
const form = document.getElementById("logForm");
const presetEl = document.getElementById("preset");
const ruleHintEl = document.getElementById("ruleHint");
const ruleDescriptionEl = document.getElementById("ruleDescription");

const isLocalDevPort = ["5173", "3000", "8080"].includes(window.location.port);
const apiOrigin =
  window.location.origin === "null" || isLocalDevPort ? "http://localhost:5000" : window.location.origin;
const API_BASE = `${apiOrigin}/api`;

const setStatus = (text) => {
  statusEl.textContent = text;
};

const rulePresets = {
  "failed-login": {
    values: {
      event: "login_failed",
      ip: "1.2.3.4",
      severity: "high",
      user: "alice",
      count: "5",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "user", "count", "varyUser", "timestamp"],
    description:
      "Send multiple failed logins from the same IP within a short window to trigger the brute-force rule.",
    hint: "Send 5 failed logins from the same IP within 5 minutes.",
  },
  "credential-stuffing": {
    values: {
      event: "login_failed",
      ip: "2.2.2.2",
      severity: "high",
      user: "user",
      count: "12",
      varyUser: true,
    },
    fields: ["description", "event", "ip", "severity", "user", "count", "varyUser", "timestamp"],
    description:
      "Send failed logins from the same IP while varying the user field to simulate credential stuffing.",
    hint: "Send failed logins with different users from the same IP.",
  },
  "login-success": {
    values: {
      event: "login_success",
      ip: "1.2.3.4",
      severity: "medium",
      user: "alice",
      count: "1",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "user", "timestamp"],
    description: "Single successful login event. Useful as a baseline for other rules.",
    hint: "Useful as a baseline for the impossible traveler rule.",
  },
  "impossible-travel-baseline": {
    values: {
      event: "login_success",
      ip: "203.0.113.10",
      severity: "medium",
      user: "traveler",
      latitude: "40.7128",
      longitude: "-74.0060",
      count: "1",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "user", "latitude", "longitude", "timestamp"],
    description:
      "First successful login with geo coordinates. Send the trigger preset next for the same user.",
    hint: "Send this first, then send the trigger preset for the same user.",
  },
  "impossible-travel-trigger": {
    values: {
      event: "login_success",
      ip: "198.51.100.25",
      severity: "medium",
      user: "traveler",
      latitude: "35.6895",
      longitude: "139.6917",
      count: "1",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "user", "latitude", "longitude", "timestamp"],
    description:
      "Second successful login far away from the baseline. Should trigger impossible travel if within 24 hours.",
    hint: "Send after the baseline login to trigger impossible travel.",
  },
  "sql-injection": {
    values: {
      event: "sql_injection",
      ip: "9.9.9.9",
      severity: "critical",
      count: "1",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "source", "timestamp", "message", "log", "line", "rawLine", "raw"],
    description: "Use an event tagged as SQL injection. Add raw payload fields if you want.",
    hint: "Simulates a SQL injection detection event.",
  },
  xss: {
    values: {
      event: "xss_attempt",
      ip: "9.9.9.9",
      severity: "high",
      count: "1",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "source", "timestamp", "message", "log", "line", "rawLine", "raw"],
    description: "Use an event tagged as XSS. Raw payload fields are optional.",
    hint: "Simulates a cross-site scripting attempt.",
  },
  "command-injection": {
    values: {
      event: "command_injection_attempt",
      ip: "9.9.9.9",
      severity: "critical",
      count: "1",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "source", "timestamp", "message", "log", "line", "rawLine", "raw"],
    description: "Use an event tagged as command injection.",
    hint: "Simulates a command injection attempt.",
  },
  "api-rate-limit": {
    values: {
      event: "api_rate_limit",
      ip: "9.9.9.9",
      severity: "medium",
      count: "1",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "source", "timestamp", "message", "log", "line", "rawLine", "raw"],
    description: "Use an event tagged as rate limiting or throttling.",
    hint: "Simulates API rate limiting or throttling.",
  },
  "unauthorized-endpoint": {
    values: {
      event: "unauthorized_endpoint",
      ip: "9.9.9.9",
      severity: "high",
      count: "1",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "source", "timestamp", "message", "log", "line", "rawLine", "raw"],
    description: "Use an event tagged as unauthorized endpoint access.",
    hint: "Simulates unauthorized endpoint access.",
  },
  "directory-scan": {
    values: {
      event: "directory_scan",
      ip: "9.9.9.9",
      severity: "medium",
      count: "1",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "source", "timestamp", "message", "log", "line", "rawLine", "raw"],
    description: "Use an event tagged as directory scan enumeration.",
    hint: "Simulates directory enumeration behavior.",
  },
  "sensitive-file-access": {
    values: {
      event: "sensitive_file_access",
      ip: "9.9.9.9",
      severity: "high",
      count: "1",
      varyUser: false,
    },
    fields: ["description", "event", "ip", "severity", "source", "timestamp", "message", "log", "line", "rawLine", "raw"],
    description: "Use an event tagged as sensitive file access.",
    hint: "Simulates sensitive file access attempts.",
  },
};

const fieldElements = Array.from(document.querySelectorAll(".field[data-field]"));

const setVisibleFields = (fields) => {
  if (!fields || !fields.length) {
    fieldElements.forEach((field) => field.classList.remove("hidden"));
    return;
  }

  const allow = new Set(fields);
  fieldElements.forEach((field) => {
    const key = field.dataset.field;
    if (allow.has(key)) {
      field.classList.remove("hidden");
    } else {
      field.classList.add("hidden");
    }
  });
};

const applyPreset = (key) => {
  if (!key || !rulePresets[key]) {
    setVisibleFields(null);
    if (ruleDescriptionEl) ruleDescriptionEl.value = "";
    if (ruleHintEl) {
      ruleHintEl.textContent = "Tip: Use Rule Preset plus Batch Count to trigger multi-log rules quickly.";
    }
    return;
  }

  const { values, hint, fields, description } = rulePresets[key];

  Object.entries(values).forEach(([field, value]) => {
    const element = form.elements.namedItem(field);
    if (!element) return;
    if (element.type === "checkbox") {
      element.checked = Boolean(value);
      return;
    }
    if (field === "raw" && value && typeof value === "object") {
      element.value = JSON.stringify(value, null, 2);
      return;
    }
    element.value = value ?? "";
  });

  if (ruleDescriptionEl && description) {
    ruleDescriptionEl.value = description;
  }

  if (ruleHintEl && hint) {
    ruleHintEl.textContent = hint;
  }

  setVisibleFields(fields);
};

const addActivity = (text, type = "info") => {
  const item = document.createElement("div");
  item.className = "activity-item";
  item.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  if (type === "error") {
    item.style.borderColor = "rgba(169, 28, 47, 0.4)";
    item.style.background = "#ffecef";
  }
  activityEl.prepend(item);
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const renderAlerts = (alerts) => {
  alertsEl.innerHTML = "";
  if (!alerts.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No alerts yet.";
    alertsEl.appendChild(empty);
    return;
  }
  alerts.forEach((alert) => {
    const card = document.createElement("div");
    card.className = "alert-card";

    const meta = document.createElement("div");
    meta.className = "alert-meta";
    meta.innerHTML = `
      <span>${formatDate(alert.triggeredAt)}</span>
      <span>${alert.ip ?? "unknown ip"}</span>
    `;

    const title = document.createElement("div");
    title.textContent = alert.message || "Alert triggered";

    const tag = document.createElement("span");
    const severity = (alert.severity || "low").toLowerCase();
    tag.className = `tag ${severity}`;
    tag.textContent = severity;

    const rule = document.createElement("div");
    rule.className = "muted";
    rule.textContent = `Rule: ${alert.ruleId || "unknown"}`;

    card.appendChild(meta);
    card.appendChild(title);
    card.appendChild(tag);
    card.appendChild(rule);

    const recommendations =
      alert.recommendations ||
      (alert.context && Array.isArray(alert.context.recommendations) ? alert.context.recommendations : null);

    const recTitle = document.createElement("div");
    recTitle.className = "muted";
    recTitle.textContent = "Recommendations:";

    const recList = document.createElement("ul");
    recList.className = "rec-list";

    if (Array.isArray(recommendations) && recommendations.length) {
      recommendations.forEach((rec) => {
        const item = document.createElement("li");
        item.textContent = rec;
        recList.appendChild(item);
      });
    } else {
      const item = document.createElement("li");
      item.textContent = "No recommendations available.";
      recList.appendChild(item);
    }

    card.appendChild(recTitle);
    card.appendChild(recList);

    alertsEl.appendChild(card);
  });
};

const renderLogs = (logs) => {
  logsEl.innerHTML = "";
  if (!logs.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No logs yet.";
    logsEl.appendChild(empty);
    return;
  }
  logs.forEach((log) => {
    const card = document.createElement("div");
    card.className = "log-card";

    const meta = document.createElement("div");
    meta.className = "log-meta";
    meta.innerHTML = `
      <span>${formatDate(log.timestamp)}</span>
      <span>${log.ip ?? "unknown ip"}</span>
    `;

    const title = document.createElement("div");
    title.textContent = log.event || "Log event";

    const source = document.createElement("div");
    source.className = "muted";
    source.textContent = `Source: ${log.source || "unknown"}`;

    const tag = document.createElement("span");
    const severity = (log.severity || "low").toLowerCase();
    tag.className = `tag ${severity}`;
    tag.textContent = severity;

    card.appendChild(meta);
    card.appendChild(title);
    card.appendChild(tag);
    card.appendChild(source);
    logsEl.appendChild(card);
  });
};

const loadAlerts = async () => {
  setStatus("Loading alerts...");
  try {
    const res = await fetch(`${API_BASE}/alerts`);
    if (!res.ok) throw new Error(`Alert fetch failed (${res.status})`);
    const data = await res.json();
    renderAlerts(data);
    addActivity(`Loaded ${data.length} alerts`);
  } catch (err) {
    addActivity(err.message, "error");
  } finally {
    setStatus("Idle");
  }
};

const loadLogs = async () => {
  setStatus("Loading logs...");
  try {
    const res = await fetch(`${API_BASE}/logs`);
    if (!res.ok) throw new Error(`Log fetch failed (${res.status})`);
    const data = await res.json();
    renderLogs(data);
    addActivity(`Loaded ${data.length} logs`);
  } catch (err) {
    addActivity(err.message, "error");
  } finally {
    setStatus("Idle");
  }
};

const clearLogs = async () => {
  const shouldClear = window.confirm("Clear all logs from the database?");
  if (!shouldClear) return;

  setStatus("Clearing logs...");
  try {
    const res = await fetch(`${API_BASE}/logs`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Clear logs failed (${res.status})`);
    const data = await res.json();
    addActivity(`Cleared ${data.deletedCount ?? 0} logs`);
    await loadLogs();
  } catch (err) {
    addActivity(err.message, "error");
  } finally {
    setStatus("Idle");
  }
};

const clearAlerts = async () => {
  const shouldClear = window.confirm("Clear all alerts from the database?");
  if (!shouldClear) return;

  setStatus("Clearing alerts...");
  try {
    const res = await fetch(`${API_BASE}/alerts`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Clear alerts failed (${res.status})`);
    const data = await res.json();
    addActivity(`Cleared ${data.deletedCount ?? 0} alerts`);
    await loadAlerts();
  } catch (err) {
    addActivity(err.message, "error");
  } finally {
    setStatus("Idle");
  }
};

const buildPayload = (formData) => {
  const payload = {};
  for (const [key, value] of formData.entries()) {
    if (!value) continue;
    if (key === "raw" || key === "count" || key === "varyUser" || key === "preset" || key === "description") {
      continue;
    }
    if (key === "latitude" || key === "longitude" || key === "lat" || key === "lon") {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) payload[key] = numeric;
      continue;
    }
    payload[key] = value;
  }
  const raw = formData.get("raw");
  if (raw) {
    try {
      payload.raw = JSON.parse(raw);
    } catch {
      payload.raw = { raw };
    }
  }
  return payload;
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Sending log...");
  const formData = new FormData(form);
  const payload = buildPayload(formData);
  const count = Math.max(1, Number(formData.get("count") || 1));
  const varyUser = formData.get("varyUser") === "on";
  const baseUser = formData.get("user") || "";
  const timestampInput = formData.get("timestamp");
  const timestampBase = timestampInput ? new Date(timestampInput.toString()) : null;
  const hasValidTimestamp = timestampBase && !Number.isNaN(timestampBase.getTime());

  try {
    let storedCount = 0;
    for (let i = 0; i < count; i += 1) {
      const overrides = {};
      if (varyUser && baseUser) {
        overrides.user = `${baseUser}${i + 1}`;
      }
      if (hasValidTimestamp && count > 1) {
        overrides.timestamp = new Date(timestampBase.getTime() + i * 1000).toISOString();
      }
      const res = await fetch(`${API_BASE}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...overrides }),
      });
      if (!res.ok) throw new Error(`Log send failed (${res.status})`);
      const data = await res.json();
      storedCount += 1;
      if (count === 1) {
        addActivity(`Log stored (${data._id || "ok"})`);
      }
    }
    if (count > 1) {
      addActivity(`Sent ${storedCount} logs`);
    }
    setStatus("Idle");
    await loadAlerts();
    await loadLogs();
  } catch (err) {
    addActivity(err.message, "error");
    setStatus("Error");
  }
});

refreshBtn.addEventListener("click", async () => {
  await loadAlerts();
  await loadLogs();
});

if (presetEl) {
  presetEl.addEventListener("change", (event) => {
    applyPreset(event.target.value);
  });
}

clearLogsBtn.addEventListener("click", clearLogs);
clearAlertsBtn.addEventListener("click", clearAlerts);

if (presetEl) {
  applyPreset(presetEl.value);
} else {
  setVisibleFields(null);
}

loadAlerts();
loadLogs();
