/*
 * Smart Kitchen Hygiene - ESP32 MQTT Buzzer Client
 * =================================================
 * 
 * Firmware ESP32 untuk menerima trigger buzzer via MQTT (Cloud)
 * maupun via kabel Serial (Lokal).
 * 
 * Hardware:
 *   - ESP32 Development Board
 *   - Active Buzzer pada pin GPIO 25
 * 
 * Library yang dibutuhkan:
 *   - PubSubClient by Nick O'Leary
 *   - WiFi (built-in)
 */

#include <WiFi.h>
#include <PubSubClient.h>

// ============================================================
// KONFIGURASI
// ============================================================

// WiFi
const char* WIFI_SSID = "cuklis";
const char* WIFI_PASS = "cuklis123";

// MQTT Broker
const char* MQTT_BROKER = "broker.hivemq.com";
const int   MQTT_PORT   = 1883;
const char* MQTT_TOPIC  = "smartkitchen/buzzer";
const char* MQTT_CLIENT_ID = "esp32_kitchen_buzzer";

// Hardware Pins
const int BUZZER_PIN = 25;
const int LED_PIN    = 2;   // Built-in LED ESP32

// Buzzer Settings
const int BUZZ_DURATION_MS = 3000;  // 3 detik buzzer nyala

// ============================================================
// GLOBAL OBJECTS
// ============================================================
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

unsigned long lastReconnectAttempt = 0;
unsigned long buzzerOffTime = 0;
bool buzzerActive = false;

// ============================================================
// FUNCTIONS
// ============================================================

void setupWiFi() {
  Serial.println("\n🔗 Menghubungkan ke WiFi...");
  Serial.print("   SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Terhubung!");
    Serial.print("   IP Address: ");
    Serial.println(WiFi.localIP());
    
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(200);
      digitalWrite(LED_PIN, LOW);
      delay(200);
    }
  } else {
    Serial.println("\n❌ Gagal terhubung ke WiFi! Restart...");
    delay(5000);
    ESP.restart();
  }
}

void triggerBuzzer() {
  Serial.println("🔊 BUZZER AKTIF!");
  
  digitalWrite(BUZZER_PIN, HIGH);
  digitalWrite(LED_PIN, HIGH);
  
  buzzerActive = true;
  buzzerOffTime = millis() + BUZZ_DURATION_MS;
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("📩 Pesan MQTT diterima: ");
  Serial.println(message);

  if (message.startsWith("BUZZ")) {
    triggerBuzzer();
  }
}

bool reconnectMQTT() {
  Serial.print("📡 Menghubungkan ke MQTT broker: ");
  Serial.println(MQTT_BROKER);

  if (mqttClient.connect(MQTT_CLIENT_ID)) {
    Serial.println("✅ MQTT Terhubung!");
    mqttClient.subscribe(MQTT_TOPIC);
    
    for (int i = 0; i < 2; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
      digitalWrite(LED_PIN, LOW);
      delay(100);
    }
    return true;
  } else {
    Serial.print("❌ MQTT gagal connect, rc=");
    Serial.println(mqttClient.state());
    return false;
  }
}

// ============================================================
// SETUP & LOOP
// ============================================================

void setup() {
  Serial.begin(115200);
  delay(100);

  Serial.println("===========================================");
  Serial.println("🍳 Smart Kitchen - ESP32 AI Buzzer");
  Serial.println("===========================================");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  setupWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  reconnectMQTT();
  
  Serial.println("\n🚀 ESP32 siap menerima perintah Serial (Lokal) maupun MQTT (Cloud)!");
}

void loop() {
  // 1. Baca Perintah dari Kabel Serial (Mode Lokal Python)
  if (Serial.available()) {
    String msg = Serial.readStringUntil('\n');
    msg.trim();
    if (msg.length() > 0) {
      triggerBuzzer();
    }
  }

  // 2. Jaga koneksi MQTT & WiFi
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  } else {
    if (!mqttClient.connected()) {
      unsigned long now = millis();
      if (now - lastReconnectAttempt > 5000) {
        lastReconnectAttempt = now;
        reconnectMQTT();
      }
    } else {
      mqttClient.loop();
    }
  }

  // 3. Matikan buzzer jika timeout
  if (buzzerActive && millis() >= buzzerOffTime) {
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
    buzzerActive = false;
    Serial.println("🔇 Buzzer mati (3s timeout).");
  }
}
