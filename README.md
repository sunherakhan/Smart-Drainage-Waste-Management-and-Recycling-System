# AURA-DRAIN | Smart Drainage Waste Management & Recycling System

An intelligent, cloud-connected, and AI-driven urban sanitation OS designed to automatically monitor drainage conditions, detect and classify incoming trash, prevent localized flooding, and automate waste segregation and recycling.

---

## 🌟 System Architecture Overview

Aura-Drain utilizes a multi-layered IoT and AI architecture to secure urban drainage lines:
1. **Hardware Edge Sensing**: ESP32 or ESP8266 node connected to HC-SR04 ultrasonic sensors (measuring water capacity), analog rain probes (tracking velocity), and infrared barrier sensors (verifying filtration bin loads).
2. **Servo Motor Segregation Gates**: Multi-gate sorting mechanisms powered by heavy-duty servo motors. Automatically redirects items detected as recyclable (plastics, tin cans) to recycling silos, and non-recyclables (organic leaves, silt sediment) to localized composting channels.
3. **AI Vision Classification (OpenCV / ML)**: Frame captures processed via color-segmentation, scale analysis, or YOLO-based neural networks to identify and track garbage items drifting down the drainage channel in real-time.
4. **Interactive Telemetry Dashboard**: A high-fidelity, premium glassmorphism dark-mode UI with live SVG physics visualizers, automated rolling Chart.js graphics, interactive weather presets (Clear vs torrential storm chasers), and manual control boards.
5. **Flask IoT Telemetry Server**: Python REST API receiving node updates, updating terminal dashboards, and feedback routines.

---

## 🛠️ Hardware Pinout Connection Diagram

Deploying the physical system requires interfacing components to the ESP32 or NodeMCU according to the pinout matrix below:

| Component Component | Sub-Component Name | ESP32 Pin Assignment | ESP8266 Pin Assignment | VCC Power Input | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ultrasonic Sensor** | HC-SR04 TRIG | `GPIO 12` | `D6 (GPIO 12)` | 5V | Sensor pulse emitter trigger. |
| **Ultrasonic Sensor** | HC-SR04 ECHO | `GPIO 14` | `D5 (GPIO 14)` | 5V | Captures sound reflections bounce duration. |
| **IR Barrier Sensor** | Sensor Pin | `GPIO 27` | `D4 (GPIO 2)` | 5V / 3.3V | Detects if waste bin has reached limit capacity. |
| **Flow Probe** | Analog input | `GPIO 34 (ADC1)`| `A0 (Analog)` | 3.3V | Measures drainage water pressure velocity. |
| **Servo Motor** | Signal Gate PWM | `GPIO 13` | `D7 (GPIO 13)` | 5V (External) | Drives sorting mechanism partition. |
| **I2C LCD Display** | SDA Pin | `GPIO 21` | `D2 (GPIO 4)` | 5V | Data line for 16x2 characters status. |
| **I2C LCD Display** | SCL Pin | `GPIO 22` | `D1 (GPIO 5)` | 5V | Clock line for 16x2 characters status. |
| **Active Buzzer** | Audio Alert Pin | `GPIO 26` | `D8 (GPIO 15)` | 3.3V | Local alarm sounds during critical overflows. |
| **Warning Red LED** | Alarm Indicator | `GPIO 25` | `D3 (GPIO 0)` | 3.3V | Flashes during blockage or flood status. |
| **System Green LED** | Heartbeat Status | `GPIO 33` | `D0 (GPIO 16)` | 3.3V | Static green signals online healthy state. |

---

## 💻 Software Setup & Installation Guide

The project is structured logically across three modules:
```
├── firmware/
│   └── smart_drainage/
│       └── smart_drainage.ino  # ESP32/ESP8266 Arduino Source Code
├── python_backend/
│   ├── ai_detection.py         # OpenCV Object tracking & Color segments script
│   └── simulator.py            # Flask Cloud Telemetry API & ASCII console
├── index.html                  # HTML Web Dashboard Layout
├── style.css                   # Custom responsive Glassmorphism Styling
└── app.js                      # Core JS states simulator & Chart.js engine
```

