# act3.py - Motion Sensor & Camera + Buzzer
import time, threading, os
from gpiozero import MotionSensor, Buzzer
from picamera import PiCamera
from threading import Event

# ----------------- Setup -----------------
pir = None
buzzer = None
camera = None
stop_thread = Event()
thread = None
sensor_data = {"motion": False, "buzzer": False}

CAPTURE_DIR = "static/captures"
os.makedirs(CAPTURE_DIR, exist_ok=True)

recording_file = None

# ----------------- Main Loop -----------------
def motion_loop():
    global sensor_data
    while not stop_thread.is_set():
        if pir.motion_detected:
            sensor_data["motion"] = True
            buzzer.on()
            # auto capture on motion
            filename = f"motion_{int(time.time())}.jpg"
            camera.capture(os.path.join(CAPTURE_DIR, filename))
            print(f"[Camera] Motion snapshot saved: {filename}")
            sensor_data["buzzer"] = True
            time.sleep(2)
            buzzer.off()
        else:
            sensor_data["motion"] = False
            sensor_data["buzzer"] = False
        time.sleep(1)

# ----------------- Start / Stop -----------------
def start_act3():
    global pir, buzzer, camera, thread, stop_thread
    pir = MotionSensor(23)
    buzzer = Buzzer(18)
    camera = PiCamera()

    stop_thread.clear()
    thread = threading.Thread(target=motion_loop, daemon=True)
    thread.start()
    return True

def stop_act3():
    global pir, buzzer, camera, stop_thread, thread
    stop_thread.set()
    if thread:
        thread.join(timeout=1)
    if buzzer: buzzer.off()
    if camera: camera.close()
    print("Act3 stopped and GPIO cleaned")

# ----------------- Data Access -----------------
def get_sensor_data():
    return sensor_data.copy()

# ----------------- Camera Endpoints -----------------
def capture_image():
    filename = f"manual_{int(time.time())}.jpg"
    path = os.path.join(CAPTURE_DIR, filename)
    camera.capture(path)
    return {"message": f"Image captured: {filename}", "file": filename}

def start_recording():
    global recording_file
    recording_file = f"video_{int(time.time())}.h264"
    path = os.path.join(CAPTURE_DIR, recording_file)
    camera.start_recording(path)
    return {"message": "Recording started"}

def stop_recording():
    global recording_file
    if recording_file:
        camera.stop_recording()
        mp4_file = recording_file.replace(".h264", ".mp4")
        os.rename(os.path.join(CAPTURE_DIR, recording_file),
                  os.path.join(CAPTURE_DIR, mp4_file))
        recording_file = None
        return {"message": "Recording saved", "file": mp4_file}
    return {"message": "No recording", "file": ""}
