// ========================================
// タイムライン編集モーダル
// ========================================

"use strict";

function openModal(modal) {
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal(modal) {
  modal.classList.add("hidden");

  const anyOpen = [elements.editModal, elements.detailModal].some(
    function(item) {
      return !item.classList.contains("hidden");
    }
  );

  if (!anyOpen) {
    document.body.classList.remove("modal-open");
  }
}

function openEditModal(eventId) {
  const event = state.events.find(function(item) {
    return item.id === eventId;
  });

  if (!event) {
    return;
  }

  editingEventId = event.id;
  elements.editEventLabel.textContent =
    EVENT_DEFINITIONS[event.type].label;
  elements.editDateTime.value = formatDateTimeLocal(event.time);
  hideEditError();

  elements.deleteEventButton.disabled = event.type === "start";
  elements.deleteEventButton.textContent =
    event.type === "start"
      ? "始業は削除できません"
      : "この記録を削除";

  openModal(elements.editModal);
}

function closeEditModal() {
  editingEventId = null;
  closeModal(elements.editModal);
  hideEditError();
}

function showEditError(message) {
  elements.editError.textContent = message;
  elements.editError.classList.remove("hidden");
}

function hideEditError() {
  elements.editError.textContent = "";
  elements.editError.classList.add("hidden");
}

function validateEditedTime(eventIndex, newTime) {
  if (!isValidDate(newTime)) {
    return {
      valid: false,
      message: "正しい日付と時刻を入力してください。"
    };
  }

  const previousEvent = state.events[eventIndex - 1];
  const nextEvent = state.events[eventIndex + 1];

  if (previousEvent && newTime <= previousEvent.time) {
    return {
      valid: false,
      message:
        `前の記録「${EVENT_DEFINITIONS[previousEvent.type].label}」より後の時刻を入力してください。`
    };
  }

  if (nextEvent && newTime >= nextEvent.time) {
    return {
      valid: false,
      message:
        `次の記録「${EVENT_DEFINITIONS[nextEvent.type].label}」より前の時刻を入力してください。`
    };
  }

  return { valid: true, message: "" };
}

function saveEditedEvent() {
  const eventIndex = state.events.findIndex(function(event) {
    return event.id === editingEventId;
  });

  if (eventIndex === -1) {
    closeEditModal();
    return;
  }

  if (!elements.editDateTime.value) {
    showEditError("日付と時刻を入力してください。");
    return;
  }

  const newTime = new Date(elements.editDateTime.value);
  const validation = validateEditedTime(eventIndex, newTime);

  if (!validation.valid) {
    showEditError(validation.message);
    return;
  }

  state.events[eventIndex].time = newTime;
  sortEvents();
  syncEndedShiftToHistory();
  saveState();
  renderTimeline();
  renderCalendar();
  updateInterface();
  closeEditModal();
}

function deleteEditedEvent() {
  const event = state.events.find(function(item) {
    return item.id === editingEventId;
  });

  if (!event) {
    closeEditModal();
    return;
  }

  if (event.type === "start") {
    showEditError(
      "始業記録は削除できません。勤務記録全体を消す場合は「現在の記録をリセット」を使用してください。"
    );
    return;
  }

  const shouldDelete = window.confirm(
    `${formatClock(event.time)}の「${EVENT_DEFINITIONS[event.type].label}」を削除しますか？\n\n削除後、各時間は自動で再計算されます。`
  );

  if (!shouldDelete) {
    return;
  }

  state.events = state.events.filter(function(item) {
    return item.id !== editingEventId;
  });

  if (event.type === "end") {
    if (state.archivedRecordId) {
      state.history = state.history.filter(function(record) {
        return record.id !== state.archivedRecordId;
      });
    }
    state.archivedRecordId = null;
  } else {
    syncEndedShiftToHistory();
  }

  saveState();
  renderTimeline();
  renderCalendar();
  updateInterface();
  closeEditModal();
}
