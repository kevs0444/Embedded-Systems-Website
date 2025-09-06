import time
import threading
import board
import digitalio
from luma.core.interface.serial import i2c
from luma.oled.device import ssd1306
from PIL import Image, ImageDraw, ImageFont
import adafruit_dht
from gpiozero import Buzzer

# -------------------- Pins --------------------
TRIG_PIN = board.D23  # Ultrasonic Trigger
ECHO_PIN = board.D24  # Ultrasonic Echo
BUZZER_PIN = 17       # GPIO17
DHT_PIN = board.D4    # DHT11 Data

# -------------------- Global Variables --------------------
trigger = None
echo = None
buzzer_obj = None
oled = None
serial = None
dht_device = None
stop_event = threading.Event()
history = []
latest_data = {"distance": None, "temperature": None, "humidity": None, "time": None, "error": None}
consecutive_fail_count = 0
MAX_CONSECUTIVE_FAILS = 3

# -------------------- Hardware Initialization --------------------
def initialize_hardware():
    global trigger, echo, buzzer_obj, oled, serial, dht_device

    try:
        # Ultrasonic pins
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
        oled = ssd1306(serial, width=128, height=64)
        oled.clear()

        # DHT11
        dht_device = adafruit_dht.DHT11(DHT_PIN)

        print("Act2 hardware initialized successfully")
        return True
    except Exception as e:
        print(f"Error initializing Act2 hardware: {e}")
        return False

# -------------------- Display Function --------------------
def display_readings(distance, temperature, humidity):
    if oled is None:
        return

    try:
        font = ImageFont.load_default()
        image = Image.new("1", (oled.width, oled.height))
        draw = ImageDraw.Draw(image)

        dist_text = f"Dist: {distance:.1f} cm"
        temp_text = f"Temp: {temperature:.1f}°C"
        hum_text = f"Hum: {humidity:.1f}%"

        draw.text((10, 10), dist_text, font=font, fill=255)
        draw.text((10, 30), temp_text, font=font, fill=255)
        draw.text((10, 50), hum_text, font=font, fill=255)

        oled.display(image)
    except Exception as e:
        print(f"Error displaying readings: {e}")

# -------------------- Buzzer Function --------------------
def beep():
    if buzzer_obj:
        try:
            buzzer_obj.on()
            time.sleep(0.2)
            buzzer_obj.off()
        except Exception as e:
            print(f"Error with buzzer: {e}")

# -------------------- Ultrasonic Reading --------------------
def get_distance():
    if trigger is None or echo is None:
        return None

    try:
        # Send trigger pulse
        trigger.value = False
        time.sleep(0.0002)  # Wait 200μs
        trigger.value = True
        time.sleep(0.00001)  # 10μs pulse
        trigger.value = False

        # Wait for echo to go high
        timeout = time.time() + 0.1  # 100ms timeout
        while not echo.value:
            if time.time() > timeout:
                return None
            time.sleep(0.00001)  # 10μs delay

        # Measure echo pulse duration
        start_time = time.time()
        timeout = time.time() + 0.1  # 100ms timeout
        while echo.value:
            if time.time() > timeout:
                return None
            time.sleep(0.00001)  # 10μs delay
        end_time = time.time()

        # Calculate distance in cm
        pulse_duration = end_time - start_time
        distance_cm = (pulse_duration * 34300) / 2  # Speed of sound is 343 m/s
        
        # Validate distance (HC-SR04 range is 2cm-400cm)
        if 2 <= distance_cm <= 400:
            return round(distance_cm, 2)
        else:
            return None
            
    except Exception as e:
        print(f"Error reading ultrasonic sensor: {e}")
        return None

# -------------------- Sensor Loop --------------------
def sensor_loop():
    global latest_data, consecutive_fail_count
    interval = 2  # seconds

    while not stop_event.is_set():
        start_loop = time.time()  # Track start time of this cycle

        try:
            distance = get_distance()
            
            temperature = None
            humidity = None
            if dht_device:
                try:
                    temperature = dht_device.temperature
                    humidity = dht_device.humidity
                except RuntimeError:
                    pass
                except Exception as e:
                    print(f"DHT11 unexpected error: {e}")

            # Handle consecutive ultrasonic failures
            if distance is None:
                consecutive_fail_count += 1
                if consecutive_fail_count >= MAX_CONSECUTIVE_FAILS:
                    error_msg = "Ultrasonic sensor error"
                else:
                    error_msg = None
            else:
                consecutive_fail_count = 0
                error_msg = None

            data = {
                "distance": distance,
                "temperature": temperature,
                "humidity": humidity,
                "time": time.strftime("%H:%M:%S"),
                "error": error_msg
            }

            latest_data = data
            history.append(data)

            # Display and beep if distance is valid and >=12
            if distance is not None and distance >= 12:
                if temperature is not None and humidity is not None:
                    display_readings(distance, temperature, humidity)
                beep()
            else:
                if buzzer_obj and buzzer_obj.is_active:
                    buzzer_obj.off()
                if oled:
                    oled.clear()

        except Exception as e:
            latest_data = {
                "distance": None,
                "temperature": None,
                "humidity": None,
                "time": time.strftime("%H:%M:%S"),
                "error": str(e)
            }

        # Wait remaining time to maintain 2-second interval
        elapsed = time.time() - start_loop
        if elapsed < interval:
            time.sleep(interval - elapsed)

# -------------------- Helper Functions --------------------
def get_sensor_data():
    return latest_data

def get_history():
    return history

def clear_history():
    history.clear()
    if oled:
        oled.clear()
    return {"status": "cleared"}

# -------------------- Start Act2 --------------------
def start_act2():
    global stop_event

    cleanup()  # Clean previous resources

    if initialize_hardware():
        stop_event.clear()
        thread = threading.Thread(target=sensor_loop, daemon=True)
        thread.start()
        return True
    return False

# -------------------- Cleanup --------------------
def cleanup():
    global trigger, echo, buzzer_obj, oled, serial, dht_device, stop_event

    stop_event.set()
    time.sleep(0.5)

    try:
        if buzzer_obj:
            buzzer_obj.off()
            buzzer_obj.close()
            buzzer_obj = None
    except Exception as e:
        print(f"Error cleaning up buzzer: {e}")

    try:
        if trigger:
            trigger.deinit()
            trigger = None
        if echo:
            echo.deinit()
            echo = None
    except Exception as e:
        print(f"Error cleaning up ultrasonic: {e}")

    try:
        if dht_device:
            dht_device.exit()
            dht_device = None
    except Exception as e:
        print(f"Error cleaning up DHT11: {e}")

    try:
        if oled:
            oled.clear()
            oled = None
    except Exception as e:
        print(f"Error cleaning up OLED: {e}")

    try:
        if serial:
            serial.cleanup()
            serial = None
    except Exception as e:
        print(f"Error cleaning up serial: {e}")

    print("Act2 resources cleaned up")