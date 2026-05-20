import React, { useEffect, useState, useCallback } from "react";
import {
  Building2, Truck, RefreshCw, Loader2, Activity,
  ClipboardList, Users, Sparkles, CheckCircle2,
  AlertTriangle, Zap, ChevronDown, ChevronUp, ArrowRight,
} from "lucide-react";
import { monitorApi, agentApi, notifyApi } from "./api";

const ORDER_STATUS_KO  = { ORDERED:"발주", RECEIVED:"접수", IN_PROGRESS:"작업중", READY_TO_SHIP:"출고대기", DONE:"완료", CANCELLED:"취소" };
const VEHICLE_STATUS_KO= { AVAILABLE:"가용", ON_DUTY:"운행중", MAINTENANCE:"정비중" };
const REQUEST_TYPE_KO  = { PRODUCTION:"생산출고", IMPORT:"수입입고" };
const REQUEST_STATUS_KO= { PENDING:"대기", ASSIGNED:"배차됨", COMPLETED:"완료", CANCELLED:"취소" };
const MATERIAL_KO      = { CHIP:"칩", FABRIC:"원단", STICKER_PAPER:"스티커지" };
const MATERIAL_UNIT    = { CHIP:"개", FABRIC:"롤", STICKER_PAPER:"롤" };
const EVENT_KO = {
  MATERIAL_RECEIPT:"원자재 입고", WORK_START:"작업시작", WORK_DONE:"작업완료",
  SECOND_PROCESS_DONE:"2차공정완료", PROCESS_DEFECT:"공정불량", SHORT_RECORD:"불량기록",
  FIRST_TO_SECOND:"1차→2차투입", DISPATCH_ASSIGNED:"배차완료", STATUS_CHANGED:"상태변경",
  AGENT_START:"Agent시작", AGENT_DONE:"Agent완료", DISPATCH_AUTO_CREATED:"배차자동생성",
  PRIORITY_UPDATED:"우선순위조정", STOCKOUT_RISK:"재고부족경고", RETURN_TRIP_MATCHED:"귀로매칭",
};
const TOOL_LABEL = {
  create_logistics_dispatch: "배차 요청 생성",
  update_order_priority:     "우선순위 조정",
  flag_stockout_risk:        "재고 부족 경고",
  match_return_trip:         "귀로 매칭",
};
const COMPANY_TYPE_COLOR = {
  PRODUCTION: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  LOGISTICS:  "bg-violet-500/10 text-violet-400 border-violet-500/20",
  PLATFORM:   "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
};
const COMPANY_TYPE_KO = { PRODUCTION:"생산기업", LOGISTICS:"물류기업", PLATFORM:"플랫폼" };

function StatBadge({ label, value, color = "text-white" }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-slate-800/30 px-4 py-3">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
    </div>
  );
}

function SectionTitle({ icon, title, color = "text-slate-300" }) {
  return (
    <div className={`mb-4 flex items-center gap-2 ${color}`}>
      {icon}
      <span className="text-[13px] font-semibold tracking-wide">{title}</span>
    </div>
  );
}

