"""
Smart Kitchen Hygiene Detection - AIoT Engine
=============================================================

Dual mode:
  LOCAL: Membuka webcam langsung, streaming MJPEG, Serial ke ESP32
  CLOUD: Menerima frame dari browser via WebSocket, MQTT ke ESP32

Tracking Mode:
  Menggunakan YOLOv8 Tracker (BoT-SORT) untuk memberikan ID unik pada pekerja.
  Menerapkan Stateful Debounce untuk mengurangi spam notifikasi.

Requirements:
  pip install -r requirements.txt

Usage:
  python main.py                  # mode lokal (default)
  DEPLOY_MODE=cloud python main.py  # mode cloud (untuk HF Spaces)
"""
import cv2
import time
import os
import base64
import numpy as np
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
current_dir = Path(__file__).parent.resolve()
for _ in range(4):
    env_found = False
    for filename in [".env.local", ".env"]:
        path = current_dir / filename
        if path.exists():
            load_dotenv(dotenv_path=path)
            env_found = True
            break
    if env_found:
        break
    current_dir = current_dir.parent
else:
    load_dotenv()

from ultralytics import YOLO
import torch
import threading
from modules import supabase_logger, telegram_alert, esp32_serial, stream_server

# ============================================================
# KONFIGURASI
# ============================================================
DEPLOY_MODE = os.getenv("DEPLOY_MODE", "local").lower()
MODEL_PATH = "best.pt"           # Path ke model (relatif terhadap script)
WEBCAM_INDEX = 0                 # 0 = webcam default. Coba 1, 2 jika multi-camera
CONFIDENCE = 0.4                 # Confidence threshold (0.0 - 1.0)
IOU_THRESHOLD = 0.35             # IoU threshold untuk NMS
AGNOSTIC_NMS = False             # Harus False agar box 'with_mask' & 'with_hairnet' bisa tumpang tindih di 1 wajah
IMG_SIZE = 640                   # Image size untuk inference
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Resolusi webcam
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

# Output folder untuk screenshot
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

# Warna Bounding Box (BGR)
COLORS = {
    "with_hairnet": (0, 255, 0),          # Hijau
    "with_mask": (0, 255, 0),             # Hijau
    "without_mask_hairnet": (0, 0, 255),  # Merah
}

# ============================================================
# SHARED STATE (digunakan oleh kedua mode)
# ============================================================
sys_settings = {
    "telegram_bot_active": True,
    "esp32_buzzer_active": True,
    "ai_detection_active": True,
    "log_enabled": True,
    "ai_confidence_threshold": CONFIDENCE,
    "empty_post_timer": 5
}

sys_roi_points = []
roi_empty_start_time = None
last_log_time_left_post = 0
last_settings_poll = 0

model = None
names = None

# ============================================================
# STATEFUL TRACKER DICTIONARY
# ============================================================
# Format: tracker_id -> { "status": "safe", "violation_start": 0, "safe_start": 0, "last_buzz_time": 0, "last_log_time": 0, "last_seen": 0 }
active_trackers = {}


def poll_settings():
    """Polling settings dari Supabase setiap 10 detik."""
    global sys_settings, sys_roi_points, last_settings_poll

    current_time = time.time()
    if current_time - last_settings_poll > 10:
        db_settings = supabase_logger.get_system_settings()
        if db_settings:
            sys_settings["telegram_bot_active"] = db_settings.get("telegram_enabled", True)
            sys_settings["esp32_buzzer_active"] = db_settings.get("buzzer_enabled", True)
            sys_settings["ai_detection_active"] = db_settings.get("ai_detection_active", True)
            sys_settings["log_enabled"] = db_settings.get("log_enabled", True)
            sys_settings["ai_confidence_threshold"] = float(db_settings.get("confidence_threshold", CONFIDENCE))
            sys_settings["empty_post_timer"] = int(db_settings.get("empty_post_timer", 5))

        db_roi = supabase_logger.get_roi_config()
        if db_roi is not None:
            sys_roi_points = db_roi
        else:
            sys_roi_points = []

        last_settings_poll = current_time


def process_violation_async(frame, violation_type, confidence, trigger_buzzer=True, send_telegram=True, log_enabled=True):
    """Berjalan di background thread. Menyimpan log DB dan kirim Telegram."""
    print(f"\n⚠️ Merekam pelanggaran: {violation_type} (conf: {confidence:.2f})")

    if trigger_buzzer:
        esp32_serial.trigger_buzzer()

    if not log_enabled:
        if send_telegram:
            telegram_alert.send_alert(violation_type, confidence, "")
        return

    success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not success:
        return

    image_bytes = buffer.tobytes()
    public_url, violation_id = supabase_logger.upload_screenshot(image_bytes)

    if public_url:
        supabase_logger.insert_violation(
            violation_id=violation_id,
            violation_type=violation_type,
            confidence=confidence,
            screenshot_url=public_url,
            camera_index=WEBCAM_INDEX
        )
        if send_telegram:
            telegram_alert.send_alert(violation_type, confidence, public_url)


