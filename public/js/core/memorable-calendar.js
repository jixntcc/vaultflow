/*
 * VaultFlow Memorable Calendar
 *
 * Stores significant events by their real date, while the calendar groups
 * every year together by month/day. Example: Sep 1 can show both Sep 1,
 * 2026 "Mumbai trip" and Sep 1, 2025 "Accident".
 */
(function(window, document) {
  'use strict';

  if (window.__vfMemorableCalendarInstalled) return;
  window.__vfMemorableCalendarInstalled = true;

  const PAGE_ID = 'memories';
  const NAV_SELECTOR = '.nav-item[data-page]';
  const API_URL = '/api/memories';
  const CATEGORIES = ['Travel','Milestone','Accident','Relationship','Work','Family','Health','Personal','Other'];
  const ICONS = { Travel:'✈️', Milestone:'🏆', Accident:'⚠️', Relationship:'❤️', Work:'💼', Family:'👨‍👩‍👧', Health:'❤️', Personal:'✨', Other:'●' };

  const state = { month:new Date(new Date().getFullYear(), new Date().getMonth(), 1), selectedDate:null, events:[], loading:false };

  const pad=n=>String(n).padStart(2,'0');
  const localDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const parseDate=v=>{const [y,m,d]=String(v).split('-').map(Number);return new Date(y,m-1,d);};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token=()=>localStorage.getItem('vf_token')||window.__VAULTFLOW_TOKEN__||'';
  const today=()=>localDate(new Date());
  const eventsForDate=d=>state.events.filter(e=>String(e.date)===d).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const eventsForMonthDay=(month,day)=>state.events.filter(e=>{const d=parseDate(e.date);return d.getMonth()+1===month&&d.getDate()===day;}).sort((a,b)=>String(b.date).localeCompare(String(a.date)));

  function monthDays() {
    const first=new Date(state.month.getFullYear(),state.month.getMonth(),1);
    const start=new Date(first); start.setDate(start.getDate()-((first.getDay()+6)%7));
    return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});
  }

  function fetchJson(url, options={}) {
    return fetch(url,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`,...(options.headers||{})}})
      .then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`Request failed (${r.status})`);return data;});
  }

  function ensureNavItem() {
    if(document.querySelector(`${NAV_SELECTOR}[data-page="${PAGE_ID}"]`))return;
    const nav=document.querySelector('.sidebar nav'); if(!nav)return;
    const item=document.createElement('div'); item.className='nav-item'; item.dataset.page=PAGE_ID;
    item.innerHTML='<span>🗓️</span><span>Memories</span>'; nav.appendChild(item);
  }

  function ensurePage() {
    if(document.getElementById(PAGE_ID))return document.getElementById(PAGE_ID);
    const main=document.querySelector('.main-content'); if(!main)return null;
    const page=document.createElement('section'); page.className='page'; page.id=PAGE_ID;
    page.innerHTML=`
      <div class="page-header">
        <div class="memory-toolbar">
          <div class="memory-toolbar-copy">
            <h1 class="page-title">Memorable Calendar</h1>
            <p class="page-subtitle">Keep the moments that matter, and see what happened on this day across the years.</p>
          </div>
          <div class="memory-toolbar-actions">
            <button type="button" class="btn btn-secondary" id="memoryRefreshButton">↻ Refresh</button>
            <button type="button" class="btn btn-primary" id="memoryAddButton">+ Add Memory</button>
          </div>
        </div>
      </div>
      <section class="memory-calendar-card">
        <div class="memory-calendar-head">
          <div><div class="vf-eyebrow">On this calendar</div><h2 id="memoryMonthTitle"></h2><p>Select a date to see memories from every year.</p></div>
          <div class="memory-calendar-actions"><button class="memory-icon-btn" data-memory-month="prev">‹</button><button class="memory-today-btn" data-memory-month="today">Today</button><button class="memory-icon-btn" data-memory-month="next">›</button></div>
        </div>
        <div class="memory-weekdays">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>`<div>${x}</div>`).join('')}</div>
        <div class="memory-grid" id="memoryGrid"></div>
        <div class="memory-calendar-legend"><span>• days with memories</span><span>Selected date groups all years</span></div>
      </section>
      <section class="memory-day-card">
        <div class="memory-day-head"><div><div class="vf-eyebrow">On this day</div><h2 id="memoryDayTitle"></h2><p id="memoryDaySubtitle"></p></div><button type="button" class="btn btn-primary" id="memoryAddSelectedButton">+ Add Here</button></div>
        <div class="memory-day-list" id="memoryDayList"></div>
      </section>
      <div class="memory-modal" id="memoryModal" hidden>
        <div class="memory-modal-backdrop" data-memory-close></div>
        <div class="memory-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="memoryModalTitle">
          <div class="memory-modal-header"><div><h2 id="memoryModalTitle">Add Memory</h2><p>Record a significant moment from your life.</p></div><button type="button" class="memory-modal-close" data-memory-close>×</button></div>
          <form id="memoryForm" class="memory-form">
            <input type="hidden" id="memoryId">
            <div class="memory-form-grid">
              <label>Date<input id="memoryDate" type="date" required></label>
              <label>Category<select id="memoryCategory">${CATEGORIES.map(x=>`<option value="${x}">${x}</option>`).join('')}</select></label>
              <label class="memory-form-wide">Title<input id="memoryTitle" maxlength="160" placeholder="e.g. Trip to Mumbai" required></label>
              <label class="memory-form-wide">Location<input id="memoryLocation" maxlength="160" placeholder="Optional"></label>
              <label class="memory-form-wide">Description<textarea id="memoryDescription" maxlength="3000" placeholder="What do you want to remember about this day?"></textarea></label>
            </div>
            <div class="memory-form-error" id="memoryFormError" hidden></div>
            <div class="memory-form-footer"><button type="button" class="btn btn-secondary" data-memory-close>Cancel</button><button type="submit" class="btn btn-primary" id="memorySaveButton">Save Memory</button></div>
          </form>
        </div>
      </div>`;
    main.appendChild(page);
    page.querySelector('#memoryRefreshButton').addEventListener('click',loadMemories);
    page.querySelector('#memoryAddButton').addEventListener('click',()=>openForm());
    page.querySelector('#memoryAddSelectedButton').addEventListener('click',()=>openForm(null,state.selectedDate||today()));
    page.querySelector('#memoryForm').addEventListener('submit',saveForm);
    page.addEventListener('click',event=>{
      const close=event.target.closest('[data-memory-close]'); if(close)closeForm();
      const month=event.target.closest('[data-memory-month]'); if(month){changeMonth(month.dataset.memoryMonth);return;}
      const day=event.target.closest('[data-memory-date]'); if(day){selectDate(day.dataset.memoryDate);return;}
      const edit=event.target.closest('[data-memory-edit]'); if(edit)openForm(edit.dataset.memoryEdit);
      const remove=event.target.closest('[data-memory-delete]'); if(remove)deleteMemory(remove.dataset.memoryDelete);
    });
    return page;
  }

  function renderCalendar() {
    const grid=document.getElementById('memoryGrid'); if(!grid)return;
    const title=state.month.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    document.getElementById('memoryMonthTitle').textContent=title;
    const current=today();
    grid.innerHTML=monthDays().map(d=>{
      const ds=localDate(d), inMonth=d.getMonth()===state.month.getMonth();
      const md=eventsForMonthDay(d.getMonth()+1,d.getDate());
      return `<button type="button" class="memory-day ${inMonth?'':'outside'} ${state.selectedDate===ds?'selected':''} ${current===ds?'today':''}" data-memory-date="${ds}">
        <span class="memory-day-number">${d.getDate()}</span>
        ${md.length?`<span class="memory-day-count">${md.length} ${md.length===1?'memory':'memories'}</span><span class="memory-dots">${md.slice(0,4).map(()=>'<i class="memory-dot"></i>').join('')}${md.length>4?'<span class="memory-dot more">+</span>':''}</span>`:''}
      </button>`;
    }).join('');
  }

  function renderSelectedDay() {
    const ds=state.selectedDate||today(), d=parseDate(ds), items=eventsForMonthDay(d.getMonth()+1,d.getDate());
    const label=d.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});
    document.getElementById('memoryDayTitle').textContent=label;
    document.getElementById('memoryDaySubtitle').textContent=items.length?`${items.length} ${items.length===1?'memory':'memories'} from across the years`:'No memories recorded for this date yet.';
    const list=document.getElementById('memoryDayList');
    list.innerHTML=items.length?items.map(e=>`
      <article class="memory-item">
        <div class="memory-icon">${ICONS[e.category]||ICONS.Other}</div>
        <div>
          <div class="memory-title">${esc(e.title)}</div>
          <div class="memory-meta"><span class="memory-year">${esc(String(e.date).slice(0,4))}</span><span>${esc(e.category||'Personal')}</span>${e.location?`<span>📍 ${esc(e.location)}</span>`:''}</div>
          ${e.description?`<div class="memory-description">${esc(e.description)}</div>`:''}
        </div>
        <div class="memory-actions"><button class="memory-action" data-memory-edit="${esc(e._id)}">Edit</button><button class="memory-action memory-delete" data-memory-delete="${esc(e._id)}">Delete</button></div>
      </article>`).join(''):'<div class="memory-empty">Nothing recorded here yet. Add a memory to make this date meaningful.</div>';
  }

  function render(){ if(!document.getElementById(PAGE_ID)?.classList.contains('active'))return; if(!state.selectedDate)state.selectedDate=today(); renderCalendar(); renderSelectedDay(); }

  async function loadMemories(){
    const page=ensurePage(); if(!page)return;
    state.loading=true;
    const list=document.getElementById('memoryDayList'); if(list)list.innerHTML='<div class="memory-loading">Loading memories…</div>';
    try { state.events=await fetchJson(API_URL); if(!state.selectedDate)state.selectedDate=today(); render(); }
    catch(error){ if(list)list.innerHTML=`<div class="memory-error">${esc(error.message)}</div>`; }
    finally { state.loading=false; }
  }

  function selectDate(ds){
    state.selectedDate=ds;
    const d=parseDate(ds); state.month=new Date(d.getFullYear(),d.getMonth(),1);
    render();
  }

  function changeMonth(direction){
    if(direction==='today'){const d=new Date();state.month=new Date(d.getFullYear(),d.getMonth(),1);state.selectedDate=localDate(d);}
    else {state.month=new Date(state.month.getFullYear(),state.month.getMonth()+(direction==='next'?1:-1),1);state.selectedDate=localDate(state.month);}
    render();
  }

  function openForm(id=null,date=null){
    const modal=document.getElementById('memoryModal'), form=document.getElementById('memoryForm'); if(!modal||!form)return;
    form.reset(); document.getElementById('memoryId').value=''; document.getElementById('memoryCategory').value='Personal';
    const item=id?state.events.find(x=>String(x._id)===String(id)):null;
    document.getElementById('memoryModalTitle').textContent=item?'Edit Memory':'Add Memory';
    if(item){
      document.getElementById('memoryId').value=item._id;
      document.getElementById('memoryDate').value=item.date;
      document.getElementById('memoryCategory').value=item.category||'Personal';
      document.getElementById('memoryTitle').value=item.title||'';
      document.getElementById('memoryLocation').value=item.location||'';
      document.getElementById('memoryDescription').value=item.description||'';
    } else {
      document.getElementById('memoryDate').value=date||state.selectedDate||today();
    }
    document.getElementById('memoryFormError').hidden=true;
    modal.hidden=false; document.body.classList.add('memory-modal-open');
    document.getElementById('memoryTitle').focus();
  }

  function closeForm(){const modal=document.getElementById('memoryModal');if(modal){modal.hidden=true;document.body.classList.remove('memory-modal-open');}}

  async function saveForm(event){
    event.preventDefault();
    const id=document.getElementById('memoryId').value;
    const body={date:document.getElementById('memoryDate').value,category:document.getElementById('memoryCategory').value,title:document.getElementById('memoryTitle').value,location:document.getElementById('memoryLocation').value,description:document.getElementById('memoryDescription').value};
    const button=document.getElementById('memorySaveButton'), error=document.getElementById('memoryFormError');
    button.disabled=true; button.textContent='Saving…'; error.hidden=true;
    try {
      const saved=await fetchJson(id?`${API_URL}/${encodeURIComponent(id)}`:API_URL,{method:id?'PUT':'POST',body:JSON.stringify(body)});
      if(id){state.events=state.events.map(x=>String(x._id)===String(id)?saved:x);} else {state.events=[saved,...state.events];}
      state.selectedDate=saved.date; const d=parseDate(saved.date); state.month=new Date(d.getFullYear(),d.getMonth(),1);
      closeForm(); render();
    } catch(e){error.textContent=e.message;error.hidden=false;}
    finally{button.disabled=false;button.textContent='Save Memory';}
  }

  async function deleteMemory(id){
    const item=state.events.find(x=>String(x._id)===String(id));
    if(!item||!window.confirm(`Delete "${item.title}"?`))return;
    try { await fetchJson(`${API_URL}/${encodeURIComponent(id)}`,{method:'DELETE'}); state.events=state.events.filter(x=>String(x._id)!==String(id)); render(); }
    catch(e){window.alert(e.message);}
  }

  function showMemories(){
    ensureNavItem(); const page=ensurePage(); if(!page)return;
    document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll(NAV_SELECTOR).forEach(x=>x.classList.remove('active'));
    page.classList.add('active','vf-memories-active');
    const nav=document.querySelector(`${NAV_SELECTOR}[data-page="${PAGE_ID}"]`); if(nav)nav.classList.add('active');
    const sidebar=document.getElementById('sidebar'),overlay=document.getElementById('mobileOverlay');
    if(sidebar)sidebar.classList.remove('mobile-visible'); if(overlay)overlay.classList.remove('active'); document.body.classList.remove('mobile-nav-open');
    loadMemories();
  }

  function initialize(){
    ensureNavItem(); ensurePage();
    if(document.documentElement.dataset.vfMemoriesUi==='1')return;
    document.documentElement.dataset.vfMemoriesUi='1';
    document.addEventListener('click',event=>{
      const nav=event.target.closest(NAV_SELECTOR); if(!nav)return;
      if(nav.dataset.page===PAGE_ID){event.preventDefault();event.stopPropagation();showMemories();}
      else {const page=document.getElementById(PAGE_ID);if(page)page.classList.remove('active','vf-memories-active');}
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
  window.VaultFlowMemories={load:loadMemories,show:showMemories};
})(window, document);
