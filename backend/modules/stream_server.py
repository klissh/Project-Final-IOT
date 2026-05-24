import cv2
import threading
import time
import json
import base64
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
import uvicorn
import os
from dotenv import load_dotenv
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

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

# Callback function — akan di-set oleh main.py untuk memproses frame dari browser webcam
process_frame_callback = None

# Active WebSocket connections for broadcasting annotated frames
active_ws_connections: list[WebSocket] = []


def update_frame(frame):
    """Fungsi untuk dipanggil dari main.py guna mengupdate frame terbaru (mode lokal)."""
    global current_jpeg_frame
    ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    if ret:
        current_jpeg_frame = buffer.tobytes()


def generate_mjpeg():
    """Generator untuk mengirim frame secara terus-menerus via HTTP (mode lokal)."""
    global current_jpeg_frame
    while True:
        if current_jpeg_frame is not None:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + current_jpeg_frame + b'\r\n')
        time.sleep(0.05)


@app.get("/video_feed")
def video_feed():
    """Endpoint untuk Live Stream MJPEG (mode lokal)."""
    return StreamingResponse(generate_mjpeg(), media_type="multipart/x-mixed-replace; boundary=frame")


@app.get("/health")
def health_check():
    """Health check endpoint untuk HF Spaces."""
    return {"status": "ok", "mode": os.getenv("DEPLOY_MODE", "local")}


@app.websocket("/ws/camera")
async def websocket_camera(ws: WebSocket):
    """
    WebSocket endpoint untuk mode cloud.
    Browser mengirim frame JPEG (base64) → server proses YOLOv8 → kirim balik hasil.
    
    Protocol:
      Client → Server: { "frame": "<base64 encoded JPEG>" }
      Server → Client: { "annotated_frame": "<base64 encoded JPEG>", "detections": [...], "status": "..." }
    """
    await ws.accept()
    active_ws_connections.append(ws)
    print(f"🔗 WebSocket client terhubung. Total: {len(active_ws_connections)}")

    try:
        while True:
            # Terima frame dari browser
            data = await ws.receive_text()
            message = json.loads(data)

            if "frame" not in message:
                await ws.send_json({"error": "Missing 'frame' field"})
                continue

            # Decode base64 JPEG → numpy array (OpenCV frame)
            frame_b64 = message["frame"]
            # Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
            if "," in frame_b64:
                frame_b64 = frame_b64.split(",", 1)[1]

            import numpy as np
            frame_bytes = base64.b64decode(frame_b64)
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                await ws.send_json({"error": "Failed to decode frame"})
                continue

            # Proses frame melalui callback (YOLOv8 inference di main.py)
            if process_frame_callback:
                result = process_frame_callback(frame)
                # result = { "annotated_frame": base64_jpeg, "detections": [...], "status": "..." }
                await ws.send_json(result)
            else:
                # Jika callback belum di-set, kirim balik frame tanpa processing
                ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if ret:
                    frame_b64_out = base64.b64encode(buffer.tobytes()).decode('utf-8')
                    await ws.send_json({
                        "annotated_frame": frame_b64_out,
                        "detections": [],
                        "status": "WAITING (AI belum siap)"
                    })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
    finally:
        if ws in active_ws_connections:
            active_ws_connections.remove(ws)
        print(f"🔌 WebSocket client terputus. Total: {len(active_ws_connections)}")


def set_process_callback(callback):
    """Set callback function untuk memproses frame dari WebSocket."""
    global process_frame_callback
    process_frame_callback = callback


def start_server():
    """Menjalankan server FastAPI menggunakan uvicorn."""
    host = os.getenv("STREAM_HOST", "0.0.0.0")
    port = int(os.getenv("STREAM_PORT", "8000"))
    print(f"\n🌐 Memulai Stream Server di http://{host}:{port}/video_feed")
    print(f"   WebSocket endpoint: ws://{host}:{port}/ws/camera")
    uvicorn.run(app, host=host, port=port, log_level="error")


def run_in_background():
    """Fungsi helper untuk menjalankan server di background thread."""
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()
    return server_thread