def group_boxes_by_person(boxes, class_names):
    """
    Mengelompokkan bounding boxes menjadi "Orang/Pekerja" berdasarkan kedekatan jarak spasial.
    Memungkinkan kita menggabungkan box 'with_mask' dan 'with_hairnet' ke orang yang sama.
    """
    groups = []
    for box in boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        cls_id = int(box.cls[0])
        cls_name = class_names[cls_id]
        conf = float(box.conf[0])
        track_id = int(box.id[0]) if box.id is not None else None

        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        matched = False

        for g in groups:
            gx1, gy1, gx2, gy2 = g['rect']
            gcx, gcy = (gx1 + gx2) / 2, (gy1 + gy2) / 2
            
            # Toleransi jarak: 1.5x dari lebar/tinggi box
            dist = ((cx - gcx)**2 + (cy - gcy)**2)**0.5
            max_dist = max(x2 - x1, gx2 - gx1, y2 - y1, gy2 - gy1) * 1.5
            
            if dist < max_dist:
                g['classes'].add(cls_name)
                g['confs'].append(conf)
                if track_id is not None:
                    g['track_ids'].add(track_id)
                # Perluas rect grup
                g['rect'] = (min(x1, gx1), min(y1, gy1), max(x2, gx2), max(y2, gy2))
                matched = True
                break
                
        if not matched:
            groups.append({
                'rect': (x1, y1, x2, y2),
                'classes': {cls_name},
                'confs': [conf],
                'track_ids': {track_id} if track_id is not None else set()
            })
            
    return groups


