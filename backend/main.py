"""
Smart Kitchen Hygiene Detection - Webcam Real-Time Inference
=============================================================

Test model YOLOv8 hygiene detection dengan webcam laptop.
Tekan 'Q' atau ESC untuk keluar.
Tekan 'S' untuk screenshot frame saat ini.
Tekan 'R' untuk start/stop recording video.

Requirements:
  pip install ultralytics opencv-python numpy

Usage:
  python webcam_inference.py
"""
import cv2
import time
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
MODEL_PATH = "best.pt"           # Path ke model (relatif terhadap script)
WEBCAM_INDEX = 0                 # 0 = webcam default. Coba 1, 2 jika multi-camera
CONFIDENCE = 0.4                 # Confidence threshold (0.0 - 1.0)
IOU_THRESHOLD = 0.35             # DITURUNKAN: IoU threshold lebih ketat untuk menekan double box
AGNOSTIC_NMS = True              # AKTIF: Mencegah box beda kelas tumpang tindih (misal with_hairnet vs without_mask)
IMG_SIZE = 640                   # Image size untuk inference (640 = optimal)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Setup Debounce untuk Logging ke Supabase (jangan log pelanggaran yang sama tiap frame)
LOG_DEBOUNCE_SECONDS = 15
last_log_time = {
    "no_both": 0,
    "no_mask": 0,
    "no_hairnet": 0,
    "left_post": 0
}

# Resolusi webcam (sesuaikan dengan kamera Anda)
FRAME_WIDTH = 1280
FRAME_HEIGHT = 720

# Output folder untuk screenshot & recording
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

# Warna Bounding Box (BGR)
COLORS = {
    "with_hairnet": (0, 255, 0),          # Hijau
    "with_mask": (0, 255, 0),             # Hijau
    "without_mask_hairnet": (0, 0, 255),  # Merah
}

