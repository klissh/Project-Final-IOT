import os
import uuid
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup Supabase Client
url: str = os.getenv("SUPABASE_URL", "")
key: str = os.getenv("SUPABASE_SERVICE_KEY", "") # Gunakan service key untuk write/bypass RLS dari backend

# Fallback ke anon key jika service key tidak ada
if not key:
    key = os.getenv("SUPABASE_ANON_KEY", "")

BUCKET_NAME = os.getenv("SUPABASE_STORAGE_BUCKET", "violation-screenshots")

# Initialize client
try:
    if url and key:
        supabase: Client = create_client(url, key)
    else:
        print("⚠️ Warning: SUPABASE_URL atau KEY tidak ditemukan di .env")
        supabase = None
except Exception as e:
    print(f"❌ Error initializing Supabase client: {e}")
    supabase = None

def upload_screenshot(image_bytes: bytes) -> tuple[str, str]:
    """
    Upload image bytes ke Supabase Storage.
    Returns: (public_url, violation_id)
    """
    violation_id = str(uuid.uuid4())
    
    if not supabase:
        print("⚠️ Skip upload: Supabase client belum siap.")
        return "", violation_id

    now = datetime.now()
    # Format path: YYYY/MM/DD/violation_id.jpg
    storage_path = f"{now.strftime('%Y/%m/%d')}/{violation_id}.jpg"

    try:
        # Upload file ke Storage bucket
        supabase.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=image_bytes,
            file_options={"content-type": "image/jpeg"}
        )
        
        # Dapatkan public URL
        public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_path)
        return public_url, violation_id
        
    except Exception as e:
        print(f"❌ Error upload screenshot ke Supabase: {e}")
        return "", violation_id


def insert_violation(violation_id: str, violation_type: str, confidence: float, screenshot_url: str, camera_index: int = 0):
    """
    Insert record pelanggaran ke tabel 'violations'
    """
    if not supabase:
        print("⚠️ Skip insert log: Supabase client belum siap.")
        return None

    data = {
        "id": violation_id,
        "violation_type": violation_type,
        "confidence": confidence,
        "screenshot_url": screenshot_url,
        "camera_index": camera_index,
        "status": "new"
    }

    try:
        response = supabase.table("violations").insert(data).execute()
        return response
    except Exception as e:
        print(f"❌ Error insert violation record: {e}")
        return None

def get_system_settings():
    """
    Mengambil konfigurasi sistem terbaru dari database.
    Returns: dict berisi konfigurasi, atau None jika gagal.
    """
    if not supabase:
        return None
        
    try:
        response = supabase.table('system_settings').select('*').limit(1).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
    except Exception as e:
        print(f"⚠️ Gagal mengambil pengaturan dari Supabase: {e}")
        
    return None

def get_roi_config(camera_index: int = 0):
    """
    Mengambil konfigurasi ROI (Region of Interest) dari database.
    Returns: list koordinat polygon [[x,y], ...], atau None jika tidak ada.
    """
    if not supabase:
        return None
        
    try:
        response = supabase.table('roi_config').select('roi_points').eq('camera_index', camera_index).limit(1).execute()
        if response.data and len(response.data) > 0:
            return response.data[0].get('roi_points')
    except Exception as e:
        print(f"⚠️ Gagal mengambil konfigurasi ROI: {e}")
        
    return None
