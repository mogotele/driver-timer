"use strict";

const STORAGE_KEY = "driverTimer_v1";
const THREE_HOURS = 3 * 60 * 60 * 1000;
const THIRTEEN_HOURS = 13 * 60 * 60 * 1000;
const FIFTEEN_HOURS = 15 * 60 * 60 * 1000;
const labels = {start:"始業",break:"休憩開始",rest:"休息開始",resume:"業務再開",end:"終業"};
const modes = {start:"working",break:"break",rest:"rest",resume:"working",end:"ended"};

let state = {events:[],history:[],managerContactedAt:null};
let editingId = null;
let selectedHistoryId = null;
let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

const $ = id => document.getElementById(id);
const el = {
  clock:$("clock"), statusBadge:$("statusBadge"), remainingText:$("remainingText"), restraintTime:$("restraintTime"), elapsedTime:$("elapsedTime"), workTime:$("workTime"), breakTime:$("breakTime"), validRestTime:$("validRestTime"), progressBar:$("progressBar"),
  managerPanel:$("managerPanel"), managerText:$("managerText"), managerButton:$("managerButton"), startButton:$("startButton"), workControls:$("workControls"), breakButton:$("breakButton"), restButton:$("restButton"), resumeButton:$("resumeButton"), endButton:$("endButton"), resetButton:$("resetButton"), timeline:$("timeline"),
  timerView:$("timerView"), calendarView:$("calendarView"), prevMonth:$("prevMonth"), nextMonth:$("nextMonth"), todayButton:$("todayButton"), monthTitle:$("monthTitle"), calendarGrid:$("calendarGrid"), historyList:$("historyList"),
  editModal:$("editModal"), editLabel:$("editLabel"), editDateTime:$("editDateTime"), editError:$("editError"), saveEdit:$("saveEdit"), deleteEdit:$("deleteEdit"), cancelEdit:$("cancelEdit"),
  historyModal:$("historyModal"), historyTitle:$("historyTitle"), historyDetail:$("historyDetail"), deleteHistory:$("deleteHistory"), closeHistory:$("closeHistory"),
  confirmModal:$("confirmModal"), confirmTitle:$("confirmTitle"), confirmMessage:$("confirmMessage"), confirmOk:$("confirmOk"), confirmCancel:$("confirmCancel")
};

function uid(){return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));}
function validDate(d){return d instanceof Date && !Number.isNaN(d.getTime());}
function fmtDuration(ms){const s=Math.max(0,Math.floor(ms/1000));return [Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(v=>String(v).padStart(2,"0")).join(":");}
function fmtTime(d){return new Intl.DateTimeFormat("ja-JP",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(d);}
function fmtDate(d){return new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d);}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function inputValue(d){const z=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;}
function cloneEvents(events){return events.map(e=>({...e,time:new Date(e.time)}));}

function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function load(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));if(!raw)return;state={events:Array.isArray(raw.events)?raw.events.map(e=>({...e,time:new Date(e.time)})).filter(e=>validDate(e.time)):[],history:Array.isArray(raw.history)?raw.history.map(r=>({...r,events:cloneEvents(r.events||[]),managerContactedAt:r.managerContactedAt?new Date(r.managerContactedAt):null})):[],managerContactedAt:raw.managerContactedAt?new Date(raw.managerContactedAt):null};}catch(err){console.error(err);}}
function mode(){const last=state.events.at(-1);return last?modes[last.type]:"idle";}

function totals(events=state.events, now=new Date()){
  const t={elapsed:0,work:0,break:0,validRest:0,restraint:0};
  if(!events.length)return t;
  const start=events.findIndex(e=>e.type==="start"); if(start<0)return t;
  const end=events.find((e,i)=>i>start&&e.type==="end"); const stop=end?end.time:now;
  t.elapsed=Math.max(0,stop-events[start].time); const rests=[];
  for(let i=start;i<events.length;i++){
    const cur=events[i]; if(cur.type==="end")break;
    const next=events[i+1]; const until=next?next.time:now; const span=Math.max(0,until-cur.time);
    if(cur.type==="start"||cur.type==="resume")t.work+=span; else if(cur.type==="break")t.break+=span; else if(cur.type==="rest")rests.push(span);
  }
  t.validRest=rests.filter(v=>v>=THREE_HOURS).reduce((a,b)=>a+b,0); t.restraint=Math.max(0,t.elapsed-t.validRest); return t;
}

