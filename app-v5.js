'use strict';

const API = 'https://mjzylixznhavpfwdwovc.supabase.co/functions/v1/ej-todo-api';
const CALENDAR = 'https://mjzylixznhavpfwdwovc.supabase.co/functions/v1/ej-todo-calendar';
const DEFAULT_TEAM_CODE = 'EJ-ApS-Emil-Jesper-2026!';
const CATEGORIES = [
  '1. Aftal rammerne mellem ejerne',
  '2. Lav ejeraftale',
  '3. Stift selskabet',
  '4. Ejerforhold',
  '5. Bank, skat og økonomi',
  '6. Praktisk drift',
  '7. Før I går i gang'
];
const STATUSES = ['Ikke startet', 'I gang', 'Afventer', 'Færdig', 'Blokeret'];
const OWNERS = ['Fælles', 'Emil', 'Jesper'];
const PRIORITIES = ['Høj', 'Mellem', 'Lav'];
const REMINDERS = [[30,'30 min før'],[60,'1 time før'],[120,'2 timer før'],[1440,'1 dag før'],[2880,'2 dage før'],[10080,'1 uge før'],[0,'Ingen']];
const USER_KEY = 'ejaps_user_v2';
const CODE_KEY = 'ejaps_team_code_v2';
const PROGRESS_KEY = 'ejaps_highest_progress_v2';
const state = { tasks: [], comments: [], activities: [], activityIds: new Set(), connected: false, busy: false, installPrompt: null, signature: '' };
const byId = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let currentUser = localStorage.getItem(USER_KEY) || 'Emil';
let teamCode = resolveTeamCode();

