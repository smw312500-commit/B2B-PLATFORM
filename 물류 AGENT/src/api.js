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

export const vehiclesApi = {
  getAll:       ()           => request("GET",    "/vehicles"),
  create:       (data)       => request("POST",   "/vehicles", data),
  setStatus:    (id, status) => request("PATCH",  `/vehicles/${id}/status`, { status }),
  remove:       (id)         => request("DELETE", `/vehicles/${id}`),
};

export const dispatchRequestsApi = {
  getAll:     ()       => request("GET",   "/dispatch-requests"),
  create:     (data)   => request("POST",  "/dispatch-requests", data),
  setStatus:  (id, s)  => request("PATCH", `/dispatch-requests/${id}/status`, { status: s }),
};

export const dispatchesApi = {
  getAll:     ()       => request("GET",   "/dispatches"),
  assign:     (data)   => request("POST",  "/dispatches/assign", data),
  setStatus:  (id, s, note) => request("PATCH", `/dispatches/${id}/status`, { status: s, note }),
};

export const chatApi = {
  send: (message, context, history) =>
    request("POST", "/chat", { message, context, history }),
};
