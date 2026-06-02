"""
AURA-DRAIN: Smart Drainage Flask IoT cloud Telemetry Server
Acts as a mock cloud endpoint (ThingSpeak/Firebase alternative) receiving live telemetry from ESP32 nodes
over HTTP. It prints live logs, validates sensor inputs, and responds with system states.
"""

from flask import Flask, request, jsonify
import datetime
import time
import os

app = Flask(__name__)

# Core global state representing telemetry data received from hardware nodes
latest_telemetry = {
    "node_id": "ESP32-DRAIN-N01",
    "timestamp": None,
    "water_level_pct": 24.5,
    "flow_velocity_ms": 1.2,
    "waste_load_pct": 12.0,
    "battery_pct": 94.0,
    "solar_volts": 4.8,
    "gate_angle": 90,
    "buzzer_active": False,
    "silt_detected": False
}

# Keep a short record of past entries
telemetry_history = []

def clear_screen():
    # Helper to refresh console screen beautifully
    os.system('cls' if os.name == 'nt' else 'clear')

def render_ascii_dashboard():
    clear_screen()
    print("=" * 65)
    print("      AURA-DRAIN : MOCK CLOUD IoT TELEMETRY DASHBOARD SERVER")
    print("=" * 65)
    print(f" Server Time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f" Target Port: http://127.0.0.1:5000/api/telemetry")
    print("-" * 65)
    
    if latest_telemetry["timestamp"] is None:
        print("\n [WAITING] Listening for incoming NodeMCU/ESP32 data nodes...")
        print(" (Run the main dashboard or hardware client to push metrics here)\n")
    else:
        print(f" [NODE CONNECTED] Node ID: {latest_telemetry['node_id']}")
        print(f" Last Telemetry Push: {latest_telemetry['timestamp']}")
        print("-" * 65)
        
        # Color codes matching status thresholds
        status = "NOMINAL"
        if latest_telemetry["water_level_pct"] > 80:
            status = "CRITICAL: FLOOD RISK"
        elif latest_telemetry["water_level_pct"] > 60 or latest_telemetry["waste_load_pct"] > 60:
            status = "WARNING: ACTION REQUIRED"
            
        print(f" System Status    : {status}")
        print(f" Water Level Depth: {latest_telemetry['water_level_pct']:.1f}%")
        print(f" Flow Velocity    : {latest_telemetry['flow_velocity_ms']:.2f} m/s")
        print(f" Waste Bin Load   : {latest_telemetry['waste_load_pct']:.1f}%")
        print(f" Battery Charge   : {latest_telemetry['battery_pct']:.1f}% (Solar In: {latest_telemetry['solar_volts']:.2f}V)")
        print(f" Servo Gate Angle : {latest_telemetry['gate_angle']} deg")
        print(f" Buzzer Alarm     : {'🚨 ON (SOUNDING)' if latest_telemetry['buzzer_active'] else '🔇 OFF'}")
        print(f" Silt/Debris State: {'⚠️ HIGH SEDIMENTATION' if latest_telemetry['silt_detected'] else '✅ CLEAR'}")
    
    print("-" * 65)
    print(" Recent Activity Logs:")
    if not telemetry_history:
        print("  - No connection logs yet.")
    else:
        for idx, entry in enumerate(telemetry_history[:5]):
            print(f"  [{entry['time']}] Pushed Node data: H2O={entry['water']:.1f}%, Flow={entry['flow']:.1f}m/s, Bin={entry['waste']:.1f}%")
            
    print("=" * 65)
    print(" Press Ctrl+C inside this terminal window to shut down server.")

@app.route('/api/telemetry', methods=['POST'])
def receive_telemetry():
    global latest_telemetry
    data = request.json
    
    if not data:
        return jsonify({"status": "error", "message": "Invalid or missing JSON payload"}), 400
    
    # Map ESP32 payload keys to local state
    now_str = datetime.datetime.now().strftime('%H:%M:%S')
    
    latest_telemetry = {
        "node_id": data.get("node_id", "ESP32-NODE"),
        "timestamp": now_str,
        "water_level_pct": float(data.get("water_level_pct", 0.0)),
        "flow_velocity_ms": float(data.get("flow_velocity_ms", 0.0)),
        "waste_load_pct": float(data.get("waste_load_pct", 0.0)),
        "battery_pct": float(data.get("battery_pct", 100.0)),
        "solar_volts": float(data.get("solar_volts", 0.0)),
        "gate_angle": int(data.get("gate_angle", 90)),
        "buzzer_active": bool(data.get("buzzer_active", False)),
        "silt_detected": bool(data.get("silt_detected", False))
    }
    
    # Store history
    telemetry_history.insert(0, {
        "time": now_str,
        "water": latest_telemetry["water_level_pct"],
        "flow": latest_telemetry["flow_velocity_ms"],
        "waste": latest_telemetry["waste_load_pct"]
    })
    
    # Trigger active console repaint
    render_ascii_dashboard()
    
    # Return response payload outlining cloud rules (e.g. telling ESP32 to open/close gates or sound buzzer)
    response_rules = {
        "status": "success",
        "timestamp": now_str,
        "server_action": "NO_OVERRIDE",
        "gate_override_angle": -1, # -1 indicates follow local AI sensors
        "update_interval_ms": 3000
    }
    
    # If server rules detect overflow, return alarm flags to ESP32
    if latest_telemetry["water_level_pct"] > 80:
        response_rules["server_action"] = "FORCE_BUZZER_ON"
        
    return jsonify(response_rules), 200

@app.route('/api/telemetry', methods=['GET'])
def get_telemetry():
    # Endpoint to allow web interface dashboard to poll latest node states directly from Flask!
    return jsonify(latest_telemetry), 200

if __name__ == '__main__':
    # Initial print of blank dashboard
    render_ascii_dashboard()
    # Launch on port 5000
    app.run(host='0.0.0.0', port=5000, debug=False)
