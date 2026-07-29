// ========================================
// Driver Timer Version 0.6
// イベント登録・初期起動
// ========================================
"use strict";

elements.timerTabButton.addEventListener("click", function() {
  switchView("timer");
});

elements.calendarTabButton.addEventListener("click", function() {
  switchView("calendar");
});

elements.startButton.addEventListener("click", function() {
  if (getCurrentMode() === "ended") {
    state.events = [];
    state.managerContact = { contactedAt: null };
    state.archivedRecordId = null;
  }

  addEvent("start", new Date());
});

elements.breakButton.addEventListener("click", function() {
  addEvent("break", new Date());
});

elements.restButton.addEventListener("click", function() {
  addEvent("rest", new Date());
});

elements.resumeButton.addEventListener("click", function() {
  addEvent("resume", new Date());
});

elements.endButton.addEventListener("click", function() {
  　alert("終業ボタンが押されました");
  const shouldEnd = window.confirm(
    "現在の勤務を終業しますか？\n\n終業すると勤務カレンダーへ自動保存されます。"
  );

  if (shouldEnd) {
    addEvent("end", new Date());
  }
});

elements.managerContactButton.addEventListener("click", function() {
  const isContacted = isValidDate(state.managerContact.contactedAt);

  if (isContacted) {
    const shouldCancel = window.confirm(
      "営業所長への連絡済み記録を取り消しますか？"
    );

    if (!shouldCancel) {
      return;
    }

    state.managerContact.contactedAt = null;
  } else {
    const shouldSave = window.confirm(
      "営業所長への連絡は完了しましたか？\n\n「OK」を押すと連絡済みとして記録します。"
    );

    if (!shouldSave) {
      return;
    }

    state.managerContact.contactedAt = new Date();
  }

  syncEndedShiftToHistory();
  saveState();
  renderCalendar();
  updateInterface();
});

elements.resetButton.addEventListener("click", function() {
  if (!state.events.length) {
    return;
  }

  const message =
    getCurrentMode() === "ended" && state.archivedRecordId
      ? "現在表示中の勤務記録をリセットしますか？\n\nカレンダーに保存済みの勤務履歴は残ります。"
      : "現在の勤務記録をリセットしますか？";

  const shouldReset = window.confirm(message);

  if (!shouldReset) {
    return;
  }

  state.events = [];
  state.managerContact = { contactedAt: null };
  state.archivedRecordId = null;

  saveState();
  renderTimeline();
  renderCalendar();
  updateInterface();
});

elements.saveEditButton.addEventListener("click", saveEditedEvent);
elements.cancelEditButton.addEventListener("click", closeEditModal);
elements.deleteEventButton.addEventListener("click", deleteEditedEvent);

elements.editModal
  .querySelector(".modal-backdrop")
  .addEventListener("click", closeEditModal);

elements.previousMonthButton.addEventListener("click", function() {
  calendarCursor = addMonths(calendarCursor, -1);
  renderCalendar();
});

elements.nextMonthButton.addEventListener("click", function() {
  calendarCursor = addMonths(calendarCursor, 1);
  renderCalendar();
});

elements.todayMonthButton.addEventListener("click", function() {
  calendarCursor = startOfMonth(new Date());
  renderCalendar();
});

elements.closeDetailButton.addEventListener("click", closeHistoryDetail);

elements.detailModal
  .querySelector(".modal-backdrop")
  .addEventListener("click", closeHistoryDetail);

elements.deleteHistoryButton.addEventListener(
  "click",
  deleteSelectedHistoryRecord
);

window.addEventListener("keydown", function(event) {
  if (event.key !== "Escape") {
    return;
  }

  if (!elements.detailModal.classList.contains("hidden")) {
    closeHistoryDetail();
  } else if (!elements.editModal.classList.contains("hidden")) {
    closeEditModal();
  }
});

window.addEventListener("beforeunload", saveState);

loadState();
renderTimeline();
renderCalendar();
updateInterface();

window.setInterval(updateInterface, 1000);
window.setInterval(saveState, 30000);
