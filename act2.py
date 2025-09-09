# act2.py - Activity 2: Dual Ultrasonic + DHT11 + Buzzer + OLED
import time
import threading
import board
import digitalio
import adafruit_dht
from gpiozero import Buzzer
from luma.core.interface.serial import i2c
from luma.oled.device import sh1106
from PIL import Image, ImageDraw, ImageFont

# -------------------- Pins --------------------
TRIG_PIN1 = board.D23
ECHO_PIN1 = board.D24
TRIG_PIN2 = board.D27
ECHO_PIN2 = board.D22
BUZZER_PIN = 17
DHT_PIN = board.D4

# -------------------- Globals --------------------
_last_read = {"distance1": 0, "distance2": 0, "temperature": 0, "humidity": 0}
_history = []  # history for real-time + saved to file
_lock = threading.Lock()
_running = False
_thread = None

# -------------------- Devices (initialized later) --------------------
trigger1 = None
echo1 = None
trigger2 = None
echo2 = None
buzzer = None
dht_device = None
oled = None

# -------------------- Setup --------------------
def setup():
    global trigger1, echo1, trigger2, echo2, buzzer, dht_device, oled
    try:
        # Ultrasonic 1
        trigger1 = digitalio.DigitalInOut(TRIG_PIN1)
        trigger1.direction = digitalio.Direction.OUTPUT
        trigger1.value = False
        echo1 = digitalio.DigitalInOut(ECHO_PIN1)
        echo1.direction = digitalio.Direction.INPUT

        # Ultrasonic 2
        trigger2 = digitalio.DigitalInOut(TRIG_PIN2)
        trigger2.direction = digitalio.Direction.OUTPUT
        trigger2.value = False
        echo2 = digitalio.DigitalInOut(ECHO_PIN2)
        echo2.direction = digitalio.Direction.INPUT

        # Buzzer
        buzzer = Buzzer(BUZZER_PIN)
        buzzer.off()

        # DHT11
        dht_device = adafruit_dht.DHT11(DHT_PIN)

        # OLED
        serial = i2c(port=1, address=0x3C)
        oled = sh1106(serial)
        oled.width = 128
        oled.height = 64
        oled.font = ImageFont.load_default()
    except Exception as e:
        print(f"[Act2 Setup Error] {e}")

# -------------------- Sensor Functions --------------------
def get_distance(trigger, echo):
    try:
        trigger.value = False
        time.sleep(0.0005)
        trigger.value = True
        time.sleep(0.00001)
        trigger.value = False

        timeout_start = time.time()
        while not echo.value:
            if time.time() - timeout_start > 0.1:
                return None
        pulse_start = time.time()

        timeout_start = time.time()
        while echo.value:
            if time.time() - timeout_start > 0.1:
                return None
        pulse_end = time.time()

        distance_cm = (pulse_end - pulse_start) * 34300 / 2
        if 2 <= distance_cm <= 400:
            return round(distance_cm, 1)
        return None
    except Exception:
        return None

# -------------------- Monitoring Thread --------------------
def _monitor_sensors():
    global _running, _last_read, _history, buzzer
    while _running:
        try:
            dist1 = get_distance(trigger1, echo1)
            dist2 = get_distance(trigger2, echo2)

            temp, hum = None, None
            try:
                temp = dht_device.temperature
                hum = dht_device.humidity
            except Exception:
                pass

            # ---------------- Buzzer logic ----------------
            sensors_over_12cm = []
            if dist1 is not None and dist1 >= 12:
                sensors_over_12cm.append(("Dist1", dist1))
            if dist2 is not None and dist2 >= 12:
                sensors_over_12cm.append(("Dist2", dist2))

            if sensors_over_12cm:
                buzzer.on()
            else:
                buzzer.off()

            # ---------------- Update last_read and history ----------------
            with _lock:
                _last_read["distance1"] = dist1 if dist1 else 0
                _last_read["distance2"] = dist2 if dist2 else 0
                _last_read["temperature"] = temp if temp else 0
                _last_read["humidity"] = hum if hum else 0
                _history.append(_last_read.copy())
                _history = _history[-20:]  # keep 20 most recent for chart

            # ---------------- OLED display ----------------
            try:
                img = Image.new("1", (oled.width, oled.height))
                draw = ImageDraw.Draw(img)
                v_offset = 10

                if sensors_over_12cm:
                    for i, (name, val) in enumerate(sensors_over_12cm):
                        draw.text((0, v_offset + i*10), f"{name}: {val} cm", fill=255)
                    draw.text((0, v_offset + 30), f"Sensors >= 12cm: {len(sensors_over_12cm)}", fill=255)
                oled.display(img)
            except Exception:
                pass

            time.sleep(2)
        except Exception:
            time.sleep(2)

# -------------------- Public Functions --------------------
def start_act2():
    global _running, _thread
    if not _running:
        setup()
        _running = True
        _thread = threading.Thread(target=_monitor_sensors, daemon=True)
        _thread.start()
    return True

def start_act2_loop():
    return start_act2()

def stop_act2_loop():
    global _running, _thread, buzzer
    _running = False
    if _thread and _thread.is_alive():
        _thread.join(timeout=1)
    _thread = None
    if buzzer:
        buzzer.off()
    if oled:
        try:
            img = Image.new("1", (oled.width, oled.height))
            oled.display(img)
        except Exception:
            pass

def cleanup():
    global trigger1, echo1, trigger2, echo2, dht_device, buzzer
    stop_act2_loop()
    try:
        if trigger1: trigger1.deinit()
        if echo1: echo1.deinit()
        if trigger2: trigger2.deinit()
        if echo2: echo2.deinit()
        if dht_device: dht_device.exit()
        if buzzer: buzzer.off()
    except Exception:
        pass

def get_sensor_data():
    with _lock:
        return _last_read.copy()

def get_history():
    with _lock:
        return _history.copy()

def set_history(history_list):
    global _history
    with _lock:
        _history = history_list[-20:].copy()
