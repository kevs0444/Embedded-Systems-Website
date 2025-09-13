# act4.py - Gas + Vibration + Buzzer Monitoring
import smbus2
import time
from gpiozero import Buzzer, LED, InputDevice
from threading import Thread, Event, Lock
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import queue
import os
import json
from datetime import datetime

# ----------------- Sensor & GPIO Setup -----------------
PCF8591_ADDR = 0x48
AIN0 = 0x40
bus = None
vib_pin = None
buzzer = None
green_led = None
red_led = None
sensor_data = {"gas": 0, "vibration": False, "buzzer": False}

stop_thread = Event()
thread = None

# ----------------- History Path -----------------
ACT4_HISTORY_DIR = "/home/systemshapers/Embedded-Systems-Website/historicaldataact4"
ACT4_HISTORY_FILE = os.path.join(ACT4_HISTORY_DIR, "gas.json")

# ----------------- Email Setup -----------------
EMAIL_FROM = "markevinalcantara40@gmail.com"
EMAIL_PASS = "rqlj wioa ednb oulg"
EMAIL_TO   = "markevinalcantara40@gmail.com"
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

email_queue = queue.Queue()
email_sent = False
email_sent_lock = Lock()

# ----------------- Email Worker -----------------
def send_email_worker():
    while not stop_thread.is_set():
        try:
            subject, body = email_queue.get(timeout=1)
        except queue.Empty:
            continue
        try:
            msg = MIMEMultipart()
            msg['From'] = EMAIL_FROM
            msg['To'] = EMAIL_TO
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10)
            server.starttls()
            server.login(EMAIL_FROM, EMAIL_PASS)
            server.send_message(msg)
            server.quit()
            print(f"[EMAIL SENT] {subject}")
        except Exception as e:
            print(f"[EMAIL ERROR] Failed to send: {e}")

# ----------------- History Functions -----------------
def save_high_gas_history(gas_value: int):
    try:
        os.makedirs(ACT4_HISTORY_DIR, exist_ok=True)
        # Load existing history safely
        history = []
        if os.path.exists(ACT4_HISTORY_FILE):
            try:
                with open(ACT4_HISTORY_FILE, "r") as f:
                    history = json.load(f)
            except json.JSONDecodeError:
                history = []

        # Format time: dd/mm/yy h:m:s AM/PM
        now = datetime.now().strftime("%d/%m/%y %I:%M:%S %p")
        entry = {"time": now, "ppm": int(gas_value)}

        # Avoid exact duplicates
        if not history or history[-1]["ppm"] != entry["ppm"] or history[-1]["time"] != entry["time"]:
            history.append(entry)

        history = history[-50:]  # keep last 50 entries

        with open(ACT4_HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=2)
        print(f"[HISTORY] High gas saved: {entry}")
    except Exception as e:
        print(f"[HISTORY ERROR] {e}")

def load_high_gas_history():
    try:
        if os.path.exists(ACT4_HISTORY_FILE):
            with open(ACT4_HISTORY_FILE, "r") as f:
                history = json.load(f)
                return history[-50:]  # last 50 events
        return []
    except Exception as e:
        print(f"[HISTORY ERROR] {e}")
        return []

# ----------------- GPIO Initialization -----------------
def init_gpio():
    global bus, vib_pin, buzzer, green_led, red_led
    try:
        bus = smbus2.SMBus(1)
        vib_pin = InputDevice(26, pull_up=False)
        buzzer = Buzzer(17)
        green_led = LED(5)
        red_led = LED(6)
        buzzer.off()
        green_led.off()
        red_led.off()
        return True
    except Exception as e:
        print(f"GPIO initialization error: {e}")
        return False

# ----------------- Main Sensor Loop -----------------
def act4_loop():
    global sensor_data, email_sent
    email_local = {"gas": False, "vibration": False}

    while not stop_thread.is_set():
        try:
            bus.write_byte(PCF8591_ADDR, AIN0)
            gas_value = bus.read_byte(PCF8591_ADDR)
        except Exception:
            gas_value = 0

        vib_detected = vib_pin.is_active
        gas_detected = gas_value >= 200

        # LEDs & buzzer
        red_led.value = gas_detected
        green_led.value = vib_detected
        buz = gas_detected or vib_detected
        buzzer.value = buz

        sensor_data.update({
            "gas": gas_value,
            "vibration": vib_detected,
            "buzzer": buz
        })

        # Save high gas
        if gas_detected:
            save_high_gas_history(gas_value)

        # Email alerts
        if gas_detected and not email_local["gas"]:
            email_queue.put(("🚨 Gas Alert!", f"Gas level is {gas_value} ppm."))
            email_local["gas"] = True
            with email_sent_lock:
                email_sent = True
        elif not gas_detected:
            email_local["gas"] = False

        if vib_detected and not email_local["vibration"]:
            email_queue.put(("⚠️ Vibration Alert!", "Vibration detected."))
            email_local["vibration"] = True
            with email_sent_lock:
                email_sent = True
        elif not vib_detected:
            email_local["vibration"] = False

        time.sleep(1)

# ----------------- Start/Stop -----------------
def start_act4():
    global thread, stop_thread
    if not init_gpio():
        return False
    stop_thread.clear()
    thread = Thread(target=act4_loop, daemon=True)
    thread.start()
    Thread(target=send_email_worker, daemon=True).start()
    return True

def stop_act4():
    global stop_thread, thread, bus, buzzer, green_led, red_led, email_sent
    stop_thread.set()
    if thread: thread.join(timeout=1)
    try:
        if buzzer: buzzer.off()
        if green_led: green_led.off()
        if red_led: red_led.off()
        if bus: bus.close()
    except Exception:
        pass
    with email_sent_lock:
        email_sent = False

# ----------------- Data -----------------
def get_sensor_data():
    return sensor_data.copy()
