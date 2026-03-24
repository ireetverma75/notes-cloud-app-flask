// Load theme
const theme = localStorage.getItem('theme') || 'light';
document.body.classList.add(theme);
document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☀' : '🌙';

document.getElementById('theme-toggle').addEventListener('click', () => {
    const currentTheme = document.body.classList.contains('dark') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.classList.remove(currentTheme);
    document.body.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('theme-toggle').textContent = newTheme === 'dark' ? '☀' : '🌙';
});

function addNotification(message) {
    const list = document.getElementById('notification-list');
    if (!list) return;
    const item = document.createElement('div');
    item.className = 'notification-item';
    const time = new Date().toLocaleTimeString();
    item.textContent = `${time} — ${message}`;
    list.prepend(item);
    while (list.children.length > 20) {
        list.removeChild(list.lastChild);
    }
}

function showToast(message, duration=1800) {
    addNotification(message);
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

function formatSize(bytes) {
    if (bytes >= 1024*1024) return (bytes/(1024*1024)).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes/1024).toFixed(2) + ' KB';
    return bytes + ' B';
}

function formatDate(ts) {
    const d = new Date(ts * 1000);
    return d.toLocaleString();
}

function getIcon(type) {
    if (type === 'pdf') return '📄';
    if (type === 'image') return '🖼️';
    return '📁';
}

let notes = [];

function renderNotes() {
    const search = document.getElementById('search').value.toLowerCase();
    const filter = document.getElementById('type-filter').value;

    const notesGrid = document.getElementById('notes-grid');
    notesGrid.innerHTML = '';

    const visible = notes.filter(file => {
        const matchesSearch = file.name.toLowerCase().includes(search) || (file.category || '').toLowerCase().includes(search);
        const matchesType = !filter || (filter === 'other' ? file.type === 'other' : file.type === filter);
        return matchesSearch && matchesType;
    });

    if (visible.length === 0) {
        notesGrid.innerHTML = '<p>No notes found.</p>';
        return;
    }

    visible.forEach(file => {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.innerHTML = `
            <div class="card-header">
                <input type="checkbox" class="select-file" data-name="${file.name}" />
                <h3>${getIcon(file.type)} ${file.name}</h3>
            </div>
            <p class="meta">Type: ${file.type} | Size: ${formatSize(file.size)} | Modified: ${formatDate(file.modified)}${file.category ? ' | Category: ' + file.category : ''}</p>
            <div class="category-edit">
                <input type="text" class="category-input" placeholder="Category" value="${file.category || ''}" />
                <button onclick="updateCategory('${encodeURIComponent(file.name)}', this)">Save</button>
            </div>
            <div class="actions">
                <button onclick="previewFile('${encodeURIComponent(file.name)}','${file.type}')">Preview</button>
                <button onclick="downloadFile('${encodeURIComponent(file.name)}')">Download</button>
                <button onclick="shareFile('${encodeURIComponent(file.name)}')">Share</button>
                <button class="danger" onclick="deleteFile('${encodeURIComponent(file.name)}')">Delete</button>
            </div>
        `;
        notesGrid.appendChild(card);
    });

    document.querySelectorAll('.select-file').forEach(el => {
        el.addEventListener('change', () => {
            const selected = document.querySelectorAll('.select-file:checked').length;
            document.getElementById('bulk-delete').disabled = selected === 0;
        });
    });
}

function loadNotes() {
    fetch('/api/files')
    .then(response => response.json())
    .then(data => {
        notes = data.files;
        renderNotes();
    })
    .catch(error => console.error('Error loading notes:', error));
}

function downloadFile(filename) {
    window.open(`/download/${filename}`);
}

function deleteFile(filename) {
    const decoded = decodeURIComponent(filename);

    fetch(`/delete/${decoded}`)
    .then(response => response.json())
    .then(() => {
        showToast('File deleted');
        loadNotes();
    })
    .catch(() => showToast('Delete failed'));
}

function shareFile(filename) {
    const decoded = decodeURIComponent(filename);
    const expiry = 60;
    fetch('/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: decoded, expiry })
    })
    .then(res => res.json())
    .then(data => {
        if (data.share_url) {
            navigator.clipboard.writeText(data.share_url).then(() => {
                showToast('Share link copied');
            });
        } else {
            showToast(data.error || 'Share failed');
        }
    });
}

function updateCategory(filename, button) {
    const decoded = decodeURIComponent(filename);
    const card = button.closest('.note-card');
    const category = card.querySelector('.category-input').value.trim();

    fetch('/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: decoded, category })
    })
    .then(res => res.json())
    .then(data => {
        if (data.message) {
            showToast('Category saved');
            loadNotes();
        } else {
            showToast(data.error || 'Update failed');
        }
    });
}

function previewFile(filename, type) {
    const decoded = decodeURIComponent(filename);
    const modal = document.getElementById('preview-modal');
    const body = document.getElementById('preview-body');
    body.innerHTML = '';

    if (type === 'image') {
        body.innerHTML = `<img src="/download/${decoded}" alt="${decoded}" style="max-width:100%; max-height:80vh;" />`;
    } else if (type === 'pdf') {
        body.innerHTML = `<iframe src="/download/${decoded}" style="width:100%; height:70vh"></iframe>`;
    } else {
        body.innerHTML = `<p>No preview available for this file type.</p>`;
    }

    modal.classList.remove('hidden');
}

function processUpload(files) {
    const category = document.getElementById('category').value;
    const max = 10 * 1024 * 1024;

    Array.from(files).forEach(file => {
        if (file.size > max) {
            showToast(`File ${file.name} too big`);
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);

        fetch('/upload', { method: 'POST', body: formData })
        .then(res => res.json())
        .then(result => {
            if (result.message) {
                showToast(`${file.name} uploaded`);
                loadNotes();
                document.getElementById('file-input').value = '';
            } else {
                showToast(result.error || 'Upload failed');
            }
        })
        .catch(() => showToast('Upload error'));
    });
}

document.getElementById('upload-btn').addEventListener('click', () => {
    const fileInput = document.getElementById('file-input');
    if (!fileInput.files.length) {
        showToast('Select files to upload');
        return;
    }
    processUpload(fileInput.files);
});

const drop = document.getElementById('drag-drop');
['dragenter', 'dragover'].forEach(evt => {
    drop.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.add('active');
    });
});
['dragleave', 'drop'].forEach(evt => {
    drop.addEventListener(evt, e => {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.remove('active');
    });
});

drop.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    processUpload(files);
});

document.getElementById('search').addEventListener('input', renderNotes);
document.getElementById('type-filter').addEventListener('change', renderNotes);

document.getElementById('bulk-delete').addEventListener('click', () => {
    const selected = Array.from(document.querySelectorAll('.select-file:checked')).map(ch => ch.dataset.name);
    if (!selected.length) return;
    Promise.all(selected.map(name => fetch(`/delete/${encodeURIComponent(name)}`)))
    .then(() => {
        showToast('Bulk delete complete');
        loadNotes();
    })
    .catch(() => showToast('Bulk delete failed'));
});

document.getElementById('clear-notifications').addEventListener('click', () => {
    document.getElementById('notification-list').innerHTML = '';
    showToast('Notifications cleared');
});

const previewClose = document.getElementById('preview-close');
previewClose.addEventListener('click', () => document.getElementById('preview-modal').classList.add('hidden'));

// Close modal on outside click
document.getElementById('preview-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('preview-modal')) {
        document.getElementById('preview-modal').classList.add('hidden');
    }
});

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('preview-modal').classList.add('hidden');
    }
});

loadNotes();