// ========================================
// Driver Timer Version 0.6（機能別ファイル構成）
// ========================================

"use strict";

const STORAGE_KEY = "driverTimer_v0_4b";
const LEGACY_STORAGE_KEY = "driverTimer_v0_3";
const OLD_STORAGE_KEY = "driverTimer_v0_2";

const REST_THRESHOLD_MS = 3 * 60 * 60 * 1000;
const STANDARD_RESTRAINT_MS = 13 * 60 * 60 * 1000;
const WEEKLY_COUNT_THRESHOLD_MS = 14 * 60 * 60 * 1000;
const WARNING_RESTRAINT_MS = 15 * 60 * 60 * 1000;
const MANAGER_CONTACT_THRESHOLD_MS = STANDARD_RESTRAINT_MS;

const EVENT_DEFINITIONS = {
  start: { label: "始業", mode: "working" },
  break: { label: "休憩開始", mode: "break" },
  rest: { label: "休息開始", mode: "rest" },
  resume: { label: "業務再開", mode: "working" },
  end: { label: "終業", mode: "ended" }
};

let state = {
  events: [],
  managerContact: { contactedAt: null },
  history: [],
  archivedRecordId: null
};

let editingEventId = null;
let selectedHistoryRecordId = null;
function startOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

let calendarCursor = startOfMonth(new Date());

const elements = {
  currentClock: document.getElementById("currentClock"),
  timerTabButton: document.getElementById("timerTabButton"),
  calendarTabButton: document.getElementById("calendarTabButton"),
  timerView: document.getElementById("timerView"),
  calendarView: document.getElementById("calendarView"),

  statusText: document.getElementById("statusText"),
  statusBadge: document.getElementById("statusBadge"),
  restraintTime: document.getElementById("restraintTime"),
  elapsedTime: document.getElementById("elapsedTime"),
  workTime: document.getElementById("workTime"),
  breakTime: document.getElementById("breakTime"),
  validRestTime: document.getElementById("validRestTime"),
  progressBar: document.getElementById("progressBar"),
  remainingText: document.getElementById("remainingText"),

  restInfo: document.getElementById("restInfo"),
  restCurrentTime: document.getElementById("restCurrentTime"),
  restMessage: document.getElementById("restMessage"),

  startButton: document.getElementById("startButton"),
  workButtons: document.getElementById("workButtons"),
  breakButton: document.getElementById("breakButton"),
  restButton: document.getElementById("restButton"),
  resumeButton: document.getElementById("resumeButton"),
  endButton: document.getElementById("endButton"),
  resetButton: document.getElementById("resetButton"),

  managerContactPanel: document.getElementById("managerContactPanel"),
  managerContactTitle: document.getElementById("managerContactTitle"),
  managerContactMessage: document.getElementById("managerContactMessage"),
  managerContactTime: document.getElementById("managerContactTime"),
  managerContactButton: document.getElementById("managerContactButton"),

  timeline: document.getElementById("timeline"),

  editModal: document.getElementById("editModal"),
  editEventLabel: document.getElementById("editEventLabel"),
  editDateTime: document.getElementById("editDateTime"),
  editError: document.getElementById("editError"),
  saveEditButton: document.getElementById("saveEditButton"),
  cancelEditButton: document.getElementById("cancelEditButton"),
  deleteEventButton: document.getElementById("deleteEventButton"),

  previousMonthButton: document.getElementById("previousMonthButton"),
  nextMonthButton: document.getElementById("nextMonthButton"),
  todayMonthButton: document.getElementById("todayMonthButton"),
  calendarMonthTitle: document.getElementById("calendarMonthTitle"),
  calendarGrid: document.getElementById("calendarGrid"),
  weeklySummaryList: document.getElementById("weeklySummaryList"),

  detailModal: document.getElementById("detailModal"),
  detailModalTitle: document.getElementById("detailModalTitle"),
  closeDetailButton: document.getElementById("closeDetailButton"),
  detailJudgment: document.getElementById("detailJudgment"),
  detailStart: document.getElementById("detailStart"),
  detailEnd: document.getElementById("detailEnd"),
  detailElapsed: document.getElementById("detailElapsed"),
  detailRestraint: document.getElementById("detailRestraint"),
  detailWork: document.getElementById("detailWork"),
  detailBreak: document.getElementById("detailBreak"),
  detailRest: document.getElementById("detailRest"),
  detailContact: document.getElementById("detailContact"),
  detailTimeline: document.getElementById("detailTimeline"),
  deleteHistoryButton: document.getElementById("deleteHistoryButton")
};
