const BASE_MONITOR = "/api/monitor";
const BASE_AGENT   = "/api/agent";

async function req(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export const monitorApi = {
  em:        () => req(`${BASE_MONITOR}/em`),
  logistics: () => req(`${BASE_MONITOR}/logistics`),
  companies: () => req(`${BASE_MONITOR}/companies`),
  logs:      () => req(`${BASE_MONITOR}/logs`),
};

export const agentApi = {
  run:    () => req(`${BASE_AGENT}/run`, { method: "POST" }),
  logs:   () => req(`${BASE_AGENT}/logs`),
  status: () => req(`${BASE_AGENT}/status`),
};

export const notifyApi = {
  completions: () => req("/api/notify/completions"),
};
