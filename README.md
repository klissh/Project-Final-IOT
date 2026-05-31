# 🛡️ ArkaHygiene - AIoT Kitchen Hygiene Surveillance

ArkaHygiene adalah sistem pemantauan kebersihan dapur terpadu yang memadukan **Kecerdasan Buatan (AI)**, **Internet of Things (IoT)**, dan **Cloud Dashboard** secara real-time. Sistem ini mendeteksi secara otomatis jika pekerja dapur tidak mengenakan perlengkapan higienis (Masker dan *Hairnet*) atau meninggalkan pos kerjanya, kemudian secara otomatis memicu alarm fisik dan mengirimkan bukti pelanggaran.

![ArkaHygiene Dashboard](public/dashboard-preview.png) *(Ilustrasi Dashboard)*

## 🌟 Fitur Utama
* **Real-time AI Vision:** Deteksi otomatis penggunaan masker dan *hairnet* menggunakan YOLOv8 (dengan ByteTrack Tracker) langsung dari kamera.
* **Dual Camera Mode:** 
  * **Webcam Cloud Mode:** Menerima frame dari browser via WebSocket untuk diproses oleh AI Server jarak jauh.
  * **MJPEG Local Mode:** Pemrosesan AI dan kamera secara lokal yang sangat ringan tanpa latensi jaringan.
* **AIoT Controller Panel:** Pengaturan interaktif untuk menghidupkan/mematikan peringatan hardware (ESP32 Buzzer), Bot Telegram, dan Database Logging.
* **Dynamic ROI Configurator:** Mengatur zona/pos kerja (*Region of Interest*) secara interaktif di layar; AI akan memperingatkan jika pos tersebut kosong melampaui batas waktu.
* **Real-time Alerts & Logging:** Menyimpan riwayat pelanggaran lengkap dengan foto *snapshot* ke dalam Supabase dan mengirim notifikasi instan ke Telegram.
* **Pessimistic UI Updates:** Mencegah *race-conditions* dengan *loading state* penguncian saat berinteraksi dengan konfigurasi *Cloud*.

---

## 🛠️ Tech Stack
* **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, shadcn/ui, Recharts, Lucide Icons.
* **Backend AI:** Python, Ultralytics YOLOv8, OpenCV, FastAPI/Uvicorn, WebSockets.
* **Database & Auth:** Supabase (PostgreSQL, Storage, Real-time Logging).
* **IoT / Komunikasi:** MQTT (untuk trigger ESP32 Buzzer), Telegram Bot API.

---

## 🚀 Cara Instalasi & Menjalankan Project

Project ini terbagi menjadi dua bagian: **Frontend (Web Dashboard)** dan **Backend (AI Server)**. Sangat disarankan untuk menjalankan keduanya secara lokal untuk mendapatkan pengalaman *real-time* yang paling responsif (Latensi ~0ms).

### 1. Menjalankan Frontend (Next.js Dashboard)

Buka terminal di *root directory* project ini, lalu jalankan perintah berikut:

```bash
# 1. Instal seluruh dependensi package node
npm install

# 2. Atur Environment Variables
# Duplikat file .env.local (jika belum ada) dan isi sesuai konfigurasi Supabase Anda:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# NEXT_PUBLIC_PYTHON_STREAM_URL=http://localhost:8000
# NEXT_PUBLIC_BACKEND_WS_URL=ws://localhost:8000/ws/camera

# 3. Jalankan server development
npm run dev
```
Dashboard akan berjalan di **[http://localhost:3000](http://localhost:3000)**. Akses halaman tersebut menggunakan browser Anda.

### 2. Menjalankan Backend (Python AI Server)

Buka terminal *baru*, lalu masuk ke dalam folder `backend`:

```bash
# 1. Pindah ke direktori backend
cd backend

# 2. Instal dependensi Python
pip install -r requirements.txt

# 3. Jalankan AI Server (Mode Lokal)
python main.py
```
*Catatan: Secara default, `python main.py` akan membuka webcam bawaan komputer (Index 0). AI Server akan berjalan di port `8000` (HTTP & WebSocket).*

---

## ☁️ Deployment (Opsional)
Jika Anda ingin mendistribusikan sistem ini ke Cloud:
1. **Frontend (Vercel):** Cukup dorong *repository* GitHub ini ke Vercel. Pastikan Anda memasukkan variabel dari file `.env.vercel` ke dalam menu pengaturan Vercel.
2. **Backend (Hugging Face Spaces / AWS):** Gunakan *Dockerfile* yang tersedia di dalam folder `backend`. Mode Cloud menerima gambar kamera dari browser pengguna via protokol WebSocket (`DEPLOY_MODE=cloud`).

---

*Dibangun dengan ❤️ oleh Tim ArkaHygiene untuk menciptakan standar keamanan pangan generasi berikutnya.*
