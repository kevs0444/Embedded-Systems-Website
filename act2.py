import time
import threading
import atexit
import signal
import board
import digitalio

# Hardware pins (adjust if needed)
TRIG_PIN = board.D23
ECHO_PIN = board.D24
BUZZER_PIN = board.D17   # Same as Act1

trig = None
echo = None
buzzer = None
stop_event = threading.Event()

sensor_data = {"distance": None, "buzzer": "OFF", "time": None, "error": False}

def initialize_hardware():
    global trig, echo, buzzer
    try:
        print("Initializing Ultrasonic sensor...")

        # Trigger pin
        trig = digitalio.DigitalInOut(TRIG_PIN)
        trig.direction = digitalio.Direction.OUTPUT

        # Echo pin
        echo = digitalio.DigitalInOut(ECHO_PIN)
        echo.direction = digitalio.Direction.INPUT

        # Buzzer pin
        buzzer = digitalio.DigitalInOut(BUZZER_PIN)
        buzzer.direction = digitalio.Direction.OUTPUT
        buzzer.value = False

        trig.value = False
        time.sleep(2)
        print("Ultrasonic + Buzzer initialized")
        return True
    except Exception as e:
        print(f"Error initializing ultrasonic: {e}")
        cleanup(silent=True)
        return False

def cleanup(silent=False):
    global trig, echo, buzzer
    if not silent:
        print("Cleaning up ultrasonic sensor...")

    stop_event.set()

    if buzzer is not None:
        try:
            buzzer.value = False
            buzzer.deinit()
        except:
            pass
        buzzer = None

    if trig is not None:
        try:
            trig.deinit()
        except:
            pass
        trig = None

    if echo is not None:
        try:
            echo.deinit()
        except:
            pass
        echo = None

    time.sleep(1)

def measure_distance():
    """Measure distance in cm"""
    # Send trigger pulse
    trig.value = True
    time.sleep(0.00001)
    trig.value = False

    start_time = time.time()
    stop_time = time.time()

    # Wait for echo to go HIGH
    while echo.value == 0:
        start_time = time.time()

    # Wait for echo to go LOW
    while echo.value == 1:
        stop_time = time.time()

    elapsed = stop_time - start_time
    distance = (elapsed * 34300) / 2  # cm
    return distance

def sensor_loop():
    while not stop_event.is_set():
        try:
            distance = measure_distance()

            # Buzzer logic: ON if <= 12 cm
            if buzzer is not None:
                if distance <= 12:
                    buzzer.value = True
                    sensor_data["buzzer"] = "ON"
                else:
                    buzzer.value = False
                    sensor_data["buzzer"] = "OFF"

            sensor_data.update({
                "distance": round(distance, 2),
                "time": time.strftime("%Y-%m-%d %H:%M:%S"),
                "error": False
            })

            # ✅ Print to terminal
            print(f"[Act2] Distance: {sensor_data['distance']} cm | Buzzer: {sensor_data['buzzer']} | Time: {sensor_data['time']}")

        except Exception as e:
            print(f"Ultrasonic read error: {e}")
            sensor_data["error"] = True

        # ✅ Fetch data every 1 second
        time.sleep(1)

def start_act2():
    stop_event.clear()
    if initialize_hardware():
        threading.Thread(target=sensor_loop, daemon=True).start()
        return True
    return False

def get_sensor_data():
    return sensor_data

# Cleanup on exit
atexit.register(cleanup)
signal.signal(signal.SIGINT, lambda s, f: cleanup())
signal.signal(signal.SIGTERM, lambda s, f: cleanup())
