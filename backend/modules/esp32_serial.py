import os
import serial
import time
from dotenv import load_dotenv
from pathlib import Path

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

COM_PORT = os.getenv("ESP32_COM_PORT", "COM3")
BAUD_RATE = int(os.getenv("BAUD_RATE", "115200"))

# Global serial instance
ser = None

def init_serial():
    global ser
    try:
        if ser is None or not ser.is_open:
            ser = serial.Serial(port=COM_PORT, baudrate=BAUD_RATE, timeout=1)
            # Beri jeda agar koneksi serial ESP32 stabil
            time.sleep(2)
            print(f"🔌 Serial terhubung ke ESP32 di port {COM_PORT}")
    except Exception as e:
        print(f"⚠️ Gagal menghubungkan serial ke {COM_PORT}: {e}")
        print("   Pastikan ESP32 terhubung dan port tidak sedang digunakan aplikasi lain (misal Arduino IDE).")
        ser = None

def trigger_buzzer():
    """
    Mengirimkan sinyal ke ESP32 untuk menyalakan buzzer sementara.
    Sinyal yang dikirim adalah karakter '1' (atau disesuaikan dengan kode C++ ESP32 nanti).
    """
    global ser
    
    if ser is None or not ser.is_open:
        init_serial()
        
    if ser and ser.is_open:
        try:
            # Mengirim karakter "1" (sebagai string)
            # Di ESP32 C++ nanti (Serial.read() == '1') -> nyalakan buzzer selama beberapa detik
            ser.write(b"1\n")
            print("🔊 Sinyal Buzzer dikirim ke ESP32!")
        except Exception as e:
            print(f"❌ Error saat mengirim ke Serial: {e}")
            ser = None # Reset koneksi jika error
    else:
        print("⚠️ Bypass pengiriman ke Buzzer (ESP32 tidak terdeteksi).")

if __name__ == "__main__":
    # Test script sederhana
    print("Mencoba inisialisasi dan memicu ESP32...")
    init_serial()
    trigger_buzzer()