def process_single_frame(frame):
    """
    Proses satu frame menggunakan YOLOv8 Tracking (BoT-SORT) + Stateful Debouncing.
    """
    global roi_empty_start_time, last_log_time_left_post, active_trackers

    poll_settings()

    if not sys_settings["ai_detection_active"]:
        return frame, set(), "CCTV MODE (AI MATI)", (255, 255, 255), False

    # Inference menggunakan tracker!
    results = model.track(
        source=frame,
        conf=sys_settings["ai_confidence_threshold"],
        iou=IOU_THRESHOLD,
        agnostic_nms=AGNOSTIC_NMS,
        imgsz=IMG_SIZE,
        device=DEVICE,
        persist=True,  # Penting: mempertahankan ID antar frame
        tracker="botsort.yaml", # Tracker bawaan YOLO
        verbose=False,
    )

    current_time = time.time()
    
    # 1. Siapkan & Gambar ROI Polygon
    abs_roi_points = []
    if sys_roi_points and len(sys_roi_points) >= 3:
        frame_h, frame_w = frame.shape[:2]
        for pt in sys_roi_points:
            abs_roi_points.append([int(pt[0] * frame_w), int(pt[1] * frame_h)])

        abs_roi_pts_np = np.array(abs_roi_points, np.int32).reshape((-1, 1, 2))
        cv2.polylines(frame, [abs_roi_pts_np], isClosed=True, color=(0, 255, 0), thickness=2)
        cv2.putText(frame, "ACTIVE ROI", (abs_roi_points[0][0], max(20, abs_roi_points[0][1] - 10)),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

    is_someone_in_roi = False
    global_status_text = "AMAN"
    global_status_color = (0, 255, 0)
    all_detected_classes = set()

    # 2. Grouping bounding boxes per-orang
    groups = group_boxes_by_person(results[0].boxes, names) if results[0].boxes else []
    seen_track_ids = set()

    for g in groups:
        x1, y1, x2, y2 = g['rect']
        classes = g['classes']
        all_detected_classes.update(classes)
        
        main_track_id = min(g['track_ids']) if g['track_ids'] else None
        
        # Cek apakah grup ini berada di dalam ROI
        if abs_roi_points and len(abs_roi_points) >= 3:
            cx, cy = (x1 + x2) // 2, y2 - int((y2 - y1) * 0.1)
            if cv2.pointPolygonTest(np.array(abs_roi_points, np.int32), (cx, cy), False) >= 0:
                is_someone_in_roi = True

        # Tentukan status kebersihan untuk grup/orang ini
        person_status = "safe"
        if "without_mask_hairnet" in classes:
            person_status = "no_both"
        elif "with_mask" in classes and "with_hairnet" in classes:
            person_status = "safe"
        elif "with_mask" in classes:
            person_status = "no_hairnet"
        elif "with_hairnet" in classes:
            person_status = "no_mask"

        # Tentukan warna box
        color = (0, 255, 0) if person_status == "safe" else (0, 0, 255)
        if person_status in ["no_hairnet", "no_mask"]:
            color = (0, 255, 255) # Kuning untuk pelanggaran parsial

        # Gambar box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        label_text = f"ID:{main_track_id if main_track_id else '?'} | " + ",".join(classes)
        (w, h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
        cv2.rectangle(frame, (x1, y1 - 25), (x1 + w, y1), color, -1)
        cv2.putText(frame, label_text, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 2)

        # Update global status untuk overlay teks
        if person_status == "no_both":
            global_status_text = "PELANGGARAN!"
            global_status_color = (0, 0, 255)
        elif person_status != "safe" and global_status_text == "AMAN":
            global_status_text = "PERHATIAN (Tidak Lengkap)"
            global_status_color = (0, 255, 255)

        # 3. Logika Stateful Debouncing (Hanya jalan jika ada ID)
        if main_track_id is not None:
            seen_track_ids.add(main_track_id)
            
            # Inisialisasi memori untuk ID baru
            if main_track_id not in active_trackers:
                active_trackers[main_track_id] = {
                    "status": "safe",
                    "violation_start": 0,
                    "safe_start": 0,
                    "last_buzz_time": 0,
                    "last_log_time": 0,
                    "last_seen": current_time
                }
                
            tracker = active_trackers[main_track_id]
            tracker["last_seen"] = current_time

            if person_status != "safe":
                tracker["safe_start"] = 0
                
                # Jika sebelumnya aman, ini awal pelanggaran baru
                if tracker["status"] == "safe":
                    tracker["status"] = person_status
                    tracker["violation_start"] = current_time
                    # Reset timer agar langsung trigger
                    tracker["last_buzz_time"] = 0
                    tracker["last_log_time"] = 0
                
                # SMOOTHING: Harus konsisten melanggar selama 1 detik penuh
                if current_time - tracker["violation_start"] >= 1.0:
                    
                    # A. BUZZER (Diulang setiap 30 detik jika bandel)
                    if current_time - tracker["last_buzz_time"] >= 30:
                        if sys_settings["esp32_buzzer_active"]:
                            esp32_serial.trigger_buzzer()
                        tracker["last_buzz_time"] = current_time
                        
                    # B. LOG & TELEGRAM (Hanya 1x per insiden, cooldown 5 menit)
                    if current_time - tracker["last_log_time"] >= 300:
                        avg_conf = sum(g['confs']) / max(len(g['confs']), 1)
                        # Jalankan background thread
                        thread = threading.Thread(
                            target=process_violation_async,
                            args=(frame.copy(), person_status, avg_conf,
                                  False, # trigger_buzzer=False karena sudah di atas
                                  sys_settings["telegram_bot_active"],
                                  sys_settings["log_enabled"])
                        )
                        thread.daemon = True
                        thread.start()
                        tracker["last_log_time"] = current_time
            else:
                # Pekerja sudah pakai perlengkapan dengan benar
                if tracker["safe_start"] == 0:
                    tracker["safe_start"] = current_time
                    
                # SMOOTHING: Harus konsisten aman selama 2.5 detik untuk mereset pelanggaran
                # (Mencegah reset akibat berkedip/flicker ke status aman sedetik)
                if current_time - tracker["safe_start"] >= 2.5:
                    tracker["status"] = "safe"
                    tracker["violation_start"] = 0

    # 4. Garbage Collection: Hapus ID yang sudah out-of-frame > 5 detik
    for tid in list(active_trackers.keys()):
        if current_time - active_trackers[tid]["last_seen"] > 5.0:
            del active_trackers[tid]

    # --- Skenario Dynamic ROI (Meninggalkan Pos) ---
    if len(groups) == 0:
        global_status_text = "TIDAK TERDETEKSI"
        global_status_color = (128, 128, 128)

    if abs_roi_points and len(abs_roi_points) >= 3:
        if is_someone_in_roi:
            roi_empty_start_time = None
        else:
            if roi_empty_start_time is None:
                roi_empty_start_time = current_time

            elapsed_empty = current_time - roi_empty_start_time
            timer_limit = sys_settings["empty_post_timer"]

            if elapsed_empty >= timer_limit:
                global_status_text = "POS KOSONG!"
                global_status_color = (0, 165, 255)

                if current_time - last_log_time_left_post > 30: # 30s debounce khusus pos kosong
                    last_log_time_left_post = current_time
                    thread = threading.Thread(
                        target=process_violation_async,
                        args=(frame.copy(), "left_post", 1.0,
                              sys_settings["esp32_buzzer_active"],
                              sys_settings["telegram_bot_active"],
                              sys_settings["log_enabled"])
                    )
                    thread.daemon = True
                    thread.start()
            elif elapsed_empty > 0:
                global_status_text = f"POS KOSONG... {timer_limit - int(elapsed_empty)}s"
                global_status_color = (0, 255, 255)

    # Draw global status overlay
    actual_h, actual_w = frame.shape[:2]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (320, 100), (0, 0, 0), -1)

    (tw, th), _ = cv2.getTextSize(global_status_text, cv2.FONT_HERSHEY_DUPLEX, 1.2, 3)
    status_x = (actual_w - tw) // 2
    cv2.rectangle(overlay, (status_x - 20, 10), (status_x + tw + 20, 60), global_status_color, -1)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

    cv2.putText(frame, global_status_text, (status_x, 45), cv2.FONT_HERSHEY_DUPLEX, 1.2,
                (255, 255, 255) if global_status_color != (0, 255, 255) else (0, 0, 0), 3)

    num_dets = len(groups)
    cv2.putText(frame, f"Orang : {num_dets}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(frame, f"Tracked : {len(active_trackers)}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    return frame, all_detected_classes, global_status_text, global_status_color, is_someone_in_roi


def process_frame_for_websocket(frame):
    """Callback untuk WebSocket"""
    annotated_frame, detected_classes, status_text, status_color, is_someone_in_roi = process_single_frame(frame)

    ret, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    frame_b64 = ""
    if ret:
        frame_b64 = base64.b64encode(buffer.tobytes()).decode('utf-8')

    detections = [{"class": c, "safe": c in ["with_mask", "with_hairnet"]} for c in detected_classes]

    return {
        "annotated_frame": frame_b64,
        "detections": detections,
        "status": status_text,
        "roi_occupied": is_someone_in_roi,
    }


def run_local():
    global model, names

    print("=" * 60)
    print("🍳 SMART KITCHEN HYGIENE DETECTION - MODE LOKAL")
    print("=" * 60)

    print("\n📡 Mempersiapkan modul integrasi...")
    esp32_serial.init()
    stream_server.run_in_background()

    print(f"\n📦 Loading model: {MODEL_PATH} on device {DEVICE.upper()}")
    try:
        model = YOLO(MODEL_PATH)
        names = model.names
        print(f"✅ Model loaded ({len(names)} classes)")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return

    print("\n🔥 Warming up model...")
    dummy_frame = np.zeros((FRAME_HEIGHT, FRAME_WIDTH, 3), dtype=np.uint8)
    model.predict(source=dummy_frame, imgsz=IMG_SIZE, device=DEVICE, verbose=False)

    print(f"\n📷 Opening webcam (index {WEBCAM_INDEX})...")
    cap = cv2.VideoCapture(WEBCAM_INDEX, cv2.CAP_DSHOW)

    if not cap.isOpened():
        print(f"❌ Gagal buka webcam index {WEBCAM_INDEX}")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, 30)

    print(f"\n🎬 Starting headless inference loop (Tracker Active)...")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        annotated_frame, _, _, _, _ = process_single_frame(frame)
        stream_server.update_frame(annotated_frame)

    cap.release()


def run_cloud():
    global model, names

    print("=" * 60)
    print("☁️ SMART KITCHEN HYGIENE DETECTION - MODE CLOUD")
    print("=" * 60)

    print("\n📡 Mempersiapkan modul integrasi...")
    esp32_serial.init()

    print(f"\n📦 Loading model: {MODEL_PATH} on device {DEVICE.upper()}")
    try:
        model = YOLO(MODEL_PATH)
        names = model.names
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        return

    print("\n🔥 Warming up model...")
    dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    model.predict(source=dummy_frame, imgsz=IMG_SIZE, device=DEVICE, verbose=False)

    stream_server.set_process_callback(process_frame_for_websocket)

    print("\n🚀 AI Engine siap menerima frame via WebSocket!")
    stream_server.start_server()


if __name__ == "__main__":
    print(f"\n🔧 Deploy Mode: {DEPLOY_MODE.upper()}")

    if DEPLOY_MODE == "cloud":
        run_cloud()
    else:
        run_local()
