FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements dan install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy semua file backend
COPY . .

# Environment variables untuk mode cloud
ENV DEPLOY_MODE=cloud
ENV STREAM_HOST=0.0.0.0
ENV STREAM_PORT=7860
ENV DEVICE=cpu

# HF Spaces menggunakan port 7860
EXPOSE 7860

# Jalankan main.py yang akan memulai FastAPI server
CMD ["python", "main.py"]
