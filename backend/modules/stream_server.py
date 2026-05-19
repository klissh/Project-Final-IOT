import cv2
import threading
import time
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import uvicorn
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variable to hold the latest JPEG frame
current_jpeg_frame = None

def update_frame(frame):
    """Fungsi untuk dipanggil dari webcam_inference guna mengupdate frame terbaru."""
    global current_jpeg_frame
    # Encode frame ke JPEG dengan kualitas terkompresi untuk streaming cepat
    ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    if ret:
        current_jpeg_frame = buffer.tobytes()

def generate_mjpeg():
    """Generator untuk mengirim frame secara terus-menerus via HTTP."""
    global current_jpeg_frame
    while True:
        if current_jpeg_frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + current_jpeg_frame + b'\r\n')
        # Batasi framerate stream ke ~20 FPS (0.05s) agar CPU tidak bekerja terlalu keras
        time.sleep(0.05)

@app.get("/video_feed")
def video_feed():
    """Endpoint untuk Live Stream MJPEG."""
    return StreamingResponse(generate_mjpeg(), media_type="multipart/x-mixed-replace; boundary=frame")

def start_server():
    """Menjalankan server FastAPI menggunakan uvicorn."""
    host = os.getenv("STREAM_HOST", "0.0.0.0")
    port = int(os.getenv("STREAM_PORT", "8000"))
    print(f"\n🌐 Memulai Stream Server di http://{host}:{port}/video_feed")
    uvicorn.run(app, host=host, port=port, log_level="error")

def run_in_background():
    """Fungsi helper untuk menjalankan server di background thread."""
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    return server_thread
