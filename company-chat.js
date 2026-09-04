'use strict';

(() => {
  const SUPABASE_URL = 'https://mjzylixznhavpfwdwovc.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable__SKXSCwCGD024us-MWHyEA_bNL8Y-kt';
  const WORKSPACE_ID = '7c891748-38d0-4b4c-a667-792e2c31952b';
  const CHANNELS = ['Generelt','Kunder','Økonomi','Idéer','Beslutninger','Vigtigt'];
  const CATEGORY_OPTIONS = ['1. Aftal rammerne mellem ejerne','2. Lav ejeraftale','3. Stift selskabet','4. Ejerforhold','5. Bank, skat og økonomi','6. Praktisk drift','7. Før I går i gang'];
  let activeChannel = localStorage.getItem('ejaps_company_channel_v1') || 'Generelt';
  let messages = [];
  let seenIds = new Set();
  let firstLoad = true;
  let panelOpen = false;
  let pendingMessageId = '';

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (value) => value ? new Intl.DateTimeFormat('da-DK',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : '';

  function actor() { return typeof currentUser === 'string' ? currentUser : ''; }
  function code() { return typeof teamCode === 'string' ? teamCode : ''; }

  async function rest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set('apikey', PUBLISHABLE_KEY);
    headers.set('x-ej-team-code', code());
    headers.set('x-ej-actor', actor());
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type','application/json');
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...options, headers, cache:'no-store' });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(data?.message || data?.error || `Fejl ${response.status}`);
    return data;
  }

  function buildUi() {
    if (document.getElementById('companyPanel')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <nav id="bottomNav" class="bottom-nav" aria-label="Hovedmenu">
        <button type="button" data-nav="today"><span class="nav-icon">☀</span>I dag</button>
        <button type="button" data-nav="tasks" class="active"><span class="nav-icon">✓</span>Opgaver</button>
        <button type="button" data-nav="company"><span class="nav-icon">💬</span>Firma <span id="companyUnread" class="company-unread" hidden>0</span></button>
        <button type="button" data-nav="activity"><span class="nav-icon">↻</span>Aktivitet</button>
      </nav>
      <section id="companyPanel" class="company-panel" hidden>
        <div class="company-shell">
          <header class="company-header">
            <div class="company-header-row">
              <div><h2>Firma</h2><p>Kun E&amp;J ApS · fælles beskeder mellem Emil og Jesper</p></div>
              <button id="companyClose" type="button" class="company-close">Luk</button>
            </div>
          </header>
          <div id="companyTabs" class="company-tabs"></div>
          <div id="companyChat" class="company-chat"><div class="company-empty">Henter beskeder…</div></div>
          <div class="company-note">Brug området til kunder, økonomi, idéer og beslutninger om firmaet.</div>
          <form id="companyComposer" class="company-composer">
            <textarea id="companyMessage" maxlength="4000" placeholder="Skriv om E&J ApS…" required></textarea>
            <button type="submit" class="button company-send">Send</button>
          </form>
        </div>
      </section>
      <dialog id="messageTaskDialog" class="task-from-message-dialog">
        <div class="task-from-message-card">
          <h3>Lav beskeden til en opgave</h3>
          <p id="messageTaskPreview"></p>
          <div class="task-from-message-grid">
            <label>Kategori<select id="messageTaskCategory"></select></label>
            <label>Ansvarlig<select id="messageTaskOwner"><option>Fælles</option><option>Emil</option><option>Jesper</option></select></label>
            <label>Prioritet<select id="messageTaskPriority"><option>Høj</option><option selected>Mellem</option><option>Lav</option></select></label>
          </div>
          <div class="task-from-message-actions">
            <button id="messageTaskCancel" type="button" class="button">Annuller</button>
            <button id="messageTaskCreate" type="button" class="button primary">Opret opgave</button>
          </div>
        </div>
      </dialog>`);
    document.getElementById('companyTabs').innerHTML = CHANNELS.map(c => `<button type="button" class="company-tab ${c===activeChannel?'active':''}" data-channel="${esc(c)}">${esc(c)}</button>`).join('');
    document.getElementById('messageTaskCategory').innerHTML = CATEGORY_OPTIONS.map(c=>`<option>${esc(c)}</option>`).join('');
  }

  function setNav(name) {
    document.querySelectorAll('#bottomNav [data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
  }

  function openCompany() {
    panelOpen = true;
    document.getElementById('companyPanel').hidden = false;
    setNav('company');
    clearUnread();
    loadMessages(true);
    setTimeout(()=>document.getElementById('companyMessage')?.focus(),100);
  }

  function closeCompany(nav='tasks') {
    panelOpen = false;
    document.getElementById('companyPanel').hidden = true;
    setNav(nav);
  }

  function clearUnread() {
    const badge=document.getElementById('companyUnread');
    badge.hidden=true;badge.textContent='0';
  }

  function addUnread(count=1) {
    if (panelOpen) return;
    const badge=document.getElementById('companyUnread');
    const next=Number(badge.textContent||0)+count;
    badge.textContent=String(next);badge.hidden=false;
  }

  function renderTabs() {
    document.querySelectorAll('.company-tab').forEach(b=>b.classList.toggle('active',b.dataset.channel===activeChannel));
  }

  function renderMessages() {
    const host=document.getElementById('companyChat');
    const list=messages.filter(m=>m.channel===activeChannel);
    if(!list.length){host.innerHTML=`<div class="company-empty"><strong>Ingen beskeder i ${esc(activeChannel)} endnu.</strong><br>Skriv den første besked her.</div>`;return}
    host.innerHTML=list.map(m=>{
      const mine=m.author===actor();
      return `<div class="message-row ${mine?'mine':''}" data-message-id="${m.id}"><div class="message-bubble"><div class="message-head"><strong>${esc(m.author)}</strong><span>${esc(fmt(m.created_at))}</span></div><div class="message-body">${esc(m.body)}</div>${m.task_id?'<span class="message-task-badge">✓ Opgave oprettet</span>':''}<div class="message-actions"><button type="button" class="decision" data-msg-action="decision">Gem som beslutning</button><button type="button" data-msg-action="task">Lav opgave</button>${mine?'<button type="button" class="danger" data-msg-action="delete">Slet</button>':''}</div></div></div>`
    }).join('');
    host.scrollTop=host.scrollHeight;
  }

  async function loadMessages(force=false) {
    try {
      const data=await rest(`company_messages?workspace_id=eq.${WORKSPACE_ID}&select=*&order=created_at.asc&limit=300`);
      const incoming=Array.isArray(data)?data:[];
      const newFromOther=firstLoad?[]:incoming.filter(m=>!seenIds.has(m.id)&&m.author!==actor());
      messages=incoming;seenIds=new Set(messages.map(m=>m.id));
      if(force||panelOpen) renderMessages();
      if(newFromOther.length){addUnread(newFromOther.length);for(const m of newFromOther){window.showToast?.(`${m.author} skrev i Firma · ${m.channel}`);if(typeof systemNotification==='function')systemNotification(`${m.author} · Firma`,m.body.slice(0,140),`firmachat-${m.id}`)}}
      firstLoad=false;
    } catch(error) {
      if(panelOpen) document.getElementById('companyChat').innerHTML=`<div class="company-empty"><strong>Firma-chat kunne ikke hentes.</strong><br>${esc(error.message)}</div>`;
    }
  }

  async function sendMessage(text,channel=activeChannel,sourceId=null) {
    if(!actor()){window.showToast?.('Vælg først Emil eller Jesper under Navn');return false}
    const body={workspace_id:WORKSPACE_ID,channel,author:actor(),body:text};
    if(sourceId)body.source_message_id=sourceId;
    await rest('company_messages',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
    await loadMessages(true);return true;
  }

  async function deleteMessage(id) {
    await rest(`company_messages?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${WORKSPACE_ID}`,{method:'DELETE'});
    await loadMessages(true);
  }

  function openTaskDialog(id) {
    const message=messages.find(m=>m.id===id);if(!message)return;
    if(!actor()){window.showToast?.('Vælg først Navn');return}
    pendingMessageId=id;
    document.getElementById('messageTaskPreview').textContent=message.body;
    document.getElementById('messageTaskOwner').value='Fælles';
    document.getElementById('messageTaskPriority').value=message.channel==='Vigtigt'?'Høj':'Mellem';
    document.getElementById('messageTaskDialog').showModal();
  }

  async function createTaskFromMessage() {
    const message=messages.find(m=>m.id===pendingMessageId);if(!message)return;
    const payload={title:message.body.slice(0,220),category:document.getElementById('messageTaskCategory').value,owner:document.getElementById('messageTaskOwner').value,priority:document.getElementById('messageTaskPriority').value,status:'Ikke startet',notes:`Oprettet fra Firma · ${message.channel} · ${message.author}`,actor:actor()};
    try{
      if(typeof request!=='function')throw new Error('Opgavefunktionen er ikke klar');
      await request('tasks',{method:'POST',body:payload});
      document.getElementById('messageTaskDialog').close();pendingMessageId='';
      if(typeof loadSnapshot==='function')await loadSnapshot(true);
      window.showToast?.('Beskeden er lavet til en opgave');
    }catch(error){window.showToast?.(error.message||'Kunne ikke oprette opgaven')}
  }

  function bind() {
    document.getElementById('bottomNav').addEventListener('click',e=>{
      const b=e.target.closest('[data-nav]');if(!b)return;const nav=b.dataset.nav;
      if(nav==='company')return openCompany();
      closeCompany(nav);
      if(nav==='today'){document.getElementById('todayModeBtn')?.click();document.getElementById('nextActions')?.scrollIntoView({behavior:'smooth',block:'start'})}
      if(nav==='tasks'){document.getElementById('allModeBtn')?.click();document.getElementById('taskRoot')?.scrollIntoView({behavior:'smooth',block:'start'})}
      if(nav==='activity'){const log=document.getElementById('activityLog');const details=log?.closest('details');if(details)details.open=true;log?.scrollIntoView({behavior:'smooth',block:'center'})}
    });
    document.getElementById('companyClose').onclick=()=>closeCompany('tasks');
    document.getElementById('companyTabs').onclick=e=>{const b=e.target.closest('[data-channel]');if(!b)return;activeChannel=b.dataset.channel;localStorage.setItem('ejaps_company_channel_v1',activeChannel);renderTabs();renderMessages()};
    document.getElementById('companyComposer').onsubmit=async e=>{e.preventDefault();const input=document.getElementById('companyMessage'),text=input.value.trim();if(!text)return;try{if(await sendMessage(text)){input.value='';input.focus()}}catch(error){window.showToast?.(error.message||'Beskeden kunne ikke sendes')}};
    document.getElementById('companyChat').onclick=async e=>{const button=e.target.closest('[data-msg-action]');if(!button)return;const row=button.closest('[data-message-id]'),id=row.dataset.messageId,msg=messages.find(m=>m.id===id);if(!msg)return;try{if(button.dataset.msgAction==='decision'){if(msg.channel==='Beslutninger')return window.showToast?.('Beskeden er allerede en beslutning');await sendMessage(msg.body,'Beslutninger',id);window.showToast?.('Gemt under Beslutninger')}if(button.dataset.msgAction==='task')openTaskDialog(id);if(button.dataset.msgAction==='delete'&&confirm('Slet beskeden?')){await deleteMessage(id);window.showToast?.('Beskeden er slettet')}}catch(error){window.showToast?.(error.message||'Handlingen kunne ikke gennemføres')}};
    document.getElementById('messageTaskCancel').onclick=()=>{pendingMessageId='';document.getElementById('messageTaskDialog').close()};
    document.getElementById('messageTaskCreate').onclick=createTaskFromMessage;
  }

  document.addEventListener('DOMContentLoaded',()=>{buildUi();bind();loadMessages(false);setInterval(()=>loadMessages(false),5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadMessages(false)})});
})();
