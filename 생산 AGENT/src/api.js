const BASE = "/api";

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

// ── Orders ────────────────────────────────────────────────
export const ordersApi = {
  getAll:  ()           => request("GET",    "/orders"),
  create:  (data)       => request("POST",   "/orders", data),
  update:  (id, data)   => request("PATCH",  `/orders/${id}`, data),
  remove:  (id)         => request("DELETE", `/orders/${id}`),
};

// ── Raw Stocks ────────────────────────────────────────────
export const rawStocksApi = {
  getAll:  ()     => request("GET",    "/raw-stocks"),
  create:  (data) => request("POST",   "/raw-stocks", data),
  remove:  (id)   => request("DELETE", `/raw-stocks/${id}`),
};

// ── 1차 공정 ──────────────────────────────────────────────
export const firstProcessApi = {
  getAll:     ()           => request("GET",   "/first-process"),
  start:      (data)       => request("POST",  "/first-process/start", data),
  done:       (id, data)   => request("PATCH", `/first-process/${id}/done`, data),
  defectStop: (id, data)   => request("PATCH", `/first-process/${id}/defect-stop`, data),
  addShort:   (id, data)   => request("POST",  `/first-process/${id}/short`, data),
};

// ── 2차 공정 ──────────────────────────────────────────────
export const secondProcessApi = {
  getAll:     ()           => request("GET",   "/second-process"),
  byMachine:  (machineId)  => request("GET",   `/second-process/machine/${machineId}`),
  start:      (data)       => request("POST",  "/second-process/start", data),
  done:       (id, data)   => request("PATCH", `/second-process/${id}/done`, data),
  defectStop: (id, data)   => request("PATCH", `/second-process/${id}/defect-stop`, data),
  addShort:   (id, data)   => request("POST",  `/second-process/${id}/short`, data),
};

// ── Event Logs ────────────────────────────────────────────
export const eventLogsApi = {
  getAll:      ()                    => request("GET", "/event-logs"),
  bySession:   (type, sessionId)     => request("GET", `/event-logs/session/${type}/${sessionId}`),
  byType:      (eventType)           => request("GET", `/event-logs/type/${eventType}`),
};

// ── B/L 수입 ─────────────────────────────────────────────
export const blImportsApi = {
  getAll: ()     => request("GET",  "/bl-imports"),
  create: (data) => request("POST", "/bl-imports", data),
};

// ── B/L 파싱 (서버 → OpenAI) ─────────────────────────────
export async function parseBLFile(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/bl-parse", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

// ── AI Chat ───────────────────────────────────────────────
export const chatApi = {
  send: (message, context, history) =>
    request("POST", "/chat", { message, context, history }),
};