export default function App() {
  const [em, setEm]                   = useState(null);
  const [logistics, setLog]           = useState(null);
  const [companies, setComp]          = useState([]);
  const [logs, setLogs]               = useState([]);
  const [completions, setCompletions] = useState([]);
  const [returnPlan, setReturnPlan]   = useState({ inbound: [], outbound: [] });
  const [loading, setLoading]         = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  // agent
  const [agentRunning, setAgentRunning]   = useState(false);
  const [agentResult, setAgentResult]     = useState(null);
  const [agentError, setAgentError]       = useState(null);
  const [actionsOpen, setActionsOpen]     = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [e, l, c, lg, cp, rp] = await Promise.all([
        monitorApi.em(), monitorApi.logistics(),
        monitorApi.companies(), monitorApi.logs(),
        notifyApi.completions(), notifyApi.returnPlan(),
      ]);
      setEm(e); setLog(l); setComp(c); setLogs(lg);
      setCompletions(cp); setReturnPlan(rp);
      setLastUpdated(new Date().toLocaleTimeString("ko-KR"));
    } catch { /* 서버 미실행 시 무시 */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const id = setInterval(loadAll, 30000);
    return () => clearInterval(id);
  }, [loadAll]);

  const runAgent = async () => {
    setAgentRunning(true);
    setAgentError(null);
    setAgentResult(null);
    try {
      const result = await agentApi.run();
      setAgentResult(result);
      setActionsOpen(true);
      await loadAll();
    } catch (e) {
      setAgentError(e.message);
    } finally {
      setAgentRunning(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center gap-2 text-slate-400">
      <Loader2 size={20} className="animate-spin" /> 연결 중...
    </div>
  );

  // EM 집계
  const emOrders    = em?.orders ?? [];
  const emStocks    = em?.stocks ?? [];
  const totalOrders = emOrders.reduce((s, r) => s + Number(r.cnt), 0);
  const totalQty    = emOrders.reduce((s, r) => s + Number(r.total || 0), 0);
  const activeOrders= emOrders.find(r => r.status === "IN_PROGRESS")?.cnt ?? 0;
  const readyOrders = emOrders.find(r => r.status === "READY_TO_SHIP")?.cnt ?? 0;

  // 물류 집계
  const logVehicles   = logistics?.vehicles ?? [];
  const logRequests   = logistics?.requests ?? [];
  const logDispatches = logistics?.dispatches ?? [];
  const availVehicles = logVehicles.find(r => r.status === "AVAILABLE")?.cnt ?? 0;
  const onDuty        = logVehicles.find(r => r.status === "ON_DUTY")?.cnt ?? 0;
  const pendingReq    = logRequests.filter(r => r.status === "PENDING").reduce((s, r) => s + Number(r.cnt), 0);
  const inTransit     = logDispatches.find(r => r.status === "IN_TRANSIT")?.cnt ?? 0;

  return (
    <div className="min-h-screen bg-[#050508] p-6">

      {/* ── 헤더 ── */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/30 border border-indigo-500/30">
            <Activity size={18} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">AgentCompany</h1>
            <p className="text-[10px] text-slate-500">Platform Monitoring Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-[10px] text-slate-600">최근 갱신 {lastUpdated}</span>}
          <button onClick={loadAll}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-[10px] text-slate-300 hover:bg-slate-700">
            <RefreshCw size={12} /> 새로고침
          </button>
        </div>
      </div>

      {/* ── 등록 기업 ── */}
      <div className="mb-6 flex gap-3">
        {companies.map(c => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl border border-slate-700/40 bg-slate-800/30 px-4 py-2">
            <div className={`h-2 w-2 rounded-full ${c.status === "ACTIVE" ? "bg-emerald-400" : "bg-slate-500"}`} />
            <span className="text-[12px] text-slate-300">{c.name}</span>
            <span className="text-[10px] text-slate-500">
              {c.type === "PRODUCTION" ? "생산기업" : c.type === "LOGISTICS" ? "물류기업" : "플랫폼"}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-700/40 px-4 py-2 text-[11px] text-slate-600">
          <Users size={12} /> 신규 기업 대기 중
        </div>
      </div>

      {/* ── Platform Agent 실행 패널 ── */}
      <div className="mb-6 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" />
            <span className="text-[13px] font-semibold text-indigo-300">Platform Agent</span>
            <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[9px] text-indigo-400">
              GPT-4o-mini
            </span>
          </div>
          <button
            onClick={runAgent}
            disabled={agentRunning}
            className="flex items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-4 py-2 text-[12px] font-medium text-indigo-300 hover:bg-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {agentRunning
              ? <><Loader2 size={13} className="animate-spin" /> 분석 중...</>
              : <><Zap size={13} /> Agent 실행</>}
          </button>
        </div>

        {/* 설명 (결과 없을 때) */}
        {!agentResult && !agentError && !agentRunning && (
          <p className="mt-3 text-[11px] text-slate-500">
            양쪽 현황을 분석해 배차 요청 생성 · 우선순위 조정 · 재고 경고 · 귀로 매칭을 자동 실행합니다.
          </p>
        )}

        {/* 로딩 중 */}
        {agentRunning && (
          <div className="mt-4 space-y-2">
            {["생산기업 수주 현황 분석 중...", "물류기업 차량·배차 현황 확인 중...", "최적 액션 결정 중..."].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-slate-500">
                <Loader2 size={10} className="animate-spin text-indigo-500" /> {t}
              </div>
            ))}
          </div>
        )}

        {/* 에러 */}
        {agentError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
            <AlertTriangle size={12} /> {agentError}
          </div>
        )}

        {/* 결과 */}
        {agentResult && (
          <div className="mt-4 space-y-3">
            {/* 요약 */}
            <div className="rounded-xl border border-indigo-500/20 bg-slate-900/60 p-3">
              <div className="mb-1 text-[10px] text-slate-500 tracking-widest">AGENT 요약</div>
              <p className="text-[12px] text-slate-200 leading-relaxed">{agentResult.summary}</p>
              <p className="mt-1 text-[10px] text-slate-600">{agentResult.executedAt}</p>
            </div>

            {/* 실행된 액션 */}
            {agentResult.actions?.length > 0 && (
              <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3">
                <button
                  onClick={() => setActionsOpen(v => !v)}
                  className="flex w-full items-center justify-between text-[11px] text-slate-400"
                >
                  <span className="tracking-widest">실행된 액션 ({agentResult.actions.length}건)</span>
                  {actionsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {actionsOpen && (
                  <div className="mt-2 space-y-1.5">
                    {agentResult.actions.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        {a.result?.ok
                          ? <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-400" />
                          : <AlertTriangle size={12} className="mt-0.5 shrink-0 text-yellow-400" />}
                        <div>
                          <span className="text-slate-300">{TOOL_LABEL[a.tool] ?? a.tool}</span>
                          <span className="ml-2 text-slate-500">{a.result?.message}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {agentResult.actions?.length === 0 && (
              <p className="text-[11px] text-slate-500">현재 시점에 실행할 액션이 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* ── 귀로 플랜 ── */}
      <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5">
        <div className="mb-4 flex items-center gap-2">
          <ArrowRight size={16} className="text-amber-400" />
          <span className="text-[13px] font-semibold text-amber-300">귀로 플랜</span>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-400">
            인바운드 {returnPlan.inbound.length}건 · 아웃바운드 {returnPlan.outbound.length}건
          </span>
        </div>

        {returnPlan.inbound.length === 0 && returnPlan.outbound.length === 0 ? (
          <p className="py-3 text-center text-[11px] text-slate-600">
            수입 배송 중인 차량이 없거나 출고 대기 수주가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">

            {/* 인바운드 */}
            <div>
              <div className="mb-2 text-[10px] text-slate-500 tracking-widest">
                수입 배송 현황 — 도착 후 귀로 연결
              </div>
              <div className="space-y-2">
                {returnPlan.inbound.length === 0 ? (
                  <p className="text-[11px] text-slate-600">없음</p>
                ) : returnPlan.inbound.map(d => (
                  <div key={d.dispatchId} className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${
                        d.dispatchStatus === "IN_TRANSIT"
                          ? "border-blue-500/30 text-blue-400"
                          : "border-slate-600/50 text-slate-400"
                      }`}>
                        {d.dispatchStatus === "IN_TRANSIT" ? "운송 중" : "물류 대기"}
                      </span>
                      <span className="text-[11px] font-medium text-white">{d.cargoDesc}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span>{d.pickupLocation}</span>
                      <ArrowRight size={9} />
                      <span className={d.dispatchStatus === "IN_TRANSIT" ? "text-amber-400" : "text-slate-500"}>
                        {d.dispatchStatus === "IN_TRANSIT" ? "공장 도착 예정" : "출발 대기 중"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-500">
                      {d.estimatedPickup && (
                        <span>픽업 {String(d.estimatedPickup).slice(5, 16).replace("T", " ")}</span>
                      )}
                      {d.estimatedDelivery && (
                        <><span className="text-slate-700">→</span>
                        <span>도착 {String(d.estimatedDelivery).slice(5, 16).replace("T", " ")}</span></>
                      )}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-600">
                      {d.plateNumber} · {d.driverName}
                      {d.weightKg && ` · ${Number(d.weightKg).toLocaleString()}kg`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 아웃바운드 */}
            <div>
              <div className="mb-2 text-[10px] text-slate-500 tracking-widest">
                출고 대기 — 귀로 배차 필요
              </div>
              <div className="space-y-2">
                {returnPlan.outbound.length === 0 ? (
                  <p className="text-[11px] text-slate-600">없음</p>
                ) : returnPlan.outbound.map(r => (
                  <div key={r.requestId} className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-400">
                        배차 대기
                      </span>
                      <span className="text-[11px] font-medium text-white">{r.cargoDesc}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <span>{r.pickupLocation}</span>
                      <ArrowRight size={9} />
                      <span>{r.deliveryLocation}</span>
                    </div>
                    {r.qty && (
                      <div className="mt-1 text-[10px] text-slate-600">
                        {r.productType === "CARE_LABEL" ? "케어라벨" : r.productType} · {Number(r.qty).toLocaleString()}개
                      </div>
                    )}
                    {r.note?.startsWith("[귀로 추천]") && (
                      <div className="mt-1 text-[10px] text-amber-400">⟳ {r.note}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ── 메인 모니터링 — 좌우 분할 ── */}
      <div className="mb-6 grid grid-cols-2 gap-6">

        {/* EM 생산기업 */}
        <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-5">
          <SectionTitle icon={<Building2 size={16} />} title="EM — 생산기업" color="text-cyan-400" />

          <div className="mb-4 grid grid-cols-2 gap-2">
            <StatBadge label="전체 수주" value={`${totalOrders}건`} />
            <StatBadge label="총 발주량" value={`${totalQty.toLocaleString()}장`} />
            <StatBadge label="작업중" value={`${activeOrders}건`} color="text-yellow-400" />
            <StatBadge label="출고대기" value={`${readyOrders}건`} color="text-emerald-400" />
          </div>

          <div className="mb-4">
            <div className="mb-2 text-[10px] text-slate-500 tracking-widest">수주 현황</div>
            <div className="space-y-1">
              {emOrders.map(r => (
                <div key={r.status} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{ORDER_STATUS_KO[r.status] ?? r.status}</span>
                  <span className="font-mono text-slate-200">{Number(r.cnt)}건 / {Number(r.total||0).toLocaleString()}장</span>
                </div>
              ))}
              {emOrders.length === 0 && <div className="text-[11px] text-slate-600">수주 데이터 없음</div>}
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-2 text-[10px] text-slate-500 tracking-widest">원자재 재고</div>
            <div className="space-y-1">
              {emStocks.map(r => (
                <div key={r.material_type} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{MATERIAL_KO[r.material_type] ?? r.material_type}</span>
                  <span className="font-mono text-slate-200">
                    {Number(r.total).toLocaleString()}{MATERIAL_UNIT[r.material_type] ?? ""}
                  </span>
                </div>
              ))}
              {emStocks.length === 0 && <div className="text-[11px] text-slate-600">입고 데이터 없음</div>}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] text-slate-500 tracking-widest">최근 이벤트</div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {(em?.recentEvents ?? []).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="text-slate-600">{String(e.timestamp).slice(5, 16)}</span>
                  <span className="text-slate-400">{EVENT_KO[e.event_type] ?? e.event_type}</span>
                  {e.qty && <span className="text-slate-500">{Number(e.qty).toLocaleString()}</span>}
                </div>
              ))}
              {(em?.recentEvents ?? []).length === 0 && <div className="text-[11px] text-slate-600">이벤트 없음</div>}
            </div>
          </div>
        </div>

        {/* 물류기업 */}
        <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-5">
          <SectionTitle icon={<Truck size={16} />} title="물류기업" color="text-violet-400" />

          <div className="mb-4 grid grid-cols-2 gap-2">
            <StatBadge label="가용 차량" value={`${availVehicles}대`} color="text-emerald-400" />
            <StatBadge label="운행 중" value={`${onDuty}대`} color="text-blue-400" />
            <StatBadge label="배차 대기" value={`${pendingReq}건`} color="text-orange-400" />
            <StatBadge label="운송 중" value={`${inTransit}건`} color="text-blue-400" />
          </div>

          <div className="mb-4">
            <div className="mb-2 text-[10px] text-slate-500 tracking-widest">차량 현황</div>
            <div className="space-y-1">
              {logVehicles.map(r => (
                <div key={r.status} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">{VEHICLE_STATUS_KO[r.status] ?? r.status}</span>
                  <span className="font-mono text-slate-200">{Number(r.cnt)}대</span>
                </div>
              ))}
              {logVehicles.length === 0 && <div className="text-[11px] text-slate-600">차량 데이터 없음</div>}
            </div>
          </div>

          <div className="mb-4">
            <div className="mb-2 text-[10px] text-slate-500 tracking-widest">배차 요청</div>
            <div className="space-y-1">
              {logRequests.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    {REQUEST_TYPE_KO[r.request_type] ?? r.request_type} · {REQUEST_STATUS_KO[r.status] ?? r.status}
                  </span>
                  <span className="font-mono text-slate-200">{Number(r.cnt)}건</span>
                </div>
              ))}
              {logRequests.length === 0 && <div className="text-[11px] text-slate-600">배차 요청 없음</div>}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[10px] text-slate-500 tracking-widest">최근 이벤트</div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {(logistics?.recentEvents ?? []).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="text-slate-600">{String(e.timestamp).slice(5, 16)}</span>
                  <span className="text-slate-400">{EVENT_KO[e.event_type] ?? e.event_type}</span>
                  {e.note && <span className="truncate max-w-32 text-slate-600">{e.note}</span>}
                </div>
              ))}
              {(logistics?.recentEvents ?? []).length === 0 && <div className="text-[11px] text-slate-600">이벤트 없음</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── 플랫폼 통합 로그 ── */}
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/40 p-5">
        <SectionTitle icon={<ClipboardList size={16} />} title="플랫폼 통합 로그" />
        {logs.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-slate-600">
            Agent를 실행하면 여기에 액션 로그가 기록됩니다.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((l, i) => (
              <div key={i} className="flex items-start gap-3 text-[11px]">
                <span className="shrink-0 text-slate-600">{String(l.logged_at).slice(0, 16)}</span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${COMPANY_TYPE_COLOR[l.company_type] ?? COMPANY_TYPE_COLOR.PLATFORM}`}>
                  {COMPANY_TYPE_KO[l.company_type] ?? l.company_type}
                </span>
                <span className="shrink-0 text-slate-500">{EVENT_KO[l.event_type] ?? l.event_type}</span>
                {l.message && <span className="text-slate-400 truncate">{l.message}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
