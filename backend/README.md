# 🍳 Smart Kitchen Hygiene & Workspace Monitoring (AIoT System)

Sistem Enterprise AIoT untuk memantau kebersihan pekerja dapur dan kehadiran di area kerja secara *real-time*. Proyek ini menggabungkan **Edge AI** (Computer Vision di Windows/Laptop), **Cloud Database** (Supabase), **Web Dashboard** (Next.js), dan **perangkat IoT fisik** (ESP32 + DFPlayer Mini) untuk peringatan langsung di lokasi.

> **Filosofi Sistem:** Admin tidak harus terus-menerus memantau layar. Notifikasi Telegram + alert fisik di dapur adalah tulang punggung sistem. Dashboard berfungsi sebagai pusat **audit, konfigurasi, dan review pelanggaran**, bukan sebagai layar pengawasan 24/7.

---

## 🌟 Fitur Utama

1. **AI Kitchen Hygiene Monitoring (YOLOv8):** Mendeteksi kepatuhan penggunaan masker dan jaring rambut (*hairnet*) oleh pekerja dapur secara *real-time*.
2. **Absence/Presence Detection (Dynamic ROI):** Mendeteksi apakah pekerja berada di pos kerjanya selama jam operasional. Area pemantauan dapat diatur secara dinamis via Web Dashboard.
3. **IoT Physical Alerting (ESP32 + DFPlayer Mini):** Memicu peringatan *Buzzer* dan rekaman suara (*Voice Announcer*) di lokasi dapur melalui komunikasi Serial.
4. **Real-time Notifications (Telegram Bot):** Mengirim *alert* otomatis dan *screenshot* pelanggaran langsung ke HP pengawas — **fitur utama untuk admin yang tidak sedang di depan dashboard**.
5. **Web Dashboard (Next.js + Supabase):** Pusat kontrol untuk konfigurasi sistem, review log pelanggaran, manajemen ROI, dan live monitoring via LAN.
6. **Enterprise Logging (Supabase):** Menyimpan gambar bukti pelanggaran ke *Cloud Storage* dan mencatat *log* terstruktur untuk audit.

---

## 📋 Prerequisites & Tech Stack

### Edge AI (Local Laptop/PC)
- **OS:** Windows 10/11
- **GPU:** NVIDIA GTX 1050 atau lebih baru (3 GB VRAM minimum)
- **RAM:** 8 GB minimum
- **Webcam:** built-in atau USB webcam (mendukung pergantian via Settings dashboard)
- **Python:** 3.10+
- **Framework AI:** Ultralytics YOLOv8
- **Streaming Server:** FastAPI + uvicorn (MJPEG stream untuk dashboard Live)

### IoT Hardware
- ESP32 Development Board
- Modul MP3 DFPlayer Mini + Micro SD Card (berisi file suara peringatan)
- Active Buzzer & Kabel Jumper

### Cloud & Web Server
- **Database & Storage:** Supabase (PostgreSQL + Storage API + Realtime)
- **Authentication:** Supabase Auth (email/password)
- **Web Framework:** Next.js 14+ (App Router) + TypeScript
- **UI Library:** Tailwind CSS + shadcn/ui (rekomendasi)
- **Bot Notification:** Telegram Bot API

---

## 🏗️ Arsitektur Sistem

```text
┌─────────────────────────────────────────────────────────────────────┐
│                          EDGE AI (Python)                           │
│                                                                     │
│  [Kamera] → [YOLOv8 Inference] → Cek ROI & Hygiene                  │
│                    │                                                │
│                    ├─ Polling Settings (10s) ──→ [Supabase DB]      │
│                    ├─ Realtime Subscribe ROI ──→ [Supabase Realtime]│
│                    ├─ Heartbeat (5s) ──────────→ [Supabase DB]      │
│                    │                                                │
│                    └─ Jika PELANGGARAN:                             │
│                       ├─ Trigger ESP32 (Serial) → Buzzer + MP3      │
│                       ├─ Upload Screenshot ────→ [Supabase Storage] │
│                       │                              ↓ (public URL) │
│                       ├─ Insert Log (+URL) ────→ [Supabase DB]      │
│                       └─ Kirim URL ────────────→ [Telegram Bot API] │
│                                                       ↓             │
│                                          (Telegram fetch foto       │
│                                           langsung dari Supabase)   │
│                                                                     │
│  [FastAPI MJPEG Stream Server :8000] ←─── (LAN) ─── Browser Admin   │
└─────────────────────────────────────────────────────────────────────┘
                                  ↕
┌─────────────────────────────────────────────────────────────────────┐
│                    CLOUD (Supabase)                                 │
│  PostgreSQL Database  |  Storage Bucket  |  Auth  |  Realtime       │
└─────────────────────────────────────────────────────────────────────┘
                                  ↕
┌─────────────────────────────────────────────────────────────────────┐
│              WEB DASHBOARD (Next.js — Admin Only)                   │
│  Login → Home → Live → ROI Config → Logs → Settings                 │
└─────────────────────────────────────────────────────────────────────┘
```

