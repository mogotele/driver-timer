// ========================================
// メイン画面・状態表示・タイムライン
// ========================================

"use strict";

function updateStatus() {
  const mode = getCurrentMode();

  const statusMap = {
    idle: { text: "未始業", badge: "待機中", className: "idle" },
    working: { text: "業務中", badge: "計測中", className: "working" },
    break: { text: "休憩中", badge: "拘束時間に含む", className: "breaking" },
    rest: { text: "休息中", badge: "判定中", className: "resting" },
    ended: { text: "終業済み", badge: "履歴へ保存済み", className: "ended" }
  };

  const current = statusMap[mode];
  elements.statusText.textContent = current.text;
  elements.statusBadge.textContent = current.badge;
  elements.statusBadge.className = `status-badge ${current.className}`;
}

function updateButtons() {
  const mode = getCurrentMode();
  const isIdle = mode === "idle";
  const isWorking = mode === "working";
  const isPaused = mode === "break" || mode === "rest";
  const isEnded = mode === "ended";

  elements.startButton.classList.toggle("hidden", !isIdle && !isEnded);
  elements.startButton.textContent = isEnded
    ? "次の勤務を始業する"
    : "始業する";

  elements.workButtons.classList.toggle("hidden", !isWorking);
  elements.resumeButton.classList.toggle("hidden", !isPaused);
  elements.breakButton.disabled = !isWorking;
  elements.restButton.disabled = !isWorking;
  elements.endButton.disabled = isIdle || isEnded;
}

function updateRestPanel(now) {
  const isResting = getCurrentMode() === "rest";

  elements.restInfo.classList.toggle("hidden", !isResting);

  if (!isResting) {
    return;
  }

  const currentRestMs = getCurrentRestDuration(now);
  elements.restCurrentTime.textContent = formatDuration(currentRestMs);

  if (currentRestMs >= REST_THRESHOLD_MS) {
    elements.restMessage.textContent =
      "3時間以上の休息が成立しました。この休息時間は拘束時間から除外されています。";
    elements.statusBadge.textContent = "有効な休息";
  } else {
    const remaining = REST_THRESHOLD_MS - currentRestMs;
    elements.restMessage.textContent =
      `休息成立まであと ${formatDuration(remaining)}。現在は拘束時間に含まれています。`;
  }
}

function updateProgress(restraintMs) {
  const progress = Math.min(
    100,
    (restraintMs / STANDARD_RESTRAINT_MS) * 100
  );

  elements.progressBar.style.width = `${progress}%`;
  elements.progressBar.classList.remove("warning", "danger");

  if (restraintMs > WARNING_RESTRAINT_MS) {
    elements.progressBar.classList.add("danger");
  } else if (restraintMs > STANDARD_RESTRAINT_MS) {
    elements.progressBar.classList.add("warning");
  }

  const remainingMs = STANDARD_RESTRAINT_MS - restraintMs;

  elements.remainingText.textContent = remainingMs >= 0
    ? `13時間まで残り ${formatDuration(remainingMs)}`
    : `13時間を ${formatDuration(Math.abs(remainingMs))} 超過しています`;
}

function updateManagerContactPanel(restraintMs) {
  const contactRequired = restraintMs > MANAGER_CONTACT_THRESHOLD_MS;

  elements.managerContactPanel.classList.toggle(
    "hidden",
    !contactRequired
  );

  if (!contactRequired) {
    return;
  }

  const contactedAt = state.managerContact.contactedAt;
  const isContacted = isValidDate(contactedAt);

  elements.managerContactPanel.classList.toggle("contacted", isContacted);
  elements.managerContactTime.classList.toggle("hidden", !isContacted);

  const icon = elements.managerContactPanel.querySelector(
    ".manager-contact-icon"
  );

  if (isContacted) {
    elements.managerContactTitle.textContent = "営業所長へ連絡済み";
    elements.managerContactMessage.textContent =
      "連絡完了として記録されています。";
    elements.managerContactTime.textContent =
      `連絡時刻：${formatContactDateTime(contactedAt)}`;
    elements.managerContactButton.textContent = "連絡済みを取り消す";
    icon.textContent = "✓";
  } else {
    elements.managerContactTitle.textContent =
      "拘束時間が13時間を超えました";
    elements.managerContactMessage.textContent =
      "営業所長に連絡してください。";
    elements.managerContactTime.textContent = "";
    elements.managerContactButton.textContent = "連絡済みにする";
    icon.textContent = "⚠";
  }
}

function renderTimeline() {
  elements.timeline.innerHTML = "";

  if (!state.events.length) {
    const empty = document.createElement("li");
    empty.className = "empty-timeline";
    empty.textContent = "まだ記録はありません。";
    elements.timeline.appendChild(empty);
    return;
  }

  state.events.forEach(function(event) {
    const item = document.createElement("li");
    item.className = "timeline-item";

    const time = document.createElement("time");
    time.className = "timeline-time";
    time.textContent = formatClock(event.time);

    const name = document.createElement("span");
    name.className = "timeline-name";
    name.textContent =
      `${formatDate(event.time)} ${EVENT_DEFINITIONS[event.type].label}`;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "timeline-edit-button";
    editButton.textContent = "編集";
    editButton.addEventListener("click", function() {
      openEditModal(event.id);
    });

    item.append(time, name, editButton);
    elements.timeline.appendChild(item);
  });
}

function switchView(viewName) {
  const timerActive = viewName === "timer";

  elements.timerView.classList.toggle("hidden", !timerActive);
  elements.calendarView.classList.toggle("hidden", timerActive);
  elements.timerTabButton.classList.toggle("active", timerActive);
  elements.calendarTabButton.classList.toggle("active", !timerActive);
  elements.timerTabButton.setAttribute("aria-selected", String(timerActive));
  elements.calendarTabButton.setAttribute("aria-selected", String(!timerActive));

  if (!timerActive) {
    renderCalendar();
  }
}

function updateInterface() {
  const now = new Date();
  const totals = calculateTotals(now);

  elements.currentClock.textContent = formatClock(now);
  elements.restraintTime.textContent = formatDuration(totals.restraintMs);
  elements.elapsedTime.textContent = formatDuration(totals.elapsedMs);
  elements.workTime.textContent = formatDuration(totals.workMs);
  elements.breakTime.textContent = formatDuration(totals.breakMs);
  elements.validRestTime.textContent = formatDuration(totals.validRestMs);

  updateStatus();
  updateButtons();
  updateRestPanel(now);
  updateProgress(totals.restraintMs);
  updateManagerContactPanel(totals.restraintMs);
}
