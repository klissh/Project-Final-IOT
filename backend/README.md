---
title: Smart Kitchen Hygiene Detection
emoji: 🍳
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Smart Kitchen Hygiene Detection - AI Backend

Backend server untuk deteksi pelanggaran kebersihan dapur menggunakan YOLOv8 + Object Tracking.

## Fitur
- Deteksi masker dan hairnet secara real-time
- Object tracking per-individu (BoT-SORT)
- WebSocket endpoint untuk menerima frame dari browser
- MQTT untuk trigger buzzer ESP32 jarak jauh
- Integrasi Supabase (database + storage)
- Integrasi Telegram Bot

## API Endpoints
- `GET /health` - Health check
- `GET /video_feed` - MJPEG stream (mode lokal)
- `WS /ws/camera` - WebSocket untuk streaming frame dari browser