def draw_custom_boxes(frame, results, names, roi_points=None):
    """Menggambar bounding box custom dengan warna sesuai kelas, dan mengecek apakah ada objek di dalam ROI."""
    detected_classes = set()
    is_someone_in_roi = False
    
    for box in results[0].boxes:
        # Ambil koordinat, class, dan confidence
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        cls_name = names[cls_id]
        
        # CEK POSISI DI ROI (POS KERJA)
        if roi_points and len(roi_points) >= 3:
            # Hitung titik tengah bawah (kaki/badan bawah) objek
            cx = int((x1 + x2) / 2)
            cy = int(y2 - ((y2 - y1) * 0.1)) # 10% dari bawah
            # Cek apakah koordinat tersebut ada di dalam polygon pos kerja
            dist = cv2.pointPolygonTest(np.array(roi_points, np.int32), (cx, cy), False)
            if dist >= 0:
                is_someone_in_roi = True
        
        detected_classes.add(cls_name)
        color = COLORS.get(cls_name, (255, 255, 255))
        
        # Gambar Bounding Box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        
        # Background untuk text label
        label = f"{cls_name} {conf:.2f}"
        (w, h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
        cv2.rectangle(frame, (x1, y1 - 25), (x1 + w, y1), color, -1)
        
        # Tulis text label
        cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
        
    return detected_classes, is_someone_in_roi

def process_violation_async(frame, violation_type, confidence, trigger_buzzer=True, send_telegram=True, log_enabled=True):
    """Fungsi ini berjalan di background thread untuk mencegah lag pada kamera"""
    print(f"\n⚠️ Merekam pelanggaran: {violation_type} (conf: {confidence:.2f})")
    
    # 0. TRIGGER IoT BUZZER (Seketika!)
    if trigger_buzzer:
        esp32_serial.trigger_buzzer()
        
    if not log_enabled:
        print("⏭️ Fitur Log DB dimatikan. Melewati proses upload screenshot.")
        # Jika log mati, telegram otomatis tidak bisa mengirim foto
        if send_telegram:
            print("⚠️ Telegram aktif tapi Log mati, pesan terkirim tanpa foto.")
            telegram_alert.send_alert(violation_type, confidence, "")
        return
    
    # 1. Encode frame ke JPEG (in-memory)
    success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not success:
        print("❌ Gagal encode frame untuk diupload")
        return
        
    image_bytes = buffer.tobytes()
    
    # 2. Upload ke Supabase Storage
    public_url, violation_id = supabase_logger.upload_screenshot(image_bytes)
    
    if public_url:
        print(f"✅ Screenshot terupload: {public_url}")
        # 3. Insert record pelanggaran ke DB
        supabase_logger.insert_violation(
            violation_id=violation_id,
            violation_type=violation_type,
            confidence=confidence,
            screenshot_url=public_url,
            camera_index=WEBCAM_INDEX
        )
        print("✅ Log pelanggaran berhasil disimpan ke database")
        
        # 4. KIRIM TELEGRAM ALERT
        if send_telegram:
            telegram_alert.send_alert(violation_type, confidence, public_url)
    else:
        print("❌ Gagal mengunggah screenshot, log dibatalkan.")

def get_hygiene_status(detected_classes):
    """Menentukan status hygiene berdasarkan deteksi."""
    if len(detected_classes) == 0:
        return "TIDAK TERDETEKSI", (128, 128, 128)  # Abu-abu
    elif "without_mask_hairnet" in detected_classes:
        return "PELANGGARAN!", (0, 0, 255)  # Merah
    elif "with_mask" in detected_classes and "with_hairnet" in detected_classes:
        return "AMAN", (0, 255, 0)  # Hijau
    else:
        # Hanya pakai salah satu (masker saja atau hairnet saja)
        return "PERHATIAN (Tidak Lengkap)", (0, 255, 255)  # Kuning

def main():
    print("=" * 60)
    print("🍳 SMART KITCHEN HYGIENE DETECTION - WEBCAM")
    print("=" * 60)
    
    # Inisialisasi ESP32 & Live Stream
    print("\n📡 Mempersiapkan modul integrasi...")
    esp32_serial.init_serial()
    stream_server.run_in_background()
    
    # Load model
    print(f"\n📦 Loading model: {MODEL_PATH} on device {DEVICE.upper()}")
    try:
        model = YOLO(MODEL_PATH)
        names = model.names
        print(f"✅ Model loaded ({len(names)} classes)")
        print(f"   Classes: {list(names.values())}")
    except Exception as e:
        print(f"❌ Failed to load model: {e}")
        print(f"   Pastikan file '{MODEL_PATH}' ada di folder yang sama")
        return
        
    # Warmup model (menghindari lag pada frame pertama)
    print("\n🔥 Warming up model...")
    dummy_frame = np.zeros((FRAME_HEIGHT, FRAME_WIDTH, 3), dtype=np.uint8)
    model.predict(source=dummy_frame, imgsz=IMG_SIZE, device=DEVICE, verbose=False)
    
    # Buka webcam
    print(f"\n📷 Opening webcam (index {WEBCAM_INDEX})...")
    cap = cv2.VideoCapture(WEBCAM_INDEX, cv2.CAP_DSHOW)
    
    if not cap.isOpened():
        print(f"❌ Gagal buka webcam index {WEBCAM_INDEX}")
        print("   Coba ganti WEBCAM_INDEX ke 1, 2, atau 3")
        return
    
    # Set resolusi
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"✅ Webcam ready: {actual_w}x{actual_h}")
    
    # Variabel untuk recording
    is_recording = False
    video_writer = None
    
    # FPS calculation
    fps_buffer = []
    fps_buffer_size = 30
    
    print(f"\n🎬 Starting headless inference loop...")
    print(f"   Tekan Ctrl+C di terminal ini untuk berhenti")
    print()
    
    confidence = CONFIDENCE
    frame_count = 0
    start_time = time.time()
    
    # State untuk System Settings Dinamis
    sys_settings = {
        "telegram_bot_active": True,
        "esp32_buzzer_active": True,
        "ai_detection_active": True,
        "log_enabled": True,
        "ai_confidence_threshold": confidence,
        "empty_post_timer": 5
    }
    
    # State untuk Dynamic ROI
    sys_roi_points = []
    roi_empty_start_time = None
    
    last_settings_poll = 0
    
    while True:
        # Wall-clock time untuk hitung FPS full loop
        loop_start = time.time()
        
        # 0. Polling Settings dari DB setiap 10 detik
        if loop_start - last_settings_poll > 10:
            db_settings = supabase_logger.get_system_settings()
            if db_settings:
                sys_settings["telegram_bot_active"] = db_settings.get("telegram_enabled", True)
                sys_settings["esp32_buzzer_active"] = db_settings.get("buzzer_enabled", True)
                sys_settings["ai_detection_active"] = db_settings.get("ai_detection_active", True)
                sys_settings["log_enabled"] = db_settings.get("log_enabled", True)
                sys_settings["ai_confidence_threshold"] = float(db_settings.get("confidence_threshold", confidence))
                sys_settings["empty_post_timer"] = int(db_settings.get("empty_post_timer", 5))
                
            # Tarik ROI config
            db_roi = supabase_logger.get_roi_config()
            if db_roi is not None:
                sys_roi_points = db_roi
            else:
                sys_roi_points = []
                
            last_settings_poll = loop_start

        ret, frame = cap.read()
        if not ret:
            print("❌ Failed to read frame")
            break
            
        frame_count += 1
        
        if sys_settings["ai_detection_active"]:
            # Inference dengan Agnostic NMS dan IoU lebih ketat
            results = model.predict(
                source=frame,
                conf=sys_settings["ai_confidence_threshold"],
                iou=IOU_THRESHOLD,
                agnostic_nms=AGNOSTIC_NMS,
                imgsz=IMG_SIZE,
                device=DEVICE,
                verbose=False,
            )
            
            # Siapkan koordinat absolut ROI untuk dikirim ke fungsi filtering dan penggambaran
            abs_roi_points = []
            if sys_roi_points and len(sys_roi_points) >= 3:
                frame_h, frame_w = frame.shape[:2]
                for pt in sys_roi_points:
                    abs_roi_points.append([int(pt[0] * frame_w), int(pt[1] * frame_h)])
                
                # Gambar batas ROI di frame
                abs_roi_pts_np = np.array(abs_roi_points, np.int32).reshape((-1, 1, 2))
                cv2.polylines(frame, [abs_roi_pts_np], isClosed=True, color=(0, 255, 0), thickness=2)
                cv2.putText(frame, "ACTIVE ROI ZONE", (abs_roi_points[0][0], max(20, abs_roi_points[0][1] - 10)),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            
            # Gambar Bounding Box Custom & Cek ROI
            detected_classes, is_someone_in_roi = draw_custom_boxes(frame, results, names, abs_roi_points)
            
            # Tentukan Status Hygiene Normal
            status_text, status_color = get_hygiene_status(detected_classes)

            # --- Skenario Dynamic ROI (Meninggalkan Pos) ---
            if abs_roi_points and len(abs_roi_points) >= 3:
                if is_someone_in_roi:
                    # Posisi terjaga, reset timer
                    roi_empty_start_time = None
                    if status_text == "TIDAK TERDETEKSI":
                        status_text = "POS TERISI"
                        status_color = (0, 255, 0)
                else:
                    # Posisi kosong, mulai atau lanjut timer
                    if roi_empty_start_time is None:
                        roi_empty_start_time = time.time()
                    
                    elapsed_empty = time.time() - roi_empty_start_time
                    timer_limit = sys_settings["empty_post_timer"]
                    
                    if elapsed_empty >= timer_limit:
                        # Timer mencapai batas waktu, Picu pelanggaran Meninggalkan Pos
                        status_text = "POS KOSONG!"
                        status_color = (0, 165, 255) # Orange warna peringatan
                        
                        current_time = time.time()
                        if current_time - last_log_time.get("left_post", 0) > LOG_DEBOUNCE_SECONDS:
                            last_log_time["left_post"] = current_time
                            
                            thread = threading.Thread(
                                target=process_violation_async, 
                                args=(
                                    frame.copy(), 
                                    "left_post", 
                                    1.0, # Confidence 100% untuk Pos Kosong
                                    sys_settings["esp32_buzzer_active"], 
                                    sys_settings["telegram_bot_active"],
                                    sys_settings["log_enabled"]
                                )
                            )
                            thread.daemon = True
                            thread.start()
                    elif elapsed_empty > 0:
                        # Tampilkan hitung mundur di layar
                        status_text = f"POS KOSONG... {timer_limit - int(elapsed_empty)}s"
                        status_color = (0, 255, 255) # Kuning
        else:
            # Bypass AI (Hanya Kamera CCTV Biasa)
            results = None
            detected_classes = set()
            status_text, status_color = "CCTV MODE (AI MATI)", (255, 255, 255)
            
        # Cek Pelanggaran & Trigger Upload (Debounced)
        if "PELANGGARAN" in status_text or "PERHATIAN" in status_text:
            violation_type = None
            if "without_mask_hairnet" in detected_classes:
                violation_type = "no_both"
            elif "with_mask" in detected_classes and "with_hairnet" not in detected_classes:
                violation_type = "no_hairnet"
            elif "with_hairnet" in detected_classes and "with_mask" not in detected_classes:
                violation_type = "no_mask"
            
            # Jika ada pelanggaran yang spesifik
            if violation_type:
                current_time = time.time()
                # Cek apakah sudah melewati batas waktu debounce
                if current_time - last_log_time.get(violation_type, 0) > LOG_DEBOUNCE_SECONDS:
                    last_log_time[violation_type] = current_time
                    
                    # Ambil confidence rata-rata deteksi sebagai metadata
                    avg_conf = sum([float(box.conf[0]) for box in results[0].boxes]) / max(len(results[0].boxes), 1)
                    
                    # Jalankan upload di background thread agar tidak bikin kamera lag
                    thread = threading.Thread(
                        target=process_violation_async, 
                        args=(
                            frame.copy(), 
                            violation_type, 
                            avg_conf, 
                            sys_settings["esp32_buzzer_active"], 
                            sys_settings["telegram_bot_active"],
                            sys_settings["log_enabled"]
                        )
                    )
                    thread.daemon = True
                    thread.start()

        # Hitung FPS
        loop_time = time.time() - loop_start
        fps = 1 / loop_time if loop_time > 0 else 0
        fps_buffer.append(fps)
        if len(fps_buffer) > fps_buffer_size:
            fps_buffer.pop(0)
        avg_fps = sum(fps_buffer) / len(fps_buffer)
        
        # Background semi-transparan untuk Info Panel (Kiri Atas)
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (320, 100), (0, 0, 0), -1)
        
        # Background Panel Status Besar (Atas Tengah)
        (tw, th), _ = cv2.getTextSize(status_text, cv2.FONT_HERSHEY_DUPLEX, 1.2, 3)
        status_x = (actual_w - tw) // 2
        cv2.rectangle(overlay, (status_x - 20, 10), (status_x + tw + 20, 60), status_color, -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
        
        # Tulis Text Status Besar
        cv2.putText(frame, status_text, (status_x, 45), cv2.FONT_HERSHEY_DUPLEX, 1.2, (255, 255, 255) if status_color != (0, 255, 255) else (0,0,0), 3)
        
        # UPDATE FRAME KE SERVER LIVE STREAM
        stream_server.update_frame(frame)
        
        # Info Panel Teks
        cv2.putText(frame, f"FPS : {avg_fps:.1f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.putText(frame, f"Conf: {sys_settings['ai_confidence_threshold']:.2f}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        cv2.putText(frame, f"Tol : {sys_settings['empty_post_timer']}s", (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
        
        num_dets = len(results[0].boxes) if results else 0
        cv2.putText(frame, f"Det : {num_dets}", (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        if is_recording:
            cv2.circle(frame, (actual_w - 40, 40), 10, (0, 0, 255), -1)
            cv2.putText(frame, "REC", (actual_w - 90, 47), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        
        # Tulis ke video jika recording
        if is_recording and video_writer is not None:
            video_writer.write(frame)
        
        # Handle interupsi manual (Ctrl+C di terminal)
        # cv2.imshow dan waitKey dihapus agar berjalan murni di background (Headless)
        # Kamera akan sepenuhnya ditampilkan di Website.
    
    # Cleanup
    if video_writer is not None:
        video_writer.release()
    cap.release()
    
    # Summary
    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print(f"📊 SESSION SUMMARY")
    print(f"{'=' * 60}")
    print(f"   Total frames     : {frame_count}")
    print(f"   Total time       : {elapsed:.1f}s")
    print(f"   Average FPS      : {frame_count / elapsed:.2f}")
    print(f"   Output folder    : {OUTPUT_DIR.absolute()}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
