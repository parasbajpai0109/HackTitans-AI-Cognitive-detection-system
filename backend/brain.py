import cv2
import numpy as np
import time
from flask import Flask, jsonify
from flask_cors import CORS
import threading
import math

app = Flask(__name__)
CORS(app)

# ─── Global State ──────────────────────────────────
state = {
    "blink_rate": 15,
    "stress_score": 25,
    "reaction_time": 250,
    "focus_score": 80,
    "gaze_stability": 85,
    "hrv": 62,
    "risk_score": 15,
    "alert_level": "NORMAL",
    "running": True
}

blink_times = []
last_eye_open = True
gaze_history = []
no_eye_frames = 0
hrv_base = 62
hrv_time = 0

# ─── Risk Score ────────────────────────────────────
def calc_risk(blink, stress, reaction):
    b = min((blink / 30) * 100, 100) * 0.35
    s = stress * 0.35
    r = min((reaction / 600) * 100, 100) * 0.30
    return min(int(b + s + r), 100)

# ─── Realistic HRV Simulation ──────────────────────
def get_realistic_hrv():
    global hrv_base, hrv_time
    hrv_time += 0.1
    # Simulate real HRV pattern - slow sine wave with small noise
    slow_wave = math.sin(hrv_time * 0.3) * 4
    fast_wave = math.sin(hrv_time * 1.2) * 2
    noise = (np.random.random() - 0.5) * 2
    hrv = hrv_base + slow_wave + fast_wave + noise
    # HRV drops when stress is high
    stress_penalty = (state["stress_score"] - 30) * 0.1
    hrv = hrv - stress_penalty
    return max(28, min(85, round(hrv, 1)))

# ─── Camera Loop ───────────────────────────────────
def camera_loop():
    global blink_times, last_eye_open, gaze_history, no_eye_frames

    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    eye_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_eye.xml'
    )

    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    print("✅ CogniGuard AI Camera Started!")

    last_face_x = None
    last_face_y = None
    stress_history = []
    eye_area_history = []

    while state["running"]:
        ret, frame = cap.read()
        if not ret:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(
            gray, scaleFactor=1.1,
            minNeighbors=5, minSize=(80, 80)
        )

        if len(faces) > 0:
            fx, fy, fw, fh = faces[0]
            cx = fx + fw // 2
            cy = fy + fh // 2

            # ── GAZE TRACKING ────────────────────
            gaze_history.append((cx, cy))
            if len(gaze_history) > 30:
                gaze_history.pop(0)
            if len(gaze_history) > 5:
                xs = [g[0] for g in gaze_history]
                ys = [g[1] for g in gaze_history]
                movement = np.std(xs) + np.std(ys)
                stability = max(0, int(100 - movement * 2))
                state["gaze_stability"] = stability
                state["focus_score"] = min(stability + 5, 100)

            # ── EYE DETECTION + BLINK ────────────
            face_roi = gray[fy:fy+fh, fx:fx+fw]
            eyes = eye_cascade.detectMultiScale(
                face_roi, scaleFactor=1.1,
                minNeighbors=5, minSize=(20, 20)
            )

            eyes_open = len(eyes) >= 2

            if not eyes_open:
                no_eye_frames += 1
            else:
                if no_eye_frames >= 2:
                    blink_times.append(time.time())
                no_eye_frames = 0

                # ── REAL STRESS FROM EYE SIZE ────
                # Smaller eyes = more stress/fatigue
                total_eye_area = sum([ew * eh for (ex, ey, ew, eh) in eyes])
                normalized_area = total_eye_area / (fw * fh) * 1000
                eye_area_history.append(normalized_area)

                if len(eye_area_history) > 20:
                    eye_area_history.pop(0)

                if len(eye_area_history) >= 5:
                    baseline = max(eye_area_history)
                    current = eye_area_history[-1]
                    # Eyes smaller than baseline = stress
                    eye_stress = max(0, int((1 - current/baseline) * 100)) if baseline > 0 else 30

                    # Add head movement component
                    if last_face_x is not None:
                        dx = abs(cx - last_face_x)
                        dy = abs(cy - last_face_y)
                        movement_stress = min(dx + dy, 30)
                    else:
                        movement_stress = 0

                    # Combine eye stress + movement stress
                    combined_stress = int(eye_stress * 0.7 + movement_stress * 0.3 + 20)
                    combined_stress = max(10, min(90, combined_stress))

                    # Smooth the stress value
                    stress_history.append(combined_stress)
                    if len(stress_history) > 10:
                        stress_history.pop(0)
                    state["stress_score"] = int(np.mean(stress_history))

            # Keep only last 60 seconds of blinks
            now = time.time()
            blink_times = [t for t in blink_times if now - t < 60]
            state["blink_rate"] = max(len(blink_times), 1)

            last_face_x = cx
            last_face_y = cy

        # ── REALISTIC HRV ────────────────────────
        state["hrv"] = get_realistic_hrv()

        # ── UPDATE RISK SCORE ────────────────────
        state["risk_score"] = calc_risk(
            state["blink_rate"],
            state["stress_score"],
            state["reaction_time"]
        )

        r = state["risk_score"]
        if r >= 70:
            state["alert_level"] = "CRITICAL"
        elif r >= 40:
            state["alert_level"] = "WARNING"
        else:
            state["alert_level"] = "NORMAL"

        time.sleep(0.05)

    cap.release()
    print("Camera stopped.")

# ─── API Routes ────────────────────────────────────
@app.route('/api/status')
def get_status():
    return jsonify({
        "risk_score":  state["risk_score"],
        "alert_level": state["alert_level"],
        "biometrics": {
            "blink_rate":     state["blink_rate"],
            "stress_score":   state["stress_score"],
            "reaction_time":  state["reaction_time"],
            "focus_score":    state["focus_score"],
            "gaze_stability": state["gaze_stability"],
            "hrv":            state["hrv"]
        }
    })

@app.route('/api/reaction/<int:ms>')
def set_reaction(ms):
    state["reaction_time"] = ms
    return jsonify({"ok": True})

@app.route('/api/health')
def health():
    return jsonify({"status": "CogniGuard Real AI Running! ✅"})

# ─── Start ─────────────────────────────────────────
if __name__ == '__main__':
    cam_thread = threading.Thread(target=camera_loop, daemon=True)
    cam_thread.start()
    print("🛡️ CogniGuard AI Backend Starting...")
    print("📡 API at http://localhost:5000/api/status")
    app.run(debug=False, port=5000)