function archive(){const start=state.events.find(e=>e.type==="start"), end=state.events.find(e=>e.type==="end");if(!start||!end)return;const record={id:uid(),dateKey:dateKey(start.time),events:cloneEvents(state.events),managerContactedAt:state.managerContactedAt?new Date(state.managerContactedAt):null};state.history=state.history.filter(r=>r.dateKey!==record.dateKey);state.history.push(record);state.history.sort((a,b)=>a.dateKey.localeCompare(b.dateKey));}
function addEvent(type){state.events.push({id:uid(),type,time:new Date()});state.events.sort((a,b)=>a.time-b.time);if(type==="end")archive();save();renderAll();}

function renderStatus(){const t=totals(), m=mode();el.restraintTime.textContent=fmtDuration(t.restraint);el.elapsedTime.textContent=fmtDuration(t.elapsed);el.workTime.textContent=fmtDuration(t.work);el.breakTime.textContent=fmtDuration(t.break);el.validRestTime.textContent=fmtDuration(t.validRest);el.statusBadge.className=`badge ${m}`;el.statusBadge.textContent={idle:"待機中",working:"業務中",break:"休憩中",rest:"休息中",ended:"終業済み"}[m];
  if(m==="idle")el.remainingText.textContent="始業してください";else if(m==="ended")el.remainingText.textContent="勤務を終了しました";else if(t.restraint<THIRTEEN_HOURS)el.remainingText.textContent=`13時間まで ${fmtDuration(THIRTEEN_HOURS-t.restraint)}`;else if(t.restraint<FIFTEEN_HOURS)el.remainingText.textContent=`15時間まで ${fmtDuration(FIFTEEN_HOURS-t.restraint)}`;else el.remainingText.textContent="15時間を超えています";
  el.progressBar.style.width=`${Math.min(100,t.restraint/FIFTEEN_HOURS*100)}%`;
  el.startButton.classList.toggle("hidden",m!=="idle"&&m!=="ended");el.startButton.textContent=m==="ended"?"新しい勤務を始める":"始業する";el.workControls.classList.toggle("hidden",m==="idle"||m==="ended");el.breakButton.disabled=m==="break";el.restButton.disabled=m==="rest";el.resumeButton.disabled=m==="working";
  const needs=t.restraint>THIRTEEN_HOURS&&m!=="idle";el.managerPanel.classList.toggle("hidden",!needs);if(needs){el.managerButton.textContent=state.managerContactedAt?"連絡済みを取消":"連絡済みにする";el.managerText.textContent=state.managerContactedAt?`${fmtTime(state.managerContactedAt)} に連絡済みです。`:"拘束時間が13時間を超えました。";}
}
function renderTimeline(){if(!state.events.length){el.timeline.className="timeline empty";el.timeline.textContent="記録はありません";return;}el.timeline.className="timeline";el.timeline.innerHTML="";state.events.forEach(e=>{const row=document.createElement("div");row.className="timeline-item";row.innerHTML=`<span class="dot"></span><strong>${labels[e.type]}</strong>`;const b=document.createElement("button");b.type="button";b.className="timeline-time";b.textContent=fmtTime(e.time);b.addEventListener("click",()=>openEdit(e.id));row.appendChild(b);el.timeline.appendChild(row);});}
function renderCalendar(){const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();el.monthTitle.textContent=`${y}年 ${m+1}月`;el.calendarGrid.innerHTML="";const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay());for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const record=state.history.find(r=>r.dateKey===dateKey(d));const b=document.createElement("button");b.type="button";b.className="day"+(d.getMonth()!==m?" outside":"")+(record?" has-record":"")+(dateKey(d)===dateKey(new Date())?" today":"");b.innerHTML=`${d.getDate()}${record?'<span class="mark">●</span>':''}`;if(record)b.addEventListener("click",()=>openHistory(record.id));el.calendarGrid.appendChild(b);}renderHistoryList();}
function renderHistoryList(){if(!state.history.length){el.historyList.className="history-list empty";el.historyList.textContent="履歴はありません";return;}el.historyList.className="history-list";el.historyList.innerHTML="";[...state.history].reverse().forEach(r=>{const t=totals(r.events,r.events.at(-1)?.time||new Date());const b=document.createElement("button");b.type="button";b.className="history-item";b.innerHTML=`<span><strong>${r.dateKey}</strong><br><small>拘束 ${fmtDuration(t.restraint)}</small></span><span>›</span>`;b.addEventListener("click",()=>openHistory(r.id));el.historyList.appendChild(b);});}
function renderAll(){renderStatus();renderTimeline();renderCalendar();}

