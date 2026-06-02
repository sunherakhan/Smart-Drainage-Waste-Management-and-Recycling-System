/**
 * AURA-DRAIN: ESP32 & ESP8266 Smart Drainage Waste Management Firmware
 * Interfaces sensors, local outputs, sorting servo motors, and uploads real-time metrics
 * to the telemetry server over Wi-Fi.
 */

#if defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <ESP32Servo.h> // ESP32 specific servo library
#elif defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <Servo.h>
#else
  #error "Board not supported! Please select ESP32 or ESP8266 in Arduino IDE."
#endif

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ================= HARDWARE PIN CONFIGURATIONS =================
// Ultrasonic Sensor (HC-SR04)
#define PIN_TRIG         12
#define PIN_ECHO         14

// Infrared (IR) Bin Full Sensor
#define PIN_IR_BIN       27

// Water Level Sensor (Analog Rain Probe)
#define PIN_RAIN_PROBE   34  // ADC Pin

// Actuators
#define PIN_SERVO_GATE   13
#define PIN_BUZZER       26
#define PIN_LED_RED      25
#define PIN_LED_GREEN    33

// I2C LCD Display (Address 0x27, 16 columns x 2 rows)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Servo instance
Servo sortingServo;

// ================= COGNITIVE CALIBRATION METRICS =================
const char* ssid     = "AuraDrain-WiFi-SSID";
const char* password = "AuraDrainSecurePassword101";

// Address of the local Cloud Telemetry Endpoint or ThingSpeak API
// (Change to your Flask server computer's IP address when deploying)
const char* server_url = "http://192.168.1.100:5000/api/telemetry";

// Simulation or physical parameters
const float PIPE_TOTAL_DEPTH_CM = 30.0; // Distance from HC-SR04 sensor to pipe bottom
unsigned long last_upload_time = 0;
const unsigned long upload_interval_ms = 3000; // push updates every 3 seconds

// Local state tracking variables
int water_level_percent = 0;
float flow_velocity_ms = 0.0;
int waste_load_percent = 0;
bool buzzer_active = false;
bool silt_detected = false;
int current_gate_angle = 90; // Default center (Neutral)

// ================= SYSTEM SETUP =================
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n[SETUP] Initializing Aura-Drain IoT Node Firmware...");

    // 1. Initialize Sensor Pins
    pinMode(PIN_TRIG, OUTPUT);
    pinMode(PIN_ECHO, INPUT);
    pinMode(PIN_IR_BIN, INPUT);
    pinMode(PIN_RAIN_PROBE, INPUT);

    // 2. Initialize Output Pins
    pinMode(PIN_BUZZER, OUTPUT);
    pinMode(PIN_LED_RED, OUTPUT);
    pinMode(PIN_LED_GREEN, OUTPUT);

    digitalWrite(PIN_BUZZER, LOW);
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_LED_GREEN, LOW);

    // 3. Initialize Servo Gate
    #if defined(ESP32)
        ESP32PWM::allocateTimer(0);
        ESP32PWM::allocateTimer(1);
        sortingServo.setPeriodHertz(50);
    #endif
    sortingServo.attach(PIN_SERVO_GATE);
    sortingServo.write(90); // default neutral position
    Serial.println("[SETUP] Servo mechanism calibrated to Neutral (90 deg).");

    // 4. Initialize LCD Display
    Wire.begin();
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("AURA-DRAIN INIT");
    lcd.setCursor(0, 1);
    lcd.print("Connecting WiFi...");

    // 5. Connect to Wi-Fi
    connectToWiFi();
    
    lcd.clear();
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print("System Active");
    delay(1000);
}

