const App = {
  notes: [],
  activeNoteId: null,
  searchQuery: '',
  selectedTag: null,
  saveTimer: null,
  searchTimer: null,
  currentNote: null,
  pendingTags: [],

  async init() {
    await this.refreshNotes();
    this.renderTagFilter();
    this.bindEvents();
    if (this.notes.length > 0) {
      this.selectNote(this.notes[0].id);
    }
  },

  async refreshNotes() {
    let notes = await NotesDB.getAll();
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      notes = notes.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      );
    }
    if (this.selectedTag) {
      notes = notes.filter(n => (n.tags || []).includes(this.selectedTag));
    }
    this.notes = notes;
    this.renderNoteList();
    this.updateNoteCount();
  },

  updateNoteCount() {
    document.getElementById('note-count').textContent = this.notes.length;
  },

  renderNoteList() {
    const list = document.getElementById('note-list');
    if (this.notes.length === 0) {
      list.innerHTML = '<div class="note-list-empty">No notes yet<div class="empty-sub">Create one with the button above</div></div>';
      return;
    }
    list.innerHTML = this.notes.map(n => `
      <div class="note-item ${n.id === this.activeNoteId ? 'active' : ''}" data-id="${n.id}">
        <div class="note-item-title">${this.escapeHtml(n.title || 'Untitled')}</div>
        <div class="note-item-excerpt">${this.escapeHtml((n.content || '').slice(0, 150))}</div>
        ${(n.tags || []).length > 0 ? `<div class="note-item-tags">${n.tags.map(t => `<span class="tag">${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="note-item-date">${this.formatTime(n.updatedAt)}</div>
      </div>
    `).join('');
  },

  async renderTagFilter() {
    const allTags = await NotesDB.getAllTags();
    const container = document.getElementById('tag-filter');
    let html = '';
    if (this.selectedTag) {
      html += `<button class="tag-pill-clear" data-action="clear-tag">&#x2715; clear</button>`;
    }
    allTags.forEach(tag => {
      const active = tag === this.selectedTag;
      html += `<button class="tag-pill ${active ? 'active' : ''}" data-tag="${this.escapeHtml(tag)}">${this.escapeHtml(tag)}</button>`;
    });
    container.innerHTML = html;
  },

  renderEditorTags(tags) {
    const container = document.getElementById('editor-tags');
    this.pendingTags = [...tags];
    let html = (tags || []).map(t => `
      <span class="editor-tag" data-tag="${this.escapeHtml(t)}">
        ${this.escapeHtml(t)}
        <span class="tag-remove" data-tag="${this.escapeHtml(t)}">&#x2715;</span>
      </span>
    `).join('');
    html += `<input type="text" class="editor-tag-input" id="tag-input" placeholder="Add tag..." />`;
    container.innerHTML = html;
    const input = document.getElementById('tag-input');
    input.focus = input.focus.bind(input);
    input.addEventListener('keydown', (e) => this.onTagKeydown(e));
    input.addEventListener('blur', () => this.commitTagInput());
  },

  onTagKeydown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      this.commitTagInput();
    } else if (e.key === 'Backspace' && e.target.value === '' && this.pendingTags.length > 0) {
      this.pendingTags.pop();
      this.renderEditorTags(this.pendingTags);
      this.scheduleSave();
    }
  },

  commitTagInput() {
    const input = document.getElementById('tag-input');
    if (!input) return;
    const val = input.value.trim().replace(/,/g, '').trim();
    if (val && !this.pendingTags.includes(val)) {
      this.pendingTags.push(val);
    }
    this.renderEditorTags(this.pendingTags);
    this.scheduleSave();
  },

  async selectNote(id) {
    this.activeNoteId = id;
    const note = await NotesDB.get(id);
    this.currentNote = note;
    document.getElementById('editor-empty').style.display = 'none';
    document.getElementById('editor-active').style.display = 'flex';
    document.getElementById('note-title').value = note.title || '';
    this.renderEditorTags(note.tags || []);
    document.getElementById('note-content').value = note.content || '';
    this.updatePreview();
    this.renderNoteList();
    this.setIndicator('Saved', 'saved');
  },

  clearEditor() {
    this.activeNoteId = null;
    this.currentNote = null;
    document.getElementById('editor-empty').style.display = 'flex';
    document.getElementById('editor-active').style.display = 'none';
    this.renderNoteList();
  },

  async saveCurrentNote() {
    if (!this.currentNote) return;
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value;
    this.currentNote.title = title || 'Untitled';
    this.currentNote.tags = [...this.pendingTags];
    this.currentNote.content = content;
    const id = await NotesDB.put(this.currentNote);
    this.currentNote.id = id;
    this.activeNoteId = id;
    this.setIndicator('Saved', 'saved');
    await this.refreshNotes();
    this.renderTagFilter();
  },

  scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.setIndicator('Unsaved...', 'saving');
    this.saveTimer = setTimeout(() => this.saveCurrentNote(), 400);
  },

  setIndicator(text, cls) {
    const el = document.getElementById('save-indicator');
    el.textContent = text;
    el.className = 'save-indicator' + (cls ? ' ' + cls : '');
  },

  updatePreview() {
    const content = document.getElementById('note-content').value;
    const preview = document.getElementById('note-preview');
    if (typeof marked !== 'undefined') {
      preview.innerHTML = marked.parse(content, { breaks: true });
    } else {
      preview.textContent = content;
    }
  },

  async createNote() {
    const note = {
      title: 'Untitled',
      content: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const id = await NotesDB.put(note);
    await this.refreshNotes();
    this.renderTagFilter();
    this.selectNote(id);
    setTimeout(() => {
      const el = document.getElementById('note-title');
      if (el) el.focus();
    }, 50);
  },

  async deleteNote() {
    if (!this.activeNoteId) return;
    this.showConfirm('Delete note?', 'This cannot be undone.', async () => {
      await NotesDB.delete(this.activeNoteId);
      this.activeNoteId = null;
      this.currentNote = null;
      await this.refreshNotes();
      this.renderTagFilter();
      if (this.notes.length > 0) {
        this.selectNote(this.notes[0].id);
      } else {
        this.clearEditor();
      }
    });
  },

  showConfirm(title, message, onOk) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    modal.style.display = 'flex';
    const ok = document.getElementById('confirm-ok');
    const cancel = document.getElementById('confirm-cancel');
    const cleanup = () => {
      modal.style.display = 'none';
      ok.removeEventListener('click', handleOk);
      cancel.removeEventListener('click', handleCancel);
    };
    const handleOk = () => { cleanup(); onOk(); };
    const handleCancel = () => { cleanup(); };
    ok.addEventListener('click', handleOk);
    cancel.addEventListener('click', handleCancel);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup();
    }, { once: true });
  },

  async exportNotes() {
    const all = await NotesDB.getAll();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `localnotebox-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importNotes(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const notes = JSON.parse(e.target.result);
        if (!Array.isArray(notes)) throw new Error('Invalid format');
        for (const note of notes) {
          await NotesDB.put({
            title: note.title || 'Untitled',
            content: note.content || '',
            tags: note.tags || [],
            createdAt: note.createdAt || Date.now(),
            updatedAt: note.updatedAt || Date.now()
          });
        }
        await this.refreshNotes();
        this.renderTagFilter();
        if (this.notes.length > 0) this.selectNote(this.notes[0].id);
        this.setIndicator(`Imported ${notes.length} notes`, 'saved');
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  },

  showSyncModal() {
    document.getElementById('sync-modal').style.display = 'flex';
    document.getElementById('sync-status').textContent = '';
  },

  hideSyncModal() {
    document.getElementById('sync-modal').style.display = 'none';
  },

  async syncPush() {
    const url = document.getElementById('sync-url').value.trim();
    const passphrase = document.getElementById('sync-passphrase').value;
    if (!url || !passphrase) {
      document.getElementById('sync-status').textContent = 'Fill in server URL and passphrase.';
      return;
    }
    document.getElementById('sync-status').textContent = 'Encrypting and pushing...';
    try {
      await Sync.push(url, passphrase);
      document.getElementById('sync-status').textContent = 'Sync push complete!';
    } catch (e) {
      document.getElementById('sync-status').textContent = 'Error: ' + e.message;
    }
  },

  async syncPull() {
    const url = document.getElementById('sync-url').value.trim();
    const passphrase = document.getElementById('sync-passphrase').value;
    if (!url || !passphrase) {
      document.getElementById('sync-status').textContent = 'Fill in server URL and passphrase.';
      return;
    }
    document.getElementById('sync-status').textContent = 'Pulling and decrypting...';
    try {
      const notes = await Sync.pull(url, passphrase);
      if (notes.length === 0) {
        document.getElementById('sync-status').textContent = 'No data on server.';
        return;
      }
      await NotesDB.clear();
      for (const note of notes) {
        await NotesDB.put(note);
      }
      await this.refreshNotes();
      this.renderTagFilter();
      if (this.notes.length > 0) this.selectNote(this.notes[0].id);
      document.getElementById('sync-status').textContent = `Restored ${notes.length} notes.`;
    } catch (e) {
      document.getElementById('sync-status').textContent = 'Error: ' + e.message;
    }
  },

  bindEvents() {
    document.getElementById('btn-new-note').addEventListener('click', () => this.createNote());
    document.getElementById('btn-delete-note').addEventListener('click', () => this.deleteNote());
    document.getElementById('btn-export').addEventListener('click', () => this.exportNotes());
    document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-input').click());
    document.getElementById('import-input').addEventListener('change', (e) => {
      if (e.target.files[0]) this.importNotes(e.target.files[0]);
      e.target.value = '';
    });
    document.getElementById('btn-sync').addEventListener('click', () => this.showSyncModal());
    document.getElementById('btn-sync-close').addEventListener('click', () => this.hideSyncModal());
    document.getElementById('btn-sync-push').addEventListener('click', () => this.syncPush());
    document.getElementById('btn-sync-pull').addEventListener('click', () => this.syncPull());

    document.getElementById('search-input').addEventListener('input', (e) => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        this.refreshNotes();
      }, 200);
    });

    document.getElementById('note-list').addEventListener('click', (e) => {
      const item = e.target.closest('.note-item');
      if (item) {
        const id = Number(item.dataset.id);
        this.selectNote(id);
      }
    });

    document.getElementById('tag-filter').addEventListener('click', (e) => {
      const pill = e.target.closest('.tag-pill');
      if (pill) {
        const tag = pill.dataset.tag;
        this.selectedTag = this.selectedTag === tag ? null : tag;
        this.renderTagFilter();
        this.refreshNotes();
      }
      if (e.target.closest('[data-action="clear-tag"]')) {
        this.selectedTag = null;
        this.renderTagFilter();
        this.refreshNotes();
      }
    });

    document.getElementById('editor-tags').addEventListener('click', (e) => {
      const remove = e.target.closest('.tag-remove');
      if (remove) {
        const tag = remove.dataset.tag;
        this.pendingTags = this.pendingTags.filter(t => t !== tag);
        this.renderEditorTags(this.pendingTags);
        this.scheduleSave();
      }
    });

    document.getElementById('note-title').addEventListener('input', () => this.scheduleSave());
    document.getElementById('note-content').addEventListener('input', () => {
      this.updatePreview();
      this.scheduleSave();
    });

    document.getElementById('toggle-preview').addEventListener('change', (e) => {
      document.getElementById('note-preview').classList.toggle('show', e.target.checked);
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.saveCurrentNote();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.createNote();
      }
    });

    document.getElementById('sync-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.hideSyncModal();
    });
  },

  formatTime(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
