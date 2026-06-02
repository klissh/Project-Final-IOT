import pygame
import threading
import os
from pathlib import Path

# Inisialisasi pygame mixer secara global
try:
    pygame.mixer.init()
    AUDIO_AVAILABLE = True
    print("🎵 Audio Player (Laptop) berhasil diinisialisasi!")
except Exception as e:
    AUDIO_AVAILABLE = False
    print(f"⚠️ Peringatan: Gagal inisialisasi Audio Player: {e}")

def play_voice_async(violation_type):
    """
    Fungsi internal untuk memutar suara di background thread
    agar tidak memblokir stream kamera.
    """
    if not AUDIO_AVAILABLE:
        return

    # Petakan jenis pelanggaran ke nama file MP3
    filename = "0004.mp3" # Default ke left_post
    if violation_type == "no_mask":
        filename = "0001.mp3"
    elif violation_type == "no_hairnet":
        filename = "0002.mp3"
    elif violation_type == "no_both":
        filename = "0003.mp3"

    # Cari file mp3 di folder backend/mp3
    current_dir = Path(__file__).parent.parent
    mp3_path = current_dir / "mp3" / filename

    if not mp3_path.exists():
        print(f"⚠️ Peringatan: File suara {mp3_path} tidak ditemukan!")
        return

    try:
        # Jika ada suara lain yang sedang diputar, hentikan dulu
        if pygame.mixer.music.get_busy():
            pygame.mixer.music.stop()

        pygame.mixer.music.load(str(mp3_path))
        pygame.mixer.music.play()
        print(f"🔊 Memutar peringatan suara (Laptop): {filename} untuk {violation_type}")
    except Exception as e:
        print(f"❌ Gagal memutar suara: {e}")

def play_voice(violation_type):
    """
    Memicu pemutaran MP3 secara asynchronous (non-blocking).
    Panggil fungsi ini bersamaan dengan trigger buzzer.
    """
    thread = threading.Thread(target=play_voice_async, args=(violation_type,))
    thread.daemon = True
    thread.start()

if __name__ == "__main__":
    # Test script
    import time
    print("Mengetes audio player...")
    play_voice("no_mask")
    time.sleep(3) # Tunggu agar suara selesai diputar sebelum exit
