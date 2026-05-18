import React, { useEffect, useState, useMemo } from "react";
import {
  Truck, Package, ClipboardList, LayoutDashboard,
  Sparkles, Loader2, CheckCircle2, Clock, AlertCircle,
  Wrench, Send, MessageSquare, RefreshCw, Plus
} from "lucide-react";
import { vehiclesApi, dispatchRequestsApi, dispatchesApi, chatApi } from "./api";

const apiKey   = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const AI_MODEL = import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.5-flash";
const DEMO_MODE = !apiKey.trim();

// ── 상수 ────────────────────────────────────────────────────
const VEHICLE_TYPE_LABELS = { "1TON":"1톤", "5TON":"5톤", "11TON":"11톤", "25TON":"25톤" };
const VEHICLE_STATUS_LABELS  = { AVAILABLE:"가용", ON_DUTY:"운행 중", MAINTENANCE:"정비 중" };
const DISPATCH_STATUS_LABELS = { ASSIGNED:"배차 완료", IN_TRANSIT:"운송 중", DELIVERED:"배달 완료", CANCELLED:"취소" };
const REQUEST_STATUS_LABELS  = { PENDING:"대기", ASSIGNED:"배차됨", COMPLETED:"완료", CANCELLED:"취소" };
const REQUEST_TYPE_LABELS    = { PRODUCTION:"생산출고", IMPORT:"수입입고" };

const VEHICLE_STATUS_COLOR = {
  AVAILABLE:   "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  ON_DUTY:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  MAINTENANCE: "bg-red-500/20 text-red-300 border-red-500/30",
};
const DISPATCH_STATUS_COLOR = {
  ASSIGNED:  "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  IN_TRANSIT:"bg-blue-500/20 text-blue-300 border-blue-500/30",
  DELIVERED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  CANCELLED: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
};
const REQUEST_STATUS_COLOR = {
  PENDING:   "bg-orange-500/20 text-orange-300 border-orange-500/30",
  ASSIGNED:  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  COMPLETED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  CANCELLED: "bg-zinc-600/20 text-zinc-400 border-zinc-600/30",
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function callGeminiAPI(payload, retries = 3, delay = 800) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${apiKey}`;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      }
      if (res.status !== 429 && i === retries) throw new Error(`API ${res.status}`);
    } catch (e) {
      if (i === retries) throw e;
    }
    await sleep(delay * 2 ** i);
  }
}

// ── 공통 컴포넌트 ────────────────────────────────────────────
function Badge({ label, colorClass }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${colorClass}`}>
      {label}
    </span>
  );
}

