
import time
import threading
import board
import digitalio
from luma.core.interface.serial import i2c
from luma.oled.device import sh1106
from PIL import Image, ImageDraw, ImageFont
import adafruit_dht
from gpiozero import Buzzer
import json
import os

# -------------------- Pins --------------------
TRIG_PIN = board.D23
ECHO_PIN = board.D24
BUZZER_PIN = 17
DHT_PIN = board.D4

# -------------------- Global Variables --------------------
trigger = None
echo = None
buzzer_obj = None
oled = None
serial = None
dht_device = None
stop_event = threading.Event()
history = []
latest_data = {"distance": None, "temperature": None, "humidity": None, "time": None, "buzzer": "OFF"}

ultrasonic_fail_count = 0
dht_fail_count = 0
MAX_CONSECUTIVE_FAILS = 3
SENSOR_TIMEOUT = 3
last_successful_reading = None
ULTRASONIC_TIMEOUT = 5

# -------------------- File for Persistent History --------------------
HISTORY_DIR = "/home/systemshapers/Embedded-Systems-Website/historicaldataact2"
HISTORY_FILE = os.path.join(HISTORY_DIR, "historical_data_act2.json")

def load_history():
    global history
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r") as f:
                loaded_data = json.load(f)
                if isinstance(loaded_data, list):
                    history = loaded_data
                    print(f"Loaded {len(history)} historical records from file")
                else:
                    print("Invalid history file format, starting fresh")
                    history = []
        except json.JSONDecodeError:
            print("Corrupted history file, starting fresh.")
            history = []
        except Exception as e:
            print(f"Error loading history: {e}")
            history = []
    else:
        print("No history file found, starting fresh")
        history = []
    return history

def save_history():
    try:
        if not os.path.exists(HISTORY_DIR):
            os.makedirs(HISTORY_DIR, exist_ok=True)
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=4)
        print(f"History saved with {len(history)} records")
        return True
    except Exception as e:
        print(f"Error saving history: {e}")
        return False

# -------------------- Hardware Initialization --------------------
def initialize_hardware():
    global trigger, echo, buzzer_obj, oled, serial, dht_device
    try:
        print("Initializing hardware...")

        # Ultrasonic
        trigger = digitalio.DigitalInOut(TRIG_PIN)
        trigger.direction = digitalio.Direction.OUTPUT
        trigger.value = False
        echo = digitalio.DigitalInOut(ECHO_PIN)
        echo.direction = digitalio.Direction.INPUT

        # Buzzer
        buzzer_obj = Buzzer(BUZZER_PIN)
        buzzer_obj.off()

        # OLED
        serial = i2c(port=1, address=0x3C)
        oled = sh1106(serial)
        oled.clear()

        # DHT11
        dht_device = adafruit_dht.DHT11(DHT_PIN)

        print("Hardware initialization completed")
        return True
    except Exception as e:
        print(f"Hardware initialization error: {e}")
        cleanup()
        return False

# -------------------- Ultrasonic Reading --------------------
def get_distance():
    if trigger is None or echo is None:
        return None
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
            return round(distance_cm, 1)  # one decimal place
        return None
    except:
        return None

# -------------------- OLED Display --------------------
def update_oled(distance):
    if oled is None:
        return
    try:
        image = Image.new("1", (oled.width, oled.height))
        draw = ImageDraw.Draw(image)

        if distance is not None and distance >= 12:  # Show only if ≥12cm
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)  # smaller font
            text = f"dist: {distance:.1f}cm"

            bbox = draw.textbbox((0, 0), text, font=font)
            text_x = (oled.width - (bbox[2] - bbox[0])) // 2
            text_y = (oled.height - (bbox[3] - bbox[1])) // 2
            draw.text((text_x, text_y), text, font=font, fill=255)

        oled.display(image)
    except Exception as e:
        print(f"OLED update error: {e}")

# -------------------- Buzzer --------------------
def handle_buzzer(distance):
    if buzzer_obj:
        try:
            if distance is not None and distance >= 12:
                buzzer_obj.on()  # Keep buzzer on continuously
            else:
                buzzer_obj.off()
        except:
            pass

# -------------------- Sensor Loop --------------------
def sensor_loop():
    global latest_data, ultrasonic_fail_count, dht_fail_count, last_successful_reading
    interval = 2
    save_counter = 0
    save_interval = 5
    
    while not stop_event.is_set():
        start_loop = time.time()
        distance = get_distance()
        if distance is not None:
            ultrasonic_fail_count = 0
            last_successful_reading = time.time()
        else:
            ultrasonic_fail_count += 1

        # Temp & Humidity
        temperature = None
        humidity = None
        if dht_device:
            try:
                temperature = dht_device.temperature
                humidity = dht_device.humidity
                dht_fail_count = 0
            except:
                dht_fail_count += 1

        # Buzzer + OLED logic
        handle_buzzer(distance)
        update_oled(distance)

        # Update latest_data
        latest_data = {
            "distance": distance,
            "temperature": temperature,
            "humidity": humidity,
            "date": time.strftime("%d-%m-%Y"),
            "time": time.strftime("%H:%M:%S"),
            "buzzer": "ON" if (distance is not None and distance >= 12) else "OFF"
        }

        # Append to history
        if distance is not None:
            history.append({
                "date": latest_data["date"],
                "time": latest_data["time"],
                "distance": distance
            })
            
            if len(history) > 1000:
                history.pop(0)
            
            save_counter += 1
            if save_counter >= save_interval:
                save_history()
                save_counter = 0

        elapsed = time.time() - start_loop
        if elapsed < interval:
            time.sleep(interval - elapsed)

# -------------------- Helper Functions --------------------
def get_sensor_data():
    ultrasonic_timeout = False
    if last_successful_reading and time.time() - last_successful_reading > ULTRASONIC_TIMEOUT and latest_data.get("distance") is None:
        ultrasonic_timeout = True
    data = latest_data.copy()
    data["ultrasonic_timeout"] = ultrasonic_timeout
    return data

def get_history():
    return history

def clear_history():
    global history
    history.clear()
    save_history()
    if oled:
        oled.clear()
    return {"status": "success"}

def set_history(data):
    global history
    if isinstance(data, list):
        history = data
    else:
        history = []

# -------------------- Start/Stop --------------------
def start_act2():
    global stop_event, ultrasonic_fail_count, dht_fail_count, last_successful_reading, history
    
    cleanup()
    ultrasonic_fail_count = 0
    dht_fail_count = 0
    last_successful_reading = time.time()
    load_history()

    if initialize_hardware():
        stop_event.clear()
        thread = threading.Thread(target=sensor_loop, daemon=True)
        thread.start()
        return True
    return False

def cleanup():
    global trigger, echo, buzzer_obj, oled, serial, dht_device, stop_event, last_successful_reading
    stop_event.set()
    time.sleep(0.5)
    save_history()

    try: buzzer_obj and buzzer_obj.off(); buzzer_obj = None
    except: pass
    try: trigger and trigger.deinit(); trigger = None
    except: pass
    try: echo and echo.deinit(); echo = None
    except: pass
    try: dht_device and dht_device.exit(); dht_device = None
    except: pass
    try: oled and oled.clear(); oled = None
    except: pass
    serial = None
    last_successful_reading = None