**Pola komunikasi penting:** Python dan Dashboard **tidak bicara langsung**. Supabase berfungsi sebagai *message bus*:
- Dashboard menulis ke `system_settings`, Python membaca via polling tiap 10 detik.
- Python menulis ke `violations` & `system_heartbeat`, Dashboard subscribe via Supabase Realtime.
- Hanya **MJPEG stream** yang langsung (LAN: browser → Python FastAPI).

---

## 🖥️ Web Dashboard — Spesifikasi Halaman

Dashboard adalah aplikasi Next.js **khusus admin**. MVP terdiri dari 6 halaman:

### 1. Login Page (`/login`)
- Form email + password (Supabase Auth)
- Redirect ke `/` setelah berhasil login
- Middleware Next.js melindungi semua route lain

### 2. Dashboard Home (`/`)
Landing page setelah login. Berisi ringkasan status sistem.
- **Status Cards (real-time via Supabase Realtime):**
  - Python Engine: 🟢 online / 🔴 offline (cek `system_heartbeat`)
  - ESP32: 🟢 online / 🔴 offline
  - Telegram Bot: ✅ active / ⏸️ disabled (berdasarkan `system_settings.telegram_enabled`)
- **Counter widget:**
  - Total pelanggaran hari ini
  - Pelanggaran belum di-review
  - Jam operasional sedang aktif? (badge: ✅ Operating / 💤 Off-hours)
- **Last 5 Alerts** (live update via Realtime subscribe ke tabel `violations`)
- **Quick action buttons:** "Buka Live Monitor" + "Lihat Semua Log"

### 3. Live Monitoring (`/live`)
- **Video feed**: `<img src="http://<python-host>:8000/stream" />` (MJPEG stream)
  - Stream sudah ter-render dengan bounding box + label hasil YOLOv8
  - Catatan: hanya bisa diakses dari device yang sejaringan LAN dengan laptop Python
- **Side panel kanan (data real-time):**
  - Daftar deteksi terkini: `with_mask ✅` / `without_mask ❌` / `with_hairnet ✅` / `without_hairnet ❌`
  - Status ROI: "Worker IN POSITION" / "POS KOSONG (xx detik)"
  - Confidence score per deteksi
- **Tombol "Pause View"** (hanya pause tampilan, AI engine tetap jalan di background)

### 4. ROI Configuration (`/roi`)
- Tampilkan snapshot frame dari kamera aktif (Python expose endpoint `/snapshot` di FastAPI)
- **Canvas interaktif** untuk drag-draw area kerja:
  - Mode rectangle (MVP)
  - Mode polygon (opsional / future)
- Tombol **Save** → tulis koordinat ke tabel `roi_config` di Supabase
- Python (via Realtime subscribe) langsung apply ROI baru tanpa restart
- **Preview ROI aktif** ditampilkan sebagai overlay semi-transparan di atas snapshot

### 5. Log Pelanggaran (`/logs`)
- **Data table** dengan kolom:
  - Timestamp
  - Jenis pelanggaran (badge berwarna: `no_mask` / `no_hairnet` / `no_both` / `left_post`)
  - Screenshot thumbnail (kecil, klik untuk modal)
  - Confidence score
  - Status review (badge: `new` / `reviewed` / `false_positive`)
- **Filter:**
  - Date range picker
  - Jenis pelanggaran (multi-select)
  - Status review (multi-select)
- **Pagination:** 20 row per halaman
- **Klik row → Modal detail:**
  - Foto full-size dari Supabase Storage
  - Metadata lengkap
  - Tombol aksi: `Mark as Reviewed` / `Mark as False Positive`
  - Field catatan admin (opsional)
- **Export CSV** (opsional, berguna untuk laporan akademik)

