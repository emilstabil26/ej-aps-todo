'use strict';

(() => {
  const MILESTONE_KEY = 'ejaps_seen_milestones_v1';
  const completionQueue = new Map();
  const confidence = [
    [0,'I er i gang — det vigtigste er, at I faktisk får taget beslutningerne én efter én.'],
    [25,'25 % er nået. I har allerede flyttet projektet fra idé til reel fremdrift.'],
    [50,'Halvvejs. I har bevist, at I kan holde struktur og få ting gennemført sammen.'],
    [75,'75 % er nået. Nu er det ikke længere bare en plan — I er tæt på en færdig virksomhedsopstart.'],
    [100,'100 %. I har gennemført hele opstartsplanen. Det er stærkt arbejde og et solidt fundament for E&J ApS.']
  ];

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function currentProgress(){const total=Number(document.getElementById('totalCount')?.textContent||0),done=Number(document.getElementById('doneCount')?.textContent||0);return total?Math.round(done/total*100):0}
  function taskCards(){return [...document.querySelectorAll('.task-card')]}
  function cardTitle(card){return card.querySelector('.task-title')?.textContent?.trim()||''}
  function cardOwner(card){const badges=[...card.querySelectorAll('.task-badges .badge')].map(x=>x.textContent.trim());return badges.find(x=>['Emil','Jesper','Fælles'].includes(x))||'Fælles'}
  function cardPriority(card){const badges=[...card.querySelectorAll('.task-badges .badge')].map(x=>x.textContent.trim());return badges.find(x=>['Høj','Mellem','Lav'].includes(x))||'Mellem'}
  function cardStatus(card){const badges=[...card.querySelectorAll('.task-badges .badge')].map(x=>x.textContent.trim());return badges.find(x=>['Ikke startet','I gang','Afventer','Færdig','Blokeret'].includes(x))||'Ikke startet'}
  function cardDate(card){const value=card.querySelector('[data-field="deadline_date"]')?.value;return value||''}
  function score(card){
    const status=cardStatus(card); if(status==='Færdig') return -999;
    let s=0; const p=cardPriority(card); if(p==='Høj')s+=50;else if(p==='Mellem')s+=20;
    if(status==='I gang')s+=40; if(status==='Blokeret')s-=30;
    const d=cardDate(card); if(d){const today=new Date();today.setHours(0,0,0,0);const dt=new Date(`${d}T00:00:00`);const days=Math.round((dt-today)/86400000);if(days<0)s+=80;else if(days===0)s+=70;else if(days<=3)s+=45;else if(days<=7)s+=25}
    return s;
  }
  function renderConfidence(){
    const host=document.getElementById('confidenceCard'); if(!host)return;
    const p=currentProgress(); let chosen=confidence[0]; for(const item of confidence)if(p>=item[0])chosen=item;
    host.innerHTML=`<strong>${p}% gennemført</strong><p>${esc(chosen[1])}</p>`;
  }
  function renderNext(){
    const host=document.getElementById('nextActions'); if(!host)return;
    const cards=taskCards().filter(c=>cardStatus(c)!=='Færdig').sort((a,b)=>score(b)-score(a)).slice(0,3);
    if(!cards.length){host.innerHTML='<div class="today-empty">Alle opgaver er færdige 🎉</div>';return}
    host.innerHTML=cards.map((card,i)=>`<article class="focus-action"><strong>${i+1}. ${esc(cardTitle(card))}</strong><div class="focus-action-meta"><span>${esc(cardOwner(card))}</span><span>·</span><span>${esc(cardPriority(card))}</span>${cardDate(card)?`<span>·</span><span>${esc(cardDate(card))}</span>`:''}</div><button class="button small" data-focus-id="${esc(card.dataset.taskId)}">Åbn opgave</button></article>`).join('');
  }
  function applyTodayMode(on){
    const today=new Date().toISOString().slice(0,10); let visible=0;
    document.querySelectorAll('.category').forEach(section=>{let count=0;section.querySelectorAll('.task-card').forEach(card=>{const due=cardDate(card),status=cardStatus(card),show=!on||(status!=='Færdig'&&(due===today||(due&&due<today)||status==='I gang'));card.classList.toggle('today-hidden',!show);if(show)count++});section.classList.toggle('today-hidden',on&&count===0);visible+=count});
    document.getElementById('todayModeBtn')?.classList.toggle('primary',on);
    document.getElementById('allModeBtn')?.classList.toggle('primary',!on);
    const empty=document.getElementById('todayEmpty'); if(empty)empty.hidden=!(on&&visible===0);
    sessionStorage.setItem('ejaps_today_mode',on?'1':'0');
  }
  function showMilestoneIfNeeded(){
    const p=currentProgress(); const reached=[25,50,75,100].filter(x=>p>=x); if(!reached.length)return;
    const seen=new Set(JSON.parse(localStorage.getItem(MILESTONE_KEY)||'[]')); const newest=[...reached].reverse().find(x=>!seen.has(x)); if(!newest)return;
    seen.add(newest); localStorage.setItem(MILESTONE_KEY,JSON.stringify([...seen]));
    const text=confidence.find(x=>x[0]===newest)?.[1]||''; window.showToast?.(`🎉 ${newest}% nået — ${text}`); document.getElementById('confidenceCard')?.classList.add('milestone-pop');setTimeout(()=>document.getElementById('confidenceCard')?.classList.remove('milestone-pop'),700);
  }
  function openCompletionDialog(card,checkbox){
    const dlg=document.getElementById('completionDialog'); if(!dlg)return false;
    const id=card.dataset.taskId,title=cardTitle(card); completionQueue.set(id,{card,checkbox});
    document.getElementById('completionTaskTitle').textContent=title;
    document.getElementById('completionNote').value=''; document.getElementById('completionLink').value=''; dlg.dataset.taskId=id; dlg.showModal(); return true;
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const root=document.getElementById('taskRoot'); if(!root)return;
    const observer=new MutationObserver(()=>{renderNext();renderConfidence();showMilestoneIfNeeded();applyTodayMode(sessionStorage.getItem('ejaps_today_mode')==='1')}); observer.observe(root,{childList:true,subtree:true});
    root.addEventListener('click',e=>{const check=e.target.closest('[data-action="toggle"]');if(check&&check.checked){const card=check.closest('.task-card');if(openCompletionDialog(card,check)){e.preventDefault();e.stopImmediatePropagation();check.checked=false;return}}
    },true);
    document.getElementById('nextActions')?.addEventListener('click',e=>{const b=e.target.closest('[data-focus-id]');if(!b)return;const card=document.querySelector(`.task-card[data-task-id="${CSS.escape(b.dataset.focusId)}"]`);if(card){card.scrollIntoView({behavior:'smooth',block:'center'});card.classList.add('milestone-pop');setTimeout(()=>card.classList.remove('milestone-pop'),700)}});
    document.getElementById('todayModeBtn')?.addEventListener('click',()=>applyTodayMode(true)); document.getElementById('allModeBtn')?.addEventListener('click',()=>applyTodayMode(false));
    document.getElementById('completionCancel')?.addEventListener('click',()=>{const id=document.getElementById('completionDialog').dataset.taskId,entry=completionQueue.get(id);if(entry)entry.checkbox.checked=false;completionQueue.delete(id);document.getElementById('completionDialog').close()});
    document.getElementById('completionSave')?.addEventListener('click',async()=>{const dlg=document.getElementById('completionDialog'),id=dlg.dataset.taskId,entry=completionQueue.get(id);if(!entry)return;const note=document.getElementById('completionNote').value.trim(),link=document.getElementById('completionLink').value.trim();if(!note){window.showToast?.('Skriv kort hvad der blev gjort');return}try{await request(`tasks/${id}`,{method:'PATCH',body:{status:'Færdig',completion_note:note,completion_link:link,actor:currentUser}});dlg.close();completionQueue.delete(id);await loadSnapshot(true);window.showToast?.('Opgaven er færdig og dokumenteret')}catch(err){window.showToast?.(err.message||'Kunne ikke gemme dokumentationen')}});
    document.getElementById('completionSkip')?.addEventListener('click',async()=>{const dlg=document.getElementById('completionDialog'),id=dlg.dataset.taskId;try{await request(`tasks/${id}`,{method:'PATCH',body:{status:'Færdig',actor:currentUser}});dlg.close();completionQueue.delete(id);await loadSnapshot(true)}catch(err){window.showToast?.(err.message||'Kunne ikke markere opgaven færdig')}});
    setTimeout(()=>{renderNext();renderConfidence();showMilestoneIfNeeded();applyTodayMode(sessionStorage.getItem('ejaps_today_mode')==='1')},700);
  });
})();
