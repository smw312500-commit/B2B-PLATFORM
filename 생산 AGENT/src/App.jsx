import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Cpu,
  Database,
  Download,
  History,
  Lightbulb,
  ListOrdered,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Upload,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import {
  FIRST_PROCESS_TYPE_OPTIONS,
  PRODUCTION_CONFIG,
  getRawMaterialUsageForWorkItem,
} from "./lib/productionLogic";
import { ordersApi, firstProcessApi, secondProcessApi, rawStocksApi, chatApi, blImportsApi, parseBLFile } from "./api";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const AI_MODEL =
  import.meta.env.VITE_GEMINI_MODEL ?? "gemini-2.5-flash";
const DEMO_MODE = !apiKey.trim();

const CUSTOMER_OPTIONS = ["EASTWOO", "MIDO", "PRI", "JMI", "BONCOP"];
const PRODUCT_TYPE_OPTIONS = ["CARE_LABEL", "STICKER_LABEL"];
const PRIORITY_OPTIONS = [1, 2, 3, 4, 5];
const ORDER_JOB_TYPE_OPTIONS = ["GENERAL", "SHORT"];
const CHAT_QUICK_QUESTIONS = [
  "오늘 컷팅 물량 얼마야?",
  "선택한 수주 기준으로 1차공정 부족해?",
  "긴급 발주 몇 건이야?",
  "현재 설비 상태 알려줘",
];
const ORDER_STATUS_OPTIONS = [
  "ORDERED",
  "RECEIVED",
  "IN_PROGRESS",
  "READY_TO_SHIP",
  "DONE",
  "CANCELLED",
];
const ACTIVE_PRODUCTION_ORDER_STATUSES = new Set([
  ORDER_STATUS_OPTIONS[1],
  ORDER_STATUS_OPTIONS[2],
]);
const CUTTING_READY_ORDER_STATUSES = new Set([
  ORDER_STATUS_OPTIONS[3],
  ORDER_STATUS_OPTIONS[4],
]);
const FIRST_PROCESS_CONSUMPTION_ORDER_STATUSES = new Set([
  ORDER_STATUS_OPTIONS[4],
]);
const STOCK_PLANNING_ORDER_STATUSES = new Set([
  ORDER_STATUS_OPTIONS[0],
  ORDER_STATUS_OPTIONS[1],
  ORDER_STATUS_OPTIONS[2],
]);
const MACHINE_STATUS_OPTIONS = ["AVAILABLE", "WORKING", "BLOCKED"];
const MENU_LABELS = {
  production: "생산",
  orders: "수주",
  inventory: "재고",
  customers: "거래처",
};
const PRODUCT_TYPE_LABELS = {
  CARE_LABEL: "케어라벨",
  STICKER_LABEL: "스티커라벨",
};
const ORDER_STATUS_LABELS = {
  ORDERED: "발주",
  RECEIVED: "접수",
  IN_PROGRESS: "작업중",
  READY_TO_SHIP: "출고대기",
  DONE: "완료",
  CANCELLED: "취소",
};
const MACHINE_STATUS_LABELS = {
  AVAILABLE: "가동 가능",
  WORKING: "가동 중",
  BLOCKED: "정비 필요",
};
const RAW_STOCK_LABELS = {
  CHIP: "칩",
  FABRIC: "원단",
  STICKER_PAPER: "스티커지",
};
const RAW_STOCK_KEY_BY_LABEL = {
  [RAW_STOCK_LABELS.CHIP]: "CHIP",
  [RAW_STOCK_LABELS.FABRIC]: "FABRIC",
  [RAW_STOCK_LABELS.STICKER_PAPER]: "STICKER_PAPER",
};
const CUTTING_LABELS = {
  Y: "예",
  N: "아니오",
};
const ORDER_JOB_TYPE_LABELS = {
  GENERAL: "일반",
  SHORT: "쇼트",
};
const DIAGNOSIS_STATUS_LABELS = {
  OK: "정상",
  RISK: "위험",
  NORMAL: "정상",
  SAFE: "안전",
  CHECK: "확인 필요",
};
const STATUS_CONFIG = {
  [ORDER_STATUS_OPTIONS[0]]: "bg-zinc-800/60 text-zinc-300 border-zinc-600",
  [ORDER_STATUS_OPTIONS[1]]: "bg-zinc-700/60 text-zinc-200 border-zinc-500",
  [ORDER_STATUS_OPTIONS[2]]: "bg-zinc-600/60 text-white border-zinc-400",
  [ORDER_STATUS_OPTIONS[3]]: "bg-zinc-500/40 text-zinc-100 border-zinc-300",
  [ORDER_STATUS_OPTIONS[4]]: "bg-white/15 text-white border-white/50",
  [ORDER_STATUS_OPTIONS[5]]: "bg-zinc-950/60 text-zinc-500 border-zinc-700",
};

const DATA_RESET_VERSION = "20260515-1";
const DATA_RESET_KEY = "mes-pro-data-reset-version";

if (typeof window !== "undefined") {
  const backupStorageItem = (key, versionLabel) => {
    const current = window.localStorage.getItem(key);
    if (current === null) return;

    const backupKey = `${key}-backup-${versionLabel}`;
    if (window.localStorage.getItem(backupKey) === null) {
      window.localStorage.setItem(backupKey, current);
    }
  };

  const storedResetVersion = window.localStorage.getItem(DATA_RESET_KEY);
  if (storedResetVersion !== DATA_RESET_VERSION) {
    const backupVersion = storedResetVersion ?? "pre-reset";
    [
      "mes-pro-orders",
      "mes-pro-work-inventory",
      "mes-pro-incoming-raw-stocks",
      "mes-pro-received-raw-stocks",
      "mes-pro-base-raw-stocks",
      "mes-pro-machine-assignments",
      "mes-pro-active-sessions",
    ].forEach((key) => backupStorageItem(key, backupVersion));

    window.localStorage.removeItem("mes-pro-orders");
    window.localStorage.removeItem("mes-pro-work-inventory");
    window.localStorage.removeItem("mes-pro-incoming-raw-stocks");
    window.localStorage.removeItem("mes-pro-received-raw-stocks");
    window.localStorage.removeItem("mes-pro-base-raw-stocks");
    window.localStorage.removeItem("mes-pro-machine-assignments");
    window.localStorage.removeItem("mes-pro-active-sessions");
    window.localStorage.setItem(DATA_RESET_KEY, DATA_RESET_VERSION);
  }
}

const STORAGE_KEYS = {
  activeMenu: "mes-pro-active-menu",
  selectedOrderId: "mes-pro-selected-order-id",
  orders: "mes-pro-orders",
  workInventory: "mes-pro-work-inventory",
  incomingRawStocks: "mes-pro-incoming-raw-stocks",
  receivedRawStocks: "mes-pro-received-raw-stocks",
  baseRawStocks: "mes-pro-base-raw-stocks",
  machines2: "mes-pro-machines2",
  inventoryMachines: "mes-pro-inventory-machines",
  machineAssignments: "mes-pro-machine-assignments",
  activeSessions: "mes-pro-active-sessions",
};
const DEFAULT_ORDERS = [];
const DEFAULT_WORK_INVENTORY = [];
const DEFAULT_BASE_RAW_STOCKS = {
  CHIP: 0,
  FABRIC: 0,
  STICKER_PAPER: 0,
};
const DEFAULT_PRODUCTION_MACHINES = [
  { id: 1, name: "2공정 M/C 01", status: MACHINE_STATUS_OPTIONS[0] },
  { id: 2, name: "2공정 M/C 02", status: MACHINE_STATUS_OPTIONS[1] },
  { id: 3, name: "2공정 M/C 03", status: MACHINE_STATUS_OPTIONS[0] },
  { id: 4, name: "2공정 M/C 04", status: MACHINE_STATUS_OPTIONS[0] },
  { id: 5, name: "2공정 M/C 05", status: MACHINE_STATUS_OPTIONS[2] },
  { id: 6, name: "2공정 M/C 06", status: MACHINE_STATUS_OPTIONS[0] },
];
const DEFAULT_INVENTORY_MACHINES = [
  { id: 1, name: "창고 M/C 01", status: MACHINE_STATUS_OPTIONS[0] },
  { id: 2, name: "창고 M/C 02", status: MACHINE_STATUS_OPTIONS[1] },
];
const SECOND_PROCESS_CONFIG_KEY_BY_PRODUCT_TYPE = {
  [PRODUCT_TYPE_OPTIONS[0]]: "care_label",
  [PRODUCT_TYPE_OPTIONS[1]]: "sticker_label",
};

