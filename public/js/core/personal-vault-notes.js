/* OS4.1E — Minimal, quick-capture notes workspace */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { notes: [], files: [], bound: false, loading: false, query: '' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const token = () => localStorage.getItem('vf_token');
  async function api(path, options = {}) {
    const value = token();
    if (!value) throw new Error('Your session is missing. Please sign in again.');
    const headers = { Authorization: 'Bearer ' + value, ...(options.body ? { 'Content-Type':'application/json' } : {}) };
    const response = await fetch(path, { ...options, headers, cache:'no-store' });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ')');
    return data;
  }
  function setFeedback(message, error=false) {
    const el=$('pvNoteFeedback'); if (!el) return;
    el.textContent=message; el.classList.toggle('is-error',error);
  }
  async function loadNotes() {
    if (state.loading) return;
    state.loading=true;
    $('pvNotesList').innerHTML='<p class="pv-loading">Loading notes…</p>';
    try {
      const data=await api('/api/notes?status=active&limit=100');
      state.notes=Array.isArray(data.notes)?data.notes:[];
      renderNotes();
    } catch(error) {
      $('pvNotesList').innerHTML='<p class="pv-error">'+esc(error.message)+'</p>';
    } finally { state.loading=false; }
  }
  function renderNotes() {
    const query=state.query.trim().toLowerCase();
    const notes=state.notes.filter(note=>!query || [note.title,note.content,note.category,...(note.tags||[])].join(' ').toLowerCase().includes(query));
    const pinned=notes.filter(note=>note.pinned), others=notes.filter(note=>!note.pinned);
    const card=note=>`
      <article class="pv-note-card" data-pv-note-open="${esc(note.id)}" tabindex="0" role="button" aria-label="Open note: ${esc(note.title||'Untitled')}">
        <div class="pv-note-card-top"><span class="pv-note-category">${esc(note.category||'Personal')}</span>${note.pinned?'<span class="pv-note-pinned" title="Pinned">Pinned</span>':''}</div>
        ${note.title?'<h3>'+esc(note.title)+'</h3>':''}
        <p class="pv-note-preview">${esc(note.content||'')}</p>
        ${(note.tags||[]).length?'<div class="pv-note-tags">'+note.tags.map(tag=>'<span>'+esc(tag)+'</span>').join('')+'</div>':''}
        <div class="pv-note-card-footer"><small>${note.updatedAt?new Date(note.updatedAt).toLocaleDateString():''}${(note.attachments||[]).length?' · '+note.attachments.length+' attachment(s)':''}</small>
          <div class="pv-note-actions"><button type="button" data-pv-note-pin="${esc(note.id)}" aria-label="${note.pinned?'Unpin':'Pin'} note" title="${note.pinned?'Unpin':'Pin'}">${note.pinned?'Unpin':'Pin'}</button><button type="button" data-pv-note-trash="${esc(note.id)}" aria-label="Move note to trash" title="Move to trash">Trash</button></div>
        </div>
      </article>`;
    let html='';
    if(pinned.length) html+='<div class="pv-note-group-label">Pinned</div><div class="pv-note-grid">'+pinned.map(card).join('')+'</div>';
    if(others.length) html+=(pinned.length?'<div class="pv-note-group-label pv-note-group-spaced">Others</div>':'')+'<div class="pv-note-grid">'+others.map(card).join('')+'</div>';
    if(!notes.length) html='<div class="pv-notes-empty"><span>✎</span><strong>'+(query?'No matching notes':'Your notes will appear here')+'</strong><small>'+(query?'Try another search term.':'Capture an idea, thought or reminder. Keep it simple.')+'</small></div>';
    $('pvNotesList').innerHTML=html;
    $('pvNotesCount').textContent=state.notes.length+' note'+(state.notes.length===1?'':'s');
  }
  async function loadAttachmentChoices(selected=[]) {
    $('pvNoteAttachmentChoices').innerHTML='<small>Loading your available files…</small>';
    try {
      const data=await api('/api/vault/files?limit=100&page=1');
      state.files=Array.isArray(data.files)?data.files:[];
      $('pvNoteAttachmentChoices').innerHTML=state.files.length ? state.files.map(file=>`
        <label class="pv-attachment-choice"><input type="checkbox" value="${esc(file.id)}" ${selected.includes(String(file.id))?'checked':''}><span>${esc(file.name)}</span><small>${esc(file.mimeType||'File')}</small></label>`).join('') : '<small>No verified files available to attach yet.</small>';
    } catch(error) { $('pvNoteAttachmentChoices').innerHTML='<small class="pv-error">'+esc(error.message)+'</small>'; }
  }
  function openEditor(note=null) {
    $('pvNoteForm').reset();
    $('pvNoteId').value=note?.id||'';
    $('pvNoteEditorTitle').textContent=note?'Edit note':'New note';
    $('pvNoteTitle').value=note?.title||'';
    $('pvNoteCategory').value=note?.category||'Personal';
    $('pvNoteTags').value=(note?.tags||[]).join(', ');
    $('pvNoteContent').value=note?.content||'';
    $('pvNoteSave').textContent=note?'Save changes':'Save note';
    setFeedback('');
    $('pvNoteModal').hidden=false;
    loadAttachmentChoices(note?.attachments||[]);
    $('pvNoteTitle').focus();
  }
  function closeEditor() { $('pvNoteModal').hidden=true; }
  async function saveNote(event) {
    event.preventDefault();
    const id=$('pvNoteId').value;
    const attachments=[...$('pvNoteAttachmentChoices').querySelectorAll('input[type="checkbox"]:checked')].map(input=>input.value);
    const payload={title:$('pvNoteTitle').value.trim(),category:$('pvNoteCategory').value.trim()||'Personal',tags:$('pvNoteTags').value.split(',').map(tag=>tag.trim()).filter(Boolean),content:$('pvNoteContent').value,attachments};
    if(!payload.title && !payload.content.trim()) return setFeedback('Write a title or some note content first.',true);
    if(!payload.title) payload.title=payload.content.trim().split(/\s+/).slice(0,6).join(' ').slice(0,160);
    $('pvNoteSave').disabled=true;
    try {
      await api(id?'/api/notes/'+encodeURIComponent(id):'/api/notes',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});
      closeEditor(); await loadNotes();
    } catch(error) { setFeedback(error.message,true); }
    finally { $('pvNoteSave').disabled=false; }
  }
  async function mutateNote(id, method, body) {
    try { await api('/api/notes/'+encodeURIComponent(id),{method,...(body?{body:JSON.stringify(body)}:{})}); await loadNotes(); }
    catch(error) { window.alert(error.message); }
  }
  function openFromTarget(target) {
    const card=target.closest('[data-pv-note-open]');
    if(!card || target.closest('button')) return;
    const note=state.notes.find(item=>item.id===card.dataset.pvNoteOpen);
    if(note) openEditor(note);
  }
  function init() {
    const root=$('personalVaultPage');
    if(!root||state.bound) return;
    state.bound=true;
    $('pvQuickNote').addEventListener('click',()=>openEditor());
    $('pvQuickNoteInput').addEventListener('focus',()=>openEditor());
    $('pvNoteSearch').addEventListener('input',event=>{state.query=event.target.value;renderNotes();});
    $('pvNoteForm').addEventListener('submit',saveNote);
    $('pvNoteClose').addEventListener('click',closeEditor);
    $('pvNoteCancel').addEventListener('click',closeEditor);
    $('pvNoteModal').addEventListener('click',event=>{if(event.target===$('pvNoteModal'))closeEditor();});
    $('pvNotesList').addEventListener('click',event=>{
      openFromTarget(event.target);
      const pin=event.target.closest('[data-pv-note-pin]'), trash=event.target.closest('[data-pv-note-trash]');
      if(pin){const note=state.notes.find(item=>item.id===pin.dataset.pvNotePin);if(note)mutateNote(note.id,'PATCH',{pinned:!note.pinned});}
      else if(trash){const note=state.notes.find(item=>item.id===trash.dataset.pvNoteTrash);if(note&&window.confirm('Move this note to Trash? Attached files will remain in your vault.'))mutateNote(note.id,'DELETE');}
    });
    $('pvNotesList').addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-pv-note-open]')){event.preventDefault();openFromTarget(event.target);}});
  }
  window.PersonalVaultNotes=Object.freeze({load:loadNotes});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();