function resolveTeamCode() {
  const params = new URLSearchParams(location.hash.slice(1));
  const fromLink = (params.get('team') || '').trim();
  const stored = (localStorage.getItem(CODE_KEY) || '').trim();
  const code = fromLink || stored || DEFAULT_TEAM_CODE;
  localStorage.setItem(CODE_KEY, code);
  if (location.hash) history.replaceState(null, document.title, location.pathname + location.search);
  return code;
}
function showToast(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.style.display = 'block';
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}
function setBanner(mode, message = '') {
  const banner = byId('storageBanner');
  if (mode === 'online') {
    banner.className = 'storage-banner online';
    banner.innerHTML = '<strong>Fælles live-liste er forbundet.</strong> Emil og Jesper ser automatisk hinandens ændringer.';
  } else if (mode === 'loading') {
    banner.className = 'storage-banner loading';
    banner.innerHTML = '<strong>Henter de 52 punkter…</strong> Forbinder til den fælles EJ ApS-liste.';
  } else {
    banner.className = 'storage-banner offline';
    banner.innerHTML = `<strong>Listen kunne ikke hentes.</strong> ${escapeHtml(message)} <button id="retryConnectionBtn" class="button small">Prøv igen</button>`;
  }
}
async function request(path = 'snapshot', options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('x-ej-team-code', teamCode);
  headers.set('x-ej-actor', currentUser);
  let body = options.body;
  if (body && typeof body !== 'string') {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(body);
  }
  const response = await fetch(`${API}/${path}`, { ...options, headers, body, cache: 'no-store' });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.error || `Forbindelsesfejl (${response.status})`);
  return data;
}
const isDone = (task) => task.status === 'Færdig';
const progress = () => state.tasks.length ? Math.round(state.tasks.filter(isDone).length / state.tasks.length * 100) : 0;
function taskDate(task) {
  if (!task.deadline_date) return null;
  const time = String(task.deadline_time || '23:59').slice(0, 5);
  return new Date(`${task.deadline_date}T${time}:00`);
}
function mondayOfCurrentWeek() {
  const date = new Date();
  const offset = (date.getDay() + 6) % 7;
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() - offset);
  return date;
}
function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('da-DK', { dateStyle:'short', timeStyle:'short' }).format(new Date(value));
}
function activityText(activity) {
  const labels = {opgave_oprettet:'oprettede',opgave_faerdig:'markerede som færdig',status_aendret:'ændrede status på',ansvar_aendret:'ændrede ansvarlig på',opgave_opdateret:'opdaterede',opgave_slettet:'slettede',kommentar_tilfoejet:'kommenterede på'};
  return `${activity.actor} ${labels[activity.action] || activity.action}: ${activity.detail}`;
}
async function systemNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, { body, icon:'icon.svg', badge:'icon.svg', tag, renotify:true });
    } else new Notification(title, { body, tag });
  } catch (error) { console.warn(error); }
}
async function notifyNewProgress(firstLoad) {
  const current = progress();
  const stored = localStorage.getItem(PROGRESS_KEY);
  if (firstLoad && stored === null) { localStorage.setItem(PROGRESS_KEY, String(current)); return; }
  const previous = Number(stored || 0);
  if (current > previous) {
    for (let value = previous + 1; value <= current; value += 1) {
      await systemNotification(`EJ ApS · ${value}% nået`, `I har nu gennemført ${value}% af opstartsplanen.`, `progress-${value}`);
    }
    localStorage.setItem(PROGRESS_KEY, String(current));
  }
}
function snapshotSignature(snapshot) {
  return JSON.stringify([(snapshot.tasks||[]).map(t=>[t.id,t.status,t.owner,t.priority,t.deadline_date,t.deadline_time,t.reminder_minutes,t.notes,t.depends_on,t.updated_at]),(snapshot.comments||[]).map(c=>[c.id,c.body,c.created_at]),(snapshot.activities||[]).slice(0,20).map(a=>a.id)]);
}
async function loadSnapshot(forceRender = false) {
  if (state.busy) return;
  state.busy = true;
  if (!state.connected) setBanner('loading');
  try {
    const snapshot = await request('snapshot');
    const firstLoad = !state.connected;
    const nextSignature = snapshotSignature(snapshot);
    const newActivities = firstLoad ? [] : (snapshot.activities||[]).filter(a=>!state.activityIds.has(a.id)&&a.actor!==currentUser).reverse();
    state.tasks = snapshot.tasks || [];
    state.comments = snapshot.comments || [];
    state.activities = snapshot.activities || [];
    state.activityIds = new Set(state.activities.map(a=>a.id));
    state.connected = true;
    setBanner('online');
    renderSummary(); renderActivity();
    if (forceRender || nextSignature !== state.signature) renderTasks();
    state.signature = nextSignature;
    await notifyNewProgress(firstLoad);
    for (const activity of newActivities) {
      const text = activityText(activity);
      showToast(text);
      await systemNotification(`${activity.actor} opdaterede EJ ApS`, text, activity.id);
    }
  } catch (error) {
    state.connected = false;
    setBanner('offline', error.message || 'Ukendt fejl');
    byId('taskRoot').innerHTML = '<section class="panel"><strong>De 52 punkter er i databasen, men forbindelsen kunne ikke åbnes.</strong><p>Tryk “Prøv igen” eller genindlæs siden.</p></section>';
    showToast(error.message || 'Listen kunne ikke hentes');
  } finally { state.busy = false; }
}
async function mutate(operation, successMessage = '') {
  try { await operation(); await loadSnapshot(true); if (successMessage) showToast(successMessage); }
  catch (error) { showToast(error.message || 'Ændringen kunne ikke gemmes'); await loadSnapshot(true); }
}
function renderSummary() {
  const completed = state.tasks.filter(isDone).length, percent = progress();
  byId('totalCount').textContent = state.tasks.length;
  byId('doneCount').textContent = completed;
  byId('openCount').textContent = state.tasks.length - completed;
  byId('progressPercent').textContent = `${percent}%`;
  byId('progressBar').style.width = `${percent}%`;
  renderMilestones(); renderWeeklyStatus();
}
function renderMilestones() {
  const inCategory=i=>state.tasks.filter(t=>t.category===CATEGORIES[i]);
  const byTitles=titles=>state.tasks.filter(t=>titles.includes(t.title));
  const rows=[['Ejerbeslutninger',inCategory(0)],['Ejeraftale klar',inCategory(1)],['Klar til registrering',byTitles(['Vælg selskabsnavn','Vælg adresse','Fastlæg selskabets formål','Fastlæg regnskabsår','Udarbejd stiftelsesdokument','Udarbejd vedtægter','Indbetal selskabskapital','Dokumentér kapitalen',"Registrér ApS'et hos Erhvervsstyrelsen"])],['CVR modtaget',byTitles(['Modtag CVR-nummer'])],['Driftsklar',state.tasks]];
  byId('milestones').innerHTML=rows.map(([name,tasks])=>{const n=tasks.filter(isDone).length,p=tasks.length?Math.round(n/tasks.length*100):0;return `<div class="milestone ${p===100?'reached':''}"><h3>${escapeHtml(name)}</h3><div class="milestone-line"><span>${n}/${tasks.length}</span><strong>${p}%</strong></div><div class="mini-track"><div style="width:${p}%"></div></div></div>`}).join('');
}
function weeklyNumbers() {
  const now=new Date(),start=mondayOfCurrentWeek(),end=new Date(start); end.setDate(end.getDate()+7);
  return {week:state.tasks.filter(t=>{const d=taskDate(t);return d&&d>=start&&d<end}).length,overdue:state.tasks.filter(t=>{const d=taskDate(t);return d&&d<now&&!isDone(t)}).length,today:state.tasks.filter(t=>t.deadline_date===now.toISOString().slice(0,10)&&!isDone(t)).length,completed:state.tasks.filter(t=>t.completed_at&&new Date(t.completed_at)>=start&&new Date(t.completed_at)<end).length};
}
function renderWeeklyStatus() {
  const n=weeklyNumbers();
  byId('weeklyStatus').innerHTML=[['Tidsfrister denne uge',n.week],['Overskredne',n.overdue],['Forfalder i dag',n.today],['Færdige i denne uge',n.completed]].map(([l,v])=>`<div class="weekly-item"><strong>${v}</strong><span>${l}</span></div>`).join('');
}
function renderActivity() {
  byId('activityLog').innerHTML=state.activities.length?state.activities.slice(0,50).map(a=>`<div class="activity-item"><strong>${escapeHtml(activityText(a))}</strong><time>${escapeHtml(formatDateTime(a.created_at))}</time></div>`).join(''):'<div class="empty">Ingen aktivitet endnu.</div>';
}
const dependencyFor=t=>state.tasks.find(x=>x.id===t.depends_on);
const commentsFor=id=>state.comments.filter(c=>c.task_id===id);
function taskMatchesFilters(task) {
  const query=byId('searchInput').value.toLowerCase(),commentText=commentsFor(task.id).map(c=>c.body).join(' ');
  if(query&&!`${task.title} ${task.notes} ${task.owner} ${commentText}`.toLowerCase().includes(query))return false;
  if(byId('ownerFilter').value!=='all'&&task.owner!==byId('ownerFilter').value)return false;
  if(byId('priorityFilter').value!=='all'&&task.priority!==byId('priorityFilter').value)return false;
  const dependency=dependencyFor(task),blocked=task.status==='Blokeret'||(dependency&&!isDone(dependency)),sf=byId('statusFilter').value;
  if(sf==='blocked'&&!blocked)return false;
  if(sf!=='all'&&sf!=='blocked'&&task.status!==sf)return false;
  const f=byId('deadlineFilter').value,d=taskDate(task),now=new Date(),start=mondayOfCurrentWeek(),end=new Date(start);end.setDate(end.getDate()+7);
  if(f==='none')return !d;if(f!=='all'&&!d)return false;
  if(f==='today'&&task.deadline_date!==now.toISOString().slice(0,10))return false;
  if(f==='week'&&!(d>=start&&d<end))return false;
  if(f==='soon'&&!(d>=now&&d<=new Date(now.getTime()+259200000)))return false;
  if(f==='overdue'&&!(d<now&&!isDone(task)))return false;
  return true;
}
function options(values,selected){return values.map(v=>`<option value="${escapeHtml(v)}" ${v===selected?'selected':''}>${escapeHtml(v)}</option>`).join('')}
function taskCard(task) {
  const deadline=taskDate(task),now=new Date(),dependency=dependencyFor(task),classes=['task-card'];
  if(isDone(task))classes.push('completed');else if(deadline&&deadline<now)classes.push('overdue');else if(deadline&&deadline<new Date(now.getTime()+259200000))classes.push('due-soon');
  if(task.status==='Blokeret'||(dependency&&!isDone(dependency)))classes.push('blocked');
  const comments=commentsFor(task.id),commentHtml=comments.length?comments.map(c=>`<div class="comment"><div class="comment-head"><strong>${escapeHtml(c.author)}</strong><span>${escapeHtml(formatDateTime(c.created_at))}</span></div><div>${escapeHtml(c.body)}</div>${c.author===currentUser?`<button class="button small danger-ghost" data-action="delete-comment" data-comment-id="${c.id}">Slet</button>`:''}</div>`).join(''):'<div class="empty">Ingen kommentarer.</div>';
  return `<article class="${classes.join(' ')}" data-task-id="${task.id}"><div class="task-top"><input class="task-check" type="checkbox" data-action="toggle" ${isDone(task)?'checked':''}><div><div class="task-title">${escapeHtml(task.title)}</div><div class="task-badges"><span class="badge ${task.priority==='Høj'?'high':task.priority==='Lav'?'low':'medium'}">${escapeHtml(task.priority)}</span><span class="badge ${isDone(task)?'done':task.status==='Blokeret'?'blocked':''}">${escapeHtml(task.status)}</span><span class="badge">${escapeHtml(task.owner)}</span></div></div><div class="task-actions"><button class="button small" data-action="calendar">Til kalender</button><button class="button small danger-ghost" data-action="delete">Slet</button></div></div><div class="task-fields"><label>Status<select data-field="status">${options(STATUSES,task.status)}</select></label><label>Ansvarlig<select data-field="owner">${options(OWNERS,task.owner)}</select></label><label>Prioritet<select data-field="priority">${options(PRIORITIES,task.priority)}</select></label><label>Tidsfrist<input type="date" data-field="deadline_date" value="${task.deadline_date||''}"></label><label>Klokkeslæt<input type="time" data-field="deadline_time" value="${String(task.deadline_time||'09:00').slice(0,5)}"></label><label>Påmindelse<select data-field="reminder_minutes">${REMINDERS.map(([m,l])=>`<option value="${m}" ${Number(task.reminder_minutes)===m?'selected':''}>${l}</option>`).join('')}</select></label><label>Afhænger af<select data-field="depends_on"><option value="">Ingen</option>${state.tasks.filter(x=>x.id!==task.id).map(x=>`<option value="${x.id}" ${x.id===task.depends_on?'selected':''}>${escapeHtml(x.title)}</option>`).join('')}</select></label></div>${dependency?`<div class="dependency-note">${isDone(dependency)?'✓ Afhængighed færdig':'Afventer'}: ${escapeHtml(dependency.title)}</div>`:''}<label class="task-notes">Noter<textarea data-field="notes" rows="2">${escapeHtml(task.notes||'')}</textarea></label><details class="comments"><summary>Kommentarer (${comments.length})</summary><div class="comment-list">${commentHtml}</div><form class="comment-form"><input name="comment" placeholder="Skriv en kommentar…" required><button class="button primary small">Send</button></form></details></article>`;
}
function renderTasks(){byId('taskRoot').innerHTML=CATEGORIES.map(category=>{const all=state.tasks.filter(t=>t.category===category),visible=all.filter(taskMatchesFilters),n=all.filter(isDone).length,p=all.length?Math.round(n/all.length*100):0;return `<section class="category"><header class="category-header"><h2>${escapeHtml(category)}</h2><div class="category-meta"><span class="badge">${n}/${all.length}</span><span class="badge done">${p}%</span></div></header><div class="category-body">${visible.length?visible.map(taskCard).join(''):'<div class="empty panel">Ingen opgaver matcher filteret.</div>'}</div></section>`}).join('')}
function createTaskCalendar(task){if(!task.deadline_date)throw new Error('Tilføj først en tidsfrist');const pad=n=>String(n).padStart(2,'0'),stamp=(minutes=0)=>{const d=new Date(`${task.deadline_date}T${String(task.deadline_time||'09:00').slice(0,5)}:00`);d.setMinutes(d.getMinutes()+minutes);return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`},esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'),lines=['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT',`UID:${task.id}@ejaps`,`DTSTART;TZID=Europe/Copenhagen:${stamp()}`,`DTEND;TZID=Europe/Copenhagen:${stamp(30)}`,`SUMMARY:${esc(`[${task.owner}] ${task.title}`)}`,`DESCRIPTION:${esc(task.notes||'')}`];if(Number(task.reminder_minutes)>0)lines.push('BEGIN:VALARM',`TRIGGER:-PT${task.reminder_minutes}M`,'ACTION:DISPLAY',`DESCRIPTION:${esc(task.title)}`,'END:VALARM');lines.push('END:VEVENT','END:VCALENDAR');const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/calendar'})),link=document.createElement('a');link.href=url;link.download='EJ-ApS-opgave.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function bindEvents(){
  byId('currentUser').value=currentUser;
  byId('currentUser').onchange=e=>{currentUser=e.target.value;localStorage.setItem(USER_KEY,currentUser);renderTasks()};
  byId('storageBanner').onclick=e=>{if(e.target.id==='retryConnectionBtn')loadSnapshot(true)};
  ['searchInput','ownerFilter','statusFilter','priorityFilter','deadlineFilter'].forEach(id=>byId(id).oninput=renderTasks);
  byId('taskRoot').onchange=e=>{const input=e.target,card=input.closest('.task-card');if(!card)return;const id=card.dataset.taskId;if(input.dataset.action==='toggle'){mutate(()=>request(`tasks/${id}`,{method:'PATCH',body:{status:input.checked?'Færdig':'Ikke startet',actor:currentUser}}));return}const f=input.dataset.field;if(!f)return;let v=input.value;if(f==='reminder_minutes')v=Number(v);if(['deadline_date','deadline_time','depends_on'].includes(f)&&!v)v=null;mutate(()=>request(`tasks/${id}`,{method:'PATCH',body:{[f]:v,actor:currentUser}}))};
  byId('taskRoot').onclick=e=>{const b=e.target.closest('button');if(!b)return;const card=b.closest('.task-card'),id=card?.dataset.taskId,t=state.tasks.find(x=>x.id===id);if(b.dataset.action==='calendar')try{createTaskCalendar(t)}catch(error){showToast(error.message)}if(b.dataset.action==='delete'&&t&&confirm(`Slet “${t.title}”?`))mutate(()=>request(`tasks/${id}`,{method:'DELETE'}),'Opgaven er slettet');if(b.dataset.action==='delete-comment'&&confirm('Slet kommentaren?'))mutate(()=>request(`comments/${b.dataset.commentId}`,{method:'DELETE'}),'Kommentaren er slettet')};
  byId('taskRoot').onsubmit=e=>{const f=e.target.closest('.comment-form');if(!f)return;e.preventDefault();const card=f.closest('.task-card'),text=f.elements.comment.value.trim();if(text)mutate(()=>request('comments',{method:'POST',body:{task_id:card.dataset.taskId,body:text,actor:currentUser}}),'Kommentaren er delt')};
  byId('addTaskBtn').onclick=async()=>{const title=byId('newTitle').value.trim();if(!title)return showToast('Skriv en opgave');await mutate(()=>request('tasks',{method:'POST',body:{title,category:byId('newCategory').value,owner:byId('newOwner').value,priority:byId('newPriority').value,deadline_date:byId('newDate').value||null,deadline_time:byId('newTime').value||'09:00',reminder_minutes:1440,actor:currentUser}}),'Opgaven er delt');byId('newTitle').value='';byId('newDate').value=''};
  byId('copyWeeklyBtn').onclick=async()=>{const n=weeklyNumbers(),text=`EJ ApS To Do – ${progress()}% færdig\nTidsfrister denne uge: ${n.week}\nOverskredne: ${n.overdue}\nFærdige denne uge: ${n.completed}`;try{await navigator.clipboard.writeText(text);showToast('Ugestatus kopieret')}catch{prompt('Kopiér status:',text)}};
  byId('clearActivityBtn').onclick=()=>confirm('Ryd den fælles aktivitetslog?')&&mutate(()=>request('activities',{method:'DELETE'}),'Aktivitetsloggen er ryddet');
  byId('notificationBtn').onclick=async()=>{if(!('Notification'in window))return showToast('Denne browser understøtter ikke notifikationer');if(await Notification.requestPermission()==='granted'){byId('notificationBtn').textContent='Notifikationer aktive';systemNotification('EJ ApS To Do','Notifikationer er aktiveret.','notification-test')}};
  byId('calendarAllBtn').onclick=async()=>{const feed=`${CALENDAR}?team=${encodeURIComponent(teamCode)}`;try{await navigator.clipboard.writeText(feed)}catch{}if(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent))location.href=feed.replace(/^https:/,'webcal:');else prompt('Tilføj dette link som internetkalender i Google Kalender eller Outlook:',feed)};
  byId('backupBtn').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify({tasks:state.tasks,comments:state.comments},null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='EJ-ApS-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  byId('restoreBtn').onclick=()=>byId('restoreFile').click();
  byId('restoreFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const backup=JSON.parse(await file.text());if(!Array.isArray(backup.tasks))throw new Error('Backupfilen er ugyldig');if(!confirm(`Gendan ${backup.tasks.length} opgaver?`))return;for(const t of backup.tasks){const body={title:t.title,category:t.category,owner:t.owner,priority:t.priority,status:t.status,deadline_date:t.deadline_date||null,deadline_time:t.deadline_time||null,reminder_minutes:Number(t.reminder_minutes??1440),notes:t.notes||'',depends_on:t.depends_on||null,actor:currentUser};if(state.tasks.some(x=>x.id===t.id))await request(`tasks/${t.id}`,{method:'PATCH',body});else await request('tasks',{method:'POST',body})}await loadSnapshot(true);showToast('Backup er gendannet')}catch(error){showToast(error.message||'Backupfilen kunne ikke læses')}finally{e.target.value=''}};
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.installPrompt=e});
  byId('installBtn').onclick=async()=>{if(state.installPrompt){state.installPrompt.prompt();await state.installPrompt.userChoice;state.installPrompt=null}else byId('installDialog').showModal()};
  window.addEventListener('online',()=>loadSnapshot(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadSnapshot(true)});
}
function init(){byId('newCategory').innerHTML=CATEGORIES.map(c=>`<option>${escapeHtml(c)}</option>`).join('');bindEvents();if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js?v=5');if('Notification'in window&&Notification.permission==='granted')byId('notificationBtn').textContent='Notifikationer aktive';loadSnapshot(true);setInterval(()=>loadSnapshot(false),5000)}
document.addEventListener('DOMContentLoaded',init);
