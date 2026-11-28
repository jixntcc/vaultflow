/* OS4.1E — Notes editor and file attachments */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const state = { notes: [], files: [], bound: false, loading: false };
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
    $('pvNotesList').innerHTML=state.notes.length ? state.notes.map(note=>`
      <article class="pv-note-row">
        <div class="pv-note-main"><h3>${esc(note.title)}</h3><p>${esc((note.content||'').slice(0,180))}${(note.content||'').length>180?'…':''}</p>
          <small>${esc(note.category||'Personal')} · Updated ${note.updatedAt?new Date(note.updatedAt).toLocaleDateString():''} · ${(note.attachments||[]).length} attachment(s)</small>
          <div class="pv-note-tags">${(note.tags||[]).map(tag=>'<span>'+esc(tag)+'</span>').join('')}</div>
        </div>
        <div class="pv-note-actions"><button type="button" data-pv-note-edit="${esc(note.id)}">Edit</button><button type="button" data-pv-note-pin="${esc(note.id)}">${note.pinned?'Unpin':'Pin'}</button><button type="button" data-pv-note-trash="${esc(note.id)}">Trash</button></div>
      </article>`).join('') : '<div class="pv-empty-mini"><span>📝</span><strong>No notes yet</strong><small>Create your first private note.</small></div>';
  }
  async function loadAttachmentChoices(selected=[]) {
    $('pvNoteAttachmentChoices').innerHTML='<small>Loading your available files…</small>';
    try {
      const data=await api('/api/vault/files?limit=100&page=1');
      state.files=Array.isArray(data.files)?data.files:[];
      $('pvNoteAttachmentChoices').innerHTML=state.files.length ? state.files.map(file=>`
        <label class="pv-attachment-choice"><input type="checkbox" value="${esc(file.id)}" ${selected.includes(String(file.id))?'checked':''}><span>${esc(file.name)}</span><small>${esc(file.mimeType||'File')}</small></label>`).join('') : '<small>No available files to attach. Files must pass verification before they can be attached.</small>';
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
    const payload={
      title:$('pvNoteTitle').value.trim(),
      category:$('pvNoteCategory').value.trim()||'Personal',
      tags:$('pvNoteTags').value.split(',').map(tag=>tag.trim()).filter(Boolean),
      content:$('pvNoteContent').value,
      attachments
    };
    if(!payload.title) return setFeedback('A title is required.',true);
    $('pvNoteSave').disabled=true;
    try {
      await api(id?'/api/notes/'+encodeURIComponent(id):'/api/notes',{method:id?'PATCH':'POST',body:JSON.stringify(payload)});
      closeEditor();
      await loadNotes();
    } catch(error) { setFeedback(error.message,true); }
    finally { $('pvNoteSave').disabled=false; }
  }
  async function mutateNote(id, method, body, success) {
    try { await api('/api/notes/'+encodeURIComponent(id),{method,...(body?{body:JSON.stringify(body)}:{})}); await loadNotes(); }
    catch(error) { window.alert(error.message); }
  }
  function init() {
    const root=$('personalVaultPage');
    if(!root||state.bound) return;
    state.bound=true;
    $('pvNewNoteButton').addEventListener('click',()=>openEditor());
    $('pvNoteForm').addEventListener('submit',saveNote);
    $('pvNoteClose').addEventListener('click',closeEditor);
    $('pvNoteCancel').addEventListener('click',closeEditor);
    $('pvNoteModal').addEventListener('click',event=>{if(event.target===$('pvNoteModal'))closeEditor();});
    $('pvNotesList').addEventListener('click',event=>{
      const edit=event.target.closest('[data-pv-note-edit]');
      const pin=event.target.closest('[data-pv-note-pin]');
      const trash=event.target.closest('[data-pv-note-trash]');
      if(edit){const note=state.notes.find(item=>item.id===edit.dataset.pvNoteEdit);if(note)openEditor(note);}
      else if(pin){const note=state.notes.find(item=>item.id===pin.dataset.pvNotePin);if(note)mutateNote(note.id,'PATCH',{pinned:!note.pinned});}
      else if(trash){const note=state.notes.find(item=>item.id===trash.dataset.pvNoteTrash);if(note&&window.confirm('Move this note to Trash? Attached files will remain in your vault.'))mutateNote(note.id,'DELETE');}
    });
  }
  window.PersonalVaultNotes=Object.freeze({load:loadNotes});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