function openEdit(id){const e=state.events.find(x=>x.id===id);if(!e)return;editingId=id;el.editLabel.textContent=labels[e.type];el.editDateTime.value=inputValue(e.time);el.editError.classList.add("hidden");el.deleteEdit.disabled=e.type==="start";el.editModal.classList.remove("hidden");}
function closeEdit(){editingId=null;el.editModal.classList.add("hidden");}
function saveEdit(){const e=state.events.find(x=>x.id===editingId),d=new Date(el.editDateTime.value);if(!e||!validDate(d)){el.editError.textContent="正しい日時を入力してください。";el.editError.classList.remove("hidden");return;}e.time=d;state.events.sort((a,b)=>a.time-b.time);if(mode()==="ended")archive();save();closeEdit();renderAll();}
function deleteEdit(){const e=state.events.find(x=>x.id===editingId);if(!e||e.type==="start")return;askConfirm(`${labels[e.type]}の記録を削除しますか？`,()=>{state.events=state.events.filter(x=>x.id!==editingId);save();closeEdit();renderAll();},{title:"記録の削除",okText:"削除する"});}
function openHistory(id){const r=state.history.find(x=>x.id===id);if(!r)return;selectedHistoryId=id;const t=totals(r.events,r.events.at(-1)?.time||new Date());el.historyTitle.textContent=`${r.dateKey} の勤務`;el.historyDetail.innerHTML=`<div class="detail-row"><span>拘束時間</span><strong>${fmtDuration(t.restraint)}</strong></div><div class="detail-row"><span>業務時間</span><strong>${fmtDuration(t.work)}</strong></div><div class="detail-row"><span>休憩時間</span><strong>${fmtDuration(t.break)}</strong></div>`+r.events.map(e=>`<div class="detail-row"><span>${labels[e.type]}</span><strong>${fmtTime(e.time)}</strong></div>`).join("");el.historyModal.classList.remove("hidden");}
function closeHistory(){selectedHistoryId=null;el.historyModal.classList.add("hidden");}

let confirmAction = null;
function askConfirm(message, action, options={}){
  confirmAction = action;
  el.confirmTitle.textContent = options.title || "確認";
  el.confirmMessage.textContent = message;
  el.confirmOk.textContent = options.okText || "実行する";
  el.confirmOk.classList.toggle("danger", options.danger !== false);
  el.confirmModal.classList.remove("hidden");
}
function closeConfirm(){
  confirmAction = null;
  el.confirmModal.classList.add("hidden");
}
function runConfirm(){
  const action = confirmAction;
  closeConfirm();
  if (typeof action === "function") action();
}

function bind(){document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x===b));const timer=b.dataset.view==="timer";el.timerView.classList.toggle("active",timer);el.calendarView.classList.toggle("active",!timer);}));
  el.startButton.addEventListener("click",()=>{if(mode()==="ended"){state.events=[];state.managerContactedAt=null;}addEvent("start");});el.breakButton.addEventListener("click",()=>addEvent("break"));el.restButton.addEventListener("click",()=>addEvent("rest"));el.resumeButton.addEventListener("click",()=>addEvent("resume"));el.endButton.addEventListener("click",()=>{askConfirm("現在の勤務を終業しますか？ 終業するとカレンダーへ保存されます。",()=>addEvent("end"),{title:"終業の確認",okText:"終業する",danger:false});});
  el.resetButton.addEventListener("click",()=>{if(!state.events.length)return;askConfirm("現在の勤務記録をリセットしますか？",()=>{state.events=[];state.managerContactedAt=null;save();renderAll();},{title:"記録のリセット",okText:"リセットする"});});el.managerButton.addEventListener("click",()=>{state.managerContactedAt=state.managerContactedAt?null:new Date();save();renderStatus();});
  el.prevMonth.addEventListener("click",()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar();});el.nextMonth.addEventListener("click",()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar();});el.todayButton.addEventListener("click",()=>{calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1);renderCalendar();});
  el.saveEdit.addEventListener("click",saveEdit);el.deleteEdit.addEventListener("click",deleteEdit);el.cancelEdit.addEventListener("click",closeEdit);document.querySelector("[data-close-modal]").addEventListener("click",closeEdit);el.closeHistory.addEventListener("click",closeHistory);document.querySelector("[data-close-history]").addEventListener("click",closeHistory);el.deleteHistory.addEventListener("click",()=>{if(!selectedHistoryId)return;askConfirm("この勤務履歴を削除しますか？",()=>{state.history=state.history.filter(r=>r.id!==selectedHistoryId);save();closeHistory();renderCalendar();},{title:"履歴の削除",okText:"削除する"});});
  el.confirmOk.addEventListener("click",runConfirm);el.confirmCancel.addEventListener("click",closeConfirm);el.confirmModal.querySelector(".modal-backdrop").addEventListener("click",closeConfirm);
}

load();bind();renderAll();setInterval(()=>{el.clock.textContent=fmtTime(new Date());renderStatus();},1000);el.clock.textContent=fmtTime(new Date());
