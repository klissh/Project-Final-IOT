import os
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

# Deploy mode
DEPLOY_MODE = os.getenv("DEPLOY_MODE", "local").lower()  # 'local' or 'cloud'

# Serial config (local mode)
COM_PORT = os.getenv("ESP32_COM_PORT", "COM3")
BAUD_RATE = int(os.getenv("BAUD_RATE", "115200"))

# MQTT config (cloud mode)
MQTT_BROKER = os.getenv("MQTT_BROKER", "broker.hivemq.com")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "smartkitchen/buzzer")

# Global instances
ser = None
mqtt_client = None


def init_serial():
    """Inisialisasi koneksi Serial ke ESP32 (mode lokal)."""
    global ser
    try:
        import serial
        if ser is None or not ser.is_open:
            ser = serial.Serial(port=COM_PORT, baudrate=BAUD_RATE, timeout=1)
            time.sleep(2)
            print(f"🔌 Serial terhubung ke ESP32 di port {COM_PORT}")
    except Exception as e:
        print(f"⚠️ Gagal menghubungkan serial ke {COM_PORT}: {e}")
        print("   Pastikan ESP32 terhubung dan port tidak sedang digunakan aplikasi lain (misal Arduino IDE).")
        ser = None


def init_mqtt():
    """Inisialisasi koneksi MQTT ke broker (mode cloud)."""
    global mqtt_client
    try:
        import paho.mqtt.client as mqtt

        def on_connect(client, userdata, flags, reason_code, properties=None):
            if reason_code == 0:
                print(f"📡 MQTT terhubung ke broker {MQTT_BROKER}:{MQTT_PORT}")
            else:
                print(f"⚠️ MQTT gagal connect, reason code: {reason_code}")

        def on_disconnect(client, userdata, flags, reason_code, properties=None):
            print(f"⚠️ MQTT terputus dari broker (reason: {reason_code})")

        mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        mqtt_client.on_connect = on_connect
        mqtt_client.on_disconnect = on_disconnect

        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        mqtt_client.loop_start()  # Background thread untuk maintain koneksi

    except Exception as e:
        print(f"⚠️ Gagal menghubungkan MQTT ke {MQTT_BROKER}:{MQTT_PORT}: {e}")
        mqtt_client = None


def init():
    """Inisialisasi modul sesuai deploy mode."""
    if DEPLOY_MODE == "cloud":
        print(f"☁️ Deploy Mode: CLOUD — menggunakan MQTT (broker: {MQTT_BROKER})")
        init_mqtt()
    else:
        print(f"🏠 Deploy Mode: LOCAL — menggunakan Serial (port: {COM_PORT})")
        init_serial()


# Alias untuk backward compatibility
init_serial_or_mqtt = init


def trigger_buzzer():
    """
    Mengirimkan sinyal ke ESP32 untuk menyalakan buzzer.
    Mode cloud: publish ke MQTT topic.
    Mode local: kirim via Serial.
    """
    if DEPLOY_MODE == "cloud":
        _trigger_mqtt()
    else:
        _trigger_serial()


def _trigger_serial():
    """Trigger buzzer via Serial (mode lokal)."""
    global ser
    try:
        import serial as serial_module
    except ImportError:
        print("⚠️ pyserial tidak terinstall. Bypass buzzer.")
        return

    if ser is None or not ser.is_open:
        init_serial()

    if ser and ser.is_open:
        try:
            ser.write(b"1\n")
            print("🔊 Sinyal Buzzer dikirim ke ESP32 via Serial!")
        except Exception as e:
            print(f"❌ Error saat mengirim ke Serial: {e}")
            ser = None
    else:
        print("⚠️ Bypass pengiriman ke Buzzer (ESP32 tidak terdeteksi via Serial).")


def _trigger_mqtt():
    """Trigger buzzer via MQTT (mode cloud)."""
    global mqtt_client

    if mqtt_client is None:
        init_mqtt()

    if mqtt_client:
        try:
            result = mqtt_client.publish(MQTT_TOPIC, payload="BUZZ", qos=1)
            if result.rc == 0:
                print(f"🔊 Sinyal Buzzer dikirim via MQTT ke topic '{MQTT_TOPIC}'!")
            else:
                print(f"⚠️ MQTT publish gagal, return code: {result.rc}")
        except Exception as e:
            print(f"❌ Error saat publish MQTT: {e}")
            mqtt_client = None
    else:
        print("⚠️ Bypass pengiriman ke Buzzer (MQTT client tidak terhubung).")


def cleanup():
    """Bersihkan koneksi saat shutdown."""
    global ser, mqtt_client
    if ser and ser.is_open:
        ser.close()
    if mqtt_client:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()


if __name__ == "__main__":
    # Test script
    print(f"Mode: {DEPLOY_MODE}")
    init()
    print("Mencoba memicu buzzer...")
    trigger_buzzer()
    time.sleep(2)
    cleanup()
