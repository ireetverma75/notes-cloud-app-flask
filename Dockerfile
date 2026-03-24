# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory
WORKDIR /app

# Copy requirements (if you have one) or just copied files
COPY . /app

# Install Python dependencies
RUN pip install --no-cache-dir flask

# Expose port
EXPOSE 5000

# Create uploads folder and ensure it's writable
RUN mkdir -p /app/uploads && chmod -R 777 /app/uploads

# Start command
CMD ["python", "app.py"]
