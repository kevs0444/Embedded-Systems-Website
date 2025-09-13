# act4.py
import smbus2
import time
from gpiozero import Buzzer, LED, InputDevice
from threading import Thread, Event
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import queue

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

# ----------------- Email Queue Setup -----------------
# Queue stores tuples: (recipient_email, subject, body)
email_queue = queue.Queue()

def send_email_worker():
    """Background thread that sends emails from the queue."""
    while not stop_thread.is_set():
        try:
            recipient, subject, body = email_queue.get(timeout=1)
        except queue.Empty:
            continue
        try:
            # Replace with your actual Gmail
            sender_email = "markevinalcantara40@gmail.com"
            sender_password = "rqlj wioa ednb oulg"
            msg = MIMEMultipart()
            msg['From'] = sender_email
            msg['To'] = recipient
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP("smtp.gmail.com", 587, timeout=10)
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
            server.quit()
            print(f"[EMAIL SENT] To: {recipient} | {subject}")
        except Exception as e:
            print(f"[EMAIL ERROR] Failed to send: {e}")

# ----------------- GPIO Initialization -----------------
def init_gpio():
    global bus, vib_pin, buzzer, green_led, red_led
    try:
        bus = smbus2.SMBus(1)
        vib_pin = InputDevice(26, pull_up=False)  # vibration sensor
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
    global sensor_data
    email_sent = {"gas": False, "vibration": False}  # Track sent alerts

    while not stop_thread.is_set():
        try:
            bus.write_byte(PCF8591_ADDR, AIN0)
            gas_value = bus.read_byte(PCF8591_ADDR)
        except Exception as e:
            print(f"Gas sensor read error: {e}")
            gas_value = 0

        vib_detected = vib_pin.is_active
        gas_detected = gas_value >= 200

        # Update LEDs & buzzer
        red_led.value = gas_detected
        green_led.value = vib_detected
        buz = gas_detected or vib_detected
        buzzer.value = buz

        # Update sensor data
        sensor_data.update({
            "gas": gas_value,
            "vibration": vib_detected,
            "buzzer": buz
        })

        # ----------------- Queue Email Alerts -----------------
        recipient = "markevinalcantara40@gmail.com"  # default
        if gas_detected and not email_sent["gas"]:
            email_queue.put((
                recipient,
                "🚨 Gas Alert Detected!",
                f"Gas level is {gas_value} ppm. Immediate action required!"
            ))
            email_sent["gas"] = True
        elif not gas_detected:
            email_sent["gas"] = False

        if vib_detected and not email_sent["vibration"]:
            email_queue.put((
                recipient,
                "⚠️ Vibration Alert Detected!",
                "Vibration has been detected on the sensor. Please check immediately!"
            ))
            email_sent["vibration"] = True
        elif not vib_detected:
            email_sent["vibration"] = False

        time.sleep(1)

# ----------------- Start/Stop Functions -----------------
def start_act4():
    global thread, stop_thread
    if not init_gpio():
        return False
    stop_thread.clear()

    # Start main sensor thread
    thread = Thread(target=act4_loop, daemon=True)
    thread.start()

    # Start email worker thread
    email_thread = Thread(target=send_email_worker, daemon=True)
    email_thread.start()

    return True

def queue_email(recipient, subject, body):
    """Add an email to the sending queue."""
    if recipient and subject and body:
        email_queue.put((recipient, subject, body))
        return True
    return False

def stop_act4():
    global stop_thread, thread, bus, buzzer, green_led, red_led
    stop_thread.set()
    if thread:
        thread.join(timeout=1)
    try:
        if buzzer: buzzer.off()
        if green_led: green_led.off()
        if red_led: red_led.off()
        if bus: bus.close()
    except Exception:
        pass

def get_sensor_data():
    return sensor_data.copy()
