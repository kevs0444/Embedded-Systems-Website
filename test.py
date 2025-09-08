import time
import board
import digitalio
import adafruit_dht
from gpiozero import Buzzer
from luma.core.interface.serial import i2c
from luma.oled.device import sh1106
from PIL import Image, ImageDraw, ImageFont

# -------------------- Pins --------------------
# Ultrasonic 1
TRIG_PIN1 = board.D23
ECHO_PIN1 = board.D24

# Ultrasonic 2
TRIG_PIN2 = board.D27
ECHO_PIN2 = board.D22

# Buzzer
BUZZER_PIN = 17

# DHT11
DHT_PIN = board.D4

# -------------------- Setup --------------------
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

# -------------------- Functions --------------------
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
    except Exception as e:
        print(f"Ultrasonic error: {e}")
        return None

# -------------------- Main Test Loop --------------------
print("Starting sensor test... Press CTRL+C to stop.")

try:
    while True:
        # Test Ultrasonic 1
        dist1 = get_distance(trigger1, echo1)

        # Test Ultrasonic 2
        dist2 = get_distance(trigger2, echo2)

        # Test DHT11
        temp = None
        hum = None
        try:
            temp = dht_device.temperature
            hum = dht_device.humidity
        except Exception as e:
            print(f"DHT11 error: {e}")

        # Test Buzzer (turn ON if dist1 < 20cm)
        if dist1 is not None and dist1 < 20:
            buzzer.on()
        else:
            buzzer.off()

        # Print to console
        print(f"Ultrasonic1: {dist1} cm | Ultrasonic2: {dist2} cm | Temp: {temp}°C | Humidity: {hum}%")

        # Show on OLED
        try:
            img = Image.new("1", (oled.width, oled.height))
            draw = ImageDraw.Draw(img)
            draw.text((0, 0), f"Dist1: {dist1 if dist1 else '--'} cm", fill=255)
            draw.text((0, 10), f"Dist2: {dist2 if dist2 else '--'} cm", fill=255)
            draw.text((0, 20), f"Temp: {temp if temp else '--'} C", fill=255)
            draw.text((0, 30), f"Hum: {hum if hum else '--'} %", fill=255)
            draw.text((0, 50), "Testing...", fill=255)
            oled.display(img)
        except Exception as e:
            print(f"OLED update error: {e}")

        time.sleep(2)

except KeyboardInterrupt:
    print("Test stopped by user.")
    buzzer.off()
    dht_device.exit()
    trigger1.deinit()
    echo1.deinit()
    trigger2.deinit()
    echo2.deinit()
