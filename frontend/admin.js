// ─── State ────────────────────────────────────────────────────────────────────
let books = [];
let currentBook = null;
let clips = [];
let profiles = [];
let textDebounceTimers = {};

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadBooks();
  bindGlobalEvents();
});

function bindGlobalEvents() {
  // New book modal
  document.getElementById('new-book-btn').addEventListener('click', () => showModal('new-book-modal'));
  document.getElementById('new-book-cancel').addEventListener('click', () => hideModal('new-book-modal'));
  document.getElementById('new-book-create').addEventListener('click', createBook);
  document.getElementById('new-book-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') createBook();
    if (e.key === 'Escape') hideModal('new-book-modal');
  });

  // Voice modal
  document.getElementById('voice-modal-close').addEventListener('click', () => hideModal('voice-modal'));
  document.getElementById('clip-upload-btn').addEventListener('click', () => document.getElementById('clip-file-input').click());
  document.getElementById('clip-file-input').addEventListener('change', uploadClip);
  document.getElementById('profile-create-btn').addEventListener('click', createProfile);
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
  if (id === 'new-book-modal') {
    setTimeout(() => document.getElementById('new-book-title').focus(), 50);
  }
  if (id === 'voice-modal') {
    loadClipsAndProfiles();
  }
}

function hideModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ─── Books ────────────────────────────────────────────────────────────────────
async function loadBooks() {
  const res = await fetch('/api/books');
  const data = await res.json();
  books = data.items || [];
  renderBookList();
}

function renderBookList() {
  const el = document.getElementById('book-list');
  if (!books.length) {
    el.innerHTML = '<div class="p-4 text-gray-400 text-xs">No books yet.</div>';
    return;
  }
  el.innerHTML = books.map(b => `
    <div class="book-item px-3 py-2.5 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${currentBook?.id === b.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}"
         onclick="selectBook('${b.id}')">
      <div class="font-medium text-gray-900 truncate text-sm">${esc(b.title)}</div>
      <div class="text-xs text-gray-400">${b.page_count} page${b.page_count !== 1 ? 's' : ''}</div>
    </div>
  `).join('');
}

async function selectBook(bookId) {
  const res = await fetch(`/api/books/${bookId}`);
  currentBook = await res.json();
  renderBookList();
  renderMainArea();
}

