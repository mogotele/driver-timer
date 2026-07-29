// ========================================
// 勤務カレンダー・週間集計・勤務詳細
// ========================================

"use strict";

function getRecordsForDate(dateKey) {
  return state.history.filter(function(record) {
    return record.dateKey === dateKey;
  });
}

function getPrimaryRecord(records) {
  if (!records.length) {
    return null;
  }

  return records.slice().sort(function(first, second) {
    const firstTotals = calculateTotalsFromEvents(first.events);
    const secondTotals = calculateTotalsFromEvents(second.events);
    return secondTotals.restraintMs - firstTotals.restraintMs;
  })[0];
}

function renderCalendar() {
  elements.calendarMonthTitle.textContent = formatMonthTitle(calendarCursor);
  elements.calendarGrid.innerHTML = "";

  const firstDay = startOfMonth(calendarCursor);
  const gridStart = startOfWeekMonday(firstDay);
  const todayKey = toDateKey(new Date());

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const dateKey = toDateKey(date);
    const records = getRecordsForDate(dateKey);
    const primaryRecord = getPrimaryRecord(records);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";

    if (date.getMonth() !== calendarCursor.getMonth()) {
      button.classList.add("outside-month");
    }

    if (dateKey === todayKey) {
      button.classList.add("today");
    }

    const dayNumber = document.createElement("span");
    dayNumber.className = "calendar-day-number";
    dayNumber.textContent = String(date.getDate());
    button.appendChild(dayNumber);

    if (!primaryRecord) {
      button.disabled = true;
    } else {
      const totals = calculateTotalsFromEvents(primaryRecord.events);
      const judgment = getJudgment(totals.restraintMs);

      const mark = document.createElement("strong");
      mark.className = `calendar-day-mark ${judgment.className}`;
      mark.textContent = judgment.mark;
      button.appendChild(mark);

      if (totals.restraintMs > MANAGER_CONTACT_THRESHOLD_MS) {
        const contactLabel = document.createElement("span");
        const contacted =
          primaryRecord.managerContact &&
          isValidDate(primaryRecord.managerContact.contactedAt);

        contactLabel.className =
          "calendar-contact-label " + (contacted ? "done" : "pending");
        contactLabel.textContent = contacted ? "連絡済み" : "要連絡";
        button.appendChild(contactLabel);
      }

      if (records.length > 1) {
        const count = document.createElement("span");
        count.className = "calendar-record-count";
        count.textContent = String(records.length);
        button.appendChild(count);
      }

      button.addEventListener("click", function() {
        if (records.length === 1) {
          openHistoryDetail(records[0].id);
          return;
        }

        const options = records
          .map(function(record, recordIndex) {
            const recordTotals = calculateTotalsFromEvents(record.events);
            return (
              `${recordIndex + 1}：` +
              `${formatShortClock(record.events[0].time)}開始 ` +
              `拘束${formatDuration(recordTotals.restraintMs)}`
            );
          })
          .join("\n");

        const selected = window.prompt(
          `この日は${records.length}件の勤務があります。\n確認する番号を入力してください。\n\n${options}`,
          "1"
        );

        if (selected === null) {
          return;
        }

        const selectedIndex = Number(selected) - 1;

        if (Number.isInteger(selectedIndex) && records[selectedIndex]) {
          openHistoryDetail(records[selectedIndex].id);
        }
      });
    }

    elements.calendarGrid.appendChild(button);
  }

  renderWeeklySummary();
}