### 6. Settings (`/settings`)
Semua konfigurasi sistem yang bisa diubah tanpa edit kode. Disimpan di tabel `system_settings`.

- **Operating Hours**
  - Time picker `start` (default 07:00) dan `end` (default 22:00)
  - Sistem **hanya kirim alert** dalam rentang jam ini
- **Telegram**
  - Toggle on/off
  - Input `bot_token`
  - List **multiple chat ID** (CRUD via tabel terpisah `telegram_recipients`)
  - Tombol "Test Send" → kirim pesan test ke semua recipient aktif
- **Buzzer / DFPlayer**
  - Toggle on/off
  - Slider durasi buzzer (ms)
  - Dropdown nomor track MP3 di SD Card
  - Tombol "Test Alert" → trigger ESP32 manual
- **Camera**
  - Dropdown `active_camera_index` (0, 1, 2 — auto-detect dari Python)
  - Tombol "Refresh Camera List"
  - Tombol "Test Camera" → preview snapshot
- **AI Threshold**
  - Slider `confidence_threshold` (0.1 – 0.9, default 0.4)
  - Slider `iou_threshold` (0.1 – 0.9, default 0.3)
  - Tombol "Reset to Default"

> **Catatan:** Manajemen user & multi-role **belum** masuk MVP. Tabel `profiles` sudah disiapkan dengan kolom `role` agar fitur multi-role (Admin / Supervisor / Viewer) bisa ditambah di sprint berikutnya tanpa migrasi besar.

---

## 🗄️ Skema Database (Supabase / PostgreSQL)

```sql
-- ===== AUTH (built-in Supabase, tidak perlu dibuat manual) =====
-- auth.users

-- ===== PROFILES (siapkan untuk multi-role di masa depan) =====
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'admin',  -- 'admin' | 'supervisor' | 'viewer'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== VIOLATIONS (log semua pelanggaran) =====
CREATE TABLE violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  violation_type TEXT NOT NULL,        -- 'no_mask' | 'no_hairnet' | 'no_both' | 'left_post'
  confidence FLOAT,                    -- skor AI saat deteksi
  screenshot_url TEXT,                 -- URL ke Supabase Storage bucket
  camera_index INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',  -- 'new' | 'reviewed' | 'false_positive'
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT
);
CREATE INDEX idx_violations_timestamp ON violations(timestamp DESC);
CREATE INDEX idx_violations_status ON violations(status);
CREATE INDEX idx_violations_type ON violations(violation_type);

-- ===== ROI CONFIG (mendukung multi-kamera di masa depan) =====
CREATE TABLE roi_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_index INT NOT NULL,
  roi_points JSONB NOT NULL,           -- [[x1,y1],[x2,y2],...] polygon points
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- ===== SYSTEM SETTINGS (single row config) =====
CREATE TABLE system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_hours_start TIME DEFAULT '07:00:00',
  operating_hours_end TIME DEFAULT '22:00:00',
  telegram_enabled BOOLEAN DEFAULT TRUE,
  telegram_bot_token TEXT,
  buzzer_enabled BOOLEAN DEFAULT TRUE,
  buzzer_duration_ms INT DEFAULT 2000,
  dfplayer_track INT DEFAULT 1,
  active_camera_index INT DEFAULT 0,
  confidence_threshold FLOAT DEFAULT 0.4,
  iou_threshold FLOAT DEFAULT 0.3,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Constraint hanya boleh satu row aktif
-- Insert satu row default saat setup awal.

-- ===== TELEGRAM RECIPIENTS (multiple supervisor) =====
CREATE TABLE telegram_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id TEXT NOT NULL,
  label TEXT,                          -- 'Supervisor Pagi', 'Owner', dll
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== SYSTEM HEARTBEAT (status komponen real-time) =====
CREATE TABLE system_heartbeat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component TEXT UNIQUE NOT NULL,      -- 'python_engine' | 'esp32'
  last_ping TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,                -- 'online' | 'offline' | 'error'
  metadata JSONB                       -- info tambahan (FPS, error msg, dll)
);
```

### Supabase Storage Bucket
- **Bucket name:** `violation-screenshots`
- **Access:** Public read, Authenticated write
- **Naming convention:** `YYYY/MM/DD/<violation_id>.jpg`