// ================= MAIN LOOP SYSTEM =================
void loop() {
    // Check Wi-Fi state health and retry if dropped
    if (WiFi.status() != WL_CONNECTED) {
        connectToWiFi();
    }

    // 1. Read Sensors and process local calculations
    readWaterLevelSensor();
    readWasteBinSensor();
    readFlowProbe();
    
    // 2. Local State Logic Decisions
    processSafetyCriticalAlarms();

    // 3. Telemetry Upload (Non-blocking loop timer)
    unsigned long current_time = millis();
    if (current_time - last_upload_time >= upload_interval_ms) {
        last_upload_time = current_time;
        uploadTelemetryData();
    }

    // Small delay to maintain CPU stability
    delay(50);
}

// ================= COMMUNICATIONS: WIFI CONNECTION =================
void connectToWiFi() {
    Serial.print("[WIFI] Connecting to ");
    Serial.println(ssid);
    
    WiFi.begin(ssid, password);
    
    int attempt_counter = 0;
    while (WiFi.status() != WL_CONNECTED && attempt_counter < 15) {
        delay(800);
        Serial.print(".");
        digitalWrite(PIN_LED_RED, !digitalRead(PIN_LED_RED)); // Flash red LED during wait
        attempt_counter++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        digitalWrite(PIN_LED_RED, LOW);
        digitalWrite(PIN_LED_GREEN, HIGH); // Steady green shows healthy online status
        Serial.println("\n[WIFI] Wi-Fi connection successful!");
        Serial.print("[WIFI] Local IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\n[WIFI] Connection failed. Entering local autonomous mode...");
        // Flash red light slow representing local-only safe mode
        digitalWrite(PIN_LED_RED, HIGH);
        digitalWrite(PIN_LED_GREEN, LOW);
    }
}

// ================= HARDWARE: SENSORS ACQUISITIONS =================
void readWaterLevelSensor() {
    // Trigger HC-SR04 pulse
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(2);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);

    // Read echo duration (in microseconds)
    long duration = pulseIn(PIN_ECHO, HIGH, 30000); // 30ms timeout
    
    if (duration == 0) {
        Serial.println("[SENSOR WARNING] HC-SR04 Ultrasonic read error (out of bounds).");
        return;
    }

    // Distance calculation (speed of sound = 0.0343 cm/us)
    float distance_cm = duration * 0.0343 / 2.0;

    // Convert raw distance into drainage water percentage level
    // Lesser distance between sensor and surface indicates HIGHER water accumulation
    float level_cm = PIPE_TOTAL_DEPTH_CM - distance_cm;
    if (level_cm < 0) level_cm = 0;
    
    water_level_percent = (level_cm / PIPE_TOTAL_DEPTH_CM) * 100.0;
    water_level_percent = constrain(water_level_percent, 0, 100);

    Serial.print("[SENSOR] HC-SR04 Water Distance: ");
    Serial.print(distance_cm);
    Serial.print(" cm | Depth Level: ");
    Serial.print(water_level_percent);
    Serial.println("%");
}

void readWasteBinSensor() {
    // IR barrier sensor outputs LOW when blockages or waste triggers the ray path
    int val = digitalRead(PIN_IR_BIN);
    
    if (val == LOW) {
        // Garbage detected blocks the filter bin!
        waste_load_percent = 90; // mock full status
        silt_detected = true;
    } else {
        waste_load_percent = 18; // nominal load
        silt_detected = false;
    }

    Serial.print("[SENSOR] Waste Bin Load: ");
    Serial.print(waste_load_percent);
    Serial.println("%");
}

void readFlowProbe() {
    // Reading analog rain/water level probe to estimate velocity
    // Higher analog reading indicates deeper immersion inside running currents
    int val = analogRead(PIN_RAIN_PROBE);
    
    // Scale ADC range 0-4095 into mock flow speed (0.0 to 4.5 m/s)
    flow_velocity_ms = (val / 4095.0) * 4.5;
    
    // If pipe is dry, force flow rate to 0.1
    if (water_level_percent < 5) {
        flow_velocity_ms = 0.1;
    }

    Serial.print("[SENSOR] Current Flow Velocity: ");
    Serial.print(flow_velocity_ms);
    Serial.println(" m/s");
}

