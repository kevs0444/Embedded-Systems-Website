import serial
import pynmea2
import time
from gpiozero import LED, Buzzer
from luma.core.interface.serial import i2c
from luma.oled.device import sh1106
from luma.core.render import canvas
from PIL import ImageFont
import smbus2
import requests

# -----------------------------
# Hardware Setup
# -----------------------------
SERIAL_PORT = '/dev/serial0'
BAUD_RATE = 9600

# LEDs
green_led = LED(17)  # GPIO17, Pin 11
red_led = LED(27)    # GPIO27, Pin 13

# Buzzer
buzzer = Buzzer(22)  # GPIO22, Pin 15

# OLED Display (SH1106 via I2C, 0x3C is common, try 0x3D if needed)
oled_serial = i2c(port=1, address=0x3C)
oled = sh1106(oled_serial)

# Load default font
font = ImageFont.load_default()

# MPU6050 (GY-521)
MPU6050_ADDR = 0x68
bus = smbus2.SMBus(1)
bus.write_byte_data(MPU6050_ADDR, 0x6B, 0)  # Wake up MPU6050

# -----------------------------
# MPU6050 Helper Functions
# -----------------------------
def read_word(adr):
    high = bus.read_byte_data(MPU6050_ADDR, adr)
    low = bus.read_byte_data(MPU6050_ADDR, adr + 1)
    val = (high << 8) + low
    if val >= 0x8000:
        return -((65535 - val) + 1)
    return val

def get_accel_data():
    return {
        "x": read_word(0x3B) / 16384.0,
        "y": read_word(0x3D) / 16384.0,
        "z": read_word(0x3F) / 16384.0
    }

def get_gyro_data():
    return {
        "x": read_word(0x43) / 131.0,
        "y": read_word(0x45) / 131.0,
        "z": read_word(0x47) / 131.0
    }

# -----------------------------
# Reverse Geocoding Function
# -----------------------------
def get_city(lat, lon):
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10&addressdetails=1"
        headers = {"User-Agent": "RaspberryPi-GPS-App"}
        response = requests.get(url, headers=headers, timeout=5)
        data = response.json()
        if "address" in data:
            city = data["address"].get("city") or data["address"].get("town") or data["address"].get("village")
            country = data["address"].get("country_code", "").upper()
            return f"{city}, {country}" if city else "Unknown"
        return "Unknown"
    except Exception as e:
        print(f"🌐 Geocoding error: {e}")
        return "Unknown"

# -----------------------------
# OLED Update Function
# -----------------------------
def update_oled(status, lat=None, lon=None, sats=0, city=""):
    with canvas(oled) as draw:
        draw.text((0, 0), f"GPS: {status}", font=font, fill=255)
        draw.text((0, 12), f"Sats: {sats}", font=font, fill=255)
        if lat and lon:
            draw.text((0, 24), f"Lat: {lat:.6f}", font=font, fill=255)
            draw.text((0, 36), f"Lon: {lon:.6f}", font=font, fill=255)
        if city:
            draw.text((0, 48), city, font=font, fill=255)

# -----------------------------
# GPS Setup
# -----------------------------
ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
print("📡 Reading GPS... Ctrl+C to stop")

last_fix = False  # track fix state for buzzer

try:
    while True:
        line = ser.readline().decode('ascii', errors='ignore').strip()
        if not line.startswith(('$GPGGA', '$GPRMC')):
            continue

        try:
            msg = pynmea2.parse(line)

            if line.startswith('$GPGGA'):
                print(f"🛰️ Satellites: {msg.num_sats}")

                if msg.gps_qual > 0:  # GPS fix
                    lat, lon = msg.latitude, msg.longitude
                    city = get_city(lat, lon)
                    print(f"📍 {lat:.6f}, {lon:.6f} → {city}")

                    # Indicators
                    green_led.on()
                    red_led.off()

                    # Beep once when fix is acquired
                    if not last_fix:
                        buzzer.on()
                        time.sleep(0.2)
                        buzzer.off()
                        last_fix = True

                    # Update OLED
                    update_oled("Detected", lat, lon, msg.num_sats, city)

                else:  # No fix
                    print("⏳ Waiting for GPS fix...")

                    # Indicators
                    green_led.off()
                    red_led.toggle()  # blink red LED
                    buzzer.off()
                    last_fix = False

                    # Update OLED
                    update_oled("Searching...", sats=msg.num_sats)

            elif line.startswith('$GPRMC'):
                print(f"⏰ Time (UTC): {msg.datestamp} {msg.timestamp}")

        except pynmea2.ParseError:
            continue

        time.sleep(1)

except KeyboardInterrupt:
    print("\n🛑 GPS stopped")
finally:
    ser.close()
    # Clean GPIO
    green_led.close()
    red_led.close()
    buzzer.close()
    print("✅ Clean exit, GPIO released")