async function createBook() {
  const title = document.getElementById('new-book-title').value.trim();
  if (!title) return;
  const res = await fetch('/api/books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  const book = await res.json();
  hideModal('new-book-modal');
  document.getElementById('new-book-title').value = '';
  await loadBooks();
  selectBook(book.id);
}

async function deleteBook(bookId) {
  if (!confirm('Delete this book and all its audio? This cannot be undone.')) return;
  await fetch(`/api/books/${bookId}`, { method: 'DELETE' });
  currentBook = null;
  await loadBooks();
  document.getElementById('main-area').innerHTML = '<div class="text-gray-400 text-sm mt-16 text-center">Select or create a book to get started.</div>';
}

// ─── Main area ────────────────────────────────────────────────────────────────
function renderMainArea() {
  if (!currentBook) return;

  const b = currentBook;
  const profileOptions = profiles.map(p => `<option value="${esc(p.name)}" ${b.voice_profile === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('');

  document.getElementById('main-area').innerHTML = `
    <div class="max-w-4xl mx-auto">
      <!-- Book header -->
      <div class="flex items-start justify-between mb-6">
        <div class="flex-1">
          <input id="book-title-input" type="text" value="${esc(b.title)}"
            class="text-2xl font-bold text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none w-full"
            onblur="saveBookTitle()" onkeydown="if(event.key==='Enter')this.blur()">
          <a href="/reader/${b.id}" target="_blank" class="text-xs text-indigo-600 hover:underline mt-1 inline-block">Open reader ↗</a>
        </div>
        <button onclick="deleteBook('${b.id}')" class="text-xs text-red-400 hover:text-red-600 ml-4 mt-1">Delete book</button>
      </div>

      <!-- Voice profile -->
      <div class="bg-white border border-gray-200 rounded p-4 mb-5">
        <div class="flex items-center gap-3 flex-wrap">
          <label class="text-sm font-medium text-gray-700 shrink-0">Voice Profile:</label>
          <select id="voice-profile-select" onchange="saveVoiceProfile()"
            class="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">— none —</option>
            ${profileOptions}
          </select>
          <button onclick="showModal('voice-modal')" class="text-xs text-indigo-600 hover:underline">Manage voices…</button>
        </div>
      </div>

      <!-- Upload dropzone -->
      <div id="dropzone" class="border-2 border-dashed border-gray-300 rounded-lg p-8 mb-5 text-center cursor-pointer bg-white hover:border-indigo-400 transition-colors"
           onclick="document.getElementById('page-upload-input').click()"
           ondragover="event.preventDefault();this.classList.add('dropzone-active')"
           ondragleave="this.classList.remove('dropzone-active')"
           ondrop="handleDrop(event)">
        <input id="page-upload-input" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.heic" class="hidden" onchange="uploadPages(this.files)">
        <div class="text-gray-400 text-sm">Drop page photos here or <span class="text-indigo-600 font-medium">click to upload</span></div>
        <div class="text-xs text-gray-400 mt-1">JPEG, PNG, WEBP — multiple files OK</div>
      </div>

      <!-- Actions bar -->
      <div class="flex items-center gap-3 mb-5">
        <button onclick="generateAllAudio()"
          class="text-sm bg-green-600 text-white rounded px-4 py-2 hover:bg-green-700 font-medium">
          Generate All Audio
        </button>
        <span id="gen-status" class="text-sm text-gray-500"></span>
      </div>

      <!-- Pages grid -->
      <div id="pages-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${b.pages.map(p => renderPageCard(p)).join('')}
      </div>
    </div>
  `;

  // Load profiles for the select
  loadProfilesForSelect();
}

function renderPageCard(page) {
  const statusColors = {
    none: 'bg-gray-100 text-gray-500',
    generating: 'bg-yellow-100 text-yellow-700',
    ready: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-600',
  };
  const statusLabel = { none: 'No audio', generating: 'Generating…', ready: 'Ready', error: 'Error' };
  const status = page.audio_status || 'none';
  const bookId = currentBook.id;
  const imgSrc = `/uploads/${bookId}/${page.image_filename}`;

  return `
    <div class="bg-white border border-gray-200 rounded-lg overflow-hidden" id="page-card-${page.page_number}">
      <div class="flex">
        <div class="w-28 shrink-0 bg-gray-50">
          <img src="${imgSrc}" alt="Page ${page.page_number}" class="w-full h-full object-cover" style="max-height:140px">
        </div>
        <div class="flex-1 p-3 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-500">Page ${page.page_number}</span>
            <div class="flex items-center gap-2">
              <span class="text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[status]}">${statusLabel[status] || status}</span>
              <button onclick="generatePageAudio(${page.page_number})" title="Generate audio for this page"
                class="text-xs text-gray-400 hover:text-indigo-600">&#9654;</button>
              <button onclick="deletePage(${page.page_number})" title="Delete page"
                class="text-xs text-gray-400 hover:text-red-500">&times;</button>
            </div>
          </div>
          <textarea
            class="text-sm text-gray-700 border border-gray-200 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 leading-snug"
            rows="4"
            onInput="scheduleTextSave(${page.page_number}, this.value)"
          >${esc(page.text)}</textarea>
          ${status === 'ready' ? `<audio controls src="/audio/${page.audio_filename}" class="w-full h-8 mt-1"></audio>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ─── Pages ────────────────────────────────────────────────────────────────────
function handleDrop(event) {
  event.preventDefault();
  document.getElementById('dropzone').classList.remove('dropzone-active');
  uploadPages(event.dataTransfer.files);
}

async function uploadPages(fileList) {
  if (!currentBook || !fileList.length) return;
  const files = Array.from(fileList);

  for (const file of files) {
    const form = new FormData();
    form.append('files', file);

    // Add placeholder card
    const grid = document.getElementById('pages-grid');
    if (grid) {
      const placeholder = document.createElement('div');
      placeholder.className = 'bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3';
      placeholder.id = `upload-placeholder-${file.name}`;
      placeholder.innerHTML = `<div class="spinner"></div><span class="text-sm text-gray-500">Uploading ${esc(file.name)}…</span>`;
      grid.appendChild(placeholder);
    }

    try {
      const res = await fetch(`/api/books/${currentBook.id}/pages`, { method: 'POST', body: form });
      const data = await res.json();
      // Refresh the full book and re-render
      const bookRes = await fetch(`/api/books/${currentBook.id}`);
      currentBook = await bookRes.json();
      renderMainArea();
      await loadBooks();
    } catch (e) {
      const ph = document.getElementById(`upload-placeholder-${file.name}`);
      if (ph) ph.innerHTML = `<span class="text-sm text-red-500">Failed: ${esc(file.name)}</span>`;
    }
  }
}

function scheduleTextSave(pageNumber, value) {
  clearTimeout(textDebounceTimers[pageNumber]);
  textDebounceTimers[pageNumber] = setTimeout(() => savePageText(pageNumber, value), 600);
}

async function savePageText(pageNumber, text) {
  if (!currentBook) return;
  await fetch(`/api/books/${currentBook.id}/pages/${pageNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const page = currentBook.pages.find(p => p.page_number === pageNumber);
  if (page) page.text = text;
}

async function deletePage(pageNumber) {
  if (!confirm(`Delete page ${pageNumber}?`)) return;
  await fetch(`/api/books/${currentBook.id}/pages/${pageNumber}`, { method: 'DELETE' });
  const bookRes = await fetch(`/api/books/${currentBook.id}`);
  currentBook = await bookRes.json();
  renderMainArea();
  await loadBooks();
}

// ─── Audio generation ─────────────────────────────────────────────────────────
async function generateAllAudio() {
  if (!currentBook) return;
  if (!currentBook.voice_profile) {
    alert('Please select a voice profile first.');
    return;
  }
  await startAudioGeneration([]);
}

async function generatePageAudio(pageNumber) {
  if (!currentBook) return;
  if (!currentBook.voice_profile) {
    alert('Please select a voice profile first.');
    return;
  }
  await startAudioGeneration([pageNumber]);
}

async function startAudioGeneration(pageNumbers) {
  const statusEl = document.getElementById('gen-status');
  if (statusEl) statusEl.textContent = 'Generating…';

  const res = await fetch(`/api/books/${currentBook.id}/generate-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page_numbers: pageNumbers, language: 'English' }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        handleAudioEvent(event);
      } catch {}
    }
  }

  if (statusEl) statusEl.textContent = '';
  // Refresh book state
  const bookRes = await fetch(`/api/books/${currentBook.id}`);
  currentBook = await bookRes.json();
  renderMainArea();
}

function handleAudioEvent(event) {
  if (event.status === 'started' || event.status === 'progress' || event.status === 'error') {
    const pageNum = event.page_number;
    const card = document.getElementById(`page-card-${pageNum}`);
    if (!card) return;

    const badge = card.querySelector('.text-xs.px-2');
    if (!badge) return;

    if (event.status === 'started') {
      badge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700';
      badge.textContent = 'Generating…';
    } else if (event.status === 'progress') {
      badge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700';
      badge.textContent = 'Ready';
    } else if (event.status === 'error') {
      badge.className = 'text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-600';
      badge.textContent = 'Error';
    }
  }

  const statusEl = document.getElementById('gen-status');
  if (event.status === 'done' && statusEl) statusEl.textContent = 'Done!';
}

// ─── Book metadata saves ──────────────────────────────────────────────────────
async function saveBookTitle() {
  const input = document.getElementById('book-title-input');
  if (!input || !currentBook) return;
  const title = input.value.trim();
  if (!title || title === currentBook.title) return;
  await fetch(`/api/books/${currentBook.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  currentBook.title = title;
  await loadBooks();
}

async function saveVoiceProfile() {
  const select = document.getElementById('voice-profile-select');
  if (!select || !currentBook) return;
  const voiceProfile = select.value;
  await fetch(`/api/books/${currentBook.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voice_profile: voiceProfile }),
  });
  currentBook.voice_profile = voiceProfile;
}

// ─── Voice profiles ───────────────────────────────────────────────────────────
async function loadClipsAndProfiles() {
  const [clipsRes, profilesRes] = await Promise.all([
    fetch('/api/reference-clips'),
    fetch('/api/voice-clone/profiles'),
  ]);
  const clipsData = await clipsRes.json();
  const profilesData = await profilesRes.json();
  clips = clipsData.items || [];
  profiles = profilesData.profiles || [];

  // Populate clip select
  const clipSelect = document.getElementById('profile-clip');
  clipSelect.innerHTML = '<option value="">— choose a clip —</option>' +
    clips.map(c => `<option value="${esc(c.filename)}">${esc(c.filename)}</option>`).join('');

  renderProfilesList();
}

async function loadProfilesForSelect() {
  const res = await fetch('/api/voice-clone/profiles');
  const data = await res.json();
  profiles = data.profiles || [];
  const select = document.getElementById('voice-profile-select');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">— none —</option>' +
    profiles.map(p => `<option value="${esc(p.name)}" ${current === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}

function renderProfilesList() {
  const el = document.getElementById('profiles-list');
  if (!profiles.length) {
    el.innerHTML = '<div class="text-sm text-gray-400">No profiles yet.</div>';
    return;
  }
  el.innerHTML = profiles.map(p => `
    <div class="border border-gray-200 rounded p-3 flex items-start justify-between gap-2">
      <div>
        <div class="font-medium text-sm text-gray-900">${esc(p.name)}</div>
        <div class="text-xs text-gray-400 mt-0.5">Clip: ${esc(p.reference_clip)}</div>
      </div>
      <button onclick="deleteProfile('${p.id}')" class="text-xs text-red-400 hover:text-red-600 shrink-0">Delete</button>
    </div>
  `).join('');
}

async function uploadClip() {
  const input = document.getElementById('clip-file-input');
  const status = document.getElementById('clip-upload-status');
  if (!input.files.length) return;
  status.textContent = 'Uploading…';
  const form = new FormData();
  form.append('file', input.files[0]);
  const res = await fetch('/api/reference-clips', { method: 'POST', body: form });
  if (res.ok) {
    status.textContent = 'Uploaded!';
    await loadClipsAndProfiles();
  } else {
    status.textContent = 'Upload failed.';
  }
  input.value = '';
  setTimeout(() => { status.textContent = ''; }, 3000);
}

async function createProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const clip = document.getElementById('profile-clip').value;
  const refText = document.getElementById('profile-ref-text').value.trim();
  const status = document.getElementById('profile-create-status');

  if (!name || !clip || !refText) {
    status.textContent = 'All fields required.';
    return;
  }
  status.textContent = 'Saving…';
  const res = await fetch('/api/voice-clone/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, reference_clip: clip, ref_text: refText }),
  });
  if (res.ok) {
    document.getElementById('profile-name').value = '';
    document.getElementById('profile-ref-text').value = '';
    document.getElementById('profile-clip').value = '';
    status.textContent = 'Saved!';
    await loadClipsAndProfiles();
    await loadProfilesForSelect();
  } else {
    const err = await res.json();
    status.textContent = err.detail || 'Error.';
  }
  setTimeout(() => { status.textContent = ''; }, 3000);
}

async function deleteProfile(profileId) {
  if (!confirm('Delete this voice profile?')) return;
  await fetch(`/api/voice-clone/profiles/${profileId}`, { method: 'DELETE' });
  await loadClipsAndProfiles();
  await loadProfilesForSelect();
}

// ─── Util ─────────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
