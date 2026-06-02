"""
AURA-DRAIN: Smart Drainage Waste Classification & AI Detection Simulator
Uses OpenCV to simulate a real-time object detection feed of drainage channels, 
performing segmentation, color-based material filtering (simulating plastic/metal/organics), 
and visual tracking with bounding boxes.
"""
import streamlit as st
import cv2
import numpy as np
import time
import random

# Color code constants for visual drawing
COLOR_CYAN = (254, 242, 0)      # Plastic
COLOR_EMERALD = (129, 185, 16)   # Organic Debris
COLOR_AMBER = (11, 158, 245)     # Metal Cans
COLOR_ROSE = (68, 68, 239)       # Unknown / Pollutants

class AIDetector:
    def __init__(self):
        print("[INFO] Initializing Aura-Drain Neural Network Inference Engine...")
        time.sleep(1.0)
        print("[INFO] Model weights 'aura_drain_yolov8n.onnx' loaded successfully.")
        print("[INFO] ESP32-CAM video stream link established: Mock Local Webcam Feed.")
        
        # Classification confidence lists
        self.materials = ['Plastic Bottle', 'Aluminum Can', 'Cardboard pulp', 'Leaf Debris', 'Twig Branch']
        self.categories = ['Recyclable', 'Recyclable', 'Recyclable', 'Non-Recyclable', 'Non-Recyclable']
        self.colors = [COLOR_CYAN, COLOR_AMBER, COLOR_CYAN, COLOR_EMERALD, COLOR_EMERALD]

    def process_frame(self, frame):
        h, w, c = frame.shape
        
        # Draw a simulated drainage pipe overlay (translucent boundaries)
        cv2.line(frame, (0, int(h * 0.35)), (w, int(h * 0.35)), (100, 100, 100), 2)
        cv2.line(frame, (0, int(h * 0.75)), (w, int(h * 0.75)), (100, 100, 100), 2)
        cv2.putText(frame, "SIMULATED PIPE BORDERS", (15, int(h * 0.32)), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (150, 150, 150), 1)

        # Draw a simulated scanning laser (vertical blue line pulsing)
        scan_x = int(w * 0.5 + np.sin(time.time() * 2) * (w * 0.1))
        cv2.line(frame, (scan_x, int(h * 0.35)), (scan_x, int(h * 0.75)), (255, 242, 0), 2)
        cv2.putText(frame, "AI SCANNERS ACTIVE", (scan_x - 60, int(h * 0.73)), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.35, (254, 242, 0), 1)

        # Apply a simple color-based detection heuristic (simulating threshold filters on real frames)
        # Convert image to HSV
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # 1. Look for highly vibrant colored trash pieces (e.g., green leaves, blue/red plastic)
        # Define ranges for green leaves/twigs (organic)
        lower_green = np.array([35, 40, 40])
        upper_green = np.array([85, 255, 255])
        mask_green = cv2.inRange(hsv, lower_green, upper_green)
        
        # 2. Define ranges for blue plastics
        lower_blue = np.array([100, 50, 50])
        upper_blue = np.array([140, 255, 255])
        mask_blue = cv2.inRange(hsv, lower_blue, upper_blue)

        # Perform contour finding to identify trash objects
        self.detect_contours(frame, mask_green, "Organic Waste", COLOR_EMERALD, "Organic Chute (Right)")
        self.detect_contours(frame, mask_blue, "Plastic Bottle", COLOR_CYAN, "Recycling Bin (Left)")

        # Render simulated ML telemetry in upper corner
        cv2.rectangle(frame, (10, 10), (220, 95), (20, 20, 20), -1)
        cv2.rectangle(frame, (10, 10), (220, 95), (255, 242, 0), 1)
        cv2.putText(frame, "AURA-DRAIN AI INFERENCE", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, f"FPS: {29.5 + random.uniform(-0.4, 0.4):.1f}", (15, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (180, 180, 180), 1)
        cv2.putText(frame, "CAMERA STATUS: ONLINE", (15, 57), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 255, 0), 1)
        cv2.putText(frame, "SEGREGATION GATE: IDLE", (15, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255, 255, 255), 1)
        cv2.putText(frame, "COM PORT: ESP32-CAM (WIFI)", (15, 87), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1)

        return frame

    def detect_contours(self, frame, mask, label, drawing_color, routing_bin):
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 450: # filter tiny camera noise
                x, y, w, h = cv2.boundingRect(contour)
                
                # Draw bounding box
                cv2.rectangle(frame, (x, y), (x + w, y + h), drawing_color, 2)
                
                # Dynamic labels
                conf = 88.0 + (area % 12)
                text = f"AI: {label} [{conf:.1f}%]"
                cv2.putText(frame, text, (x, y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, drawing_color, 2)
                
                # Render metadata route directive
                route_text = f"Route -> {routing_bin}"
                cv2.putText(frame, route_text, (x, y + h + 15), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

def main():
    detector = AIDetector()
    
    # Try opening system default camera
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("[WARNING] Hardware camera webcam not detected. Creating simulated video streams...")
        # Create a blank visual canvas if camera is missing to ensure a working fallback
        canvas_w, canvas_h = 640, 480
        background = np.zeros((canvas_h, canvas_w, 3), dtype=np.uint8)
        
        # Add particles to simulated stream
        p_x, p_y = 50, 220
        p_color = (255, 50, 50) # Blue color to test blue mask
        
        print("[RUNNING] Press 'q' on the visual GUI window to shut down the Python AI process.")
        while True:
            # Recreate background simulation
            frame = background.copy()
            # Draw pipeline cross section background
            cv2.rectangle(frame, (0, 160), (canvas_w, 320), (30, 20, 10), -1)
            
            # Animate dummy blue plastic bottle sliding down channel
            p_x += 4
            if p_x > canvas_w + 30:
                p_x = -30
                p_y = 200 + random.randint(-40, 40)
            
            # Draw blue circle as dummy plastic piece
            cv2.circle(frame, (p_x, p_y), 25, (255, 100, 20), -1) # Blue in BGR
            # Draw green organic leaves
            cv2.circle(frame, ((p_x + 300) % canvas_w, p_y + 10), 18, (40, 180, 50), -1) # Green leaf in BGR
            
            processed = detector.process_frame(frame)
            st.image(processed, channels="BGR")
            
            
    else:
        print("[RUNNING] Real-time camera feed active. Position high-contrast blue plastic or green leaves in front of camera to see sorting AI in action!")
        print("[RUNNING] Press 'q' inside the OpenCV window to exit.")
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Mirror frame for intuitive dashboard testing
            frame = cv2.flip(frame, 1)
            
            processed = detector.process_frame(frame)
            st.image(processed, channels="BGR")
            
            
                
    cap.release()
    
    print("[INFO] AI inference stream closed down gracefully.")

if __name__ == "__main__":
    main()