const RAW_STOCK_TYPES = ["CHIP", "FABRIC", "STICKER_PAPER"];
const formatDateKey = (date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
const formatDateInput = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
const formatDateTime = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
const formatOrderNumber = (date) =>
  `${formatDateKey(date)}${String(date.getHours()).padStart(2, "0")}${String(
    date.getMinutes(),
  ).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;
const formatOrderCreatedAt = (date) => formatDateTime(date).replace(" ", "T");
const sleep = (ms) =>
  new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
const safeStr = (value) =>
  value === null || value === undefined || typeof value === "object"
    ? "-"
    : String(value);
const normalizePriorityValue = (value) => {
  if (value === null || value === undefined || value === "" || value === "-") {
    return null;
  }

  const parsedValue = Math.round(Number(value));
  return Number.isFinite(parsedValue) && parsedValue >= 1 && parsedValue <= 5
    ? parsedValue
    : null;
};
const getMachineStatusClass = (status) =>
  status === MACHINE_STATUS_OPTIONS[0]
    ? "bg-white/25 text-white border-white/30"
    : status === MACHINE_STATUS_OPTIONS[1]
      ? "bg-zinc-400/30 text-zinc-200 border-zinc-400/30"
      : "bg-zinc-800 text-zinc-400 border-zinc-700/30";
const getMenuLabel = (menu) => MENU_LABELS[menu] ?? menu;
const getProductTypeLabel = (productType) =>
  PRODUCT_TYPE_LABELS[productType] ?? productType;
const getOrderStatusLabel = (status) => ORDER_STATUS_LABELS[status] ?? status;
const getMachineStatusLabel = (status) =>
  MACHINE_STATUS_LABELS[status] ?? status;
const getRawStockLabel = (type) => RAW_STOCK_LABELS[type] ?? type;
const getCuttingLabel = (value) => CUTTING_LABELS[value] ?? value;
const getDiagnosisStatusLabel = (value) =>
  DIAGNOSIS_STATUS_LABELS[value] ?? safeStr(value);
const getPriorityLabel = (value) => {
  const normalizedValue = normalizePriorityValue(value);
  return normalizedValue === null ? "-" : String(normalizedValue);
};
const getOrderJobTypeLabel = (value) =>
  ORDER_JOB_TYPE_LABELS[value] ?? safeStr(value);
const getCuttingValue = (productType, cutting) =>
  productType === PRODUCT_TYPE_OPTIONS[1] ? "N" : cutting;
const getRawStockUnitLabel = (type) =>
  (type === RAW_STOCK_TYPES[0] ? "개" : "롤");

function downloadCsv(filename, headers, rows) {
  const BOM = "\uFEFF"; // UTF-8 BOM — Excel이 한글 깨짐 없이 인식
  const escape = (cell) => {
    const s = cell == null ? "" : String(cell);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const createRawStockSummary = () => ({
  [RAW_STOCK_TYPES[1]]: 0,
  [RAW_STOCK_TYPES[0]]: 0,
  [RAW_STOCK_TYPES[2]]: 0,
});
const createProductTypeSummary = () => ({
  [PRODUCT_TYPE_OPTIONS[0]]: 0,
  [PRODUCT_TYPE_OPTIONS[1]]: 0,
});
const createProductTypePlanSummary = () => ({
  [PRODUCT_TYPE_OPTIONS[0]]: {
    rolls: 0,
    qty: 0,
    hours: 0,
    dueTodayOrPastRolls: 0,
    distributedRolls: 0,
  },
  [PRODUCT_TYPE_OPTIONS[1]]: {
    rolls: 0,
    qty: 0,
    hours: 0,
    dueTodayOrPastRolls: 0,
    distributedRolls: 0,
  },
});
const isActiveProductionOrderStatus = (status) =>
  ACTIVE_PRODUCTION_ORDER_STATUSES.has(status);
const isCuttingReadyOrderStatus = (status) =>
  CUTTING_READY_ORDER_STATUSES.has(status);
const isFirstProcessConsumedOrderStatus = (status) =>
  FIRST_PROCESS_CONSUMPTION_ORDER_STATUSES.has(status);
const isStockPlanningOrderStatus = (status) =>
  STOCK_PLANNING_ORDER_STATUSES.has(status);
const getProcessKeyForProductType = (productType) =>
  productType === PRODUCT_TYPE_OPTIONS[0]
    ? "converting"
    : "sticker_converting";
const getWorkTypeLabelForProductType = (productType) =>
  productType === PRODUCT_TYPE_OPTIONS[0]
    ? FIRST_PROCESS_TYPE_OPTIONS[0]
    : FIRST_PROCESS_TYPE_OPTIONS[1];
const getUnitsPerFirstProcessRoll = (productType) => {
  const processKey = getProcessKeyForProductType(productType);
  const outputKey =
    processKey === "converting"
      ? "converting_roll"
      : "sticker_converting_roll";

  return (
    PRODUCTION_CONFIG.material_capacity_per_roll?.[outputKey] ??
    (productType === PRODUCT_TYPE_OPTIONS[0] ? 2300 : 8000)
  );
};
const getFirstProcessRollsPerHour = (productType) => {
  const processKey = getProcessKeyForProductType(productType);

  return (
    PRODUCTION_CONFIG.process_rates?.first_process?.[processKey]?.rolls_per_hour ??
    (productType === PRODUCT_TYPE_OPTIONS[0] ? 3 : 2)
  );
};
const getSecondProcessUnitsPerHour = (productType) => {
  const processKey = SECOND_PROCESS_CONFIG_KEY_BY_PRODUCT_TYPE[productType];

  return (
    PRODUCTION_CONFIG.process_rates?.second_process?.[processKey]
      ?.units_per_hour_per_machine ??
    (productType === PRODUCT_TYPE_OPTIONS[0] ? 2300 : 8000)
  );
};
const getSecondProcessHoursForQty = (productType, qty) => {
  const unitsPerHour = getSecondProcessUnitsPerHour(productType);
  const normalizedQty = Math.max(0, Math.floor(normalizeNonNegativeNumber(qty, 0)));

  return unitsPerHour > 0 ? normalizedQty / unitsPerHour : 0;
};
const getCuttingUnitsPerHour = () =>
  Number(PRODUCTION_CONFIG.process_rates?.cutting?.units_per_hour) || 4600;
const getCuttingHoursForQty = (qty) => {
  const unitsPerHour = getCuttingUnitsPerHour();
  const normalizedQty = Math.max(0, Math.floor(normalizeNonNegativeNumber(qty, 0)));

  return unitsPerHour > 0 ? normalizedQty / unitsPerHour : 0;
};
const getWorkingHoursPerDay = () =>
  Number(PRODUCTION_CONFIG.working_schedule?.working_hours_per_day) || 7.5;
const WORKING_DAY_NAMES = new Set(
  (PRODUCTION_CONFIG.working_schedule?.working_days ?? [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]).map((day) => String(day).toLowerCase()),
);
const DAY_NAMES_BY_INDEX = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const isConfiguredWorkingDay = (date) =>
  WORKING_DAY_NAMES.has(DAY_NAMES_BY_INDEX[date.getDay()]);
const startOfDay = (date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};
const endOfDay = (date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};
const countWorkingDaysInclusive = (startDate, endDateValue) => {
  const current = startOfDay(startDate);
  const target = startOfDay(endDateValue);

  if (target.getTime() < current.getTime()) {
    return 0;
  }

  let count = 0;
  while (current.getTime() <= target.getTime()) {
    if (isConfiguredWorkingDay(current)) {
      count += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};
function parseCompactDateTime(value) {
  if (!/^\d{14}$/.test(value)) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hours = Number(value.slice(8, 10));
  const minutes = Number(value.slice(10, 12));
  const seconds = Number(value.slice(12, 14));
  const parsed = new Date(year, month - 1, day, hours, minutes, seconds);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateInputValue(value, hours = 9, minutes = 0, seconds = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const parsed = new Date(year, month - 1, day, hours, minutes, seconds);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveOrderCreatedAt(order, index = 0) {
  if (typeof order.createdAt === "string" && order.createdAt.trim()) {
    const parsed = new Date(order.createdAt);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const existingOrderNumber =
    typeof order.orderNumber === "string" ? order.orderNumber.trim() : "";
  const parsedOrderNumber = parseCompactDateTime(existingOrderNumber);
  if (parsedOrderNumber) {
    return parsedOrderNumber;
  }

  const legacyId = typeof order.id === "string" ? order.id.trim() : "";
  const parsedLegacyId = parseCompactDateTime(legacyId);
  if (parsedLegacyId) {
    return parsedLegacyId;
  }

  if (/^\d{8}/.test(legacyId)) {
    const parsedLegacyDate = parseDateInputValue(
      `${legacyId.slice(0, 4)}-${legacyId.slice(4, 6)}-${legacyId.slice(6, 8)}`,
      9,
      0,
      Math.min(index, 59),
    );
    if (parsedLegacyDate) {
      return parsedLegacyDate;
    }
  }

  const parsedDueDate = parseDateInputValue(order.dueDate, 9, 0, Math.min(index, 59));
  if (parsedDueDate) {
    return parsedDueDate;
  }

  const fallback = new Date();
  fallback.setSeconds(fallback.getSeconds() + index);
  return fallback;
}

function normalizeOrder(order, index = 0) {
  const source = order && typeof order === "object" ? order : {};
  const createdAtDate = resolveOrderCreatedAt(source, index);
  const orderNumber =
    typeof source.orderNumber === "string" && source.orderNumber.trim()
      ? source.orderNumber
      : formatOrderNumber(createdAtDate);
  const fallbackDueDate = formatDateInput(createdAtDate);

  return {
    ...source,
    customerName:
      typeof source.customerName === "string" && source.customerName.trim()
        ? source.customerName
        : CUSTOMER_OPTIONS[0],
    productType: PRODUCT_TYPE_OPTIONS.includes(source.productType)
      ? source.productType
      : PRODUCT_TYPE_OPTIONS[0],
    quantity: normalizeNonNegativeNumber(source.quantity, 0),
    status: ORDER_STATUS_OPTIONS.includes(source.status)
      ? source.status
      : ORDER_STATUS_OPTIONS[0],
    priority: normalizePriorityValue(source.priority),
    jobType: ORDER_JOB_TYPE_OPTIONS.includes(source.jobType)
      ? source.jobType
      : ORDER_JOB_TYPE_OPTIONS[0],
    cutting: source.cutting === "Y" || source.cutting === "N" ? source.cutting : "N",
    dueDate:
      typeof source.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.dueDate)
        ? source.dueDate
        : fallbackDueDate,
    id:
      typeof source.id === "string" && source.id.trim()
        ? source.id
        : orderNumber,
    orderNumber,
    createdAt: formatOrderCreatedAt(createdAtDate),
    completedAt: typeof source.completedAt === "string" && source.completedAt.trim()
      ? source.completedAt
      : null,
  };
}

function normalizeOrders(orders = []) {
  if (!Array.isArray(orders)) {
    return [];
  }

  return orders
    .filter((order) => order && typeof order === "object")
    .map((order, index) => normalizeOrder(order, index));
}

function normalizeMachineState(machines = [], defaults = []) {
  if (!Array.isArray(machines) || machines.length === 0) {
    return defaults;
  }

  const defaultMap = new Map(defaults.map((machine) => [machine.id, machine]));

  return machines.map((machine) => {
    const fallback = defaultMap.get(machine.id);

    return {
      ...machine,
      name: fallback?.name ?? machine.name,
      status: MACHINE_STATUS_OPTIONS.includes(machine.status)
        ? machine.status
        : fallback?.status ?? MACHINE_STATUS_OPTIONS[0],
    };
  });
}

function normalizeNonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, parsed);
}

function formatHoursText(value) {
  return `${normalizeNonNegativeNumber(value, 0).toFixed(1)}시간`;
}

function normalizeMachineAssignmentItems(machineId, items = [], orderMap = new Map()) {
  if (!Array.isArray(items)) {
    return [];
  }

  const merged = new Map();

  items.forEach((item) => {
    const orderId =
      typeof item?.orderId === "string" && orderMap.has(item.orderId)
        ? item.orderId
        : "";
    const qty = Math.max(0, Math.floor(normalizeNonNegativeNumber(item?.qty, 0)));

    if (!orderId || qty <= 0) {
      return;
    }

    merged.set(orderId, (merged.get(orderId) ?? 0) + qty);
  });

  return [...merged.entries()].map(([orderId, qty]) => ({
    id: `${machineId}-${orderId}`,
    orderId,
    qty,
  }));
}

function normalizeMachineAssignments(assignments = {}, machines = [], orders = []) {
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) {
    return {};
  }

  const validMachineIds = new Set(
    machines
      .filter((machine) => machine?.status !== MACHINE_STATUS_OPTIONS[2])
      .map((machine) => String(machine.id)),
  );
  const orderMap = new Map(orders.map((order) => [order.id, order]));

  return Object.entries(assignments).reduce((result, [machineId, items]) => {
    const normalizedMachineId = String(machineId);
    if (!validMachineIds.has(normalizedMachineId)) {
      return result;
    }

    const normalizedItems = normalizeMachineAssignmentItems(
      normalizedMachineId,
      items,
      orderMap,
    );

    if (normalizedItems.length > 0) {
      result[normalizedMachineId] = normalizedItems;
    }

    return result;
  }, {});
}

function sanitizeMachineAssignments(assignments = {}, machines = [], orders = []) {
  if (!assignments || typeof assignments !== "object" || Array.isArray(assignments)) {
    return {};
  }

  const machineMap = new Map(
    machines
      .filter((machine) => machine?.status !== MACHINE_STATUS_OPTIONS[2])
      .map((machine) => [String(machine.id), machine]),
  );
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const orderNumberMap = new Map(
    orders.map((order) => [getOrderDisplayNumber(order), order]),
  );
  const remainingQtyByOrder = new Map(
    orders.map((order) => [
      order.id,
      Math.max(0, Math.floor(normalizeNonNegativeNumber(order.quantity, 0))),
    ]),
  );
  const remainingHoursByMachine = new Map(
    [...machineMap.keys()].map((machineId) => [machineId, getWorkingHoursPerDay()]),
  );
  const sanitized = {};

  const resolveOrder = (item) => {
    const orderId =
      typeof item?.orderId === "string" ? item.orderId.trim() : "";
    if (orderMap.has(orderId)) {
      return orderMap.get(orderId);
    }

    const orderNumber =
      typeof item?.orderNumber === "string" ? item.orderNumber.trim() : "";
    return orderNumberMap.get(orderNumber) ?? null;
  };

  Object.entries(assignments).forEach(([rawMachineId, items]) => {
    const machineId = String(rawMachineId).trim();
    if (!machineMap.has(machineId) || !Array.isArray(items)) {
      return;
    }

    items.forEach((item) => {
      const order = resolveOrder(item);
      if (!order) {
        return;
      }

      const requestedQty = Math.max(
        0,
        Math.floor(normalizeNonNegativeNumber(item?.qty, 0)),
      );
      if (requestedQty <= 0) {
        return;
      }

      const remainingOrderQty = remainingQtyByOrder.get(order.id) ?? 0;
      const remainingMachineHours = remainingHoursByMachine.get(machineId) ?? 0;
      const unitsPerHour = getSecondProcessUnitsPerHour(order.productType);
      const maxQtyByMachine =
        unitsPerHour > 0
          ? Math.max(0, Math.floor(remainingMachineHours * unitsPerHour))
          : 0;
      const allowedQty = Math.min(
        requestedQty,
        remainingOrderQty,
        maxQtyByMachine,
      );

      if (allowedQty <= 0) {
        return;
      }

      if (!sanitized[machineId]) {
        sanitized[machineId] = [];
      }

      sanitized[machineId].push({
        id: `${machineId}-${order.id}`,
        orderId: order.id,
        qty: allowedQty,
      });

      remainingQtyByOrder.set(order.id, remainingOrderQty - allowedQty);
      remainingHoursByMachine.set(
        machineId,
        Math.max(
          0,
          remainingMachineHours -
            getSecondProcessHoursForQty(order.productType, allowedQty),
        ),
      );
    });
  });

  return normalizeMachineAssignments(sanitized, machines, orders);
}

function buildFallbackMachineAssignments(orders = [], machines = []) {
  const availableMachines = machines.filter(
    (machine) => machine.status === MACHINE_STATUS_OPTIONS[0],
  );
  const remainingHoursByMachine = new Map(
    availableMachines.map((machine) => [String(machine.id), getWorkingHoursPerDay()]),
  );
  const assignments = {};

  orders.forEach((order) => {
    let remainingQty = Math.max(
      0,
      Math.floor(normalizeNonNegativeNumber(order.quantity, 0)),
    );
    const unitsPerHour = getSecondProcessUnitsPerHour(order.productType);

    while (remainingQty > 0) {
      const nextMachine = [...remainingHoursByMachine.entries()]
        .sort((a, b) => b[1] - a[1])
        .find(([, remainingHours]) => remainingHours > 0);

      if (!nextMachine || unitsPerHour <= 0) {
        break;
      }

      const [machineId, remainingHours] = nextMachine;
      const allocatableQty = Math.min(
        remainingQty,
        Math.max(0, Math.floor(remainingHours * unitsPerHour)),
      );

      if (allocatableQty <= 0) {
        remainingHoursByMachine.set(machineId, 0);
        continue;
      }

      if (!assignments[machineId]) {
        assignments[machineId] = [];
      }

      assignments[machineId].push({
        orderId: order.id,
        qty: allocatableQty,
      });
      remainingQty -= allocatableQty;
      remainingHoursByMachine.set(
        machineId,
        Math.max(
          0,
          remainingHours -
            getSecondProcessHoursForQty(order.productType, allocatableQty),
        ),
      );
    }
  });

  return sanitizeMachineAssignments(assignments, machines, orders);
}

function buildMachineAllocationSummaryText(assignments = {}, orders = [], machines = []) {
  const availableMachineCount = machines.filter(
    (machine) => machine.status === MACHINE_STATUS_OPTIONS[0],
  ).length;

  if (availableMachineCount <= 0) {
    return "가동 가능 설비가 없어 AI 배분을 진행하지 못했습니다.";
  }

  if (orders.length <= 0) {
    return "배분 가능한 작업중 발주가 없어 설비 배분을 비워 두었습니다.";
  }

  const assignedMachineCount = Object.values(assignments).filter(
    (items) => items.length > 0,
  ).length;
  const allocatedQty = Object.values(assignments)
    .flat()
    .reduce((sum, item) => sum + item.qty, 0);
  const allocatedByOrderId = Object.values(assignments)
    .flat()
    .reduce((result, item) => {
      result[item.orderId] = (result[item.orderId] ?? 0) + item.qty;
      return result;
    }, {});
  const partiallyUnassignedCount = orders.filter((order) => {
    const orderQty = Math.max(
      0,
      Math.floor(normalizeNonNegativeNumber(order.quantity, 0)),
    );
    return (allocatedByOrderId[order.id] ?? 0) < orderQty;
  }).length;

  return partiallyUnassignedCount > 0
    ? `가동 가능 설비 ${availableMachineCount}대 중 ${assignedMachineCount}대에 총 ${allocatedQty.toLocaleString()}개를 배분했습니다. 일부 발주 ${partiallyUnassignedCount}건은 설비 시간 부족으로 잔여 수량이 남아 있습니다.`
    : `가동 가능 설비 ${availableMachineCount}대 중 ${assignedMachineCount}대에 총 ${allocatedQty.toLocaleString()}개를 배분했습니다.`;
}

function normalizeBaseRawStocks(stocks = {}) {
  return RAW_STOCK_TYPES.reduce((result, type) => {
    result[type] = normalizeNonNegativeNumber(
      stocks?.[type],
      DEFAULT_BASE_RAW_STOCKS[type] ?? 0,
    );
    return result;
  }, {});
}

function normalizeWorkInventory(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  return items
    .map((item, index) => {
      const qty = normalizeNonNegativeNumber(item?.qty, 0);
      const type = FIRST_PROCESS_TYPE_OPTIONS.includes(item?.type)
        ? item.type
        : FIRST_PROCESS_TYPE_OPTIONS[0];

      if (qty <= 0) {
        return null;
      }

      return {
        id: item?.id ?? `work-${index}`,
        dateTime:
          typeof item?.dateTime === "string" && item.dateTime.trim()
            ? item.dateTime
            : formatDateTime(new Date()),
        type,
        qty,
      };
    })
    .filter(Boolean);
}

function normalizeIncomingRawStocks(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => {
      const qty = normalizeNonNegativeNumber(item?.qty, 0);
      const type = RAW_STOCK_TYPES.includes(item?.type) ? item.type : RAW_STOCK_TYPES[0];
      const expectedDate =
        typeof item?.expectedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.expectedDate)
          ? item.expectedDate
          : formatDateInput(new Date());

      if (qty <= 0) {
        return null;
      }

      return {
        id: item?.id ?? `incoming-${index}`,
        type,
        qty,
        expectedDate,
      };
    })
    .filter(Boolean);
}

function normalizeReceivedRawStocks(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => {
      const qty = normalizeNonNegativeNumber(item?.qty, 0);
      const type = RAW_STOCK_TYPES.includes(item?.type) ? item.type : RAW_STOCK_TYPES[0];
      const receivedDate =
        typeof item?.receivedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.receivedDate)
          ? item.receivedDate
          : formatDateInput(new Date());

      if (qty <= 0) {
        return null;
      }

      return {
        id: item?.id ?? `received-${index}`,
        sourceIncomingId: item?.sourceIncomingId ?? null,
        type,
        qty,
        expectedDate:
          typeof item?.expectedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.expectedDate)
            ? item.expectedDate
            : receivedDate,
        receivedDate,
        dateTime:
          typeof item?.dateTime === "string" && item.dateTime.trim()
            ? item.dateTime
            : `${receivedDate} 09:00:00`,
      };
    })
    .filter(Boolean);
}

function summarizeRawStockItemsByType(items = []) {
  return items.reduce((summary, item) => {
    if (!RAW_STOCK_TYPES.includes(item?.type)) {
      return summary;
    }

    summary[item.type] += normalizeNonNegativeNumber(item.qty, 0);
    return summary;
  }, createRawStockSummary());
}

function reconcileBaseRawStocksWithReceiptHistory(baseRawStocks, receivedRawStocks) {
  const receivedSummary = summarizeRawStockItemsByType(receivedRawStocks);

  return RAW_STOCK_TYPES.reduce((result, type) => {
    const defaultQty = DEFAULT_BASE_RAW_STOCKS[type] ?? 0;
    const currentQty = normalizeNonNegativeNumber(baseRawStocks?.[type], defaultQty);
    const receivedQty = receivedSummary[type] ?? 0;

    result[type] =
      currentQty === defaultQty && receivedQty > 0
        ? currentQty + receivedQty
        : currentQty;

    return result;
  }, {});
}

function getOrderDisplayNumber(order) {
  return order?.orderNumber ?? order?.id ?? "-";
}

function getOrderCreatedDateKey(order) {
  if (typeof order?.createdAt === "string" && order.createdAt.length >= 10) {
    return order.createdAt.slice(0, 10);
  }

  return formatDateInput(resolveOrderCreatedAt(order));
}

function getOrderDueDate(order, index = 0) {
  return (
    parseDateInputValue(order?.dueDate, 23, 59, Math.min(index, 59)) ??
    resolveOrderCreatedAt(order, index)
  );
}

function compareOrdersForPlanning(a, b) {
  const dueDiff = getOrderDueDate(a).getTime() - getOrderDueDate(b).getTime();
  if (dueDiff !== 0) {
    return dueDiff;
  }

  const priorityDiff = (a?.priority ?? 99) - (b?.priority ?? 99);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return resolveOrderCreatedAt(a).getTime() - resolveOrderCreatedAt(b).getTime();
}

function buildFirstProcessCoverageSummary(orders, initialStockByProductType) {
  const remainingFirstProcessStockByProductType = {
    ...createProductTypeSummary(),
    ...initialStockByProductType,
  };
  const byOrderId = {};
  const shortageRollsByProductType = createProductTypeSummary();
  const shortageQtyByProductType = createProductTypeSummary();
  let totalShortageHours = 0;

  orders.forEach((order) => {
    const demandQty = normalizeNonNegativeNumber(order.quantity, 0);
    const availableStockQty = Math.max(
      0,
      remainingFirstProcessStockByProductType[order.productType] ?? 0,
    );
    const coveredQty = Math.min(demandQty, availableStockQty);
    const shortageQty = Math.max(0, demandQty - coveredQty);
    const unitsPerRoll = getUnitsPerFirstProcessRoll(order.productType);
    const rollsPerHour = getFirstProcessRollsPerHour(order.productType);
    const shortageRolls =
      unitsPerRoll > 0 ? Math.ceil(shortageQty / unitsPerRoll) : 0;
    const shortageHours =
      rollsPerHour > 0 ? shortageRolls / rollsPerHour : 0;

    remainingFirstProcessStockByProductType[order.productType] =
      availableStockQty - coveredQty;
    totalShortageHours += shortageHours;
    shortageRollsByProductType[order.productType] += shortageRolls;
    shortageQtyByProductType[order.productType] += shortageQty;
    byOrderId[order.id] = {
      demandQty,
      coveredQty,
      shortageQty,
      shortageRolls,
      shortageHours,
    };
  });

  return {
    byOrderId,
    totalShortageHours,
    shortageRollsByProductType,
    shortageQtyByProductType,
    remainingFirstProcessStockByProductType,
  };
}

function buildTodayFirstProcessPlan(orders, coverageByOrderId) {
  const today = new Date();
  const todayEnd = endOfDay(today);
  const byOrderId = {};
  const byProductType = createProductTypePlanSummary();
  let totalRolls = 0;
  let totalHours = 0;

  orders.forEach((order, index) => {
    const coverage = coverageByOrderId[order.id];
    if (!coverage || coverage.shortageRolls <= 0) {
      byOrderId[order.id] = {
        dueTodayOrPast: false,
        workingDaysUntilDue: 0,
        todayRequiredRolls: 0,
        todayRequiredQty: 0,
        todayRequiredHours: 0,
      };
      return;
    }

    const dueDate = getOrderDueDate(order, index);
    const dueTodayOrPast = dueDate.getTime() <= todayEnd.getTime();
    const workingDaysUntilDue = dueTodayOrPast
      ? 0
      : countWorkingDaysInclusive(today, dueDate);
    const todayRequiredRolls = dueTodayOrPast
      ? coverage.shortageRolls
      : Math.ceil(coverage.shortageRolls / Math.max(workingDaysUntilDue, 1));
    const todayRequiredQty =
      todayRequiredRolls * getUnitsPerFirstProcessRoll(order.productType);
    const rollsPerHour = getFirstProcessRollsPerHour(order.productType);
    const todayRequiredHours =
      rollsPerHour > 0 ? todayRequiredRolls / rollsPerHour : 0;

    byOrderId[order.id] = {
      dueTodayOrPast,
      workingDaysUntilDue,
      todayRequiredRolls,
      todayRequiredQty,
      todayRequiredHours,
    };
    byProductType[order.productType].rolls += todayRequiredRolls;
    byProductType[order.productType].qty += todayRequiredQty;
    byProductType[order.productType].hours += todayRequiredHours;
    if (dueTodayOrPast) {
      byProductType[order.productType].dueTodayOrPastRolls += todayRequiredRolls;
    } else {
      byProductType[order.productType].distributedRolls += todayRequiredRolls;
    }
    totalRolls += todayRequiredRolls;
    totalHours += todayRequiredHours;
  });

  return {
    byOrderId,
    byProductType,
    totalRolls,
    totalHours,
  };
}

function buildRawMaterialNeedFromRollSummary(rollSummaryByProductType) {
  const result = createRawStockSummary();

  PRODUCT_TYPE_OPTIONS.forEach((productType) => {
    const rollQty = normalizeNonNegativeNumber(
      rollSummaryByProductType?.[productType],
      0,
    );
    if (rollQty <= 0) {
      return;
    }

    const workTypeLabel = getWorkTypeLabelForProductType(productType);
    const usage = getRawMaterialUsageForWorkItem(workTypeLabel, rollQty);
    RAW_STOCK_TYPES.forEach((stockType) => {
      const materialLabel = RAW_STOCK_LABELS[stockType];
      result[stockType] += normalizeNonNegativeNumber(usage?.[materialLabel], 0);
    });
  });

  return result;
}

function evaluateRawStockFeasibility(currentStocks, requiredStocks) {
  const shortages = RAW_STOCK_TYPES.reduce((list, stockType) => {
    const requiredQty = normalizeNonNegativeNumber(requiredStocks?.[stockType], 0);
    const availableQty = normalizeNonNegativeNumber(currentStocks?.[stockType], 0);

    if (requiredQty > availableQty) {
      list.push({
        type: stockType,
        requiredQty,
        availableQty,
        shortageQty: requiredQty - availableQty,
      });
    }

    return list;
  }, []);

  return {
    isEnough: shortages.length === 0,
    shortages,
  };
}

function buildReceivedRawStockEntry(item, receivedAt = new Date()) {
  const receivedDate = formatDateInput(receivedAt);

  return {
    id: `received-${item.id}`,
    sourceIncomingId: item.id,
    type: item.type,
    qty: item.qty,
    expectedDate: item.expectedDate,
    receivedDate,
    dateTime: formatDateTime(receivedAt),
  };
}

function applyRawStockReceipts(baseStocks, receiptItems) {
  const nextStocks = { ...baseStocks };

  receiptItems.forEach((item) => {
    nextStocks[item.type] = (nextStocks[item.type] ?? 0) + item.qty;
  });

  return nextStocks;
}

function normalizeIncomingRawStockState({
  baseRawStocks,
  incomingRawStocks,
  receivedRawStocks,
}) {
  const normalizedBaseRawStocks = normalizeBaseRawStocks(baseRawStocks);
  const normalizedIncomingRawStocks = normalizeIncomingRawStocks(incomingRawStocks);
  const normalizedReceivedRawStocks = normalizeReceivedRawStocks(receivedRawStocks);
  const reconciledBaseRawStocks = reconcileBaseRawStocksWithReceiptHistory(
    normalizedBaseRawStocks,
    normalizedReceivedRawStocks,
  );

  return {
    baseRawStocks: reconciledBaseRawStocks,
    incomingRawStocks: normalizedIncomingRawStocks,
    receivedRawStocks: normalizedReceivedRawStocks,
  };
}

function loadPersistedState(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function savePersistedState(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function createChatMessage(role, text) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
  };
}

async function callGeminiAPI(payload, retries = 5, delay = 1000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${apiKey}`;

  for (let i = 0; i <= retries; i += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
      }

      if (response.status !== 429 && i === retries) {
        let errorMessage = `API Error: ${response.status}`;

        try {
          const errorBody = await response.json();
          errorMessage =
            errorBody?.error?.message ||
            errorBody?.message ||
            errorMessage;
        } catch {
          // Ignore JSON parse failures and keep the fallback message.
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      if (i === retries) {
        throw error;
      }
    }

    await sleep(delay * 2 ** i);
  }

  return null;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-5 transition-all ${
        active
          ? "scale-105 bg-blue-700 text-white shadow-2xl"
          : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
      }`}
    >
      <div className={active ? "text-white" : "text-slate-600"}>{icon}</div>
      <span className="hidden md:block">{label}</span>
    </button>
  );
}

// type: "production" | "firstProcess" | "rawStocks"
function ExportModal({ type, orders, workInventory, incomingRawStocks, onClose }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const config = React.useMemo(() => {
    const inRange = (key) => {
      if (startDate && key < startDate) return false;
      if (endDate && key > endDate) return false;
      return true;
    };

    if (type === "production") {
      const filtered = orders.filter((o) => {
        if (o.status !== "DONE") return false;
        // 완료 처리 시각 기준 필터 (없으면 등록일로 fallback)
        const key = typeof o.completedAt === "string" && o.completedAt.trim()
          ? o.completedAt.slice(0, 10)
          : (o.createdAt ?? "").slice(0, 10);
        return inRange(key);
      });
      return {
        title: "생산 완료내역",
        subtitle: "완료 처리된 발주를 완료일 기준으로 추출합니다.",
        filename: "생산_완료내역",
        headers: ["오더번호", "거래처", "제품종류", "수량", "납기일", "완료일시", "작업구분", "컷팅"],
        rows: filtered.map((o) => [
          o.orderNumber,
          o.customerName,
          getProductTypeLabel(o.productType),
          o.quantity,
          o.dueDate,
          o.completedAt ?? "—",
          getOrderJobTypeLabel(o.jobType),
          getCuttingLabel(o.cutting),
        ]),
      };
    }

    if (type === "firstProcess") {
      const filtered = workInventory.filter((w) => {
        const key = typeof w.dateTime === "string" ? w.dateTime.slice(0, 10) : "";
        return inRange(key);
      });
      return {
        title: "1차공정 작업내역",
        subtitle: "1차 공정 등록 항목을 추출합니다.",
        filename: "1차공정_작업내역",
        headers: ["등록일시", "제품종류", "수량(롤)"],
        rows: filtered.map((w) => [w.dateTime, w.type, w.qty]),
      };
    }

    // rawStocks
    const filtered = incomingRawStocks.filter((r) => {
      const key = r.expectedDate ?? "";
      return inRange(key);
    });
    return {
      title: "원자재 입고내역",
      subtitle: "등록된 원자재 입고 일정을 추출합니다.",
      filename: "원자재_입고내역",
      headers: ["원자재종류", "수량", "단위", "입고예정일"],
      rows: filtered.map((r) => [
        getRawStockLabel(r.type),
        r.qty,
        getRawStockUnitLabel(r.type),
        r.expectedDate,
      ]),
    };
  }, [type, startDate, endDate, orders, workInventory, incomingRawStocks]);

  const handleDownload = () => {
    const suffix =
      startDate && endDate ? `_${startDate}_${endDate}` :
      startDate ? `_${startDate}~` :
      endDate ? `~${endDate}` : "";
    downloadCsv(`${config.filename}${suffix}.csv`, config.headers, config.rows);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-zinc-900 shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-700 p-5">
          <div>
            <div className="flex items-center gap-2 text-sm text-white">
              <Download size={15} className="text-slate-400" />
              {config.title}
            </div>
            <div className="mt-1 text-[10px] text-slate-400">{config.subtitle}</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] text-slate-300 transition-colors hover:bg-slate-800"
          >
            닫기
          </button>
        </div>

        {/* 날짜 필터 */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-900/40 px-5 py-4">
          <span className="text-[9px] tracking-widest text-slate-500">날짜 범위</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 outline-none"
          />
          <span className="text-[9px] text-slate-500">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 outline-none"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(""); setEndDate(""); }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-[9px] text-slate-400 transition-colors hover:bg-slate-700"
            >
              초기화
            </button>
          )}
          <span className="ml-auto text-[9px] text-slate-400">
            총 <span className="font-semibold text-white">{config.rows.length}</span>건
          </span>
        </div>

        {/* 미리보기 테이블 */}
        <div className="max-h-72 overflow-auto">
          {config.rows.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-[10px] text-slate-500">
              해당 기간의 내역이 없습니다.
            </div>
          ) : (
            <table className="w-full min-w-max border-collapse text-[9px]">
              <thead className="sticky top-0 bg-slate-800">
                <tr>
                  {config.headers.map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.rows.map((row, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-slate-900/30" : "bg-transparent"}
                  >
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 text-slate-300">
                        {cell == null ? "—" : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 border-t border-slate-700 p-5">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-[10px] text-slate-300 transition-colors hover:bg-slate-800"
          >
            취소
          </button>
          <button
            onClick={handleDownload}
            disabled={config.rows.length === 0}
            className="flex items-center gap-2 rounded-xl border border-zinc-600/40 bg-zinc-700 px-4 py-2 text-[10px] text-white transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            <Download size={13} />
            CSV 다운로드 ({config.rows.length}건)
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children, accent = "" }) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-700 bg-zinc-900 shadow-2xl ${accent}`}
    >
      <div className="border-b border-slate-700 bg-slate-800/30 p-4">
        <h2 className="text-[10px] tracking-widest text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function App() {
  const [activeMenu, setActiveMenu] = useState(() => {
    const persistedMenu = loadPersistedState(STORAGE_KEYS.activeMenu, "production");
    return Object.hasOwn(MENU_LABELS, persistedMenu) ? persistedMenu : "production";
  });
  const [selectedOrderId, setSelectedOrderId] = useState(() =>
    loadPersistedState(STORAGE_KEYS.selectedOrderId, null),
  );
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isInvDiagnosing, setIsInvDiagnosing] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isBLModalOpen, setIsBLModalOpen] = useState(false);
  const [isBLParsing, setIsBLParsing] = useState(false);
  const [blParseResult, setBlParseResult] = useState(null); // { blNumber, eta, items: [{type,qty}] }
  const [isIncomingRawStockModalOpen, setIsIncomingRawStockModalOpen] =
    useState(false);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  // null | "production" | "firstProcess" | "rawStocks"
  const [exportModal, setExportModal] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);
  const [invDiagnosis, setInvDiagnosis] = useState(null);
  const [chatMessages, setChatMessages] = useState(() => [
    {
      id: "chatbot-welcome",
      role: "assistant",
      text:
        "MES PRO AI 채팅입니다. 현재 화면 데이터를 읽어서 재고, 수주, 납기, 컷팅, 설비 상태를 설명해드릴게요. 배분 실행이나 등록, 수정 같은 작업은 하지 않습니다.",
    },
  ]);
  const initialRawStockState = useMemo(
    () =>
      normalizeIncomingRawStockState({
        incomingRawStocks: loadPersistedState(
          STORAGE_KEYS.incomingRawStocks,
          [],
        ),
        receivedRawStocks: loadPersistedState(
          STORAGE_KEYS.receivedRawStocks,
          [],
        ),
        baseRawStocks: loadPersistedState(
          STORAGE_KEYS.baseRawStocks,
          DEFAULT_BASE_RAW_STOCKS,
        ),
      }),
    [],
  );

  const [orders, setOrders] = useState([]);

  // 기계별 활성 세션 { [machineId]: { id, startedAt, targetQty, orderId, processType, unitsPerHour } }
  const [machineActiveSessions, setMachineActiveSessions] = useState(() =>
    loadPersistedState(STORAGE_KEYS.activeSessions, {}),
  );
  const [progressTick, setProgressTick] = useState(0); // 진행률 갱신용 틱

  const [orderForm, setOrderForm] = useState({
    customerName: CUSTOMER_OPTIONS[0],
    productType: PRODUCT_TYPE_OPTIONS[0],
    quantity: 1000,
  });

  // "active" | "done" | "all"
  const [orderStatusFilter, setOrderStatusFilter] = useState("active");

  const [productionDateFilter, setProductionDateFilter] = useState({
    startDate: "",
    endDate: "",
  });

  const [workInventory, setWorkInventory] = useState(() =>
    normalizeWorkInventory(
      loadPersistedState(STORAGE_KEYS.workInventory, DEFAULT_WORK_INVENTORY),
    ),
  );

  const [inventoryForm, setInventoryForm] = useState({
    type: FIRST_PROCESS_TYPE_OPTIONS[0],
    qty: 1,
  });

  const [incomingRawStockForm, setIncomingRawStockForm] = useState({
    type: RAW_STOCK_TYPES[0],
    qty: 100,
    expectedDate: formatDateInput(new Date()),
  });

  const [incomingRawStocks, setIncomingRawStocks] = useState(() =>
    initialRawStockState.incomingRawStocks,
  );

  const [receivedRawStocks, setReceivedRawStocks] = useState(() =>
    initialRawStockState.receivedRawStocks,
  );
  const [receivedUndoInfo, setReceivedUndoInfo] = useState(null);
  const receivedUndoTimeoutRef = useRef(null);
  const productionDiagnosisRequestRef = useRef(0);
  const machineAllocationRequestRef = useRef(0);
  const [lastProductionDiagnosisAt, setLastProductionDiagnosisAt] = useState(null);
  const [lastMachineAllocationAt, setLastMachineAllocationAt] = useState(null);
  const [machineAllocationSummary, setMachineAllocationSummary] = useState("");
  const [isMachineAllocating, setIsMachineAllocating] = useState(false);

  const [baseRawStocks, setBaseRawStocks] = useState(() =>
    initialRawStockState.baseRawStocks,
  );

  const [machines2, setMachines2] = useState(() =>
    normalizeMachineState(
      loadPersistedState(STORAGE_KEYS.machines2, DEFAULT_PRODUCTION_MACHINES),
      DEFAULT_PRODUCTION_MACHINES,
    ),
  );

  const [inventoryMachines, setInventoryMachines] = useState(() =>
    normalizeMachineState(
      loadPersistedState(
        STORAGE_KEYS.inventoryMachines,
        DEFAULT_INVENTORY_MACHINES,
      ),
      DEFAULT_INVENTORY_MACHINES,
    ),
  );
  const [machineAssignments, setMachineAssignments] = useState(() =>
    sanitizeMachineAssignments(
      loadPersistedState(STORAGE_KEYS.machineAssignments, {}),
      DEFAULT_PRODUCTION_MACHINES,
      DEFAULT_ORDERS,
    ),
  );

  const availableMachines2 = useMemo(
    () =>
      machines2.filter((machine) => machine.status === MACHINE_STATUS_OPTIONS[0])
        .length,
    [machines2],
  );
  const availableProductionMachines = useMemo(
    () =>
      machines2.filter((machine) => machine.status === MACHINE_STATUS_OPTIONS[0]),
    [machines2],
  );

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => (a.priority || 99) - (b.priority || 99)),
    [orders],
  );
  const planningSortedOrders = useMemo(
    () => [...orders].sort(compareOrdersForPlanning),
    [orders],
  );

  const filteredProductionOrders = useMemo(
    () =>
      sortedOrders.filter((order) => {
        // 상태 필터
        if (orderStatusFilter === "active" && !isActiveProductionOrderStatus(order.status)) return false;
        if (orderStatusFilter === "done" && !["DONE", "READY_TO_SHIP", "CANCELLED"].includes(order.status)) return false;

        const productionDateKey =
          typeof order.dueDate === "string" && order.dueDate.trim()
            ? order.dueDate
            : getOrderCreatedDateKey(order);

        if (productionDateFilter.startDate && productionDateKey < productionDateFilter.startDate) return false;
        if (productionDateFilter.endDate   && productionDateKey > productionDateFilter.endDate)   return false;

        return true;
      }),
    [orderStatusFilter, productionDateFilter.endDate, productionDateFilter.startDate, sortedOrders],
  );

  const workInventorySummary = useMemo(
    () =>
      workInventory.reduce(
        (summary, item) => {
          const normalizedQty = Math.floor(normalizeNonNegativeNumber(item.qty, 0));

          summary.totalRolls += normalizedQty;
          summary.byType[item.type] = (summary.byType[item.type] ?? 0) + normalizedQty;
          return summary;
        },
        {
          totalRolls: 0,
          byType: FIRST_PROCESS_TYPE_OPTIONS.reduce((result, type) => {
            result[type] = 0;
            return result;
          }, {}),
        },
      ),
    [workInventory],
  );
  const firstProcessRegisteredRollsByProductType = useMemo(
    () =>
      PRODUCT_TYPE_OPTIONS.reduce((summary, productType) => {
        const workTypeLabel = getWorkTypeLabelForProductType(productType);
        summary[productType] = Math.floor(
          normalizeNonNegativeNumber(workInventorySummary.byType[workTypeLabel], 0),
        );
        return summary;
      }, createProductTypeSummary()),
    [workInventorySummary],
  );
  const secondProcessConsumedRollsByProductType = useMemo(
    () =>
      orders.reduce((summary, order) => {
        if (!isFirstProcessConsumedOrderStatus(order.status)) {
          return summary;
        }

        const unitsPerRoll = getUnitsPerFirstProcessRoll(order.productType);
        const completedQty = Math.floor(normalizeNonNegativeNumber(order.quantity, 0));
        summary[order.productType] +=
          unitsPerRoll > 0 ? Math.ceil(completedQty / unitsPerRoll) : 0;
        return summary;
      }, createProductTypeSummary()),
    [orders],
  );
  const firstProcessAvailableRollsByProductType = useMemo(
    () =>
      PRODUCT_TYPE_OPTIONS.reduce((summary, productType) => {
        summary[productType] = Math.max(
          0,
          Math.floor(
            normalizeNonNegativeNumber(
              firstProcessRegisteredRollsByProductType[productType],
              0,
            ),
          ) -
            Math.floor(
              normalizeNonNegativeNumber(
                secondProcessConsumedRollsByProductType[productType],
                0,
              ),
            ),
        );
        return summary;
      }, createProductTypeSummary()),
    [
      firstProcessRegisteredRollsByProductType,
      secondProcessConsumedRollsByProductType,
    ],
  );
  const firstProcessStockByProductType = useMemo(
    () =>
      PRODUCT_TYPE_OPTIONS.reduce((summary, productType) => {
        summary[productType] =
          Math.floor(
            normalizeNonNegativeNumber(
              firstProcessAvailableRollsByProductType[productType],
              0,
            ),
          ) * getUnitsPerFirstProcessRoll(productType);
        return summary;
      }, createProductTypeSummary()),
    [firstProcessAvailableRollsByProductType],
  );
  const totalFirstProcessAvailableRolls = useMemo(
    () =>
      PRODUCT_TYPE_OPTIONS.reduce(
        (sum, productType) =>
          sum +
          Math.floor(
            normalizeNonNegativeNumber(
              firstProcessAvailableRollsByProductType[productType],
              0,
            ),
          ),
        0,
      ),
    [firstProcessAvailableRollsByProductType],
  );
  const totalFirstProcessAvailableQty = useMemo(
    () =>
      PRODUCT_TYPE_OPTIONS.reduce(
        (sum, productType) =>
          sum +
          Math.floor(normalizeNonNegativeNumber(firstProcessStockByProductType[productType], 0)),
        0,
      ),
    [firstProcessStockByProductType],
  );
  const totalSecondProcessConsumedRolls = useMemo(
    () =>
      PRODUCT_TYPE_OPTIONS.reduce(
        (sum, productType) =>
          sum +
          Math.floor(
            normalizeNonNegativeNumber(
              secondProcessConsumedRollsByProductType[productType],
              0,
            ),
          ),
        0,
      ),
    [secondProcessConsumedRollsByProductType],
  );

  const activeProductionOrders = useMemo(
    () =>
      planningSortedOrders.filter((order) =>
        isActiveProductionOrderStatus(order.status),
      ),
    [planningSortedOrders],
  );

  const stockPlanningOrders = useMemo(
    () =>
      planningSortedOrders.filter((order) =>
        isStockPlanningOrderStatus(order.status),
      ),
    [planningSortedOrders],
  );

  const productionCoverageSummary = useMemo(
    () =>
      buildFirstProcessCoverageSummary(
        activeProductionOrders,
        firstProcessStockByProductType,
      ),
    [activeProductionOrders, firstProcessStockByProductType],
  );

  const stockPlanningCoverageSummary = useMemo(
    () =>
      buildFirstProcessCoverageSummary(
        stockPlanningOrders,
        firstProcessStockByProductType,
      ),
    [firstProcessStockByProductType, stockPlanningOrders],
  );

  const todayFirstProcessPlan = useMemo(
    () =>
      buildTodayFirstProcessPlan(
        activeProductionOrders,
        productionCoverageSummary.byOrderId,
      ),
    [activeProductionOrders, productionCoverageSummary.byOrderId],
  );

  const currentRawStocks = useMemo(() => {
    const stock = { ...baseRawStocks };
    workInventory.forEach((item) => {
      const usage = getRawMaterialUsageForWorkItem(item.type, item.qty);
      Object.entries(usage).forEach(([materialLabel, amount]) => {
        const stockKey = RAW_STOCK_KEY_BY_LABEL[materialLabel];
        if (!stockKey) {
          return;
        }

        stock[stockKey] = Math.max(
          0,
          normalizeNonNegativeNumber(stock[stockKey], 0) - amount,
        );
      });
    });
    return stock;
  }, [baseRawStocks, workInventory]);

  const todayFirstProcessRawMaterialNeed = useMemo(
    () =>
      buildRawMaterialNeedFromRollSummary({
        [PRODUCT_TYPE_OPTIONS[0]]:
          todayFirstProcessPlan.byProductType[PRODUCT_TYPE_OPTIONS[0]].rolls,
        [PRODUCT_TYPE_OPTIONS[1]]:
          todayFirstProcessPlan.byProductType[PRODUCT_TYPE_OPTIONS[1]].rolls,
      }),
    [todayFirstProcessPlan],
  );

  const todayFirstProcessRawMaterialFeasibility = useMemo(
    () =>
      evaluateRawStockFeasibility(
        currentRawStocks,
        todayFirstProcessRawMaterialNeed,
      ),
    [currentRawStocks, todayFirstProcessRawMaterialNeed],
  );

  const stockPlanningRawMaterialNeed = useMemo(
    () =>
      buildRawMaterialNeedFromRollSummary(
        stockPlanningCoverageSummary.shortageRollsByProductType,
      ),
    [stockPlanningCoverageSummary.shortageRollsByProductType],
  );

  const stockPlanningRawMaterialFeasibility = useMemo(
    () =>
      evaluateRawStockFeasibility(currentRawStocks, stockPlanningRawMaterialNeed),
    [currentRawStocks, stockPlanningRawMaterialNeed],
  );

  const incomingRawStockSummary = useMemo(
    () =>
      incomingRawStocks.reduce(
        (summary, item) => {
          summary[item.type] += item.qty;
          return summary;
        },
        createRawStockSummary(),
      ),
    [incomingRawStocks],
  );

  const receivedRawStockSummary = useMemo(
    () =>
      receivedRawStocks.reduce(
        (summary, item) => {
          summary[item.type] += item.qty;
          return summary;
        },
        createRawStockSummary(),
      ),
    [receivedRawStocks],
  );

  const selectedOrder = useMemo(
    () =>
      orders.find((item) => item.id === selectedOrderId) ??
      sortedOrders[0] ??
      null,
    [orders, selectedOrderId, sortedOrders],
  );

  const selectedProductionOrder = useMemo(
    () =>
      filteredProductionOrders.find((item) => item.id === selectedOrderId) ??
      filteredProductionOrders[0] ??
      null,
    [filteredProductionOrders, selectedOrderId],
  );

  const orderSummary = useMemo(() => {
    const today = new Date();
    const pendingOrders = orders.filter(
      (item) =>
        item.status === ORDER_STATUS_OPTIONS[1] ||
        item.status === ORDER_STATUS_OPTIONS[2],
    );
    const urgentOrders = orders.filter((item) => {
      const due = new Date(item.dueDate);
      const diff = due.getTime() - today.getTime();
      return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 3;
    });

    return {
      totalCount: orders.length,
      pendingCount: pendingOrders.length,
      urgentCount: urgentOrders.length,
      totalQty: orders.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [orders]);

  const machineStatusSummary = useMemo(
    () => ({
      available: machines2.filter(
        (machine) => machine.status === MACHINE_STATUS_OPTIONS[0],
      ).length,
      working: machines2.filter(
        (machine) => machine.status === MACHINE_STATUS_OPTIONS[1],
      ).length,
      blocked: machines2.filter(
        (machine) => machine.status === MACHINE_STATUS_OPTIONS[2],
      ).length,
    }),
    [machines2],
  );

  const inventoryMachineStatusSummary = useMemo(
    () => ({
      available: inventoryMachines.filter(
        (machine) => machine.status === MACHINE_STATUS_OPTIONS[0],
      ).length,
      working: inventoryMachines.filter(
        (machine) => machine.status === MACHINE_STATUS_OPTIONS[1],
      ).length,
      blocked: inventoryMachines.filter(
        (machine) => machine.status === MACHINE_STATUS_OPTIONS[2],
      ).length,
    }),
    [inventoryMachines],
  );
  const machineAssignmentItemsByMachineId = useMemo(() => {
    const orderMap = new Map(orders.map((order) => [order.id, order]));

    return machines2.reduce((result, machine) => {
      const machineId = String(machine.id);
      const items = (machineAssignments[machineId] ?? [])
        .map((item) => {
          const order = orderMap.get(item.orderId);
          if (!order) {
            return null;
          }

          return {
            ...item,
            order,
            orderNumber: getOrderDisplayNumber(order),
            hours: getSecondProcessHoursForQty(order.productType, item.qty),
          };
        })
        .filter(Boolean);

      result[machineId] = items;
      return result;
    }, {});
  }, [machineAssignments, machines2, orders]);
  const orderAllocationSummaryByOrderId = useMemo(
    () =>
      orders.reduce((summary, order) => {
        const allocationSummary = Object.values(machineAssignmentItemsByMachineId)
          .flat()
          .filter((item) => item.orderId === order.id)
          .reduce(
            (result, item) => ({
              qty: result.qty + item.qty,
              machineCount: result.machineCount + 1,
              hours: result.hours + item.hours,
            }),
            { qty: 0, machineCount: 0, hours: 0 },
          );

        summary[order.id] = {
          allocatedQty: allocationSummary.qty,
          remainingQty: Math.max(
            0,
            Math.floor(normalizeNonNegativeNumber(order.quantity, 0)) -
              allocationSummary.qty,
          ),
          machineCount: allocationSummary.machineCount,
          allocatedHours: allocationSummary.hours,
        };
        return summary;
      }, {}),
    [machineAssignmentItemsByMachineId, orders],
  );
  const machineAllocationOverview = useMemo(() => {
    const assignedMachineCount = Object.values(machineAssignmentItemsByMachineId).filter(
      (items) => items.length > 0,
    ).length;
    const totalAllocatedQty = Object.values(orderAllocationSummaryByOrderId).reduce(
      (sum, item) => sum + item.allocatedQty,
      0,
    );

    return {
      assignedMachineCount,
      totalAllocatedQty,
    };
  }, [machineAssignmentItemsByMachineId, orderAllocationSummaryByOrderId]);
  const chatContext = useMemo(
    () => ({
      activeMenu,
      today: formatDateInput(new Date()),
      orderSummary,
      rawStocks: {
        CHIP: normalizeNonNegativeNumber(currentRawStocks[RAW_STOCK_TYPES[0]], 0),
        FABRIC: normalizeNonNegativeNumber(currentRawStocks[RAW_STOCK_TYPES[1]], 0),
        STICKER_PAPER: normalizeNonNegativeNumber(
          currentRawStocks[RAW_STOCK_TYPES[2]],
          0,
        ),
      },
      firstProcessStockByProductType: {
        [PRODUCT_TYPE_OPTIONS[0]]: Math.floor(
          normalizeNonNegativeNumber(
            firstProcessStockByProductType[PRODUCT_TYPE_OPTIONS[0]],
            0,
          ),
        ),
        [PRODUCT_TYPE_OPTIONS[1]]: Math.floor(
          normalizeNonNegativeNumber(
            firstProcessStockByProductType[PRODUCT_TYPE_OPTIONS[1]],
            0,
          ),
        ),
      },
      todayFirstProcessPlan: {
        totalRolls: Math.floor(normalizeNonNegativeNumber(todayFirstProcessPlan.totalRolls, 0)),
        totalHours: Number(normalizeNonNegativeNumber(todayFirstProcessPlan.totalHours, 0).toFixed(1)),
        byProductType: {
          [PRODUCT_TYPE_OPTIONS[0]]: {
            rolls: Math.floor(
              normalizeNonNegativeNumber(
                todayFirstProcessPlan.byProductType[PRODUCT_TYPE_OPTIONS[0]]?.rolls,
                0,
              ),
            ),
            qty: Math.floor(
              normalizeNonNegativeNumber(
                todayFirstProcessPlan.byProductType[PRODUCT_TYPE_OPTIONS[0]]?.qty,
                0,
              ),
            ),
            hours: Number(
              normalizeNonNegativeNumber(
                todayFirstProcessPlan.byProductType[PRODUCT_TYPE_OPTIONS[0]]?.hours,
                0,
              ).toFixed(1),
            ),
          },
          [PRODUCT_TYPE_OPTIONS[1]]: {
            rolls: Math.floor(
              normalizeNonNegativeNumber(
                todayFirstProcessPlan.byProductType[PRODUCT_TYPE_OPTIONS[1]]?.rolls,
                0,
              ),
            ),
            qty: Math.floor(
              normalizeNonNegativeNumber(
                todayFirstProcessPlan.byProductType[PRODUCT_TYPE_OPTIONS[1]]?.qty,
                0,
              ),
            ),
            hours: Number(
              normalizeNonNegativeNumber(
                todayFirstProcessPlan.byProductType[PRODUCT_TYPE_OPTIONS[1]]?.hours,
                0,
              ).toFixed(1),
            ),
          },
        },
      },
      machineStatusSummary,
      machineAllocationOverview,
      machineAllocationSummary,
      selectedOrder: selectedOrder
        ? {
            orderNumber: getOrderDisplayNumber(selectedOrder),
            customerName: selectedOrder.customerName,
            productType: selectedOrder.productType,
            quantity: normalizeNonNegativeNumber(selectedOrder.quantity, 0),
            dueDate: selectedOrder.dueDate,
            status: selectedOrder.status,
            priority: normalizePriorityValue(selectedOrder.priority),
            jobType: selectedOrder.jobType,
            cutting: getCuttingValue(
              selectedOrder.productType,
              selectedOrder.cutting,
            ),
          }
        : null,
      selectedProductionOrder: selectedProductionOrder
        ? {
            orderNumber: getOrderDisplayNumber(selectedProductionOrder),
            customerName: selectedProductionOrder.customerName,
            productType: selectedProductionOrder.productType,
            quantity: normalizeNonNegativeNumber(selectedProductionOrder.quantity, 0),
            dueDate: selectedProductionOrder.dueDate,
            status: selectedProductionOrder.status,
            priority: normalizePriorityValue(selectedProductionOrder.priority),
            jobType: selectedProductionOrder.jobType,
            cutting: getCuttingValue(
              selectedProductionOrder.productType,
              selectedProductionOrder.cutting,
            ),
          }
        : null,
      productionDiagnosis: diagnosis,
      activeOrders: activeProductionOrders.slice(0, 12).map((order) => ({
        orderNumber: getOrderDisplayNumber(order),
        customerName: order.customerName,
        productType: order.productType,
        quantity: normalizeNonNegativeNumber(order.quantity, 0),
        dueDate: order.dueDate,
        status: order.status,
        priority: normalizePriorityValue(order.priority),
        jobType: order.jobType,
        cutting: getCuttingValue(order.productType, order.cutting),
      })),
    }),
    [
      activeMenu,
      activeProductionOrders,
      currentRawStocks,
      diagnosis,
      firstProcessStockByProductType,
      machineAllocationOverview,
      machineAllocationSummary,
      machineStatusSummary,
      orderSummary,
      selectedOrder,
      selectedProductionOrder,
      todayFirstProcessPlan,
    ],
  );

  const buildProductionDiagnosis = (order) => {
    const productType = order?.productType ?? PRODUCT_TYPE_OPTIONS[0];
    const productLabel = getProductTypeLabel(productType);
    const today = formatDateInput(new Date());
    const tomorrow = formatDateInput(new Date(Date.now() + 86400000));

    const prioritizedActiveOrders = activeProductionOrders.filter(
      (item) => normalizePriorityValue(item.priority) !== null,
    );
    const cuttingReadyOrders = activeProductionOrders.filter(
      (item) =>
        item.productType === PRODUCT_TYPE_OPTIONS[0] &&
        item.cutting === "Y",
    );
    const cuttingReadyQty = Math.floor(
      cuttingReadyOrders.reduce(
        (sum, item) => sum + normalizeNonNegativeNumber(item.quantity, 0),
        0,
      ),
    );
    const cuttingReadyHours = getCuttingHoursForQty(cuttingReadyQty);
    const firstProcessQty = Math.floor(
      normalizeNonNegativeNumber(firstProcessStockByProductType[productType], 0),
    );

    // 납기 긴급도 분류: 오늘·내일 = 긴급, 그 이후 = 여유
    const sameTypeOrders = activeProductionOrders.filter((item) => item.productType === productType);
    const urgentOrders = sameTypeOrders.filter((item) => item.dueDate <= tomorrow);
    const futureOrders = sameTypeOrders.filter((item) => item.dueDate > tomorrow);

    const urgentNeedQty = Math.floor(urgentOrders.reduce((sum, item) => sum + normalizeNonNegativeNumber(item.quantity, 0), 0));
    const futureNeedQty = Math.floor(futureOrders.reduce((sum, item) => sum + normalizeNonNegativeNumber(item.quantity, 0), 0));
    const secondProcessNeedQty = urgentNeedQty + futureNeedQty;

    const urgentShortage = Math.max(0, urgentNeedQty - firstProcessQty);
    const totalShortage = Math.max(0, secondProcessNeedQty - firstProcessQty);

    // 접수·작업중 전체 발주의 1차공정 남은 롤 기준 총 시간
    const totalFirstProcessHours = activeProductionOrders.reduce((sum, o) => {
      const coverage = productionCoverageSummary.byOrderId[o.id];
      if (!coverage || coverage.shortageRolls <= 0) return sum;
      const rph = getFirstProcessRollsPerHour(o.productType);
      return sum + (rph > 0 ? coverage.shortageRolls / rph : 0);
    }, 0);
    const todayExpectedHours = totalFirstProcessHours + cuttingReadyHours;

    let inventoryComment = `${productLabel} 기준 현재 2차공정 진행 대상이 없습니다.`;
    if (urgentNeedQty > 0 && futureNeedQty > 0) {
      if (urgentShortage > 0) {
        inventoryComment = `긴급(오늘·내일 납기) ${urgentNeedQty.toLocaleString()}개 중 ${urgentShortage.toLocaleString()}개 부족합니다. 여유 납기 발주 ${futureOrders.length}건(${futureNeedQty.toLocaleString()}개)은 별도 확보 필요합니다.`;
      } else {
        inventoryComment = `긴급(오늘·내일 납기) ${urgentNeedQty.toLocaleString()}개는 현재 1차공정 물량으로 대응 가능합니다. 여유 납기 발주 ${futureOrders.length}건(${futureNeedQty.toLocaleString()}개)은 추가 확보 필요합니다.`;
      }
    } else if (urgentNeedQty > 0) {
      inventoryComment = urgentShortage > 0
        ? `${productLabel} 긴급 납기 ${urgentNeedQty.toLocaleString()}개 중 ${urgentShortage.toLocaleString()}개 부족합니다.`
        : `${productLabel} 긴급 납기 ${urgentNeedQty.toLocaleString()}개 대응 가능합니다.`;
    } else if (futureNeedQty > 0) {
      inventoryComment = `당장 긴급 납기는 없습니다. 여유 납기 발주 ${futureOrders.length}건(${futureNeedQty.toLocaleString()}개)은 순차 확보 필요합니다.`;
    }

    let finalComment = "현재 진행 중인 작업이 없습니다.";
    if (todayExpectedHours > 0 && totalFirstProcessHours > 0 && cuttingReadyHours > 0) {
      finalComment = `접수·작업중 발주 전체 1차공정(${formatHoursText(totalFirstProcessHours)})과 컷팅(${formatHoursText(cuttingReadyHours)})을 합산한 총 작업 시간입니다.`;
    } else if (todayExpectedHours > 0 && totalFirstProcessHours > 0) {
      finalComment = `접수·작업중 발주 전체 기준 1차공정 총 작업 시간입니다.`;
    } else if (todayExpectedHours > 0) {
      finalComment = `컷팅 대상 기준 총 작업 시간입니다.`;
    }

    return {
      B_Top: {
        todayTargetQty: Math.floor(
          activeProductionOrders.reduce((sum, o) => {
            return sum + normalizeNonNegativeNumber(todayFirstProcessPlan.byOrderId[o.id]?.todayRequiredQty, 0);
          }, 0)
        ),
        todayTargetHours: formatHoursText(normalizeNonNegativeNumber(todayFirstProcessPlan.totalHours, 0)),
        urgentCuttingOrders: cuttingReadyOrders.filter((o) => o.dueDate <= tomorrow),
        urgentCuttingQty: Math.floor(
          cuttingReadyOrders.filter((o) => o.dueDate <= tomorrow)
            .reduce((sum, o) => sum + normalizeNonNegativeNumber(o.quantity, 0), 0)
        ),
        futureCuttingOrders: cuttingReadyOrders.filter((o) => o.dueDate > tomorrow),
        futureCuttingQty: Math.floor(
          cuttingReadyOrders.filter((o) => o.dueDate > tomorrow)
            .reduce((sum, o) => sum + normalizeNonNegativeNumber(o.quantity, 0), 0)
        ),
        cuttingTotalHours: formatHoursText(cuttingReadyHours),
      },
      B_Mid: {
        productLabel,
        firstProcessQty,
        secondProcessNeedQty: urgentNeedQty,
        totalNeedQty: secondProcessNeedQty,
        futureNeedQty,
        urgentOrderCount: urgentOrders.length,
        futureOrderCount: futureOrders.length,
        inventoryComment,
      },
      B_Bottom: {
        todayWorkHours: formatHoursText(todayExpectedHours),
        firstProcessHours: formatHoursText(totalFirstProcessHours),
        cuttingHours: formatHoursText(cuttingReadyHours),
        finalComment,
      },
    };
  };

  const runProductionDiagnosis = async (order) => {
    if (!order) return;

    const requestId = productionDiagnosisRequestRef.current + 1;
    productionDiagnosisRequestRef.current = requestId;
    setIsDiagnosing(true);
    setDiagnosis(null);

    try {
      const nextDiagnosis = buildProductionDiagnosis(order);
      if (productionDiagnosisRequestRef.current !== requestId) {
        return;
      }

      setDiagnosis(nextDiagnosis);
      setLastProductionDiagnosisAt(formatDateTime(new Date()));
    } catch (error) {
      console.error(error);
      if (productionDiagnosisRequestRef.current !== requestId) {
        return;
      }

      setDiagnosis(buildProductionDiagnosis(order));
      setLastProductionDiagnosisAt(formatDateTime(new Date()));
    } finally {
      if (productionDiagnosisRequestRef.current === requestId) {
        setIsDiagnosing(false);
      }
    }
  };

  const runMachineAllocation = async () => {
    const requestId = machineAllocationRequestRef.current + 1;
    machineAllocationRequestRef.current = requestId;
    setIsMachineAllocating(true);

    const fallbackAssignments = buildFallbackMachineAssignments(
      activeProductionOrders,
      machines2,
    );
    const fallbackSummary = buildMachineAllocationSummaryText(
      fallbackAssignments,
      activeProductionOrders,
      machines2,
    );
    const allocationContext = {
      availableMachines: availableProductionMachines.map((machine) => ({
        machineId: machine.id,
        machineName: machine.name,
        availableHours: getWorkingHoursPerDay(),
      })),
      activeOrders: activeProductionOrders.map((order) => ({
        orderId: order.id,
        orderNumber: getOrderDisplayNumber(order),
        customerName: order.customerName,
        dueDate: order.dueDate,
        priority: order.priority,
        status: order.status,
        productType: order.productType,
        quantity: Math.max(
          0,
          Math.floor(normalizeNonNegativeNumber(order.quantity, 0)),
        ),
        secondProcessUnitsPerHour: getSecondProcessUnitsPerHour(order.productType),
        firstProcessCoveredQty:
          productionCoverageSummary.byOrderId[order.id]?.coveredQty ?? 0,
        todayFirstProcessQty:
          todayFirstProcessPlan.byOrderId[order.id]?.todayRequiredQty ?? 0,
      })),
      workingHoursPerMachine: getWorkingHoursPerDay(),
    };

    try {
      if (DEMO_MODE) {
        await sleep(500);
        if (machineAllocationRequestRef.current !== requestId) {
          return;
        }

        setMachineAssignments(fallbackAssignments);
        setMachineAllocationSummary(fallbackSummary);
        setLastMachineAllocationAt(formatDateTime(new Date()));
      } else {
        const prompt = `You are assigning active Korean manufacturing orders to second-process machines. Return JSON only. Use only machines whose status is AVAILABLE. You may split one order across multiple machines. Prioritize earlier due dates and higher priority orders. Treat null priority as no priority, lower than priorities 1 through 5. Keep each machine within ${getWorkingHoursPerDay()} working hours total. For each order allocation, use orderId exactly as provided and integer qty only. Total allocated qty for each order must not exceed its quantity. Output shape: {"summary":"short Korean summary","machineAssignments":[{"machineId":"1","orders":[{"orderId":"20260414001","qty":10000}]}]}. Context: ${JSON.stringify(
          allocationContext,
        )}`;
        const text = await callGeminiAPI({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        });

        if (machineAllocationRequestRef.current !== requestId) {
          return;
        }

        const parsedAllocation = parseJson(text);
        const rawAssignments = Array.isArray(parsedAllocation?.machineAssignments)
          ? parsedAllocation.machineAssignments.reduce((result, machine) => {
              const machineId = String(
                machine?.machineId ?? machine?.id ?? machine?.machineName ?? "",
              ).trim();

              if (!machineId) {
                return result;
              }

              result[machineId] = Array.isArray(machine?.orders)
                ? machine.orders
                : [];
              return result;
            }, {})
          : {};
        const sanitizedAssignments = sanitizeMachineAssignments(
          rawAssignments,
          machines2,
          activeProductionOrders,
        );
        const nextAssignments =
          Object.keys(sanitizedAssignments).length > 0 ||
          activeProductionOrders.length === 0 ||
          availableProductionMachines.length === 0
            ? sanitizedAssignments
            : fallbackAssignments;
        const summaryText =
          typeof parsedAllocation?.summary === "string" &&
          parsedAllocation.summary.trim()
            ? parsedAllocation.summary.trim()
            : buildMachineAllocationSummaryText(
                nextAssignments,
                activeProductionOrders,
                machines2,
              );

        setMachineAssignments(nextAssignments);
        setMachineAllocationSummary(summaryText);
        setLastMachineAllocationAt(formatDateTime(new Date()));
      }
    } catch (error) {
      console.error(error);
      if (machineAllocationRequestRef.current !== requestId) {
        return;
      }

      setMachineAssignments(fallbackAssignments);
      setMachineAllocationSummary(fallbackSummary);
      setLastMachineAllocationAt(formatDateTime(new Date()));
    } finally {
      if (machineAllocationRequestRef.current === requestId) {
        setIsMachineAllocating(false);
      }
    }
  };

  const runInventoryDiagnosis = async () => {
    setIsInvDiagnosing(true);
    const todayCareRolls =
      todayFirstProcessPlan.byProductType[PRODUCT_TYPE_OPTIONS[0]].rolls;
    const todayStickerRolls =
      todayFirstProcessPlan.byProductType[PRODUCT_TYPE_OPTIONS[1]].rolls;
    const shortageLabels = [
      ...new Set(
        [
          ...todayFirstProcessRawMaterialFeasibility.shortages,
          ...stockPlanningRawMaterialFeasibility.shortages,
        ].map((item) => getRawStockLabel(item.type)),
      ),
    ]
      .join(", ");
    const hasRisk =
      !todayFirstProcessRawMaterialFeasibility.isEnough ||
      !stockPlanningRawMaterialFeasibility.isEnough;
    const fallback = {
      status: hasRisk ? "CHECK" : "SAFE",
      advice:
        hasRisk
          ? `접수/작업중 납기 기준 오늘 1차공정 필요량은 케어라벨 ${todayCareRolls}롤, 스티커라벨 ${todayStickerRolls}롤입니다. 다만 현재 재고 기준으로는 ${shortageLabels}가 부족하며, 발주 상태 물량까지 포함하면 추가 확보가 필요합니다.`
          : `접수/작업중 납기 기준 오늘 1차공정 필요량은 케어라벨 ${todayCareRolls}롤, 스티커라벨 ${todayStickerRolls}롤입니다. 현재 재고로 오늘 계획은 대응 가능하고, 발주 상태 물량까지 포함한 전체 재고 계획도 충분합니다.`,
    };

    // 입고 예정 요약 (타입별 합산)
    const incomingByType = RAW_STOCK_TYPES.reduce((acc, t) => {
      const items = incomingRawStocks.filter(r => r.type === t);
      acc[t] = { total: items.reduce((s, r) => s + (r.qty ?? 0), 0), items };
      return acc;
    }, {});

    // 1차 공정 완료 재고 (2차공정 투입 가능 롤)
    const firstProcessSummary = PRODUCT_TYPE_OPTIONS.map(pt => {
      const label = getWorkTypeLabelForProductType(pt);
      const rolls = firstProcessAvailableRollsByProductType[pt] ?? 0;
      return `${label}: ${rolls.toLocaleString()}롤`;
    }).join(' / ');

    try {
      if (DEMO_MODE) {
        await sleep(300);
        setInvDiagnosis(fallback);
      } else {
        const text = await callGeminiAPI({
          contents: [
            {
              parts: [
                {
                  text:
                    `당신은 한국 제조공장 재고 AI 어드바이저입니다. 아래 데이터를 분석해 JSON만 반환하세요: { "status": "SAFE|CHECK", "advice": "한국어 조언" }
[규칙]
- status는 영어(SAFE 또는 CHECK), advice는 한국어
- 부족한 품목은 반드시 "보유량/필요량/부족량 + 단위"를 명시하세요
- 입고 예정 물량이 부족분을 커버하면 반드시 언급하세요
- 1차 공정 완료 재고가 있으면 2차공정 대응 가능 여부를 함께 판단하세요
- 2~4문장으로 간결하게, 수치 중심으로 작성
[현재 원자재 재고]
${RAW_STOCK_TYPES.map(t => `${getRawStockLabel(t)}: ${(currentRawStocks[t] ?? 0).toLocaleString()}${getRawStockUnitLabel(t)}`).join(' / ')}
[입고 예정 일정]
${RAW_STOCK_TYPES.map(t => {
  const { total, items } = incomingByType[t];
  if (total === 0) return `${getRawStockLabel(t)}: 없음`;
  const dates = [...new Set(items.map(r => r.expectedDate))].sort().join(', ');
  return `${getRawStockLabel(t)}: ${total.toLocaleString()}${getRawStockUnitLabel(t)} (입고예정: ${dates})`;
}).join('\n')}
[전체 수주 대응 필요 원자재]
${RAW_STOCK_TYPES.map(t => `${getRawStockLabel(t)}: ${(stockPlanningRawMaterialNeed[t] ?? 0).toLocaleString()}${getRawStockUnitLabel(t)}`).join(' / ')}
[부족 항목 (현재 재고 기준)]
${stockPlanningRawMaterialFeasibility.shortages.length > 0
  ? stockPlanningRawMaterialFeasibility.shortages.map(s =>
      `${getRawStockLabel(s.type)}: 보유 ${s.availableQty.toLocaleString()}${getRawStockUnitLabel(s.type)} / 필요 ${s.requiredQty.toLocaleString()}${getRawStockUnitLabel(s.type)} / 부족 ${s.shortageQty.toLocaleString()}${getRawStockUnitLabel(s.type)}`
    ).join('\n')
  : '없음'}
[1차 공정 완료 재고 (2차공정 투입 가능)]
${firstProcessSummary}
[오늘 1차공정 계획]
케어라벨 ${todayCareRolls}롤 / 스티커라벨 ${todayStickerRolls}롤 필요
오늘 원자재 충분 여부: ${todayFirstProcessRawMaterialFeasibility.isEnough ? '충분' : '부족'}`,
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json" },
        });
        setInvDiagnosis(parseJson(text) ?? fallback);
      }
    } catch (error) {
      console.error(error);
      setInvDiagnosis(fallback);
    } finally {
      setIsInvDiagnosing(false);
    }
  };

  const buildDemoChatReply = (message) => {
    const trimmedMessage = message.trim();
    const normalizedMessage = trimmedMessage.toLowerCase();
    const includesAny = (keywords) =>
      keywords.some((keyword) => normalizedMessage.includes(keyword));
    const selectedDiagnosis = selectedProductionOrder
      ? diagnosis ?? buildProductionDiagnosis(selectedProductionOrder)
      : null;
    const cuttingReadyOrders = activeProductionOrders.filter(
      (item) =>
        item.productType === PRODUCT_TYPE_OPTIONS[0] &&
        item.cutting === "Y",
    );
    const cuttingReadyQty = Math.floor(
      cuttingReadyOrders.reduce(
        (sum, item) => sum + normalizeNonNegativeNumber(item.quantity, 0),
        0,
      ),
    );
    const cuttingReadyHours = getCuttingHoursForQty(cuttingReadyQty);

    if (!trimmedMessage) {
      return "재고, 수주, 납기, 컷팅, 설비 상태처럼 현재 화면에서 확인 가능한 내용을 질문해 주세요.";
    }

    if (
      includesAny([
        "배분",
        "실행",
        "등록",
        "수정",
        "변경",
        "삭제",
        "추가",
        "갱신",
        "저장",
      ])
    ) {
      return "AI 채팅은 현재 화면 데이터를 읽어 설명만 하는 기능입니다. 배분 실행이나 등록, 수정은 직접 처리하지 않습니다.";
    }

    if (includesAny(["cutting", "컷팅", "커팅"])) {
      return cuttingReadyQty > 0
        ? `현재 컷팅 대상은 ${cuttingReadyOrders.length}건, 총 ${cuttingReadyQty.toLocaleString()}개이며 예상 컷팅 시간은 ${formatHoursText(cuttingReadyHours)}입니다.`
        : "현재 화면 기준 컷팅 대상 물량은 없습니다.";
    }

    if (includesAny(["1차", "2차", "부족", "필요량", "보유 물량"])) {
      if (!selectedDiagnosis) {
        return "선택된 생산 수주 기준 데이터가 없어 1차공정과 2차공정 비교를 바로 안내하기 어렵습니다.";
      }

      return `${safeStr(selectedDiagnosis.B_Mid?.inventoryComment)} 1차공정 보유 물량은 ${normalizeNonNegativeNumber(selectedDiagnosis.B_Mid?.firstProcessQty, 0).toLocaleString()}개, 2차공정 필요량은 ${normalizeNonNegativeNumber(selectedDiagnosis.B_Mid?.secondProcessNeedQty, 0).toLocaleString()}개입니다.`;
    }

    if (includesAny(["stock", "inventory", "재고", "원자재", "입고"])) {
      return `현재 원자재 재고는 ${getRawStockLabel(RAW_STOCK_TYPES[0])} ${currentRawStocks[RAW_STOCK_TYPES[0]].toLocaleString()}개, ${getRawStockLabel(RAW_STOCK_TYPES[1])} ${currentRawStocks[RAW_STOCK_TYPES[1]]}롤, ${getRawStockLabel(RAW_STOCK_TYPES[2])} ${currentRawStocks[RAW_STOCK_TYPES[2]]}롤입니다.`;
    }

    if (includesAny(["order", "due", "수주", "주문", "납기"])) {
      return `전체 수주는 ${orderSummary.totalCount}건, 진행 중인 수주는 ${orderSummary.pendingCount}건, 긴급 수주는 ${orderSummary.urgentCount}건이며 총 수량은 ${orderSummary.totalQty.toLocaleString()}개입니다.`;
    }

    if (includesAny(["machine", "equipment", "production", "설비", "기계", "생산"])) {
      return `설비 상태는 가동 가능 ${machineStatusSummary.available}대, 가동 중 ${machineStatusSummary.working}대, 정비 필요 ${machineStatusSummary.blocked}대입니다.`;
    }

    return "현재 화면에서 확인 가능한 건 재고, 수주, 납기, 컷팅, 1차/2차공정 비교, 설비 상태입니다. 예시 질문 버튼을 눌러서 확인해 보셔도 됩니다.";
  };

  const clearReceivedUndoTimeout = () => {
    if (receivedUndoTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(receivedUndoTimeoutRef.current);
    receivedUndoTimeoutRef.current = null;
  };

  const sendChatMessage = async (messageText) => {
    const trimmedInput = messageText.trim();

    if (!trimmedInput || isChatLoading) {
      return;
    }

    const userMessage = createChatMessage("user", trimmedInput);
    const nextChatMessages = [...chatMessages, userMessage];

    setChatMessages(nextChatMessages);
    setChatInput("");
    setIsChatLoading(true);

    try {
      // 챗봇은 항상 서버 API 사용 (DEMO_MODE 무관)
      const history = nextChatMessages
        .filter((m) => m.id !== "chatbot-welcome")
        .slice(-10)
        .slice(0, -1) // 방금 추가한 현재 user 메시지 제외
        .map((m) => ({ role: m.role, text: m.text }));

      const { reply } = await chatApi.send(trimmedInput, chatContext, history);
      const replyText = reply?.trim() || "현재 데이터를 기준으로 답변을 생성하지 못했습니다.";

      setChatMessages((current) => [
        ...current,
        createChatMessage("assistant", replyText),
      ]);
    } catch (error) {
      console.error(error);
      setChatMessages((current) => [
        ...current,
        createChatMessage(
          "assistant",
          `응답 생성에 실패했습니다. ${safeStr(error?.message || "API 설정이나 네트워크 상태를 확인해 주세요.")}`,
        ),
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };
  const handleSendChatMessage = async () => {
    await sendChatMessage(chatInput);
  };
  const handleQuickChatQuestion = async (question) => {
    await sendChatMessage(question);
  };

  // 재고 AI 진단은 버튼 클릭 시에만 실행 (자동 호출 제거)

  useEffect(
    () => () => {
      clearReceivedUndoTimeout();
    },
    [],
  );

  useEffect(() => {
    const normalizedBaseRawStocks = normalizeBaseRawStocks(baseRawStocks);
    const normalizedIncomingRawStocks = normalizeIncomingRawStocks(incomingRawStocks);
    const normalizedReceivedRawStocks = normalizeReceivedRawStocks(receivedRawStocks);
    const nextRawStockState = normalizeIncomingRawStockState({
      baseRawStocks: normalizedBaseRawStocks,
      incomingRawStocks: normalizedIncomingRawStocks,
      receivedRawStocks: normalizedReceivedRawStocks,
    });

    const baseChanged =
      JSON.stringify(nextRawStockState.baseRawStocks) !==
      JSON.stringify(normalizedBaseRawStocks);
    const incomingChanged =
      JSON.stringify(nextRawStockState.incomingRawStocks) !==
      JSON.stringify(normalizedIncomingRawStocks);
    const receivedChanged =
      JSON.stringify(nextRawStockState.receivedRawStocks) !==
      JSON.stringify(normalizedReceivedRawStocks);

    if (!baseChanged && !incomingChanged && !receivedChanged) {
      return;
    }

    if (baseChanged) {
      setBaseRawStocks(nextRawStockState.baseRawStocks);
    }

    if (incomingChanged) {
      setIncomingRawStocks(nextRawStockState.incomingRawStocks);
    }

    if (receivedChanged) {
      setReceivedRawStocks(nextRawStockState.receivedRawStocks);
    }
  }, [baseRawStocks, incomingRawStocks, receivedRawStocks]);

  useEffect(() => {
    savePersistedState(STORAGE_KEYS.activeMenu, activeMenu);
  }, [activeMenu]);

  useEffect(() => {
    if (orders.length > 0) savePersistedState(STORAGE_KEYS.orders, orders);
  }, [orders]);

  useEffect(() => {
    savePersistedState(STORAGE_KEYS.selectedOrderId, selectedOrderId);
  }, [selectedOrderId]);

  // raw stocks: DB 입고 내역 합산 → baseRawStocks 동기화
  useEffect(() => {
    rawStocksApi.getAll()
      .then((rows) => {
        const summed = rows.reduce(
          (acc, r) => {
            if (acc[r.materialType] !== undefined) {
              acc[r.materialType] += r.quantity;
            }
            return acc;
          },
          { CHIP: 0, FABRIC: 0, STICKER_PAPER: 0 },
        );
        setBaseRawStocks(summed);
        savePersistedState(STORAGE_KEYS.baseRawStocks, summed);
      })
      .catch(() => {/* localStorage 폴백 유지 */});
  }, []);

  // orders: API에서 초기 로드, 실패 시 localStorage 백업 사용
  useEffect(() => {
    ordersApi.getAll()
      .then((rows) => {
        const loaded = normalizeOrders(rows);
        setOrders(loaded);
        savePersistedState(STORAGE_KEYS.orders, loaded);
      })
      .catch(() => {
        const backup = loadPersistedState(STORAGE_KEYS.orders, []);
        if (backup.length > 0) setOrders(normalizeOrders(backup));
      });
  }, []);

  // 활성 세션이 있을 때 1초마다 진행률 갱신
  useEffect(() => {
    if (Object.keys(machineActiveSessions).length === 0) return;
    const id = setInterval(() => setProgressTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [machineActiveSessions]);

  useEffect(() => {
    savePersistedState(STORAGE_KEYS.workInventory, workInventory);
  }, [workInventory]);

  useEffect(() => {
    savePersistedState(STORAGE_KEYS.incomingRawStocks, incomingRawStocks);
  }, [incomingRawStocks]);

  useEffect(() => {
    savePersistedState(STORAGE_KEYS.receivedRawStocks, receivedRawStocks);
  }, [receivedRawStocks]);

  useEffect(() => {
    savePersistedState(STORAGE_KEYS.baseRawStocks, baseRawStocks);
  }, [baseRawStocks]);

  useEffect(() => {
    savePersistedState(STORAGE_KEYS.machines2, machines2);
  }, [machines2]);

  useEffect(() => {
    savePersistedState(STORAGE_KEYS.inventoryMachines, inventoryMachines);
  }, [inventoryMachines]);

  useEffect(() => {
    savePersistedState(STORAGE_KEYS.machineAssignments, machineAssignments);
  }, [machineAssignments]);

  useEffect(() => {
    savePersistedState(STORAGE_KEYS.activeSessions, machineActiveSessions);
  }, [machineActiveSessions]);

  useEffect(() => {
    const nextAssignments = sanitizeMachineAssignments(
      machineAssignments,
      machines2,
      activeProductionOrders,
    );

    if (JSON.stringify(nextAssignments) === JSON.stringify(machineAssignments)) {
      return;
    }

    setMachineAssignments(nextAssignments);
  }, [activeProductionOrders, machineAssignments, machines2]);

  useEffect(() => {
    if (activeMenu === "orders" && !selectedOrderId && sortedOrders[0]) {
      setSelectedOrderId(sortedOrders[0].id);
    }
  }, [activeMenu, selectedOrderId, sortedOrders]);

  useEffect(() => {
    if (activeMenu !== "production") {
      productionDiagnosisRequestRef.current += 1;
      setIsDiagnosing(false);
      return;
    }

    if (!selectedProductionOrder) {
      productionDiagnosisRequestRef.current += 1;
      setIsDiagnosing(false);
      setDiagnosis(null);
      setLastProductionDiagnosisAt(null);
      return;
    }

    if (selectedOrderId !== selectedProductionOrder.id) {
      setSelectedOrderId(selectedProductionOrder.id);
      return;
    }

    runProductionDiagnosis(selectedProductionOrder);
  }, [
    activeMenu,
    activeProductionOrders,
    firstProcessStockByProductType,
    orders,
    selectedOrderId,
    selectedProductionOrder,
    todayFirstProcessPlan,
  ]);

  const handleRowClick = (order) => {
    setSelectedOrderId(order.id);
  };

  const handleRefresh = async () => {
    const order = selectedProductionOrder ?? filteredProductionOrders[0] ?? null;

    if (order && selectedOrderId !== order.id) {
      setSelectedOrderId(order.id);
    }

    if (order) {
      await Promise.all([runProductionDiagnosis(order), runMachineAllocation()]);
      return;
    }

    await runMachineAllocation();
  };

  const handlePriorityChange = (orderId, priority) => {
    const normalized = normalizePriorityValue(priority);
    setOrders((current) =>
      current.map((item) => item.id === orderId ? { ...item, priority: normalized } : item),
    );
    ordersApi.update(orderId, { priority: normalized }).catch(() => {});
  };

  const handleJobTypeChange = (orderId, jobType) => {
    if (!ORDER_JOB_TYPE_OPTIONS.includes(jobType)) return;
    setOrders((current) =>
      current.map((item) => item.id === orderId ? { ...item, jobType } : item),
    );
    ordersApi.update(orderId, { jobType }).catch(() => {});
  };

  const handleStatusChange = (orderId, status) => {
    setOrders((current) =>
      current.map((item) => item.id === orderId ? { ...item, status } : item),
    );
    ordersApi.update(orderId, { status }).catch(() => {});
  };

  const handleDueDateChange = (orderId, dueDate) => {
    setOrders((current) =>
      current.map((item) => item.id === orderId ? { ...item, dueDate } : item),
    );
    ordersApi.update(orderId, { dueDate }).catch(() => {});
  };

  const handleOrderFormChange = (key, value) => {
    setOrderForm((current) => {
      return {
        ...current,
        [key]: key === "quantity" ? Number(value) : value,
      };
    });
  };

  const handleProductionDateFilterChange = (key, value) => {
    setProductionDateFilter((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const getNextOrderStamp = (currentOrders) => {
    const existingOrderNumbers = new Set(
      currentOrders.map((item) => getOrderDisplayNumber(item)),
    );
    let nextDate = new Date();
    let nextOrderNumber = formatOrderNumber(nextDate);

    while (existingOrderNumbers.has(nextOrderNumber)) {
      nextDate = new Date(nextDate.getTime() + 1000);
      nextOrderNumber = formatOrderNumber(nextDate);
    }

    return {
      createdAt: formatOrderCreatedAt(nextDate),
      orderNumber: nextOrderNumber,
    };
  };

  const handleAddOrder = () => {
    const customerName = orderForm.customerName.trim();
    const quantity = Number(orderForm.quantity);

    if (!customerName || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    const nextOrderStamp = getNextOrderStamp(orders);
    const nextOrder = {
      id: nextOrderStamp.orderNumber,
      orderNumber: nextOrderStamp.orderNumber,
      createdAt: nextOrderStamp.createdAt,
      customerName,
      dueDate: formatDateInput(new Date()),
      productType: orderForm.productType,
      quantity,
      status: ORDER_STATUS_OPTIONS[1],
      priority: 3,
      jobType: ORDER_JOB_TYPE_OPTIONS[0],
      cutting: orderForm.productType === PRODUCT_TYPE_OPTIONS[1] ? "N" : "Y",
    };

    setOrders((current) => [...current, nextOrder]);
    setSelectedOrderId(nextOrder.id);
    setOrderForm({
      customerName: CUSTOMER_OPTIONS[0],
      productType: PRODUCT_TYPE_OPTIONS[0],
      quantity: 1000,
    });
    setIsOrderModalOpen(false);

    ordersApi.create(nextOrder).catch(() => {});
  };

  const handleCuttingChange = (orderId, cutting) => {
    setOrders((current) =>
      current.map((item) => {
        if (item.id !== orderId) return item;
        const nextCutting = item.productType === PRODUCT_TYPE_OPTIONS[1] ? "N" : cutting;
        ordersApi.update(orderId, { cutting: nextCutting }).catch(() => {});
        return { ...item, cutting: nextCutting };
      }),
    );
  };

  const handleInventoryFormChange = (key, value) => {
    setInventoryForm((current) => ({
      ...current,
      [key]: key === "qty" ? Number(value) : value,
    }));
  };

  const handleIncomingRawStockFormChange = (key, value) => {
    setIncomingRawStockForm((current) => ({
      ...current,
      [key]: key === "qty" ? Number(value) : value,
    }));
  };

  const handleAddInventory = () => {
    const nextQty = Number(inventoryForm.qty);
    if (!Number.isFinite(nextQty) || nextQty <= 0) return;

    const newItem = {
      id: Date.now(),
      dateTime: formatDateTime(new Date()),
      type: inventoryForm.type,
      qty: nextQty,
    };

    setWorkInventory((current) => [newItem, ...current]);
    setInventoryForm((current) => ({ ...current, qty: 1 }));

    // API 기록
    firstProcessApi.start({
      processType: inventoryForm.type,
      workDate: formatDateInput(new Date()),
      targetQty: nextQty,
      outputQty: nextQty,
    }).then((res) =>
      firstProcessApi.done(res.id, { outputQty: nextQty, shortQty: 0 })
    ).catch(() => {});
  };

  const handleRemoveInventory = (inventoryId) => {
    setWorkInventory((current) =>
      current.filter((item) => item.id !== inventoryId),
    );
  };

  const handleResetWorkInventory = () => {
    setWorkInventory([]);
  };

  const handleResetOrders = () => {
    setOrders([]);
    setMachineAssignments({});
  };

  const handleResetInventory = () => {
    setIncomingRawStocks([]);
    setReceivedRawStocks([]);
    setBaseRawStocks(DEFAULT_BASE_RAW_STOCKS);
  };

  // 2차 공정 기계 작업 시작
  const handleMachineWorkStart = async (machine, assignmentItem) => {
    const order = assignmentItem.order;
    const processType = order.productType === PRODUCT_TYPE_OPTIONS[0] ? "care_label" : "sticker_label";
    const unitsPerHour = order.productType === PRODUCT_TYPE_OPTIONS[0] ? 2300 : 8000;

    try {
      const res = await secondProcessApi.start({
        orderId: order.id,
        machineId: machine.id,
        processType,
        unitsPerHour,
        workDate: formatDateInput(new Date()),
        targetQty: assignmentItem.qty,
      });

      setMachineActiveSessions((current) => ({
        ...current,
        [machine.id]: {
          id: res.id,
          startedAt: res.startedAt,
          targetQty: assignmentItem.qty,
          orderId: order.id,
          orderNumber: assignmentItem.orderNumber,
          processType,
          unitsPerHour,
        },
      }));

      // 작업 시작하면 기계 상태 → WORKING
      setMachines2((current) =>
        current.map((m) => m.id === machine.id ? { ...m, status: MACHINE_STATUS_OPTIONS[1] } : m),
      );
    } catch (e) {
      console.error("작업 시작 실패:", e);
    }
  };

  // 2차 공정 기계 작업 완료
  const handleMachineWorkDone = async (machineId, outputQty, shortQty = 0) => {
    const session = machineActiveSessions[machineId];
    if (!session) return;

    try {
      await secondProcessApi.done(session.id, { outputQty, shortQty });

      setMachineActiveSessions((current) => {
        const next = { ...current };
        delete next[machineId];
        return next;
      });

      // 완료 후 기계 상태 → AVAILABLE
      setMachines2((current) =>
        current.map((m) => m.id === machineId ? { ...m, status: MACHINE_STATUS_OPTIONS[0] } : m),
      );
    } catch (e) {
      console.error("작업 완료 실패:", e);
    }
  };

  const handleMachineStatusChange = (machineId, status) => {
    setMachines2((current) =>
      current.map((machine) =>
        machine.id === machineId ? { ...machine, status } : machine,
      ),
    );

    if (status === MACHINE_STATUS_OPTIONS[2]) {
      setMachineAssignments((current) => {
        const nextAssignments = { ...current };
        delete nextAssignments[String(machineId)];
        return nextAssignments;
      });
    }
  };

  const handleMachineAssignmentQtyChange = (machineId, orderId, value) => {
    const requestedQty = Math.max(
      0,
      Math.floor(normalizeNonNegativeNumber(value, 0)),
    );

    setMachineAssignments((current) => {
      const machineKey = String(machineId);
      const currentItems = current[machineKey] ?? [];
      const nextItems =
        requestedQty <= 0
          ? currentItems.filter((item) => item.orderId !== orderId)
          : currentItems.map((item) =>
              item.orderId === orderId ? { ...item, qty: requestedQty } : item,
            );
      const nextAssignments = {
        ...current,
        [machineKey]: nextItems,
      };

      if (nextItems.length === 0) {
        delete nextAssignments[machineKey];
      }

      return sanitizeMachineAssignments(
        nextAssignments,
        machines2,
        activeProductionOrders,
      );
    });
  };

  const handleRemoveMachineAssignment = (machineId, orderId) => {
    setMachineAssignments((current) => {
      const machineKey = String(machineId);
      const nextItems = (current[machineKey] ?? []).filter(
        (item) => item.orderId !== orderId,
      );
      const nextAssignments = {
        ...current,
        [machineKey]: nextItems,
      };

      if (nextItems.length === 0) {
        delete nextAssignments[machineKey];
      }

      return nextAssignments;
    });
  };

  const handleInventoryMachineStatusChange = (machineId, status) => {
    setInventoryMachines((current) =>
      current.map((machine) =>
        machine.id === machineId ? { ...machine, status } : machine,
      ),
    );
  };

  const handleBLFile = async (file) => {
    if (!file) return;
    setIsBLParsing(true);
    setBlParseResult(null);
    try {
      const parsed = await parseBLFile(file);
      if (!parsed?.items?.length) throw new Error("품목을 찾을 수 없습니다");
      setBlParseResult(parsed);
    } catch (err) {
      alert(`B/L 파싱 실패: ${err.message}`);
    } finally {
      setIsBLParsing(false);
    }
  };

  const handleBLConfirm = () => {
    if (!blParseResult?.items) return;
    const eta = blParseResult.eta ?? formatDateInput(new Date());
    const validItems = blParseResult.items.filter(item => RAW_STOCK_TYPES.includes(item.type) && item.qty > 0);

    // DB에 B/L 전체 정보 저장 (bl_imports + raw_stock_receipts)
    blImportsApi.create({
      blNumber:        blParseResult.blNumber ?? "UNKNOWN",
      vessel:          blParseResult.vessel ?? null,
      originPort:      blParseResult.originPort ?? null,
      destinationPort: blParseResult.destinationPort ?? null,
      pickupAddress:   blParseResult.pickupAddress ?? null,
      deliveryAddress: blParseResult.deliveryAddress ?? null,
      eta,
      items: validItems.map(i => ({ materialType: i.type, quantity: i.qty })),
    }).catch(() => {});

    // UI 입고 일정 반영
    validItems.forEach((item) => {
      const entry = { id: Date.now() + Math.random(), type: item.type, qty: item.qty, expectedDate: eta };
      setIncomingRawStocks((cur) => [entry, ...cur]);
    });

    setBlParseResult(null);
    setIsBLModalOpen(false);
  };

  const handleAddIncomingRawStock = () => {
    const nextQty = Number(incomingRawStockForm.qty);

    if (
      !Number.isFinite(nextQty) ||
      nextQty <= 0 ||
      !incomingRawStockForm.expectedDate
    ) {
      return;
    }

    const nextIncomingRawStock = {
      id: Date.now(),
      type: incomingRawStockForm.type,
      qty: nextQty,
      expectedDate: incomingRawStockForm.expectedDate,
    };

    setIncomingRawStocks((current) => [nextIncomingRawStock, ...current]);

    setIncomingRawStockForm((current) => ({
      ...current,
      qty: 100,
      expectedDate: formatDateInput(new Date()),
    }));
    setIsIncomingRawStockModalOpen(false);

    // API 기록
    rawStocksApi.create({
      materialType: incomingRawStockForm.type,
      quantity: nextQty,
      receivedDate: incomingRawStockForm.expectedDate,
    }).catch(() => {});
  };

  const handleRemoveIncomingRawStock = (incomingId) => {
    setIncomingRawStocks((current) =>
      current.filter((item) => item.id !== incomingId),
    );
  };

  const handleIncomingRawStockExpectedDateChange = (incomingId, expectedDate) => {
    setIncomingRawStocks((current) =>
      current.map((item) =>
        item.id === incomingId ? { ...item, expectedDate } : item,
      ),
    );
  };

  const handleReceiveIncomingRawStock = (incomingId) => {
    const targetItem = incomingRawStocks.find((item) => item.id === incomingId);

    if (!targetItem) {
      return;
    }

    const receivedEntry = buildReceivedRawStockEntry(targetItem, new Date());

    setBaseRawStocks((current) => applyRawStockReceipts(current, [targetItem]));
    setReceivedRawStocks((current) => [receivedEntry, ...current]);
    setIncomingRawStocks((current) =>
      current.filter((item) => item.id !== incomingId),
    );
  };

  const handleRemoveReceivedRawStock = (receivedId) => {
    const targetItem = receivedRawStocks.find((item) => item.id === receivedId);

    if (!targetItem) {
      return;
    }

    const shouldDelete = window.confirm(
      `${getRawStockLabel(targetItem.type)} ${targetItem.qty.toLocaleString()}${getRawStockUnitLabel(
        targetItem.type,
      )} 입고 이력을 삭제할까요?\n현재 재고에서도 같은 수량이 차감됩니다.`,
    );

    if (!shouldDelete) {
      return;
    }

    clearReceivedUndoTimeout();

    setBaseRawStocks((current) => ({
      ...current,
      [targetItem.type]: Math.max(
        0,
        normalizeNonNegativeNumber(current[targetItem.type], 0) - targetItem.qty,
      ),
    }));
    setReceivedRawStocks((current) =>
      current.filter((item) => item.id !== receivedId),
    );
    setReceivedUndoInfo({
      item: targetItem,
      message: `${getRawStockLabel(targetItem.type)} ${targetItem.qty.toLocaleString()}${getRawStockUnitLabel(
        targetItem.type,
      )} 입고 이력을 삭제했습니다.`,
    });
    receivedUndoTimeoutRef.current = window.setTimeout(() => {
      setReceivedUndoInfo(null);
      receivedUndoTimeoutRef.current = null;
    }, 8000);
  };

  const handleUndoRemoveReceivedRawStock = () => {
    if (!receivedUndoInfo?.item) {
      return;
    }

    clearReceivedUndoTimeout();
    setBaseRawStocks((current) =>
      applyRawStockReceipts(current, [receivedUndoInfo.item]),
    );
    setReceivedRawStocks((current) => [receivedUndoInfo.item, ...current]);
    setReceivedUndoInfo(null);
  };

  const handleDeleteRawStock = (materialType) => {
    const currentQty = Math.max(0, currentRawStocks[materialType] ?? 0);
    if (currentQty <= 0) {
      return;
    }

    setBaseRawStocks((current) => ({
      ...current,
      [materialType]: current[materialType] - currentQty,
    }));
  };

  const isProductionRefreshBusy = isDiagnosing || isMachineAllocating;

  return (
    <div className="monochrome-ui flex h-screen overflow-hidden bg-black text-[11px] font-black uppercase tracking-tight text-zinc-200">
      <aside className="flex w-16 shrink-0 flex-col border-r border-slate-700 bg-zinc-900 md:w-64">
        <div className="flex items-center gap-3 border-b border-slate-800 p-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-700">
            <Settings size={20} className="text-white" />
          </div>
          <span className="hidden text-lg text-white md:block">MES PRO</span>
        </div>
        <nav className="mt-4 flex-1 space-y-1.5 px-3 text-[10px]">
          <NavItem icon={<TrendingUp size={18} />} label="생산" active={activeMenu === "production"} onClick={() => setActiveMenu("production")} />
          <NavItem icon={<ListOrdered size={18} />} label="수주" active={activeMenu === "orders"} onClick={() => setActiveMenu("orders")} />
          <NavItem icon={<Database size={18} />} label="재고" active={activeMenu === "inventory"} onClick={() => setActiveMenu("inventory")} />
          <NavItem icon={<Users size={18} />} label="거래처" active={activeMenu === "customers"} onClick={() => setActiveMenu("customers")} />
          <NavItem
            icon={<MessageSquare size={18} />}
            label="AI 채팅"
            active={isChatModalOpen}
            onClick={() => setIsChatModalOpen(true)}
          />
        </nav>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden bg-slate-950">
        <header className="flex h-14 items-center justify-between border-b border-slate-700 bg-zinc-900/80 px-6">
          <div className="flex items-center gap-2 text-[10px] tracking-widest text-white">
            {getMenuLabel(activeMenu)} 관리 화면
            {DEMO_MODE && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[8px] text-amber-300">
                데모 모드
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-zinc-600/30 bg-zinc-700/30 px-3 py-1 text-[9px] text-emerald-500">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            시스템 연결됨
          </div>
        </header>

        <div
          className={`flex-1 p-4 ${
            activeMenu === "production" ? "overflow-y-auto" : "overflow-hidden"
          }`}
        >
          {activeMenu === "production" && (
            <div className="flex min-h-full items-start gap-4">
              <div className="flex min-w-0 flex-[3] flex-col gap-4">
                <Panel title="A: 생산 운영 현황" accent="flex min-h-[44rem] flex-1 flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={productionDateFilter.startDate}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 outline-none"
                        onChange={(event) =>
                          handleProductionDateFilterChange("startDate", event.target.value)
                        }
                      />
                      <span className="text-[9px] text-slate-500">~</span>
                      <input
                        type="date"
                        value={productionDateFilter.endDate}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 outline-none"
                        onChange={(event) =>
                          handleProductionDateFilterChange("endDate", event.target.value)
                        }
                      />
                    </div>
                    <button
                      onClick={() => setExportModal("production")}
                      className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-1.5 text-[10px] text-slate-300 transition-colors hover:bg-slate-700"
                    >
                      <Download size={13} />
                      상세내역
                    </button>
                    <button
                      onClick={handleRefresh}
                      disabled={
                        (!selectedProductionOrder && activeProductionOrders.length === 0) ||
                        isProductionRefreshBusy
                      }
                      className="flex items-center gap-2 rounded-lg border border-zinc-500/30 bg-zinc-700 px-4 py-1.5 text-white transition-colors hover:bg-zinc-600 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                      <RefreshCw
                        size={14}
                        className={isProductionRefreshBusy ? "animate-spin" : ""}
                      />
                      AI 갱신
                    </button>
                    {/* 상태별 조회 */}
                    <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                      {[
                        { key: "active", label: "진행중" },
                        { key: "done",   label: "완료/취소" },
                        { key: "all",    label: "전체" },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setOrderStatusFilter(key)}
                          className={`rounded-md px-3 py-1 text-[10px] font-medium transition-colors ${
                            orderStatusFilter === key
                              ? "bg-blue-600 text-white"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {label}
                          {key === "active" && ` (${sortedOrders.filter(o => isActiveProductionOrderStatus(o.status)).length})`}
                          {key === "done"   && ` (${sortedOrders.filter(o => ["DONE","READY_TO_SHIP","CANCELLED"].includes(o.status)).length})`}
                          {key === "all"    && ` (${sortedOrders.length})`}
                        </button>
                      ))}
                    </div>
                    {lastProductionDiagnosisAt || lastMachineAllocationAt ? (
                      <div className="text-right text-[9px] text-slate-400">
                        {lastProductionDiagnosisAt ? (
                          <div>최근 진단: {lastProductionDiagnosisAt}</div>
                        ) : null}
                        {lastMachineAllocationAt ? (
                          <div>최근 배분: {lastMachineAllocationAt}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="min-h-[34rem] flex-1 overflow-auto">
                    <table className="min-w-[1160px] w-full border-collapse text-left">
                      <thead className="sticky top-0 bg-zinc-900 text-[9px] text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-center">우선순위</th>
                          <th className="px-4 py-3">오더번호</th>
                          <th className="px-4 py-3">거래처</th>
                          <th className="px-4 py-3">제품</th>
                          <th className="px-4 py-3 text-center">작업구분</th>
                          <th className="px-4 py-3 text-center">커팅</th>
                          <th className="px-4 py-3 text-center">납기</th>
                          <th className="px-4 py-3 text-right">수량</th>
                          <th className="px-4 py-3 text-center">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {filteredProductionOrders.map((order) => (
                          <tr
                            key={order.id}
                            onClick={() => handleRowClick(order)}
                            className={`cursor-pointer hover:bg-white/5 ${selectedOrderId === order.id ? "bg-white/10" : ""}`}
                          >
                            <td className="px-4 py-3 text-center">
                              <select
                                value={order.priority ?? ""}
                                className="rounded border border-slate-700 bg-slate-900 px-1 text-zinc-300"
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  handlePriorityChange(order.id, event.target.value);
                                }}
                              >
                                <option value="">-</option>
                                {PRIORITY_OPTIONS.map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-300">
                              {getOrderDisplayNumber(order)}
                            </td>
                            <td className="px-4 py-3 text-white">{order.customerName}</td>
                            <td className="px-4 py-3">
                              <span className="rounded border border-slate-700 bg-slate-900/50 px-2 py-0.5 text-slate-400">
                                {getProductTypeLabel(order.productType)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={order.jobType}
                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-zinc-300"
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  handleJobTypeChange(order.id, event.target.value);
                                }}
                              >
                                {ORDER_JOB_TYPE_OPTIONS.map((value) => (
                                  <option key={value} value={value}>
                                    {getOrderJobTypeLabel(value)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={getCuttingValue(order.productType, order.cutting)}
                                disabled={order.productType === PRODUCT_TYPE_OPTIONS[1]}
                                className={`rounded border px-1 outline-none ${
                                  order.productType === PRODUCT_TYPE_OPTIONS[1]
                                    ? "cursor-not-allowed border-slate-800 bg-slate-800 text-slate-500"
                                    : "border-slate-700 bg-slate-900 text-zinc-300"
                                }`}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  handleCuttingChange(order.id, event.target.value);
                                }}
                              >
                                {["Y", "N"].map((value) => (
                                  <option key={value} value={value}>
                                    {getCuttingLabel(value)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="date"
                                value={order.dueDate}
                                className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-zinc-300 outline-none"
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  handleDueDateChange(order.id, event.target.value);
                                }}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="font-mono text-zinc-300">
                                {order.quantity.toLocaleString()}
                              </div>
                              {orderAllocationSummaryByOrderId[order.id]?.allocatedQty > 0 ? (
                                <div className="mt-1 text-[8px] text-slate-500">
                                  배분 {orderAllocationSummaryByOrderId[order.id].allocatedQty.toLocaleString()} / 잔여{" "}
                                  {orderAllocationSummaryByOrderId[order.id].remainingQty.toLocaleString()}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={order.status}
                                className={`rounded border px-2 py-1 text-[10px] outline-none ${STATUS_CONFIG[order.status] ?? "border-slate-700 bg-slate-900 text-slate-200"}`}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  handleStatusChange(order.id, event.target.value);
                                }}
                              >
                                {ORDER_STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>
                                    {getOrderStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                        {filteredProductionOrders.length === 0 && (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-4 py-10 text-center text-[10px] text-slate-500"
                            >
                              선택한 기간에 해당하는 수주가 없습니다.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel title={`2공정 설비 현황 (${availableMachines2}대 가동 가능)`} accent="border-t-2 border-t-emerald-500/50">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 p-4">
                    <div className="text-[9px] text-slate-400">
                      가동 가능 설비를 선택한 뒤 `AI 갱신`을 누르면 AI API가 작업중 발주를 기계별로 배분합니다.
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] text-slate-300">
                        {machineAllocationSummary || "아직 배분 결과가 없습니다."}
                      </div>
                      <div className="text-[8px] text-slate-500">
                        배정 설비 {machineAllocationOverview.assignedMachineCount}대 / 총 배분 {machineAllocationOverview.totalAllocatedQty.toLocaleString()}개
                      </div>
                    </div>
                  </div>
                  <div className="grid min-h-[22rem] grid-cols-2 gap-3 overflow-y-auto p-4 md:grid-cols-3">
                    {machines2.map((machine) => {
                      const assignmentItems =
                        machineAssignmentItemsByMachineId[String(machine.id)] ?? [];
                      const usedHours = assignmentItems.reduce(
                        (sum, item) => sum + item.hours,
                        0,
                      );
                      const activeSession = machineActiveSessions[machine.id];
                      // progressTick 참조 → 1초마다 갱신 트리거
                      const elapsedProgress = activeSession
                        ? Math.min(
                            activeSession.targetQty,
                            Math.floor(
                              ((Date.now() - new Date(activeSession.startedAt).getTime() + progressTick * 0) / 3600000)
                              * activeSession.unitsPerHour
                            ),
                          )
                        : null;

                      return (
                        <div key={machine.id} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[8px] text-slate-400">{machine.name}</span>
                            <div className="flex items-center gap-2">
                              <div className={`h-2.5 w-2.5 rounded-full ${machine.status === MACHINE_STATUS_OPTIONS[0] ? "bg-emerald-500" : machine.status === MACHINE_STATUS_OPTIONS[1] ? "bg-blue-500" : "bg-red-500"}`} />
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[8px] ${getMachineStatusClass(
                                  machine.status,
                                )}`}
                              >
                                {getMachineStatusLabel(machine.status)}
                              </span>
                            </div>
                          </div>
                          <select
                            value={machine.status}
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-slate-200 outline-none"
                            onChange={(event) =>
                              handleMachineStatusChange(machine.id, event.target.value)
                            }
                          >
                            {MACHINE_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {getMachineStatusLabel(status)}
                              </option>
                            ))}
                          </select>

                          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                            <div className="flex items-center justify-between text-[8px] text-slate-500">
                              <span>AI 배분 발주</span>
                              <span>
                                사용 {usedHours.toFixed(1)}h / {getWorkingHoursPerDay().toFixed(1)}h
                              </span>
                            </div>

                            {assignmentItems.length > 0 ? (
                              <div className="mt-2 space-y-2">
                                {assignmentItems.map((item) => (
                                  <div
                                    key={item.id}
                                    className="rounded-lg border border-slate-800 bg-slate-900/80 p-2"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleRowClick(item.order)}
                                      className="font-mono text-[10px] text-cyan-300 transition-colors hover:text-cyan-200"
                                    >
                                      {item.orderNumber}
                                    </button>
                                    <div className="mt-1 text-[8px] text-slate-500">
                                      {getProductTypeLabel(item.order.productType)} / 납기 {item.order.dueDate}
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={item.qty}
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[10px] text-slate-200 outline-none"
                                        onChange={(event) =>
                                          handleMachineAssignmentQtyChange(
                                            machine.id,
                                            item.orderId,
                                            event.target.value,
                                          )
                                        }
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveMachineAssignment(
                                            machine.id,
                                            item.orderId,
                                          )
                                        }
                                        className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[8px] text-slate-500">
                                      <span>{item.hours.toFixed(1)}h 예상</span>
                                      <span>{item.qty.toLocaleString()}개</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mt-2 rounded-lg border border-dashed border-slate-800 bg-slate-950/40 px-3 py-4 text-[9px] text-slate-500">
                                {machine.status === MACHINE_STATUS_OPTIONS[2]
                                  ? "정비 필요 상태라 배분 대상에서 제외됩니다."
                                  : isMachineAllocating
                                    ? "AI가 이 설비의 작업 배분을 계산 중입니다..."
                                    : lastMachineAllocationAt
                                      ? "현재 배분된 발주가 없습니다."
                                      : "AI 갱신을 누르면 발주가 표시됩니다."}
                              </div>
                            )}
                          </div>

                          {/* 작업 시작 / 진행 현황 */}
                          {activeSession ? (
                            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2">
                              <div className="mb-1 text-[8px] text-slate-400">진행 현황</div>
                              <div className="mb-2 text-center font-mono text-sm font-semibold text-zinc-300">
                                {elapsedProgress.toLocaleString()} / {activeSession.targetQty.toLocaleString()}
                              </div>
                              <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.floor((elapsedProgress / activeSession.targetQty) * 100))}%` }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleMachineWorkDone(machine.id, elapsedProgress)}
                                className="w-full rounded-lg border border-zinc-600/40 bg-zinc-700/30 py-1.5 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-700/40"
                              >
                                작업 완료
                              </button>
                            </div>
                          ) : assignmentItems.length > 0 ? (
                            <div className="space-y-1">
                              {assignmentItems.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleMachineWorkStart(machine, item)}
                                  className="w-full rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-1.5 text-[10px] text-cyan-300 transition-colors hover:bg-cyan-500/20"
                                >
                                  작업 시작 — {item.orderNumber}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              </div>

                <aside className="flex min-w-[340px] flex-1 self-start flex-col gap-4">
                {!selectedProductionOrder ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-800 bg-slate-900/20 text-slate-700">
                    <Cpu size={48} className="opacity-10" />
                    <p className="text-[10px] tracking-widest">좌측 수주를 선택하면 생산 판단 결과를 확인할 수 있습니다.</p>
                  </div>
                ) : isDiagnosing ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-zinc-300">
                    <Loader2 className="animate-spin text-blue-500" size={40} />
                    <p className="text-[10px] tracking-widest">생산 판단을 계산하고 있습니다...</p>
                  </div>
                ) : diagnosis ? (
                  <>
                    <Panel title="상단: 오늘 작업량" accent="border-t-2 border-t-blue-500">
                      <div className="space-y-4 p-5">
                        {lastProductionDiagnosisAt ? (
                          <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-[9px] text-blue-200">
                            마지막 진단 시각: {lastProductionDiagnosisAt}
                          </div>
                        ) : null}
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3">
                          <div className="mb-1 text-[8px] text-slate-500">오늘 목표 수량 (납기 역산)</div>
                          <div className="font-mono text-lg text-blue-300">
                            {(diagnosis.B_Top?.todayTargetQty ?? 0).toLocaleString()}개
                          </div>
                          <div className="mt-1 text-[9px] text-slate-400">
                            예상 소요: {safeStr(diagnosis.B_Top?.todayTargetHours)}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-[8px] text-slate-500">컷팅 납기 현황</div>
                          {(diagnosis.B_Top?.urgentCuttingQty ?? 0) > 0 ? (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                              <div className="text-[8px] text-amber-400">긴급 (오늘·내일 납기)</div>
                              <div className="mt-1 font-mono text-[13px] text-amber-300">
                                {(diagnosis.B_Top?.urgentCuttingOrders?.length ?? 0)}건 · {(diagnosis.B_Top?.urgentCuttingQty ?? 0).toLocaleString()}개
                              </div>
                            </div>
                          ) : null}
                          {(diagnosis.B_Top?.futureCuttingQty ?? 0) > 0 ? (
                            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                              <div className="text-[8px] text-slate-500">여유 납기 컷팅</div>
                              <div className="mt-1 font-mono text-[13px] text-zinc-300">
                                {(diagnosis.B_Top?.futureCuttingOrders?.length ?? 0)}건 · {(diagnosis.B_Top?.futureCuttingQty ?? 0).toLocaleString()}개
                              </div>
                            </div>
                          ) : null}
                          {(diagnosis.B_Top?.urgentCuttingQty ?? 0) === 0 && (diagnosis.B_Top?.futureCuttingQty ?? 0) === 0 ? (
                            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400">
                              현재 컷팅 대상 없음
                            </div>
                          ) : null}
                          {((diagnosis.B_Top?.urgentCuttingQty ?? 0) > 0 || (diagnosis.B_Top?.futureCuttingQty ?? 0) > 0) && (
                            <div className="text-[9px] text-slate-500">
                              컷팅 예상 소요: {safeStr(diagnosis.B_Top?.cuttingTotalHours)}
                            </div>
                          )}
                        </div>
                      </div>
                    </Panel>

                    <Panel title="중단: 1차/2차 비교" accent="border-l-2 border-l-cyan-500">
                      <div className="space-y-3 p-5">
                        <div className="text-[9px] text-slate-400">
                          기준 제품: {safeStr(diagnosis.B_Mid?.productLabel)}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                            <div className="mb-1 text-[8px] text-slate-500">1차공정 보유 물량</div>
                            <div className="font-mono text-lg text-zinc-300">
                              {normalizeNonNegativeNumber(diagnosis.B_Mid?.firstProcessQty, 0).toLocaleString()}개
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                            <div className="mb-1 text-[8px] text-amber-400">긴급 납기 필요량</div>
                            <div className="font-mono text-lg text-amber-300">
                              {normalizeNonNegativeNumber(diagnosis.B_Mid?.secondProcessNeedQty, 0).toLocaleString()}개
                            </div>
                            {(diagnosis.B_Mid?.futureNeedQty ?? 0) > 0 && (
                              <div className="mt-1 text-[8px] text-slate-500">
                                여유납기 +{normalizeNonNegativeNumber(diagnosis.B_Mid?.futureNeedQty, 0).toLocaleString()}개
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-200">
                          {safeStr(diagnosis.B_Mid?.inventoryComment)}
                        </div>
                      </div>
                    </Panel>

                    <Panel title="하단: 총 작업 시간" accent="border-t-2 border-t-amber-500">
                      <div className="space-y-4 bg-gradient-to-br from-slate-900 to-slate-800 p-5">
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                          <div className="mb-1 text-[8px] text-slate-500">총 작업 시간</div>
                          <div className="text-2xl font-semibold text-amber-200">
                            {safeStr(diagnosis.B_Bottom?.todayWorkHours)}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-[9px] text-slate-400">
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                            1차공정 예상: {safeStr(diagnosis.B_Bottom?.firstProcessHours)}
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                            컷팅 예상: {safeStr(diagnosis.B_Bottom?.cuttingHours)}
                          </div>
                        </div>

                        {/* 수주별 일일 생산 필요량 */}
                        {activeProductionOrders.length > 0 && (
                          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
                            <div className="mb-2 text-[8px] tracking-widest text-slate-500">수주별 하루 생산 목표</div>
                            <div className="space-y-1.5">
                              {activeProductionOrders.map(o => {
                                const plan = todayFirstProcessPlan.byOrderId[o.id];
                                if (!plan || plan.todayRequiredQty <= 0) return null;
                                const isUrgent = plan.dueTodayOrPast || plan.workingDaysUntilDue <= 1;
                                return (
                                  <div key={o.id} className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className={isUrgent ? "text-red-400" : "text-slate-400"}>
                                        {o.orderNumber}
                                      </span>
                                      <span className="text-slate-600">
                                        {plan.dueTodayOrPast
                                          ? "납기초과"
                                          : `D-${plan.workingDaysUntilDue}일`}
                                      </span>
                                    </div>
                                    <span className={`font-mono font-semibold ${isUrgent ? "text-red-300" : "text-amber-200"}`}>
                                      {plan.todayRequiredQty.toLocaleString()}장/일
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2 text-[10px]">
                              <span className="text-slate-500">합계</span>
                              <span className="font-mono font-bold text-white">
                                {activeProductionOrders.reduce((sum, o) => {
                                  return sum + (todayFirstProcessPlan.byOrderId[o.id]?.todayRequiredQty ?? 0);
                                }, 0).toLocaleString()}장/일
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] text-blue-200">
                          {safeStr(diagnosis.B_Bottom?.finalComment)}
                        </div>
                      </div>
                    </Panel>
                  </>
                ) : null}
              </aside>
            </div>
          )}

          {activeMenu === "inventory" && (
            <div className="flex h-full flex-col gap-4 overflow-hidden">
              {receivedUndoInfo && (
                <div className="flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                  <div className="text-[10px] text-amber-200">
                    {receivedUndoInfo.message}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleUndoRemoveReceivedRawStock}
                      className="rounded-lg border border-zinc-600/30 bg-zinc-700/30 px-3 py-2 text-[10px] text-emerald-200 transition-colors hover:bg-zinc-700/40"
                    >
                      되돌리기
                    </button>
                    <button
                      onClick={() => {
                        clearReceivedUndoTimeout();
                        setReceivedUndoInfo(null);
                      }}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] text-slate-300 transition-colors hover:bg-slate-800"
                    >
                      닫기
                    </button>
                  </div>
                </div>
              )}

              <div className="flex min-h-0 gap-4 overflow-hidden">
              <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                <Panel title="1차 공정 작업 등록">
                  <div className="border-b border-slate-700 bg-slate-800/20 p-4">
                    <div className="grid grid-cols-[1.2fr_0.8fr_auto] gap-3">
                      <select
                        value={inventoryForm.type}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 outline-none"
                        onChange={(event) =>
                          handleInventoryFormChange("type", event.target.value)
                        }
                      >
                        {FIRST_PROCESS_TYPE_OPTIONS.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={inventoryForm.qty}
                        className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 outline-none"
                        onChange={(event) =>
                          handleInventoryFormChange("qty", event.target.value)
                        }
                      />
                      <button
                        onClick={handleAddInventory}
                        className="flex items-center justify-center gap-2 rounded-xl border border-purple-400/20 bg-purple-600 px-4 py-2 text-[10px] text-white transition-colors hover:bg-purple-500"
                      >
                        <Plus size={14} />
                        작업 등록
                      </button>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => setExportModal("firstProcess")}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[10px] text-slate-300 transition-colors hover:bg-slate-700"
                      >
                        <Download size={12} />
                        상세내역
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-b border-slate-700 bg-slate-900/20 p-4 xl:grid-cols-5">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">현재 총 작업량</div>
                      <div className="mt-1 font-mono text-lg text-purple-300">
                        {totalFirstProcessAvailableRolls.toLocaleString()}롤
                      </div>
                      <div className="mt-1 text-[8px] text-slate-500">
                        {totalFirstProcessAvailableQty.toLocaleString()}개 / 누적 등록{" "}
                        {workInventorySummary.totalRolls.toLocaleString()}롤
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">
                        {FIRST_PROCESS_TYPE_OPTIONS[0]} 현재
                      </div>
                      <div className="mt-1 font-mono text-lg text-zinc-300">
                        {normalizeNonNegativeNumber(
                          firstProcessAvailableRollsByProductType[
                            PRODUCT_TYPE_OPTIONS[0]
                          ],
                          0,
                        ).toLocaleString()}롤
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">
                        {FIRST_PROCESS_TYPE_OPTIONS[1]} 현재
                      </div>
                      <div className="mt-1 font-mono text-lg text-cyan-300">
                        {normalizeNonNegativeNumber(
                          firstProcessAvailableRollsByProductType[
                            PRODUCT_TYPE_OPTIONS[1]
                          ],
                          0,
                        ).toLocaleString()}롤
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">2차 완료 차감량</div>
                      <div className="mt-1 font-mono text-lg text-white">
                        {totalSecondProcessConsumedRolls.toLocaleString()}롤
                      </div>
                      <div className="mt-1 text-[8px] text-slate-500">
                        완료(DONE) 처리된 수량 기준 차감
                      </div>
                    </div>
                    {(() => {
                      // 1차 공정 재고 롤 vs 접수·작업중 발주 직접 비교
                      const careShortRolls = stockPlanningCoverageSummary.shortageRollsByProductType[PRODUCT_TYPE_OPTIONS[0]] ?? 0;
                      const stickerShortRolls = stockPlanningCoverageSummary.shortageRollsByProductType[PRODUCT_TYPE_OPTIONS[1]] ?? 0;
                      const careLabelShort = careShortRolls > 0;
                      const stickerLabelShort = stickerShortRolls > 0;
                      const hasShortage = careLabelShort || stickerLabelShort;
                      return (
                        <div className={`rounded-xl border p-3 ${hasShortage ? "border-red-500/30 bg-red-500/5" : "border-slate-800 bg-slate-900/70"}`}>
                          <div className="flex items-center gap-1.5">
                            {hasShortage && <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
                            <div className={`text-[8px] ${hasShortage ? "text-red-500" : "text-slate-500"}`}>부족한 재고</div>
                          </div>
                          {hasShortage ? (
                            <div className="mt-1.5 space-y-1">
                              {careLabelShort && (
                                <div>
                                  <div className="text-[11px] font-semibold text-red-500">케어라벨</div>
                                  <div className="text-[8px] text-red-500">{careShortRolls}롤 부족</div>
                                </div>
                              )}
                              {stickerLabelShort && (
                                <div>
                                  <div className="text-[11px] font-semibold text-red-500">스티커라벨</div>
                                  <div className="text-[8px] text-red-500">{stickerShortRolls}롤 부족</div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1 text-[11px] font-semibold text-zinc-200">정상</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex-1 overflow-auto p-3 text-xs">
                    <div className="mb-3 flex items-center gap-2 text-purple-400">
                      <History size={16} />
                      작업 이력
                    </div>
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 bg-zinc-900 text-[9px] text-slate-500">
                        <tr>
                          <th className="px-2 py-2">일시</th>
                          <th className="px-2 py-2">작업 유형</th>
                          <th className="px-2 py-2 text-right">수량</th>
                          <th className="px-2 py-2 text-right">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {workInventory.map((item) => (
                          <tr key={item.id}>
                            <td className="px-2 py-3 font-mono text-[10px] text-slate-500">{item.dateTime}</td>
                            <td className="px-2 py-3 text-[9px] text-purple-400">{item.type}</td>
                            <td className="px-2 py-3 text-right font-mono text-white">{item.qty} 롤</td>
                            <td className="px-2 py-3 text-right">
                              <button
                                onClick={() => handleRemoveInventory(item.id)}
                                className="inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel title="재고 AI 조언" accent="border-t-2 border-t-purple-500">
                  <div className="space-y-3 p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[9px] tracking-widest text-slate-500">
                        <Lightbulb size={14} className="text-purple-400" />
                        재고 추천
                      </div>
                      <button
                        onClick={runInventoryDiagnosis}
                        disabled={isInvDiagnosing}
                        className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-600/20 px-3 py-1.5 text-[10px] text-purple-300 transition-colors hover:bg-purple-600/40 disabled:opacity-50"
                      >
                        {isInvDiagnosing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                        AI 분석
                      </button>
                    </div>
                    <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-4 text-[11px] italic text-purple-300">
                      {isInvDiagnosing ? <Loader2 className="animate-spin text-purple-500" /> : `"${safeStr(invDiagnosis?.advice || "AI 분석 버튼을 눌러 재고 현황을 분석하세요.")}"`}
                    </div>
                  </div>
                </Panel>
              </div>

              <div className="flex flex-1 flex-col gap-4 overflow-hidden">
                <Panel title="원자재 재고" accent="flex min-h-0 flex-1 flex-col">
                  <div className="flex justify-end border-b border-slate-700 bg-slate-800/20 p-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExportModal("rawStocks")}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[10px] text-slate-300 transition-colors hover:bg-slate-700"
                      >
                        <Download size={12} />
                        상세내역
                      </button>
                      <button
                        onClick={() => { setBlParseResult(null); setIsBLModalOpen(true); }}
                        className="flex items-center justify-center gap-2 rounded-xl border border-violet-400/20 bg-violet-700 px-4 py-2 text-[10px] text-white transition-colors hover:bg-violet-600"
                      >
                        <Upload size={14} />
                        B/L 업로드
                      </button>
                      <button
                        onClick={() => setIsIncomingRawStockModalOpen(true)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-600 px-4 py-2 text-[10px] text-white transition-colors hover:bg-cyan-500"
                      >
                        <Plus size={14} />
                        입고 일정 등록
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
                    <div className="mb-2 flex items-center gap-2 text-zinc-300">
                      <Database size={16} />
                      현재 원자재 재고
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="mb-2 text-[9px] tracking-widest text-slate-500">
                        원자재 총계
                      </div>
                      <div className="text-[11px] text-white">
                        {getRawStockLabel(RAW_STOCK_TYPES[0])}{" "}
                        {normalizeNonNegativeNumber(
                          currentRawStocks[RAW_STOCK_TYPES[0]],
                          0,
                        ).toLocaleString()}
                        {getRawStockUnitLabel(RAW_STOCK_TYPES[0])} /{" "}
                        {getRawStockLabel(RAW_STOCK_TYPES[1])}{" "}
                        {normalizeNonNegativeNumber(
                          currentRawStocks[RAW_STOCK_TYPES[1]],
                          0,
                        ).toLocaleString()}
                        {getRawStockUnitLabel(RAW_STOCK_TYPES[1])} /{" "}
                        {getRawStockLabel(RAW_STOCK_TYPES[2])}{" "}
                        {normalizeNonNegativeNumber(
                          currentRawStocks[RAW_STOCK_TYPES[2]],
                          0,
                        ).toLocaleString()}
                        {getRawStockUnitLabel(RAW_STOCK_TYPES[2])}
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-slate-400">{getRawStockLabel(RAW_STOCK_TYPES[0])}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xl text-zinc-200">{currentRawStocks[RAW_STOCK_TYPES[0]].toLocaleString()}개</span>
                        <button
                          onClick={() => handleDeleteRawStock(RAW_STOCK_TYPES[0])}
                          className="inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-slate-400">{getRawStockLabel(RAW_STOCK_TYPES[1])}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xl text-zinc-300">{currentRawStocks[RAW_STOCK_TYPES[1]]}롤</span>
                        <button
                          onClick={() => handleDeleteRawStock(RAW_STOCK_TYPES[1])}
                          className="inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <span className="text-slate-400">{getRawStockLabel(RAW_STOCK_TYPES[2])}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xl text-cyan-400">{currentRawStocks[RAW_STOCK_TYPES[2]]}롤</span>
                        <button
                          onClick={() => handleDeleteRawStock(RAW_STOCK_TYPES[2])}
                          className="inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>


                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-[10px] text-white">입고 완료 이력</div>
                        <div className="text-[8px] text-slate-500">
                          {getRawStockLabel(RAW_STOCK_TYPES[0])} {receivedRawStockSummary[RAW_STOCK_TYPES[0]].toLocaleString()}{getRawStockUnitLabel(RAW_STOCK_TYPES[0])} / {getRawStockLabel(RAW_STOCK_TYPES[1])} {receivedRawStockSummary[RAW_STOCK_TYPES[1]]}{getRawStockUnitLabel(RAW_STOCK_TYPES[1])} / {getRawStockLabel(RAW_STOCK_TYPES[2])} {receivedRawStockSummary[RAW_STOCK_TYPES[2]]}{getRawStockUnitLabel(RAW_STOCK_TYPES[2])}
                        </div>
                      </div>

                      {receivedRawStocks.length > 0 ? (
                        <div className="max-h-56 space-y-2 overflow-auto">
                          {receivedRawStocks.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-[1fr_0.8fr_0.8fr_auto_auto] items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3"
                            >
                              <div className="font-mono text-[10px] text-slate-400">
                                {item.dateTime}
                              </div>
                              <div className="text-[10px] text-white">{getRawStockLabel(item.type)}</div>
                              <div className="text-right font-mono text-[10px] text-zinc-300">
                                {item.qty.toLocaleString()} {getRawStockUnitLabel(item.type)}
                              </div>
                              <div className="rounded-full border border-zinc-600/30 bg-zinc-700/30 px-2 py-1 text-[8px] text-zinc-300">
                                입고 완료
                              </div>
                              <button
                                onClick={() => handleRemoveReceivedRawStock(item.id)}
                                className="inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                                title="입고 이력 삭제"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-center text-[10px] text-slate-500">
                          아직 입고 완료 이력이 없습니다.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-[10px] text-white">입고 일정 목록</div>
                        <div className="text-[8px] text-slate-500">
                          {getRawStockLabel(RAW_STOCK_TYPES[0])} {incomingRawStockSummary[RAW_STOCK_TYPES[0]].toLocaleString()}{getRawStockUnitLabel(RAW_STOCK_TYPES[0])} / {getRawStockLabel(RAW_STOCK_TYPES[1])} {incomingRawStockSummary[RAW_STOCK_TYPES[1]]}{getRawStockUnitLabel(RAW_STOCK_TYPES[1])} / {getRawStockLabel(RAW_STOCK_TYPES[2])} {incomingRawStockSummary[RAW_STOCK_TYPES[2]]}{getRawStockUnitLabel(RAW_STOCK_TYPES[2])}
                        </div>
                      </div>

                      {incomingRawStocks.length > 0 ? (
                        <div className="max-h-56 space-y-2 overflow-auto">
                          {incomingRawStocks.map((item) => (
                            <div
                              key={item.id}
                              className="grid grid-cols-[0.8fr_0.7fr_1fr_auto_auto] items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3"
                            >
                              <div className="text-[10px] text-white">{getRawStockLabel(item.type)}</div>
                              <div className="text-right font-mono text-[10px] text-cyan-300">
                                {item.qty.toLocaleString()} {getRawStockUnitLabel(item.type)}
                              </div>
                              <input
                                type="date"
                                value={item.expectedDate}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] text-slate-200 outline-none"
                                onChange={(event) =>
                                  handleIncomingRawStockExpectedDateChange(
                                    item.id,
                                    event.target.value,
                                  )
                                }
                              />
                              <button
                                onClick={() => handleReceiveIncomingRawStock(item.id)}
                                className="rounded-lg border border-zinc-600/30 bg-zinc-700/30 px-3 py-2 text-[10px] text-zinc-300 transition-colors hover:bg-zinc-700/40"
                              >
                                입고 완료
                              </button>
                              <button
                                onClick={() => handleRemoveIncomingRawStock(item.id)}
                                className="inline-flex items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition-colors hover:bg-red-500/20"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-4 text-center text-[10px] text-slate-500">
                          등록된 입고 예정 자재가 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                </Panel>

                <Panel title={`창고 설비 현황 (${inventoryMachineStatusSummary.available}대 가동 가능 / 총 ${inventoryMachines.length}대)`} accent="border-t-2 border-t-emerald-500/50">
                  <div className="grid grid-cols-3 gap-3 border-b border-slate-700 bg-slate-800/20 p-4 text-center">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">가동 가능</div>
                      <div className="mt-1 text-lg text-zinc-300">{inventoryMachineStatusSummary.available}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">가동 중</div>
                      <div className="mt-1 text-lg text-zinc-300">{inventoryMachineStatusSummary.working}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">정비 필요</div>
                      <div className="mt-1 text-lg text-red-300">{inventoryMachineStatusSummary.blocked}</div>
                    </div>
                  </div>

                  <div className="space-y-3 overflow-auto p-4">
                    {inventoryMachines.map((machine) => (
                      <div
                        key={machine.id}
                        className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                      >
                        <div>
                          <div className="text-[10px] text-white">{machine.name}</div>
                          <div className="mt-1 text-[8px] text-slate-500">설비 상태를 업데이트하면 입고 및 재고 작업 흐름을 함께 관리할 수 있습니다.</div>
                        </div>
                        <select
                          value={machine.status}
                          className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 outline-none"
                          onChange={(event) =>
                            handleInventoryMachineStatusChange(machine.id, event.target.value)
                          }
                        >
                          {MACHINE_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {getMachineStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              </div>
            </div>
          )}

          {activeMenu === "orders" && (
            <div className="flex h-full gap-4 overflow-hidden">
              <div className="flex min-w-0 flex-[2.3] flex-col gap-4 overflow-hidden">
                <Panel title="수주 관리" accent="border-t-2 border-t-blue-500">
                  <div className="grid grid-cols-2 gap-3 border-b border-slate-700 bg-slate-800/20 p-4 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">총 수주</div>
                      <div className="mt-1 text-lg text-white">{orderSummary.totalCount}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">진행 수주</div>
                      <div className="mt-1 text-lg text-zinc-300">{orderSummary.pendingCount}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">긴급 수주</div>
                      <div className="mt-1 text-lg text-amber-300">{orderSummary.urgentCount}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <div className="text-[8px] text-slate-500">총 수량</div>
                      <div className="mt-1 text-lg text-zinc-300">
                        {orderSummary.totalQty.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end border-b border-slate-700 bg-slate-800/10 p-4">
                    <button
                      onClick={() => setIsOrderModalOpen(true)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-zinc-500/20 bg-zinc-700 px-4 py-2 text-[10px] text-white transition-colors hover:bg-zinc-600"
                    >
                      <Plus size={14} />
                      수주 추가
                    </button>
                  </div>

                  <div className="flex-1 overflow-auto">
                    <table className="min-w-[1060px] w-full border-collapse text-left">
                      <thead className="sticky top-0 z-10 bg-zinc-900 text-[9px] text-slate-500">
                        <tr>
                          <th className="px-4 py-3">오더번호</th>
                          <th className="px-4 py-3">거래처</th>
                          <th className="px-4 py-3">제품</th>
                          <th className="px-4 py-3 text-center">작업구분</th>
                          <th className="px-4 py-3 text-center">우선순위</th>
                          <th className="px-4 py-3 text-center">커팅</th>
                          <th className="px-4 py-3 text-center">납기</th>
                          <th className="px-4 py-3 text-right">수량</th>
                          <th className="px-4 py-3 text-center">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {sortedOrders.map((order) => (
                          <tr
                            key={order.id}
                            onClick={() => setSelectedOrderId(order.id)}
                            className={`cursor-pointer transition-colors hover:bg-white/5 ${selectedOrder?.id === order.id ? "bg-white/10" : ""}`}
                          >
                            <td className="px-4 py-3 font-mono text-slate-300">
                              {getOrderDisplayNumber(order)}
                            </td>
                            <td className="px-4 py-3 text-white">{order.customerName}</td>
                            <td className="px-4 py-3">
                              <span className="rounded border border-slate-700 bg-slate-900/50 px-2 py-0.5 text-slate-400">
                                {getProductTypeLabel(order.productType)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="rounded border border-slate-700 bg-slate-900/50 px-2 py-0.5 text-slate-300">
                                {getOrderJobTypeLabel(order.jobType)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {getPriorityLabel(order.priority)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                value={getCuttingValue(order.productType, order.cutting)}
                                disabled={order.productType === PRODUCT_TYPE_OPTIONS[1]}
                                className={`rounded border px-1 outline-none ${
                                  order.productType === PRODUCT_TYPE_OPTIONS[1]
                                    ? "cursor-not-allowed border-slate-800 bg-slate-800 text-slate-500"
                                    : "border-slate-700 bg-slate-900 text-zinc-300"
                                }`}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) => {
                                  event.stopPropagation();
                                  handleCuttingChange(order.id, event.target.value);
                                }}
                              >
                                {["Y", "N"].map((value) => (
                                  <option key={value} value={value}>
                                    {getCuttingLabel(value)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-center font-mono text-zinc-300">{order.dueDate}</td>
                            <td className="px-4 py-3 text-right font-mono text-zinc-300">
                              {order.quantity.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`rounded-full border px-2 py-0.5 text-[8px] ${STATUS_CONFIG[order.status] ?? ""}`}>
                                {getOrderStatusLabel(order.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>

              <aside className="flex min-w-[340px] flex-1 flex-col gap-4 overflow-y-auto">
                <Panel title="수주 상세" accent="border-t-2 border-t-cyan-500">
                  <div className="space-y-4 p-5">
                    {selectedOrder ? (
                      <>
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <div className="text-[8px] text-slate-500">오더번호</div>
                          <div className="mt-1 font-mono text-white">
                            {getOrderDisplayNumber(selectedOrder)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <div className="text-[8px] text-slate-500">거래처</div>
                            <div className="mt-1 text-white">{selectedOrder.customerName}</div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <div className="text-[8px] text-slate-500">제품</div>
                            <div className="mt-1 text-white">{getProductTypeLabel(selectedOrder.productType)}</div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <div className="text-[8px] text-slate-500">작업구분</div>
                            <div className="mt-1 text-white">
                              {getOrderJobTypeLabel(selectedOrder.jobType)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <div className="text-[8px] text-slate-500">납기일</div>
                            <div className="mt-1 font-mono text-zinc-300">{selectedOrder.dueDate}</div>
                          </div>
                          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                            <div className="text-[8px] text-slate-500">수량</div>
                            <div className="mt-1 font-mono text-zinc-300">
                              {selectedOrder.quantity.toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                          <div className="mb-3 text-[8px] text-slate-500">상태 정보</div>
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="text-slate-400">우선순위</span>
                            <span className="text-white">
                              {getPriorityLabel(selectedOrder.priority)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="text-slate-400">커팅</span>
                            <span className="text-white">
                              {getCuttingLabel(
                                getCuttingValue(selectedOrder.productType, selectedOrder.cutting),
                              )}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-slate-400">상태</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[8px] ${STATUS_CONFIG[selectedOrder.status] ?? ""}`}>
                              {getOrderStatusLabel(selectedOrder.status)}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-6 text-center text-slate-500">
                        선택된 수주가 없습니다.
                      </div>
                    )}
                  </div>
                </Panel>
              </aside>
            </div>
          )}
          {activeMenu === "customers" && (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md rounded-2xl border border-slate-700 bg-zinc-900 p-8 text-center shadow-2xl">
                <div className="mb-3 text-sm text-white">
                  거래처 화면 준비 중
                </div>
                <p className="normal-case text-slate-400">
                  거래처별 담당자, 연락처, 최근 수주 이력처럼 필요한 정보를 한곳에서 관리할 수 있도록 준비 중인 화면입니다. 다음 단계에서 고객 관리 기능을 붙이기 좋도록 먼저 기본 구조를 마련해 두었습니다.
                </p>
              </div>
            </div>
          )}

          {isOrderModalOpen && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-zinc-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-700 p-5">
                  <div>
                    <div className="text-sm text-white">수주 추가</div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      거래처, 제품, 수량을 입력하면 새 수주가 즉시 등록됩니다.
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOrderModalOpen(false)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    닫기
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="mb-2 block text-[9px] tracking-widest text-slate-500">
                      거래처
                    </label>
                    <select
                      value={orderForm.customerName}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-[11px] text-slate-200 outline-none"
                      onChange={(event) =>
                        handleOrderFormChange("customerName", event.target.value)
                      }
                    >
                      {CUSTOMER_OPTIONS.map((customerName) => (
                        <option key={customerName} value={customerName}>
                          {customerName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-[9px] tracking-widest text-slate-500">
                      제품
                    </label>
                    <select
                      value={orderForm.productType}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-[11px] text-slate-200 outline-none"
                      onChange={(event) =>
                        handleOrderFormChange("productType", event.target.value)
                      }
                    >
                      {PRODUCT_TYPE_OPTIONS.map((productType) => (
                        <option key={productType} value={productType}>
                          {getProductTypeLabel(productType)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-[9px] tracking-widest text-slate-500">
                      수량
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={orderForm.quantity}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-[11px] text-slate-200 outline-none"
                      onChange={(event) =>
                        handleOrderFormChange("quantity", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-700 p-5">
                  <button
                    onClick={() => setIsOrderModalOpen(false)}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-[10px] text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAddOrder}
                    className="flex items-center gap-2 rounded-xl border border-zinc-500/20 bg-zinc-700 px-4 py-2 text-[10px] text-white transition-colors hover:bg-zinc-600"
                  >
                    <Plus size={14} />
                    수주 등록
                  </button>
                </div>
              </div>
            </div>
          )}

          {isBLModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-700 p-5">
                  <div className="text-sm font-semibold text-white">B/L 업로드 — 원자재 입고 자동 등록</div>
                  <button onClick={() => setIsBLModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                </div>

                {!blParseResult ? (
                  <div className="space-y-4 p-5">
                    {isBLParsing ? (
                      <div className="flex flex-col items-center gap-3 py-8 text-slate-400">
                        <Loader2 size={28} className="animate-spin text-violet-400" />
                        <span className="text-[11px]">Gemini AI가 B/L을 분석 중입니다...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-[11px] text-slate-400">B/L 이미지 또는 PDF를 업로드하면 자재 품목·수량·ETA를 자동으로 추출해 입고 일정에 등록합니다.</p>
                        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-600 p-8 transition-colors hover:border-violet-500">
                          <Upload size={28} className="text-slate-500" />
                          <span className="text-[11px] text-slate-400">파일 선택 (이미지 / PDF)</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => handleBLFile(e.target.files?.[0])}
                          />
                        </label>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 p-5">
                    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-[11px] text-slate-300">
                      <div className="mb-1 font-semibold text-slate-200">B/L No. {blParseResult.blNumber ?? "-"}</div>
                      <div className="text-slate-400">ETA: {blParseResult.eta ?? "-"}</div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] tracking-widest text-slate-500">추출된 품목</div>
                      {blParseResult.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-[11px]">
                          <span className="text-slate-200">{getRawStockLabel(item.type)}</span>
                          <span className="font-mono text-cyan-400">{item.qty.toLocaleString()}{getRawStockUnitLabel(item.type)}</span>
                          {item.description && <span className="text-[10px] text-slate-500">{item.description}</span>}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button onClick={() => setBlParseResult(null)} className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-[10px] text-slate-300 hover:bg-slate-800">다시 업로드</button>
                      <button onClick={handleBLConfirm} className="rounded-xl border border-violet-400/20 bg-violet-700 px-4 py-2 text-[10px] text-white hover:bg-violet-600">입고 일정에 등록</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {isIncomingRawStockModalOpen && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-zinc-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-700 p-5">
                  <div>
                    <div className="text-sm text-white">입고 일정 등록</div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      원자재 종류, 수량, 예정일을 입력하면 입고 일정 목록에 바로 추가됩니다.
                    </div>
                  </div>
                  <button
                    onClick={() => setIsIncomingRawStockModalOpen(false)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    닫기
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="mb-2 block text-[9px] tracking-widest text-slate-500">
                      원자재 종류
                    </label>
                    <select
                      value={incomingRawStockForm.type}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-[11px] text-slate-200 outline-none"
                      onChange={(event) =>
                        handleIncomingRawStockFormChange("type", event.target.value)
                      }
                    >
                      {RAW_STOCK_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {getRawStockLabel(type)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-[9px] tracking-widest text-slate-500">
                      수량
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={incomingRawStockForm.qty}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-[11px] text-slate-200 outline-none"
                      onChange={(event) =>
                        handleIncomingRawStockFormChange("qty", event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[9px] tracking-widest text-slate-500">
                      입고 예정일
                    </label>
                    <input
                      type="date"
                      value={incomingRawStockForm.expectedDate}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-[11px] text-slate-200 outline-none"
                      onChange={(event) =>
                        handleIncomingRawStockFormChange("expectedDate", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-700 p-5">
                  <button
                    onClick={() => setIsIncomingRawStockModalOpen(false)}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-[10px] text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAddIncomingRawStock}
                    className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-600 px-4 py-2 text-[10px] text-white transition-colors hover:bg-cyan-500"
                  >
                    <Plus size={14} />
                    입고 일정 추가
                  </button>
                </div>
              </div>
            </div>
          )}

          {exportModal && (
            <ExportModal
              type={exportModal}
              orders={orders}
              workInventory={workInventory}
              incomingRawStocks={incomingRawStocks}
              onClose={() => setExportModal(null)}
            />
          )}

          {isChatModalOpen && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
              <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-zinc-900 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-700 p-5">
                  <div className="flex items-center gap-2 text-sm text-white">
                    <MessageSquare size={16} className="text-cyan-300" />
                    AI 채팅
                  </div>
                  <button
                    onClick={() => setIsChatModalOpen(false)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    닫기
                  </button>
                </div>
                <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
                  <MessageSquare size={40} className="text-slate-600" />
                  <div className="text-base font-semibold text-slate-300">개발 준비중</div>
                  <div className="text-[11px] leading-relaxed text-slate-500">
                    MES 데이터를 기반으로 재고, 수주, 납기, 설비 상태를 분석하는<br />AI 채팅 기능을 준비하고 있습니다.
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}