// ================= HARDWARE: SAFETY ALARMS LOGIC =================
void processSafetyCriticalAlarms() {
    // 1. Water Level Overflows
    if (water_level_percent > 80) {
        buzzer_active = true;
        // Trigger localized urgent buzzer sequence
        tone(PIN_BUZZER, 2000, 200); 
        digitalWrite(PIN_LED_RED, HIGH); // solid warning red
        
        lcd.clear();
        lcd.print("!! OVERFLOW RISK !!");
        lcd.setCursor(0, 1);
        lcd.print("Water: ");
        lcd.print(water_level_percent);
        lcd.print("% - Alert!");
    } 
    // 2. Waste Bin Blockages
    else if (waste_load_percent > 80) {
        buzzer_active = true;
        tone(PIN_BUZZER, 1000, 500); // lower freq warning
        digitalWrite(PIN_LED_RED, !digitalRead(PIN_LED_RED)); // blinking red
        
        lcd.clear();
        lcd.print("FILTER BLOCKAGE");
        lcd.setCursor(0, 1);
        lcd.print("Bin Cap: ");
        lcd.print(waste_load_percent);
        lcd.print("%");
    } 
    // 3. Normal State
    else {
        buzzer_active = false;
        noTone(PIN_BUZZER);
        digitalWrite(PIN_LED_RED, LOW);
        digitalWrite(PIN_LED_GREEN, HIGH);
        
        // Print telemetry to local LCD screen
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("H2O:");
        lcd.print(water_level_percent);
        lcd.print("% Flow:");
        lcd.print(flow_velocity_ms, 1);
        
        lcd.setCursor(0, 1);
        lcd.print("Bin:");
        lcd.print(waste_load_percent);
        lcd.print("% Gte:");
        lcd.print(current_gate_angle);
    }
}

// ================= COMMUNICATIONS: UPLOAD TELEMETRY DATA =================
void uploadTelemetryData() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[TELEMETRY WARNING] Skip push: Wi-Fi offline.");
        return;
    }

    HTTPClient http;
    http.begin(server_url);
    http.addHeader("Content-Type", "application/json");

    // Construct telemetry payload JSON string
    String payload = "{";
    payload += "\"node_id\":\"ESP32-DRAIN-N01\",";
    payload += "\"water_level_pct\":" + String(water_level_percent) + ",";
    payload += "\"flow_velocity_ms\":" + String(flow_velocity_ms, 2) + ",";
    payload += "\"waste_load_pct\":" + String(waste_load_percent) + ",";
    payload += "\"battery_pct\":92.5,"; // simulated solar values
    payload += "\"solar_volts\":4.85,";
    payload += "\"gate_angle\":" + String(current_gate_angle) + ",";
    payload += "\"buzzer_active\":" + String(buzzer_active ? "true" : "false") + ",";
    payload += "\"silt_detected\":" + String(silt_detected ? "true" : "false");
    payload += "}";

    Serial.print("[TELEMETRY] POST Payload: ");
    Serial.println(payload);

    int http_response_code = http.POST(payload);

    if (http_response_code > 0) {
        String response = http.getString();
        Serial.print("[TELEMETRY SUCCESS] HTTP Code: ");
        Serial.println(http_response_code);
        Serial.print("[TELEMETRY SUCCESS] Response: ");
        Serial.println(response);
        
        // Dynamic server interaction: check for return actions
        // In a real program, we would parse response rules JSON using ArduinoJson library.
        // E.g., if response tells us to pivot servo gates:
        // if(response.indexOf("ROUTE_RECYCLABLE") > 0) {
        //     sortingServo.write(30); // Rotate gate left (30 degrees)
        //     current_gate_angle = 30;
        // }
    } else {
        Serial.print("[TELEMETRY ERROR] POST failed, HTTP Code: ");
        Serial.println(http_response_code);
    }

    http.end();
}
