import os
import requests
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
TELEGRAM_CHAT_IDS = os.getenv("TELEGRAM_CHAT_IDS", "").split(",")

from datetime import datetime

def send_alert(violation_type: str, confidence: float, image_url: str = None):
    """
    Mengirim pesan peringatan pelanggaran ke Telegram.
    Jika image_url diberikan, akan mengirimkan foto (via URL) beserta caption.
    Jika tidak, hanya mengirimkan pesan teks.
    """
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_IDS or TELEGRAM_CHAT_IDS == [""]:
        print("[!] Telegram Token atau Chat ID belum disetel di .env")
        return

    # Pemformatan jenis pelanggaran agar mudah dibaca
    violation_name = violation_type
    if violation_type == "no_both":
        violation_name = "Tanpa Masker & Hairnet"
    elif violation_type == "no_mask":
        violation_name = "Tanpa Masker"
    elif violation_type == "no_hairnet":
        violation_name = "Tanpa Hairnet"
    elif violation_type == "left_post":
        violation_name = "Meninggalkan Pos"

    now = datetime.now().strftime("%d %B %Y, %H:%M:%S")

    if violation_type == "left_post":
        caption = (
            "⚠️ <b>PERINGATAN ABSENSI</b> ⚠️\n\n"
            "Area Pos Kerja (ROI) yang ditentukan terdeteksi kosong selama lebih dari 5 detik.\n\n"
            "📋 <b>RINCIAN</b>\n"
            f"▪️ <b>Waktu    :</b> {now}\n"
            f"▪️ <b>Status   :</b> <code>{violation_name}</code>\n\n"
            "🔊 <i>Sistem IoT Buzzer memutar alarm peringatan Pos Kosong.</i>\n\n"
            "👨‍💻 Silakan periksa <b>Dashboard Logs</b> untuk meninjau status penuh."
        )
    else:
        caption = (
            "🚨 <b>SMART KITCHEN ALERT</b> 🚨\n\n"
            "Terdeteksi pekerja yang melanggar standar kebersihan (SOP) di area dapur.\n\n"
            "📋 <b>RINCIAN PELANGGARAN</b>\n"
            f"▪️ <b>Waktu    :</b> {now}\n"
            f"▪️ <b>Jenis    :</b> <code>{violation_name}</code>\n"
            f"▪️ <b>Akurasi  :</b> <code>{(confidence * 100):.1f}%</code>\n\n"
            "🔊 <i>Sistem IoT Buzzer otomatis memberikan teguran fisik di lokasi kejadian.</i>\n\n"
            "👨‍💻 Silakan periksa <b>Dashboard Logs</b> untuk meninjau status dan melihat riwayat secara penuh."
        )

    # Kirim ke setiap Chat ID yang terdaftar (jika > 1)
    for chat_id in TELEGRAM_CHAT_IDS:
        chat_id = chat_id.strip()
        if not chat_id:
            continue
            
        try:
            if image_url:
                # Mengirim Foto (dengan caption)
                url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
                payload = {
                    "chat_id": chat_id,
                    "photo": image_url,
                    "caption": caption,
                    "parse_mode": "HTML"
                }
            else:
                # Mengirim Teks saja
                url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": caption,
                    "parse_mode": "HTML"
                }

            response = requests.post(url, json=payload)
            if response.status_code != 200:
                print(f"[X] Gagal mengirim Telegram ke {chat_id}: {response.text}")
            else:
                print(f"[OK] Notifikasi Telegram terkirim ke {chat_id}")
                
        except Exception as e:
            print(f"[X] Error saat mengirim Telegram: {e}")

if __name__ == "__main__":
    # Test script sederhana
    print("Mencoba mengirim pesan test ke Telegram...")
    send_alert("no_both", 0.95, "https://picsum.photos/400/300")
