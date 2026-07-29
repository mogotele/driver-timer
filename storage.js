// ========================================
// localStorage・履歴保存・旧バージョン移行
// ========================================

"use strict";

function serializeEvents(events) {
  return events.map(function(event) {
    return {
      id: event.id,
      type: event.type,
      time: event.time.toISOString()
    };
  });
}

function deserializeEvents(events) {
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .filter(function(event) {
      return event && EVENT_DEFINITIONS[event.type] && event.time;
    })
    .map(function(event) {
      return {
        id: event.id || createId(),
        type: event.type,
        time: new Date(event.time)
      };
    })
    .filter(function(event) {
      return isValidDate(event.time);
    })
    .sort(function(first, second) {
      return first.time - second.time;
    });
}

function serializeHistoryRecord(record) {
  return {
    id: record.id,
    dateKey: record.dateKey,
    managerContact: {
      contactedAt:
        record.managerContact && record.managerContact.contactedAt
          ? record.managerContact.contactedAt.toISOString()
          : null
    },
    events: serializeEvents(record.events),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function deserializeHistoryRecord(record) {
  if (!record || !record.id) {
    return null;
  }

  const events = deserializeEvents(record.events);
  const startEvent = events.find(function(event) {
    return event.type === "start";
  });
  const endEvent = events.find(function(event) {
    return event.type === "end";
  });

  if (!startEvent || !endEvent) {
    return null;
  }

  return {
    id: record.id,
    dateKey: record.dateKey || toDateKey(startEvent.time),
    managerContact: {
      contactedAt:
        record.managerContact && record.managerContact.contactedAt
          ? parseDate(record.managerContact.contactedAt)
          : null
    },
    events: events,
    createdAt: parseDate(record.createdAt) || new Date(),
    updatedAt: parseDate(record.updatedAt) || new Date()
  };
}

function saveState() {
  try {
    const saveData = {
      version: "0.5",
      events: serializeEvents(state.events),
      managerContact: {
        contactedAt: state.managerContact.contactedAt
          ? state.managerContact.contactedAt.toISOString()
          : null
      },
      history: state.history.map(serializeHistoryRecord),
      archivedRecordId: state.archivedRecordId
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  } catch (error) {
    console.error("記録の保存に失敗しました。", error);
  }
}

function loadVersion04B() {
  const savedText = localStorage.getItem(STORAGE_KEY);

  if (!savedText) {
    return false;
  }

  const savedData = JSON.parse(savedText);

  state.events = deserializeEvents(savedData.events);
  state.managerContact = {
    contactedAt:
      savedData.managerContact && savedData.managerContact.contactedAt
        ? parseDate(savedData.managerContact.contactedAt)
        : null
  };
  state.history = Array.isArray(savedData.history)
    ? savedData.history.map(deserializeHistoryRecord).filter(Boolean)
    : [];
  state.archivedRecordId = savedData.archivedRecordId || null;

  return true;
}

function migrateLegacyVersion03() {
  const savedText = localStorage.getItem(LEGACY_STORAGE_KEY);

  if (!savedText) {
    return false;
  }

  const savedData = JSON.parse(savedText);
  state.events = deserializeEvents(savedData.events);
  state.managerContact = {
    contactedAt:
      savedData.managerContact && savedData.managerContact.contactedAt
        ? parseDate(savedData.managerContact.contactedAt)
        : null
  };
  state.history = [];
  state.archivedRecordId = null;

  if (getCurrentMode() === "ended") {
    archiveCurrentShift();
  }

  saveState();
  return true;
}

function migrateVersion02() {
  const oldText = localStorage.getItem(OLD_STORAGE_KEY);

  if (!oldText) {
    return false;
  }

  const oldData = JSON.parse(oldText);

  if (!Array.isArray(oldData.timeline)) {
    return false;
  }

  const labelTypeMap = {
    "始業": "start",
    "休憩開始": "break",
    "休息開始": "rest",
    "業務再開": "resume",
    "終業": "end"
  };

  state.events = oldData.timeline
    .map(function(event) {
      const type = labelTypeMap[event.label];
      if (!type || !event.time) {
        return null;
      }

      return {
        id: createId(),
        type: type,
        time: new Date(event.time)
      };
    })
    .filter(function(event) {
      return event && isValidDate(event.time);
    })
    .sort(function(first, second) {
      return first.time - second.time;
    });

  state.managerContact = { contactedAt: null };
  state.history = [];
  state.archivedRecordId = null;

  if (getCurrentMode() === "ended") {
    archiveCurrentShift();
  }

  saveState();
  return state.events.length > 0;
}

function loadState() {
  try {
    if (loadVersion04B()) {
      return;
    }

    if (migrateLegacyVersion03()) {
      return;
    }

    migrateVersion02();
  } catch (error) {
    console.error("保存データの読み込みに失敗しました。", error);
    state = {
      events: [],
      managerContact: { contactedAt: null },
      history: [],
      archivedRecordId: null
    };
  }
}

function buildCurrentHistoryRecord(existingId = null) {
  const startEvent = state.events.find(function(event) {
    return event.type === "start";
  });

  const endEvent = state.events.find(function(event) {
    return event.type === "end";
  });

  if (!startEvent || !endEvent) {
    return null;
  }

  const existing = existingId
    ? state.history.find(function(record) {
        return record.id === existingId;
      })
    : null;

  return {
    id: existingId || createId(),
    dateKey: toDateKey(startEvent.time),
    managerContact: {
      contactedAt: state.managerContact.contactedAt
        ? new Date(state.managerContact.contactedAt)
        : null
    },
    events: state.events.map(function(event) {
      return {
        id: event.id,
        type: event.type,
        time: new Date(event.time)
      };
    }),
    createdAt: existing ? existing.createdAt : new Date(),
    updatedAt: new Date()
  };
}

function archiveCurrentShift() {
  const record = buildCurrentHistoryRecord(state.archivedRecordId);

  if (!record) {
    return;
  }

  const existingIndex = state.history.findIndex(function(item) {
    return item.id === record.id;
  });

  if (existingIndex >= 0) {
    state.history[existingIndex] = record;
  } else {
    state.history.push(record);
  }

  state.archivedRecordId = record.id;
  state.history.sort(function(first, second) {
    return first.dateKey.localeCompare(second.dateKey);
  });
}

function syncEndedShiftToHistory() {
  if (getCurrentMode() === "ended") {
    archiveCurrentShift();
  }
}
