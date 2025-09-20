# act6.py - GPS + MPU6050 + OLED + LED + Buzzer + Text-to-Speech
import threading
import time
import serial
import pynmea2
import smbus2
import requests
from gpiozero import LED, Buzzer
from luma.core.interface.serial import i2c
from luma.oled.device import sh1106
from luma.core.render import canvas
from PIL import ImageFont
import pyttsx3  # local TTS

# -------------------- Globals --------------------
running = False
lock = threading.Lock()
thread = None
gps_serial = None
last_fix_status = None
last_city_coords = (None, None)
cached_city = "Unknown"

# Hardware
green_led = None
red_led = None
buzzer = None
oled = None
font = None
bus = None

# MPU6050
MPU6050_ADDR = 0x68

# Location & sensor data
location_data = {
    "lat": None, "lon": None, "fix": False, "satellites": 0,
    "altitude": None, "speed": None, "timestamp": None,
    "city": "", "accel": {}, "gyro": {}
}

# TTS engine
engine = pyttsx3.init()
engine.setProperty("rate", 150)

# -------------------- MPU6050 --------------------
def read_word(adr):
    try:
        high = bus.read_byte_data(MPU6050_ADDR, adr)
        low = bus.read_byte_data(MPU6050_ADDR, adr + 1)
        val = (high << 8) + low
        return -((65535 - val) + 1) if val >= 0x8000 else val
    except Exception as e:
        print(f"[MPU6050 Error] {e}")
        return 0

def get_accel_data():
    return {"x": read_word(0x3B)/16384.0, "y": read_word(0x3D)/16384.0, "z": read_word(0x3F)/16384.0}

def get_gyro_data():
    return {"x": read_word(0x43)/131.0, "y": read_word(0x45)/131.0, "z": read_word(0x47)/131.0}

# -------------------- Reverse Geocoding --------------------
def get_city(lat, lon):
    global last_city_coords, cached_city
    if last_city_coords == (lat, lon):
        return cached_city
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10&addressdetails=1"
        headers = {"User-Agent": "RaspberryPi-GPS-App"}
        r = requests.get(url, headers=headers, timeout=5)
        data = r.json()
        if "address" in data:
            city = data["address"].get("city") or data["address"].get("town") or data["address"].get("village")
            country = data["address"].get("country_code", "").upper()
            cached_city = f"{city}, {country}" if city else "Unknown"
            last_city_coords = (lat, lon)
            return cached_city
    except Exception as e:
        print(f"[Geocode Error] {e}")
    cached_city = "Unknown"
    return cached_city

# -------------------- OLED --------------------
def update_oled(status, sats=0, lat=None, lon=None, city=""):
    if not oled: return
    with canvas(oled) as draw:
        draw.text((0, 0), f"GPS: {status}", font=font, fill=255)
        draw.text((0, 12), f"Sats: {sats}", font=font, fill=255)
        if lat and lon:
            draw.text((0, 24), f"Lat:{lat:.5f}", font=font, fill=255)
            draw.text((0, 36), f"Lon:{lon:.5f}", font=font, fill=255)
        if city:
            draw.text((0, 48), city, font=font, fill=255)

# -------------------- GPS Parsing --------------------
def parse_gps_data(data):
    global last_fix_status
    try:
        if data.startswith('$GPGGA'):
            msg = pynmea2.parse(data)
            fix = (msg.gps_qual > 0)
            city_name = get_city(msg.latitude, msg.longitude) if fix else ""
            with lock:
                location_data.update({
                    "lat": msg.latitude,
                    "lon": msg.longitude,
                    "altitude": msg.altitude,
                    "satellites": msg.num_sats,
                    "fix": fix,
                    "accel": get_accel_data(),
                    "gyro": get_gyro_data(),
                    "city": city_name
                })

            if fix:
                green_led.on(); red_led.off()
                if not last_fix_status:
                    buzzer.on(); time.sleep(0.2); buzzer.off()
                update_oled("Detected", msg.num_sats, msg.latitude, msg.longitude, city_name)
            else:
                green_led.off(); red_led.toggle(); buzzer.off()
                update_oled("Searching...", msg.num_sats)
            last_fix_status = fix

        elif data.startswith('$GPRMC'):
            msg = pynmea2.parse(data)
            with lock:
                location_data["fix"] = getattr(msg, "status", "V") == "A"
                location_data["timestamp"] = f"{msg.datestamp} {msg.timestamp}"
    except Exception as e:
        print(f"[GPS Parse Error] {e}")

# -------------------- GPS Loop --------------------
def gps_loop():
    global gps_serial
    try:
        gps_serial = serial.Serial('/dev/serial0', 9600, timeout=1)
        print("[ACT6] GPS serial open")
        while running:
            line = gps_serial.readline()
            if line:
                parse_gps_data(line.decode('ascii', errors='ignore').strip())
            time.sleep(0.1)
    except Exception as e:
        print(f"[GPS Loop Error] {e}")
    finally:
        if gps_serial and gps_serial.is_open:
            gps_serial.close()
            print("[ACT6] GPS serial closed")

# -------------------- Text-to-Speech --------------------
def speak_location():
    with lock:
        city = location_data.get("city", "Unknown location")
    try:
        engine.say(f"Your current location is {city}")
        engine.runAndWait()
    except Exception as e:
        print(f"[TTS Error] {e}")

# -------------------- Start/Stop --------------------
def start_act6():
    global running, thread, green_led, red_led, buzzer, oled, font, bus
    if running: return False
    try:
        green_led = LED(17)
        red_led = LED(27)
        buzzer = Buzzer(22)

        oled_serial = i2c(port=1, address=0x3C)
        oled = sh1106(oled_serial)
        font = ImageFont.load_default()

        bus = smbus2.SMBus(1)
        bus.write_byte_data(MPU6050_ADDR, 0x6B, 0)

        running = True
        thread = threading.Thread(target=gps_loop, daemon=True)
        thread.start()
        return True
    except Exception as e:
        print(f"[ACT6 Start Error] {e}")
        return False

def stop_act6():
    global running, thread, green_led, red_led, buzzer, oled, bus, gps_serial
    running = False
    if gps_serial and gps_serial.is_open:
        gps_serial.close()
    if thread:
        thread.join(timeout=2)
        thread = None
    for dev in [green_led, red_led, buzzer]:
        if dev:
            try: dev.close()
            except: pass
    green_led = red_led = buzzer = None
    oled = None
    bus = None
    print("[ACT6] Hardware cleaned up")

def get_location():
    with lock:
        return dict(location_data)