### Row Level Security (RLS) — MVP
```sql
-- Untuk MVP (1 admin), aktifkan RLS dengan rule sederhana:
-- "Authenticated user bisa read/write semua tabel"
-- Setelah multi-role aktif, perketat per-role.

ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON violations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- (Ulangi untuk tabel lain)
```

---

## 🚀 Quick Start

### A. Backend Edge AI (Python)

```bash
# 1. Aktifkan environment
.venv\Scripts\activate

# 2. Pindah ke folder project
cd "d:\documents\Kuliah\Semester 6\IOT\project akhir\files"

# 3. Install dependencies (lihat requirements.txt)
pip install -r requirements.txt

# 4. Setup .env (lihat section Konfigurasi)
cp .env.example .env
# Edit .env

# 5. Jalankan AIoT engine utama
python main_aiot_engine.py
```

### B. Web Dashboard (Next.js)

```bash
# 1. Pindah ke folder dashboard
cd dashboard

# 2. Install dependencies
npm install

# 3. Setup .env.local
cp .env.local.example .env.local
# Isi SUPABASE_URL, SUPABASE_ANON_KEY,
# dan NEXT_PUBLIC_PYTHON_STREAM_URL (mis. http://192.168.1.10:8000)

# 4. Jalankan dev server
npm run dev
# Akses: http://localhost:3000
```

---

## 🎮 Keyboard Controls (saat AI Vision aktif)

| Key | Function |
|---|---|
| `Q` atau `ESC` | Quit aplikasi |
| `S` | Take screenshot manual (auto-save ke folder `output/`) |
| `R` | Start/Stop recording video |
| `+` atau `=` | Naikkan confidence threshold (+0.05) |
| `-` atau `_` | Turunkan confidence threshold (-0.05) |

> Catatan: Keyboard control hanya untuk debugging lokal. Pengaturan utama via dashboard.

---

## 📁 Struktur Folder Proyek

```text
project akhir/
├── main_aiot_engine.py        ← Script utama (Vision + Logika AIoT) (Mendatang)
├── main.py                    ← Script Engine Utama (AI, Stream, IoT)
├── modules/
│   ├── esp32_serial.py        ← Handler komunikasi Serial ke ESP32 (Mendatang)
│   ├── telegram_alert.py      ← Handler Telegram Bot API (Mendatang)
│   ├── supabase_logger.py     ← Handler insert log & upload screenshot (Mendatang)
│   ├── supabase_settings.py   ← Polling settings + subscribe ROI (Mendatang)
│   ├── stream_server.py       ← FastAPI MJPEG server (Mendatang)
│   └── heartbeat.py           ← Push heartbeat ke Supabase (Mendatang)
├── best.pt                    ← Model YOLOv8 Hygiene (hasil training)
├── requirements.txt           ← Daftar dependencies Python
├── .env.example               ← Template konfigurasi
├── README.md                  ← File ini
├── config/
│   └── roi_settings.json      ← Cache lokal ROI (sync dengan Supabase)
├── output/                    ← Buffer lokal (auto-created)
│   ├── screenshot_*.jpg
│   └── recording_*.mp4
└── dashboard/                 ← Next.js Web Dashboard (Mendatang)
    ├── app/
    │   ├── login/page.tsx
    │   ├── page.tsx           ← Dashboard Home
    │   ├── live/page.tsx
    │   ├── roi/page.tsx
    │   ├── logs/page.tsx
    │   ├── settings/page.tsx
    │   └── api/               ← Server actions / API routes
    ├── components/
    │   ├── ui/                ← shadcn/ui components
    │   └── ...
    ├── lib/
    │   ├── supabase/          ← Supabase client (browser + server)
    │   └── ...
    ├── middleware.ts          ← Auth protection
    ├── .env.local.example
    └── package.json
```

---

## ⚙️ Konfigurasi Sistem

### Python (`.env`)

```env
# --- VISION CONFIG (default; bisa di-override oleh Supabase settings) ---
MODEL_PATH=best.pt
WEBCAM_INDEX=0
CONFIDENCE=0.4
IOU_THRESHOLD=0.3
IMG_SIZE=640
DEVICE=cuda
FRAME_WIDTH=1280
FRAME_HEIGHT=720

# --- ESP32 ---
ESP32_COM_PORT=COM3
BAUD_RATE=115200

# --- SUPABASE ---
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_KEY=eyJh...        # untuk operasi privileged dari Python
SUPABASE_STORAGE_BUCKET=violation-screenshots

# --- STREAM SERVER ---
STREAM_HOST=0.0.0.0
STREAM_PORT=8000

# --- TELEGRAM (default; bisa di-override oleh Supabase settings) ---
TELEGRAM_TOKEN=
TELEGRAM_CHAT_IDS=                  # comma separated, fallback jika DB kosong
```

