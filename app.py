from flask import Flask, render_template, request, redirect, url_for, send_from_directory, jsonify, session
import os

app = Flask(__name__)
app.secret_key = 'supersecretkey'

# simple in-memory users (for demo)
users = {
    'admin': 'admin123'
}

UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', '/tmp/uploads')
METADATA_FILE = os.path.join(UPLOAD_FOLDER, 'metadata.json')
SHARE_TOKENS_FILE = os.path.join(UPLOAD_FOLDER, 'share_tokens.json')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# In case of deployment read-only root, fallback to /tmp
if not os.path.exists(UPLOAD_FOLDER):
    UPLOAD_FOLDER = '/tmp/uploads'
    app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

METADATA_FILE = os.path.join(app.config['UPLOAD_FOLDER'], 'metadata.json')
SHARE_TOKENS_FILE = os.path.join(app.config['UPLOAD_FOLDER'], 'share_tokens.json')

if not os.path.exists(METADATA_FILE):
    with open(METADATA_FILE, 'w') as f:
        f.write('{}')

if not os.path.exists(SHARE_TOKENS_FILE):
    with open(SHARE_TOKENS_FILE, 'w') as f:
        f.write('{}')

def get_metadata():
    import json
    try:
        with open(METADATA_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {}

def save_metadata(metadata):
    import json
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f)


def get_share_tokens():
    import json
    try:
        with open(SHARE_TOKENS_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {}


def save_share_tokens(tokens):
    import json
    with open(SHARE_TOKENS_FILE, 'w') as f:
        json.dump(tokens, f)


@app.route('/')
def index():
    if 'username' not in session:
        return redirect(url_for('login'))
    return render_template('index.html', username=session['username'])


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if username in users and users[username] == password:
            session['username'] = username
            return redirect(url_for('index'))
        return render_template('login.html', error='Invalid username or password')
    return render_template('login.html')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if not username or not password:
            return render_template('register.html', error='Username and password required')
        if username in users:
            return render_template('register.html', error='Username exists')
        users[username] = password
        session['username'] = username
        return redirect(url_for('index'))
    return render_template('register.html')


@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('login'))


@app.route('/favicon.ico')
def favicon():
    # Serve a simple transparent favicon if file missing to avoid 500 in browser console
    icon_path = os.path.join(app.static_folder, 'favicon.ico')
    if os.path.exists(icon_path):
        return send_from_directory(app.static_folder, 'favicon.ico')
    return ('', 204)

@app.route('/api/files')
def get_files():
    metadata = get_metadata()
    files_data = []
    for fname in os.listdir(UPLOAD_FOLDER):
        if fname == 'metadata.json':
            continue
        file_path = os.path.join(UPLOAD_FOLDER, fname)
        if not os.path.isfile(file_path):
            continue
        stat = os.stat(file_path)
        extension = fname.rsplit('.', 1)[-1].lower() if '.' in fname else ''
        mime_type = 'other'
        if extension == 'pdf':
            mime_type = 'pdf'
        elif extension in ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg']:
            mime_type = 'image'
        file_info = {
            'name': fname,
            'type': mime_type,
            'size': stat.st_size,
            'modified': stat.st_mtime,
            'category': metadata.get(fname, {}).get('category', '')
        }
        files_data.append(file_info)
    return jsonify({'files': files_data})

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    # file size limit 10MB
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > 10 * 1024 * 1024:
        return jsonify({'error': 'File is too large (max 10MB)'}), 400

    allowed_ext = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'txt', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']
    filename = file.filename
    extension = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if extension not in allowed_ext:
        return jsonify({'error': 'File type not allowed'}), 400

    dest = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(dest)

    category = request.form.get('category', '').strip()
    metadata = get_metadata()
    metadata[filename] = {'category': category}
    save_metadata(metadata)

    return jsonify({'message': 'File uploaded successfully', 'file': filename, 'category': category})

@app.route('/download/<filename>')
def download_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/delete/<filename>')
def delete_file(filename):
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    metadata = get_metadata()
    if filename in metadata:
        metadata.pop(filename)
        save_metadata(metadata)

    tokens = get_share_tokens()
    to_remove = [t for t,v in tokens.items() if v['filename'] == filename]
    for t in to_remove:
        tokens.pop(t, None)
    save_share_tokens(tokens)

    return jsonify({'message': 'File deleted'})


@app.route('/category', methods=['POST'])
def update_category():
    data = request.json or {}
    filename = data.get('filename')
    category = (data.get('category') or '').strip()

    if not filename:
        return jsonify({'error': 'filename required'}), 400

    metadata = get_metadata()
    if filename not in metadata:
        metadata[filename] = {}
    metadata[filename]['category'] = category
    save_metadata(metadata)
    return jsonify({'message': 'Category updated'})


@app.route('/share', methods=['POST'])
def share_file():
    data = request.json or {}
    filename = data.get('filename')
    expiry_min = int(data.get('expiry', 60))

    if not filename:
        return jsonify({'error': 'filename required'}), 400

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(file_path):
        return jsonify({'error': 'file not found'}), 404

    import random, string, time
    token = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
    expiry = int(time.time()) + expiry_min * 60

    tokens = get_share_tokens()
    tokens[token] = {'filename': filename, 'expiry': expiry}
    save_share_tokens(tokens)

    share_url = f"{request.host_url}shared/{token}"
    return jsonify({'share_url': share_url, 'expires_at': expiry})


@app.route('/shared/<token>')
def shared_link(token):
    tokens = get_share_tokens()
    entry = tokens.get(token)
    if not entry:
        return jsonify({'error': 'Invalid or expired token'}), 404

    import time
    if int(time.time()) > entry['expiry']:
        tokens.pop(token, None)
        save_share_tokens(tokens)
        return jsonify({'error': 'Token expired'}), 410

    return send_from_directory(app.config['UPLOAD_FOLDER'], entry['filename'])


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def internal_error(e):
    import traceback
    traceback.print_exc()
    return jsonify({'error': 'Internal Server Error'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, port=port)
