# ☁ Box Store Cloud

A simple and modern Cloud-Based  Storing Web Application built with HTML, CSS, JavaScript, and Python Flask.

## Features

- Upload, view, search, download, and delete notes/files
- Modern responsive UI with dark mode support
- Real-time search functionality
- File type icons for better visualization

## Requirements

- Python 3.x
- Flask

## Installation

1. Install Flask:
   ```
   pip install flask
   ```

2. Run the application:
   ```
   python app.py
   ```

3. Open your browser and go to `http://127.0.0.1:5000/`

## Project Structure

- `app.py`: Flask backend server
- `templates/index.html`: Main HTML template
- `static/style.css`: CSS styles with light/dark themes
- `static/script.js`: JavaScript for interactivity
- `uploads/`: Directory where uploaded files are stored

## Usage

- Upload files using the file input and upload button
- Search for files using the search bar
- Click download to download a file
- Click delete to remove a file (with confirmation)
- Toggle between light and dark mode using the moon/sun button