### Module 1: The Interactive Web Dashboard (Local Launch)
The web interface features custom physics logic, fully working Chart.js analytics, and dynamic visual state triggers.
- Simply open the [index.html](file:///c:/Users/Khan/OneDrive/Desktop/csp%20project%20g10/index.html) file directly in any modern web browser.
- **No external servers are required** to view or interact with the dashboard, as it incorporates a **local sandboxed web simulator** mimicking physical hardware feedback loops.

---

### Module 2: Python AI Detection & Flask Server
Requires Python 3.8+ with dependent libraries installed.

1. **Install Dependencies**:
   Open a terminal terminal inside the directory `python_backend/` and execute:
   ```bash
   pip install opencv-python numpy flask
   ```

2. **Run the AI Waste Cam Classifier (`ai_detection.py`)**:
   ```bash
   python ai_detection.py
   ```
   * *Features*: Launches an OpenCV visual window. If a hardware webcam is present, it grabs frames and filters blue plastic bottles or green leaves using HSV segmentation. If no camera is present, it automatically initiates an animated digital pipeline simulation on canvas, outputting bounding boxes and classification tags. Press `q` to shut down.

3. **Run the Cloud Telemetry API Server (`simulator.py`)**:
   ```bash
   python simulator.py
   ```
   * *Features*: Boots a Flask server on `http://127.0.0.1:5000`. Outputs a beautifully formatted terminal ASCII dashboard. It updates automatically when the ESP32 posts telemetry, showing system health, water percentages, flow averages, and buzzer status. Press `Ctrl+C` to terminate.

---

### Module 3: Arduino Firmware Uploads (`smart_drainage.ino`)
1. **Open** [smart_drainage.ino](file:///c:/Users/Khan/OneDrive/Desktop/csp%20project%20g10/firmware/smart_drainage/smart_drainage.ino) inside the **Arduino IDE**.
2. **Library Configuration**:
   - Go to `Tools -> Manage Libraries...`
   - Search and install **LiquidCrystal_I2C** by Frank de Brabander.
   - For ESP32 users, install **ESP32Servo** by Kevin Sweet.
3. **Configure Wi-Fi credentials**:
   Modify lines 40-41 with your local network values:
   ```cpp
   const char* ssid     = "YOUR_SSID";
   const char* password = "YOUR_PASSWORD";
   ```
4. Configure target Flask server IP address:
   Update line 45 with your computer's local IP address (find by running `ipconfig` on Windows or `ifconfig` on Linux):
   ```cpp
   const char* server_url = "http://192.168.x.x:5000/api/telemetry";
   ```
5. Choose your board (`Tools -> Board -> ESP32 Dev Module` or `NodeMCU 1.0 (ESP-12E)`), map the COM port, and press **Upload**.

---

## 🕹️ Dashboard Interface Operations

When operating the web system:
- **Weather Preset Module**: Use the top right selector to toggle between clear day, light rain, or torrential storm. Selecting a storm causes water levels to mount, flow velocity to peak, and triggers alarms automatically.
- **Sliders & Custom Board**: Drag rainfall rate, silt levels, or waste generation parameters to customize environment factors.
- **AI Camera Vision Feed**: Animate falling trash items (bottles, tin cans, logs). When they enter the blue scanning laser, the simulated neural net identifies them, displays bounding classification confidence rates, and triggers the dynamic servo indicators to turn left or right.
- **Analytics Chart**: Rolling historical line charts graph flow rate vs level, while a doughnut chart details cumulative weights of segregated materials.
- **Sanitation maintenance**: Enter task inputs and worker names to append logs to local-storage-backed tables, with integrated Google Forms reports link.