function renderWeeklySummary() {
  elements.weeklySummaryList.innerHTML = "";

  const monthStart = startOfMonth(calendarCursor);
  const monthEnd = addMonths(monthStart, 1);
  let weekStart = startOfWeekMonday(monthStart);
  let hasAnyRecord = false;

  while (weekStart < monthEnd) {
    const weekEnd = addDays(weekStart, 7);

    const weeklyRecords = state.history.filter(function(record) {
      const date = new Date(`${record.dateKey}T00:00:00`);
      return date >= weekStart && date < weekEnd;
    });

    if (weeklyRecords.length) {
      hasAnyRecord = true;
    }

    const overFourteenCount = weeklyRecords.filter(function(record) {
      const totals = calculateTotalsFromEvents(record.events);
      return totals.restraintMs > WEEKLY_COUNT_THRESHOLD_MS;
    }).length;

    const card = document.createElement("article");
    card.className = "weekly-summary-card";

    const textArea = document.createElement("div");

    const period = document.createElement("p");
    period.className = "weekly-summary-period";
    period.textContent =
      `${formatDate(weekStart)}〜${formatDate(addDays(weekEnd, -1))}`;

    const count = document.createElement("p");
    count.className = "weekly-summary-count";
    count.textContent = `14時間超：${overFourteenCount} / 2回`;

    textArea.append(period, count);

    const status = document.createElement("span");

    if (overFourteenCount === 0) {
      status.className = "weekly-summary-status safe";
      status.textContent = "対象なし";
    } else if (overFourteenCount <= 2) {
      status.className = "weekly-summary-status warning";
      status.textContent =
        overFourteenCount === 2 ? "今週2回目" : "今週1回目";
    } else {
      status.className = "weekly-summary-status danger";
      status.textContent = "回数超過";
    }

    card.append(textArea, status);
    elements.weeklySummaryList.appendChild(card);
    weekStart = weekEnd;
  }

  if (!hasAnyRecord) {
    elements.weeklySummaryList.innerHTML =
      '<p class="empty-timeline">この月の勤務履歴はまだありません。</p>';
  }
}

function openHistoryDetail(recordId) {
  const record = state.history.find(function(item) {
    return item.id === recordId;
  });

  if (!record) {
    return;
  }

  selectedHistoryRecordId = record.id;

  const totals = calculateTotalsFromEvents(record.events);
  const judgment = getJudgment(totals.restraintMs);
  const startEvent = record.events.find(function(event) {
    return event.type === "start";
  });
  const endEvent = record.events.find(function(event) {
    return event.type === "end";
  });

  elements.detailModalTitle.textContent = formatFullDate(startEvent.time);
  elements.detailJudgment.textContent = judgment.mark;
  elements.detailJudgment.className =
    `detail-judgment ${judgment.className}`;

  elements.detailStart.textContent = formatContactDateTime(startEvent.time);
  elements.detailEnd.textContent = formatContactDateTime(endEvent.time);
  elements.detailElapsed.textContent = formatDuration(totals.elapsedMs);
  elements.detailRestraint.textContent = formatDuration(totals.restraintMs);
  elements.detailWork.textContent = formatDuration(totals.workMs);
  elements.detailBreak.textContent = formatDuration(totals.breakMs);
  elements.detailRest.textContent = formatDuration(totals.validRestMs);

  if (totals.restraintMs <= MANAGER_CONTACT_THRESHOLD_MS) {
    elements.detailContact.textContent = "連絡対象外";
  } else if (
    record.managerContact &&
    isValidDate(record.managerContact.contactedAt)
  ) {
    elements.detailContact.textContent =
      `連絡済み（${formatContactDateTime(record.managerContact.contactedAt)}）`;
  } else {
    elements.detailContact.textContent = "要連絡";
  }

  elements.detailTimeline.innerHTML = "";

  record.events.forEach(function(event) {
    const item = document.createElement("li");
    item.className = "timeline-item";

    const time = document.createElement("time");
    time.className = "timeline-time";
    time.textContent = formatClock(event.time);

    const name = document.createElement("span");
    name.className = "timeline-name";
    name.textContent =
      `${formatDate(event.time)} ${EVENT_DEFINITIONS[event.type].label}`;

    item.append(time, name);
    elements.detailTimeline.appendChild(item);
  });

  openModal(elements.detailModal);
}

function closeHistoryDetail() {
  selectedHistoryRecordId = null;
  closeModal(elements.detailModal);
}

function deleteSelectedHistoryRecord() {
  const record = state.history.find(function(item) {
    return item.id === selectedHistoryRecordId;
  });

  if (!record) {
    closeHistoryDetail();
    return;
  }

  const shouldDelete = window.confirm(
    "この勤務履歴を削除しますか？\n\n削除した履歴は元に戻せません。"
  );

  if (!shouldDelete) {
    return;
  }

  state.history = state.history.filter(function(item) {
    return item.id !== selectedHistoryRecordId;
  });

  if (state.archivedRecordId === selectedHistoryRecordId) {
    state.archivedRecordId = null;
  }

  saveState();
  renderCalendar();
  closeHistoryDetail();
}
