// ========================================
// 勤務イベント・拘束時間計算
// ========================================

"use strict";

function sortEvents() {
  state.events.sort(function(first, second) {
    return first.time - second.time;
  });
}

function getLastEvent() {
  return state.events.length
    ? state.events[state.events.length - 1]
    : null;
}

function getCurrentMode() {
  const lastEvent = getLastEvent();

  if (!lastEvent) {
    return "idle";
  }

  return EVENT_DEFINITIONS[lastEvent.type].mode;
}

//function addEvent(type, date = new Date()) {
//  if (!EVENT_DEFINITIONS[type]) {
//    return;
//  }

//  state.events.push({
//    id: createId(),
//    type: type,
//    time: new Date(date)
//  });
//修正用テストコード
function addEvent(type, date = new Date()) {
  alert("⑤ addEvent開始：" + type);
  
  if (!EVENT_DEFINITIONS[type]) {
    alert("⑥ typeが見つかりません：" + type);
    return;
  }
  
  state.events.push({
    id: createId(),
    type: type,
    time: new Date(date)
  });
  
  alert("⑦ イベント追加成功");
  
  sortEvents();
  
  alert("⑧ sortEvents成功");
  
  // いまは履歴保存処理を止める
  // if (type === "end") {
  //   archiveCurrentShift();
  // }
  
  saveState();
  alert("⑨ saveState成功");
  
  renderTimeline();
  alert("⑩ renderTimeline成功");
  
  renderCalendar();
  alert("⑪ renderCalendar成功");
  
  updateInterface();
  alert("⑫ updateInterface成功");
}
//  sortEvents();

//  if (type === "end") {
//   archiveCurrentShift();
 // }

//  saveState();
 // renderTimeline();
//  renderCalendar();
//  updateInterface();
//}

function calculateTotalsFromEvents(events, now = new Date()) {
  const totals = {
    elapsedMs: 0,
    workMs: 0,
    breakMs: 0,
    validRestMs: 0,
    restraintMs: 0
  };

  if (!events.length) {
    return totals;
  }

  const startIndex = events.findIndex(function(event) {
    return event.type === "start";
  });

  if (startIndex === -1) {
    return totals;
  }

  const startEvent = events[startIndex];
  const endEvent = events.find(function(event, index) {
    return index > startIndex && event.type === "end";
  });

  const calculationEnd = endEvent ? endEvent.time : now;

  totals.elapsedMs = Math.max(0, calculationEnd - startEvent.time);

  const restSegments = [];

  for (let index = startIndex; index < events.length; index += 1) {
    const currentEvent = events[index];

    if (currentEvent.type === "end") {
      break;
    }

    const nextEvent = events[index + 1];
    const intervalEnd = nextEvent ? nextEvent.time : now;
    const duration = Math.max(0, intervalEnd - currentEvent.time);

    if (currentEvent.type === "start" || currentEvent.type === "resume") {
      totals.workMs += duration;
    } else if (currentEvent.type === "break") {
      totals.breakMs += duration;
    } else if (currentEvent.type === "rest") {
      restSegments.push(duration);
    }
  }

  totals.validRestMs = restSegments
    .filter(function(duration) {
      return duration >= REST_THRESHOLD_MS;
    })
    .reduce(function(total, duration) {
      return total + duration;
    }, 0);

  totals.restraintMs = Math.max(
    0,
    totals.elapsedMs - totals.validRestMs
  );

  return totals;
}

function calculateTotals(now = new Date()) {
  return calculateTotalsFromEvents(state.events, now);
}

function getJudgment(restraintMs) {
  if (restraintMs <= STANDARD_RESTRAINT_MS) {
    return { mark: "○", className: "safe" };
  }

  if (restraintMs <= WARNING_RESTRAINT_MS) {
    return { mark: "△", className: "caution" };
  }

  return { mark: "×", className: "danger" };
}

function getCurrentRestDuration(now = new Date()) {
  const lastEvent = getLastEvent();

  if (!lastEvent || lastEvent.type !== "rest") {
    return 0;
  }

  return Math.max(0, now - lastEvent.time);
}