function StatCard({ icon, label, value, sub, color = "text-white" }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-5">
      <div className="mb-3 flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-[11px] tracking-widest uppercase">{label}</span>
      </div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

// ── 메인 앱 ─────────────────────────────────────────────────
export default function App() {
  const [menu, setMenu]             = useState("dashboard");
  const [vehicles, setVehicles]     = useState([]);
  const [requests, setRequests]     = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [aiLoading, setAiLoading]   = useState(false);

  // chat
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput]     = useState("");
  const [chatSending, setChatSending] = useState(false);

  // 차량 등록 폼
  const [vehicleForm, setVehicleForm] = useState({ plateNumber:"", vehicleType:"5TON", capacityKg:5000, driverName:"", driverPhone:"", baseRegion:"" });
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);

  const loadAll = async () => {
    try {
      const [v, r, d] = await Promise.all([
        vehiclesApi.getAll(),
        dispatchRequestsApi.getAll(),
        dispatchesApi.getAll(),
      ]);
      setVehicles(v);
      setRequests(r);
      setDispatches(d);
    } catch {/* 서버 미실행 시 무시 */}
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  // ── 집계 ──────────────────────────────────────────────────
  const stats = useMemo(() => ({
    available:  vehicles.filter(v => v.status === "AVAILABLE").length,
    onDuty:     vehicles.filter(v => v.status === "ON_DUTY").length,
    maintenance:vehicles.filter(v => v.status === "MAINTENANCE").length,
    pending:    requests.filter(r => r.status === "PENDING").length,
    inTransit:  dispatches.filter(d => d.status === "IN_TRANSIT").length,
    delivered:  dispatches.filter(d => d.status === "DELIVERED").length,
  }), [vehicles, requests, dispatches]);

  // ── AI 자동 배차 ──────────────────────────────────────────
  const handleAutoDispatch = async (reqId) => {
    const req = requests.find(r => r.id === reqId);
    if (!req) return;

    const available = vehicles.filter(v => v.status === "AVAILABLE");
    if (!available.length) { alert("가용 차량이 없습니다."); return; }

    setAiLoading(true);
    try {
      let vehicleId = null;

      if (!DEMO_MODE) {
        const text = await callGeminiAPI({
          contents: [{
            parts: [{ text:
              `물류 배차 AI입니다. 아래 배차 요청에 가장 적합한 차량을 JSON으로만 반환하세요.
{ "vehicleId": 숫자, "reason": "선택 이유 한 문장" }

[배차 요청]
화물: ${req.cargoDesc} / 무게: ${req.weightKg?.toLocaleString()}kg / 수량: ${req.qty?.toLocaleString()}
출발: ${req.pickupLocation} → 도착: ${req.deliveryLocation}

[가용 차량]
${available.map(v => `id:${v.id} | ${v.plateNumber} | ${VEHICLE_TYPE_LABELS[v.vehicleType]} | 적재 ${v.capacityKg.toLocaleString()}kg | 기사: ${v.driverName} | 거점: ${v.baseRegion ?? "미지정"}`).join("\n")}

규칙: 화물 무게보다 적재 용량이 큰 차량 중, 픽업 출발지와 거점이 가까운 차량을 우선 선택.` }]
          }],
          generationConfig: { responseMimeType: "application/json" },
        });
        const parsed = JSON.parse(text);
        vehicleId = parsed?.vehicleId;
      }

      // DEMO_MODE 또는 AI 실패 시 → 무게 기준 자동 선택
      if (!vehicleId) {
        const suitable = available
          .filter(v => v.capacityKg >= (req.weightKg ?? 0))
          .sort((a, b) => a.capacityKg - b.capacityKg);
        vehicleId = (suitable[0] ?? available[0]).id;
      }

      const toMysql = d => d.toISOString().slice(0, 19).replace("T", " ");
      const today   = new Date();
      const pickup   = toMysql(new Date(today.getTime() + 2 * 3600000));
      const delivery = toMysql(new Date(today.getTime() + 8 * 3600000));

      await dispatchesApi.assign({ requestId: reqId, vehicleId, estimatedPickup: pickup, estimatedDelivery: delivery, note: "AI 자동 배차" });
      await loadAll();
    } catch (e) {
      alert(`배차 실패: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // ── 채팅 ─────────────────────────────────────────────────
  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatSending) return;
    setChatInput("");
    setChatSending(true);
    setChatHistory(h => [...h, { role: "user", text: msg }]);
    try {
      const { reply } = await chatApi.send(msg, stats, chatHistory);
      setChatHistory(h => [...h, { role: "assistant", text: reply }]);
    } catch {
      setChatHistory(h => [...h, { role: "assistant", text: "응답을 가져올 수 없습니다." }]);
    } finally { setChatSending(false); }
  };

  // ── 차량 등록 ─────────────────────────────────────────────
  const handleAddVehicle = async () => {
    if (!vehicleForm.plateNumber || !vehicleForm.driverName) return;
    await vehiclesApi.create(vehicleForm);
    setVehicleModalOpen(false);
    setVehicleForm({ plateNumber:"", vehicleType:"5TON", capacityKg:5000, driverName:"", driverPhone:"", baseRegion:"" });
    loadAll();
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center text-slate-400">
      <Loader2 className="mr-2 animate-spin" size={20} /> 로딩 중...
    </div>
  );

  // ── 렌더 ─────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f]">
      {/* 사이드바 */}
      <aside className="flex w-56 flex-col border-r border-slate-700/50 bg-slate-900/80 p-4">
        <div className="mb-8 mt-2">
          <div className="flex items-center gap-2">
            <Truck size={20} className="text-blue-400" />
            <span className="text-sm font-bold text-white">물류 AI Agent</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500">Logistics Management</div>
        </div>
        {[
          { key:"dashboard",  icon:<LayoutDashboard size={16}/>, label:"대시보드" },
          { key:"requests",   icon:<ClipboardList size={16}/>,   label:`배차 요청 ${stats.pending > 0 ? `(${stats.pending})` : ""}` },
          { key:"dispatches", icon:<Truck size={16}/>,           label:"배차 현황" },
          { key:"vehicles",   icon:<Package size={16}/>,         label:"차량 관리" },
          { key:"chat",       icon:<MessageSquare size={16}/>,   label:"AI 채팅" },
        ].map(({ key, icon, label }) => (
          <button key={key} onClick={() => setMenu(key)}
            className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12px] transition-colors ${
              menu === key ? "bg-blue-600/30 text-blue-300" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}>
            {icon}{label}
          </button>
        ))}
      </aside>

      {/* 콘텐츠 */}
      <main className="flex-1 overflow-y-auto p-6">

        {/* ── 대시보드 ── */}
        {menu === "dashboard" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-lg font-bold text-white">대시보드</h1>
              <button onClick={loadAll} className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[10px] text-slate-300 hover:bg-slate-700">
                <RefreshCw size={12}/> 새로고침
              </button>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard icon={<Truck size={16}/>}        label="가용 차량"   value={stats.available}   sub={`운행 중 ${stats.onDuty}대`}   color="text-emerald-400"/>
              <StatCard icon={<AlertCircle size={16}/>}  label="배차 대기"   value={stats.pending}     sub="처리 필요"                       color="text-orange-400"/>
              <StatCard icon={<Clock size={16}/>}        label="운송 중"     value={stats.inTransit}   sub="실시간 운송"                     color="text-blue-400"/>
              <StatCard icon={<CheckCircle2 size={16}/>}  label="배달 완료"   value={stats.delivered}   sub="누적"                           color="text-slate-300"/>
              <StatCard icon={<Wrench size={16}/>}       label="정비 중"     value={stats.maintenance} sub="차량"                           color="text-red-400"/>
              <StatCard icon={<Package size={16}/>}      label="총 차량"     value={vehicles.length}   sub={`${stats.available}대 가용`}    color="text-slate-200"/>
            </div>

            {/* 대기 중인 배차 요청 */}
            {stats.pending > 0 && (
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
                <div className="mb-4 flex items-center gap-2 text-orange-300">
                  <AlertCircle size={16}/><span className="text-sm font-semibold">배차 대기 요청 {stats.pending}건</span>
                </div>
                <div className="space-y-3">
                  {requests.filter(r => r.status === "PENDING").map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge label={REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType} colorClass={r.requestType === "IMPORT" ? "bg-violet-500/20 text-violet-300 border-violet-500/30" : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"} />
                          <span className="text-[12px] font-medium text-white">{r.cargoDesc}</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{r.pickupLocation} → {r.deliveryLocation} | {r.weightKg?.toLocaleString()}kg</div>
                        {r.note?.startsWith("[귀로 추천]") && (
                          <div className="mt-1.5 text-[10px] text-amber-400">⟳ {r.note}</div>
                        )}
                      </div>
                      <button onClick={() => handleAutoDispatch(r.id)} disabled={aiLoading}
                        className="flex items-center gap-1.5 rounded-xl border border-blue-400/20 bg-blue-600 px-4 py-2 text-[11px] text-white hover:bg-blue-500 disabled:opacity-50">
                        {aiLoading ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                        AI 배차
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 배차 요청 ── */}
        {menu === "requests" && (
          <div>
            <h1 className="mb-6 text-lg font-bold text-white">배차 요청</h1>
            <div className="space-y-3">
              {requests.map(r => (
                <div key={r.id} className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge label={REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType} colorClass={r.requestType === "IMPORT" ? "bg-violet-500/20 text-violet-300 border-violet-500/30" : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"} />
                        <Badge label={REQUEST_STATUS_LABELS[r.status] ?? r.status} colorClass={REQUEST_STATUS_COLOR[r.status] ?? ""} />
                        <span className="text-[12px] font-semibold text-white">{r.cargoDesc}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-400">
                        <span>출발 {r.pickupLocation}</span>
                        <span>도착 {r.deliveryLocation}</span>
                        {r.weightKg && <span>무게 {r.weightKg.toLocaleString()}kg</span>}
                        {r.qty      && <span>수량 {r.qty.toLocaleString()}</span>}
                        <span>요청 {r.requestedAt?.slice(0,16).replace("T"," ")}</span>
                      </div>
                      {r.note && r.note.startsWith("[귀로 추천]") && (
                        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] text-amber-300">
                          <span>⟳</span> {r.note}
                        </div>
                      )}
                    </div>
                    {r.status === "PENDING" && (
                      <button onClick={() => handleAutoDispatch(r.id)} disabled={aiLoading}
                        className="ml-4 flex items-center gap-1.5 rounded-xl border border-blue-400/20 bg-blue-600 px-3 py-2 text-[11px] text-white hover:bg-blue-500 disabled:opacity-50">
                        {aiLoading ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} AI 배차
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {requests.length === 0 && <div className="py-12 text-center text-[12px] text-slate-500">배차 요청이 없습니다.</div>}
            </div>
          </div>
        )}

        {/* ── 배차 현황 ── */}
        {menu === "dispatches" && (
          <div>
            <h1 className="mb-6 text-lg font-bold text-white">배차 현황</h1>
            <div className="space-y-3">
              {dispatches.map(d => {
                const req = requests.find(r => r.id === d.requestId);
                const veh = vehicles.find(v => v.id === d.vehicleId);
                return (
                  <div key={d.id} className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <Badge label={DISPATCH_STATUS_LABELS[d.status] ?? d.status} colorClass={DISPATCH_STATUS_COLOR[d.status] ?? ""} />
                          <span className="text-[12px] font-semibold text-white">{req?.cargoDesc ?? `요청 #${d.requestId}`}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-400">
                          <span>차량 {veh?.plateNumber ?? "-"} ({veh ? VEHICLE_TYPE_LABELS[veh.vehicleType] : "-"})</span>
                          <span>기사 {veh?.driverName ?? "-"}</span>
                          <span>배차 {d.assignedAt?.slice(0,16).replace("T"," ")}</span>
                          {d.estimatedDelivery && <span>도착예정 {d.estimatedDelivery.slice(0,16).replace("T"," ")}</span>}
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col gap-1">
                        {d.status === "ASSIGNED" && (
                          <button onClick={async () => { await dispatchesApi.setStatus(d.id, "IN_TRANSIT"); loadAll(); }}
                            className="rounded-lg border border-blue-500/30 bg-blue-600/20 px-3 py-1.5 text-[10px] text-blue-300 hover:bg-blue-600/40">
                            출발 처리
                          </button>
                        )}
                        {d.status === "IN_TRANSIT" && (
                          <button onClick={async () => { await dispatchesApi.setStatus(d.id, "DELIVERED"); loadAll(); }}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-600/20 px-3 py-1.5 text-[10px] text-emerald-300 hover:bg-emerald-600/40">
                            배달 완료
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {dispatches.length === 0 && <div className="py-12 text-center text-[12px] text-slate-500">배차 이력이 없습니다.</div>}
            </div>
          </div>
        )}

        {/* ── 차량 관리 ── */}
        {menu === "vehicles" && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-lg font-bold text-white">차량 관리</h1>
              <button onClick={() => setVehicleModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-600 px-4 py-2 text-[11px] text-white hover:bg-cyan-500">
                <Plus size={14}/> 차량 등록
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map(v => (
                <div key={v.id} className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-white">{v.plateNumber}</span>
                    <Badge label={VEHICLE_STATUS_LABELS[v.status] ?? v.status} colorClass={VEHICLE_STATUS_COLOR[v.status] ?? ""} />
                  </div>
                  <div className="space-y-1 text-[11px] text-slate-400">
                    <div>차종 {VEHICLE_TYPE_LABELS[v.vehicleType] ?? v.vehicleType} · 적재 {v.capacityKg.toLocaleString()}kg</div>
                    <div>기사 {v.driverName} {v.driverPhone && `(${v.driverPhone})`}</div>
                    {v.baseRegion && <div>거점 {v.baseRegion}</div>}
                  </div>
                  <div className="mt-3 flex gap-2">
                    {["AVAILABLE","ON_DUTY","MAINTENANCE"].filter(s => s !== v.status).map(s => (
                      <button key={s} onClick={async () => { await vehiclesApi.setStatus(v.id, s); loadAll(); }}
                        className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-600">
                        {VEHICLE_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {vehicleModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6">
                  <div className="mb-4 text-sm font-semibold text-white">차량 등록</div>
                  {[
                    { label:"차량번호", key:"plateNumber", type:"text",   placeholder:"서울 12가 3456" },
                    { label:"기사명",   key:"driverName",  type:"text",   placeholder:"홍길동" },
                    { label:"연락처",   key:"driverPhone", type:"text",   placeholder:"010-0000-0000" },
                    { label:"적재(kg)", key:"capacityKg",  type:"number", placeholder:"5000" },
                    { label:"거점지역", key:"baseRegion",  type:"text",   placeholder:"서울 / 경기 / 인천 / 부산" },
                  ].map(f => (
                    <div key={f.key} className="mb-3">
                      <label className="mb-1 block text-[10px] text-slate-500">{f.label}</label>
                      <input type={f.type} placeholder={f.placeholder} value={vehicleForm[f.key]}
                        onChange={e => setVehicleForm(p => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[12px] text-white outline-none"/>
                    </div>
                  ))}
                  <div className="mb-4">
                    <label className="mb-1 block text-[10px] text-slate-500">차종</label>
                    <select value={vehicleForm.vehicleType} onChange={e => setVehicleForm(p => ({ ...p, vehicleType: e.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[12px] text-white outline-none">
                      {Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setVehicleModalOpen(false)} className="rounded-xl border border-slate-700 px-4 py-2 text-[11px] text-slate-300 hover:bg-slate-800">취소</button>
                    <button onClick={handleAddVehicle} className="rounded-xl bg-cyan-600 px-4 py-2 text-[11px] text-white hover:bg-cyan-500">등록</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI 채팅 ── */}
        {menu === "chat" && (
          <div className="flex h-full flex-col">
            <h1 className="mb-4 text-lg font-bold text-white">AI 채팅</h1>
            <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-800/20 p-4 space-y-3 min-h-0" style={{maxHeight:"calc(100vh - 220px)"}}>
              {chatHistory.length === 0 && (
                <div className="py-8 text-center text-[12px] text-slate-500">
                  배차 현황, 차량 상태, 운송 일정 등을 물어보세요.
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[12px] ${m.role === "user" ? "bg-blue-600 text-white" : "bg-slate-700/80 text-slate-200"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatSending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-slate-700/80 px-4 py-2.5">
                    <Loader2 size={14} className="animate-spin text-slate-400"/>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="배차 관련 질문을 입력하세요..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-[12px] text-white outline-none placeholder:text-slate-500"/>
              <button onClick={sendChat} disabled={chatSending}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-500 disabled:opacity-50">
                <Send size={16}/>
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
