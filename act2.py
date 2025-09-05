import time
from gpiozero import DistanceSensor, Buzzer
from luma.core.interface.serial import i2c
from luma.oled.device import ssd1306
from PIL import Image, ImageDraw, ImageFont

# -------------------- Ultrasonic Setup --------------------
sensor = DistanceSensor(echo=24, trigger=23, max_distance=2)  # GPIO24 = Echo, GPIO23 = Trigger

# -------------------- Buzzer Setup --------------------
buzzer = Buzzer(17)  # GPIO17

# -------------------- OLED Setup (SSH1106) --------------------
serial = i2c(port=1, address=0x3C)
oled = ssd1306(serial, width=128, height=64)
font = ImageFont.load_default()

def display_distance(distance):
    image = Image.new("1", (oled.width, oled.height))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, oled.width, oled.height), outline=0, fill=0)
    draw.text((0, 0), f"Distance: {distance:.1f} cm", font=font, fill=255)
    oled.display(image)

# -------------------- Data History --------------------
history = []

# -------------------- Beep Function --------------------
def beep():
    buzzer.on()
    time.sleep(0.2)
    buzzer.off()

# -------------------- Main Sensor Data --------------------
def get_sensor_data():
    try:
        distance = sensor.distance * 100  # convert to cm

        if distance >= 12:
            beep()
            display_distance(distance)

        data = {"distance": round(distance, 2), "time": time.strftime("%H:%M:%S")}
        history.append(data)

        time.sleep(2)
        return data
    except Exception as e:
        return {"error": str(e), "time": time.strftime("%H:%M:%S")}

# -------------------- History Functions --------------------
def get_history():
    return history

def clear_history():
    history.clear()
    oled.clear()
    return {"status": "cleared"}

# -------------------- Control --------------------
def start_act2():
    buzzer.off()
    oled.clear()
    return True

def cleanup():
    buzzer.off()
    oled.clear()