### Dashboard (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
NEXT_PUBLIC_PYTHON_STREAM_URL=http://192.168.1.10:8000
```

### Hierarki Konfigurasi
1. **Supabase `system_settings`** → sumber kebenaran utama (di-edit via dashboard)
2. **`.env`** → fallback default saat startup atau saat DB tidak bisa diakses
3. **Hard-coded constant di Python** → fallback terakhir

---

## 🔄 Flow Komunikasi Python ↔ Supabase ↔ Dashboard

### A. Saat Admin Ubah Settings via Dashboard
```
Dashboard form Settings
  → UPDATE system_settings di Supabase
  → Python polling (max 10 detik) ambil row terbaru
  → Apply ke runtime (threshold, kamera, dll)
  → Tidak perlu restart Python
```

### B. Saat Admin Ubah ROI
```
Dashboard ROI page (drag rectangle)
  → INSERT/UPDATE roi_config di Supabase
  → Python subscribe Realtime channel `roi_config`
  → Apply ROI baru SEKETIKA
```

### C. Saat Terjadi Pelanggaran

**Prinsip penting:** Foto **hanya di-upload sekali** ke Supabase Storage. Telegram menerima **URL public** dari Supabase, bukan file binary. Pola ini menghemat bandwidth Python (tidak perlu kirim file dua kali) dan mempercepat Telegram (server Telegram yang fetch dari Supabase CDN, bukan dari laptop Python).

```
YOLO deteksi pelanggaran (no_mask + confidence > threshold + dalam ROI + dalam jam operasional)
  │
  ├─ 1. ESP32 trigger DULU (paling cepat, < 50ms via Serial)
  │     → Buzzer + DFPlayer langsung bunyi di dapur
  │
  ├─ 2. Capture frame jadi JPEG bytes (di memory, tidak save ke disk)
  │     → cv2.imencode('.jpg', frame) → bytes
  │
  ├─ 3. Upload bytes ke Supabase Storage
  │     → bucket: violation-screenshots
  │     → path: YYYY/MM/DD/<violation_id>.jpg
  │     → Dapat PUBLIC URL (mis. https://xxx.supabase.co/storage/v1/object/public/...)
  │
  ├─ 4. INSERT row ke tabel violations (dengan screenshot_url dari step 3)
  │     → Dashboard (subscribe Realtime) langsung dapat update
  │
  └─ 5. Kirim Telegram pakai URL dari step 3 (BUKAN re-upload file)
        → POST /sendPhoto { photo: <URL>, caption: "..." }
        → Telegram server yang download dari Supabase CDN
        → Python cuma kirim string URL ~200 bytes, super ringan
```

**Pseudocode (referensi untuk AI coding assistant):**

```python
def handle_violation(frame, violation_type, confidence):
    # Step 1: Trigger hardware DULU (paralel, fire-and-forget)
    if settings.buzzer_enabled:
        esp32.send_alert(track=settings.dfplayer_track,
                         duration=settings.buzzer_duration_ms)

    # Step 2: Encode frame ke JPEG bytes (in-memory)
    success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    image_bytes = buffer.tobytes()

    # Step 3: Upload ke Supabase Storage → dapat public URL
    violation_id = uuid.uuid4()
    storage_path = f"{datetime.now():%Y/%m/%d}/{violation_id}.jpg"
    public_url = supabase_logger.upload_screenshot(storage_path, image_bytes)
    # public_url contoh: https://xxx.supabase.co/storage/v1/object/public/violation-screenshots/2026/05/15/abc123.jpg

    # Step 4: Insert log ke DB (dashboard langsung dapat update via Realtime)
    supabase_logger.insert_violation(
        id=violation_id,
        violation_type=violation_type,
        confidence=confidence,
        screenshot_url=public_url,
        camera_index=settings.active_camera_index,
    )

    # Step 5: Kirim Telegram pakai URL (bukan re-upload bytes!)
    if settings.telegram_enabled and is_within_operating_hours():
        for recipient in active_telegram_recipients:
            telegram_alert.send_photo_by_url(
                chat_id=recipient.chat_id,
                photo_url=public_url,  # ← URL string, bukan file
                caption=f"⚠️ Pelanggaran: {violation_type}\nConfidence: {confidence:.2f}\nWaktu: {datetime.now():%H:%M:%S}"
            )
```

**Implementasi Telegram dengan URL (penting!):**

```python
# ✅ BENAR — kirim URL string, ringan, cepat
def send_photo_by_url(chat_id, photo_url, caption):
    requests.post(
        f"https://api.telegram.org/bot{token}/sendPhoto",
        json={
            "chat_id": chat_id,
            "photo": photo_url,      # ← string URL
            "caption": caption,
        }
    )

# ❌ SALAH — re-upload file, boros bandwidth & lambat
def send_photo_by_file(chat_id, image_bytes, caption):
    requests.post(
        f"https://api.telegram.org/bot{token}/sendPhoto",
        data={"chat_id": chat_id, "caption": caption},
        files={"photo": image_bytes},  # ← jangan ini, sudah ada di Supabase
    )
```

**Catatan tambahan:**
- **Bucket Storage HARUS public-read** agar Telegram bisa fetch URL-nya. Sudah diatur di section "Supabase Storage Bucket".
- Step 4 (insert DB) dilakukan **setelah** step 3 (upload Storage) karena butuh `screenshot_url`-nya.
- Step 1 (ESP32) bisa fire-and-forget — tidak perlu menunggu balasan supaya tidak block proses.
- Kalau pelanggaran sama berulang dalam waktu < 30 detik, sebaiknya **debounce** (skip duplicate alert) supaya tidak spam Telegram & Storage.

### D. Status Online/Offline
```
Python loop tiap 5 detik:
  → UPSERT system_heartbeat WHERE component='python_engine' SET last_ping=NOW()

ESP32 firmware tiap 5 detik:
  → Kirim string "HEARTBEAT" via Serial
  → Python forward ke Supabase: UPSERT component='esp32'

Dashboard cek:
  → Kalau last_ping > 15 detik lalu → tampil offline 🔴
```

---

## 📅 Sprint / Development Plan

### Sprint 1 — Foundation (Database & Logging)
- [ ] Buat project Supabase + jalankan SQL skema di atas
- [ ] Setup Storage bucket `violation-screenshots`
- [ ] Bikin `modules/supabase_logger.py`: upload screenshot + insert violation
- [ ] Modifikasi `main.py` → kalau deteksi pelanggaran, panggil logger
- [ ] **Goal:** Pelanggaran terdeteksi → muncul row di Supabase + foto di Storage

### Sprint 2 — Dashboard Core (Auth, Log, Settings)
- [ ] Bootstrap Next.js + shadcn/ui + Supabase client
- [ ] Halaman Login + middleware proteksi route
- [ ] Halaman `/logs` (table + filter + modal detail)
- [ ] Halaman `/settings` (form yang tulis ke `system_settings`)
- [ ] Modul `modules/supabase_settings.py`: polling tiap 10 detik, apply runtime
- [ ] **Goal:** Admin bisa lihat log + ubah threshold dari browser

### Sprint 3 — Real-time & IoT Integration
- [ ] Modul `modules/telegram_alert.py`: baca toggle & recipient dari Supabase
- [ ] Modul `modules/esp32_serial.py`: baca toggle buzzer/dfplayer dari Supabase
- [ ] Modul `modules/stream_server.py`: FastAPI MJPEG endpoint + `/snapshot`
- [ ] Modul `modules/heartbeat.py`: push status ke `system_heartbeat`
- [ ] Halaman `/live` (embed MJPEG + side panel data realtime)
- [ ] Halaman Home dengan status cards (subscribe Realtime)
- [ ] **Goal:** End-to-end alur: deteksi → buzzer + Telegram + log + live update

### Sprint 4 — Polish (ROI & Final Touch)
- [ ] Halaman `/roi` (Canvas drag rectangle + save)
- [ ] Python subscribe Realtime `roi_config` (apply tanpa restart)
- [ ] Export log CSV
- [ ] Refactor `main_aiot_engine.py` jadi entry point tunggal
- [ ] Testing skenario A (Hygiene) & B (Lighting/Angle)
- [ ] **Goal:** Sistem MVP lengkap, siap demo

---

## 🐛 Troubleshooting

### AI Vision & Local Performance
- **"Failed to load model":** Pastikan `best.pt` ada di folder yang sama atau update `MODEL_PATH`.
- **"Gagal buka webcam":** Pastikan aplikasi seperti Zoom/Teams ditutup. Coba ganti `WEBCAM_INDEX` di Settings dashboard.
- **FPS rendah (< 10 FPS):** Pastikan `DEVICE = "cuda"`. Verifikasi GPU: `python -c "import torch; print(torch.cuda.is_available())"`. Turunkan `IMG_SIZE` ke 480 atau 320.
- **"CUDA out of memory":** Turunkan `IMG_SIZE` ke 480/320 atau ganti `DEVICE = "cpu"`.
- **Detection tidak akurat / Double Box:** Naikkan `CONFIDENCE` di dashboard ke 0.5–0.6. Sistem sudah dilengkapi Agnostic NMS untuk menekan box ganda.

### Dashboard
- **"Cannot connect to stream":** Pastikan laptop Python dan browser admin di **LAN yang sama**. Cek firewall Windows izinkan port 8000. Update `NEXT_PUBLIC_PYTHON_STREAM_URL` di `.env.local` sesuai IP laptop Python.
- **Settings tidak terapply:** Tunggu max 10 detik (interval polling Python). Cek log Python apakah ada error koneksi Supabase.
- **ROI tidak update:** Cek apakah Python subscribe Realtime aktif. Restart Python jika perlu.

### IoT & Cloud Integration
- **ESP32 Tidak Merespons:** Buka Device Manager, pastikan nomor COM port sama dengan `ESP32_COM_PORT`. Cek baud rate Arduino IDE (`Serial.begin(115200)`).
- **Telegram Tidak Mengirim Gambar:** Pastikan `chat_id` di tabel `telegram_recipients` sudah benar (tambahkan tanda `-` untuk Supergroup). Pakai tombol "Test Send" di Settings.
- **Supabase Error Upload:** Cek apakah bucket storage `violation-screenshots` sudah dibuat dan diset public read. Cek RLS policy.

---

## 📊 Expected Vision Performance (GTX 1050)

| Image Size | FPS | Latency |
|---|---|---|
| 640 | 25–35 FPS | ~30 ms |
| 480 | 35–50 FPS | ~22 ms |
| 320 | 60–80 FPS | ~13 ms |

*Catatan: Performa mungkin turun ~2–3 FPS saat sistem trigger HTTP request ke Supabase/Telegram, dan saat MJPEG stream aktif (beban encoding JPEG per frame).*

---

## 🎯 Test Scenarios untuk Validasi

### A. Skenario Hygiene (Masker & Hairnet)
1. **Wajah polos:** Expected → Terdeteksi `without_mask` + `without_hairnet`, status visual PELANGGARAN. Memicu: buzzer + MP3, Telegram alert, row baru di Supabase.
2. **Pakai keduanya:** Expected → Terdeteksi `with_mask` + `with_hairnet`, status visual AMAN. Tidak ada alert.
3. **Hanya pakai masker:** Expected → Terdeteksi `with_mask` + `without_hairnet`, alert `no_hairnet`.

### B. Skenario ROI (Absence Detection)
1. **Worker meninggalkan pos > 10 detik:** Expected → alert `left_post`, terkirim Telegram.
2. **Worker kembali ke pos:** Expected → tidak ada alert baru, log sebelumnya tetap ada.

### C. Skenario Operating Hours
1. **Pelanggaran di luar jam operasional:** Expected → tidak ada alert (Telegram & buzzer skip), TAPI log tetap masuk Supabase dengan flag.
2. **Pelanggaran di dalam jam operasional:** Expected → full alert chain berjalan.

### D. Skenario Lingkungan
1. **Lighting bervariasi:** Test di tempat terang & remang-remang.
2. **Angle bervariasi:** Test dari samping, atas, bawah (menyimulasikan angle CCTV).

---

## 🚧 Future Enhancements (Pasca-MVP)

- Multi-role access (Admin / Supervisor / Viewer) — schema sudah siap di tabel `profiles`
- Multi-camera support penuh — schema `roi_config.camera_index` sudah siap
- Halaman Analytics dengan chart tren pelanggaran (perlu data historis minimal 1–2 minggu)
- Face recognition untuk attach pelanggaran ke individu (perhatikan privasi)
- Export laporan PDF bulanan
- Notification center in-dashboard (selain Telegram)
- Polygon ROI (bukan hanya rectangle)
