import time
import threading
import atexit
import signal
import os
import json
from datetime import datetime, timedelta
import board
import adafruit_dht
import digitalio

# Hardware globals
dht_device = None
buzzer = None

# Global storage
sensor_data = {"temperature": None, "humidity": None, "buzzer": "OFF", "time": None, "error": False}
stop_event = threading.Event()
temp_readings_buffer = []
humidity_readings_buffer = []
buffer_start_time = None

# Historical data
HIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "historicaldataact1")
HIST_FILE = os.path.join(HIST_DIR, "historical_data_act1.json")
os.makedirs(HIST_DIR, exist_ok=True)

historical_data = {"labels": [], "temp": [], "hum": []}
last_historical_save = None
HISTORICAL_INTERVAL = 300  # 5 minutes
MAX_HISTORICAL_POINTS = 288  # 24 hours of 5-minute intervals

def initialize_hardware():
    global dht_device, buzzer
    try:
        print("Initializing hardware...")
        time.sleep(1)

        dht_device = adafruit_dht.DHT11(board.D4)
        print("DHT sensor initialized")

        buzzer = digitalio.DigitalInOut(board.D17)
        buzzer.direction = digitalio.Direction.OUTPUT
        buzzer.value = False
        print("Buzzer initialized")

        time.sleep(2)

        for _ in range(3):
            try:
                test_temp = dht_device.temperature
                test_hum = dht_device.humidity
                if test_temp is not None and test_hum is not None:
                    print(f"Initial reading - Temp: {test_temp}°C, Humidity: {test_hum}%")
                    return True
            except:
                time.sleep(2)
                continue
        return False
    except Exception as e:
        print(f"Error initializing hardware: {str(e)}")
        cleanup(silent=True)
        return False

def cleanup(silent=False):
    global dht_device, buzzer
    if not silent:
        print("Cleaning up GPIO...")

    stop_event.set()

    if temp_readings_buffer and humidity_readings_buffer:
        save_averaged_data()

    if buzzer is not None:
        try:
            buzzer.value = False
            buzzer.deinit()
        except:
            pass
        buzzer = None

    if dht_device is not None:
        try:
            dht_device.exit()
        except:
            pass
        dht_device = None

    time.sleep(1)

def load_historical_data():
    global historical_data, last_historical_save
    try:
        if os.path.exists(HIST_FILE):
            with open(HIST_FILE, "r") as f:
                data = json.load(f)
            if "data" in data:
                loaded_data = data["data"]
                if all(key in loaded_data for key in ["labels", "temp", "hum"]):
                    min_length = min(len(loaded_data["labels"]), 
                                   len(loaded_data["temp"]), 
                                   len(loaded_data["hum"]))
                    historical_data = {
                        "labels": loaded_data["labels"][-min_length:],
                        "temp": loaded_data["temp"][-min_length:],
                        "hum": loaded_data["hum"][-min_length:]
                    }
                    print(f"Loaded {min_length} historical data points")
                else:
                    historical_data = {"labels": [], "temp": [], "hum": []}
            last_historical_save_str = data.get("last_save")
            if last_historical_save_str:
                last_historical_save = datetime.fromisoformat(last_historical_save_str)
    except Exception as e:
        print(f"Error loading historical data: {e}")
        historical_data = {"labels": [], "temp": [], "hum": []}

def save_historical_data():
    try:
        data_to_save = {
            "data": historical_data,
            "last_save": last_historical_save.isoformat() if last_historical_save else None
        }
        with open(HIST_FILE, "w") as f:
            json.dump(data_to_save, f, indent=2)
        print(f"Saved {len(historical_data['labels'])} data points")
    except Exception as e:
        print(f"Error saving historical data: {e}")

def add_to_buffer(temperature, humidity):
    global buffer_start_time
    now = datetime.now()
    if buffer_start_time is None:
        buffer_start_time = now
    temp_readings_buffer.append(temperature)
    humidity_readings_buffer.append(humidity)
    if len(temp_readings_buffer) >= 60 or (now - buffer_start_time).total_seconds() >= HISTORICAL_INTERVAL:
        save_averaged_data()

def save_averaged_data():
    global buffer_start_time, last_historical_save
    if not temp_readings_buffer or not humidity_readings_buffer:
        return False

    avg_temp = sum(temp_readings_buffer) / len(temp_readings_buffer)
    avg_humidity = sum(humidity_readings_buffer) / len(humidity_readings_buffer)

    timestamp = buffer_start_time.strftime("%b %d %I:%M %p") if buffer_start_time else datetime.now().strftime("%b %d %I:%M %p")
    historical_data["labels"].append(timestamp)
    historical_data["temp"].append(round(avg_temp, 1))
    historical_data["hum"].append(round(avg_humidity, 1))

    min_length = min(len(historical_data["labels"]), len(historical_data["temp"]), len(historical_data["hum"]))
    historical_data["labels"] = historical_data["labels"][-min_length:]
    historical_data["temp"] = historical_data["temp"][-min_length:]
    historical_data["hum"] = historical_data["hum"][-min_length:]

    if len(historical_data["labels"]) > MAX_HISTORICAL_POINTS:
        historical_data["labels"] = historical_data["labels"][-MAX_HISTORICAL_POINTS:]
        historical_data["temp"] = historical_data["temp"][-MAX_HISTORICAL_POINTS:]
        historical_data["hum"] = historical_data["hum"][-MAX_HISTORICAL_POINTS:]

    last_historical_save = datetime.now()
    save_historical_data()
    temp_readings_buffer.clear()
    humidity_readings_buffer.clear()
    buffer_start_time = None
    return True

def sensor_loop():
    error_count = 0
    while not stop_event.is_set():
        try:
            if dht_device is not None:
                temperature = dht_device.temperature
                humidity = dht_device.humidity

                if temperature is not None and humidity is not None:
                    now = datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
                    sensor_data.update({
                        "temperature": round(temperature, 1),
                        "humidity": round(humidity, 1),
                        "time": now,
                        "error": False
                    })

                    add_to_buffer(temperature, humidity)
                    error_count = 0

                    # Buzzer logic
                    if buzzer is not None:
                        if temperature >= 38:
                            beep_delay = max(0.1, 1.0 - 0.35 * (temperature - 38))
                            buzzer.value = True
                            time.sleep(0.1)
                            buzzer.value = False
                            time.sleep(beep_delay)
                            sensor_data["buzzer"] = "ON"
                            continue
                        else:
                            buzzer.value = False
                            sensor_data["buzzer"] = "OFF"

        except RuntimeError as e:
            print(f"DHT Read Error: {e}")
            error_count += 1
            sensor_data["error"] = True
            time.sleep(2)
        except Exception as e:
            print(f"Unexpected error: {e}")
            error_count += 1
            sensor_data["error"] = True

        if error_count >= 3:
            print("Too many errors, reinitializing...")
            initialize_hardware()
            error_count = 0

        time.sleep(5)

def cleanup_thread():
    while not stop_event.is_set():
        time.sleep(3600)
        if not stop_event.is_set():
            clean_old_data()

def clean_old_data():
    if not historical_data["labels"]:
        return
    now = datetime.now()
    cutoff_time = now - timedelta(hours=24)
    keep_from = 0
    for i, label in enumerate(historical_data["labels"]):
        try:
            try:
                point_time = datetime.strptime(f"{now.year} {label}", "%Y %b %d %I:%M %p")
            except ValueError:
                point_time = datetime.strptime(f"{now.year} {label}", "%Y %b %d %H:%M")
            if point_time >= cutoff_time:
                keep_from = i
                break
        except:
            continue
    if keep_from > 0:
        historical_data["labels"] = historical_data["labels"][keep_from:]
        historical_data["temp"] = historical_data["temp"][keep_from:]
        historical_data["hum"] = historical_data["hum"][keep_from:]
        save_historical_data()
        print(f"Cleaned up {keep_from} old data points")

def start_act1():
    stop_event.clear()
    if initialize_hardware():
        load_historical_data()
        threading.Thread(target=sensor_loop, daemon=True).start()
        threading.Thread(target=cleanup_thread, daemon=True).start()
        return True
    return False

def get_sensor_data():
    return sensor_data

def get_history():
    return historical_data

def clear_history():
    global historical_data, last_historical_save, buffer_start_time
    try:
        historical_data = {"labels": [], "temp": [], "hum": []}
        last_historical_save = None
        buffer_start_time = None
        temp_readings_buffer.clear()
        humidity_readings_buffer.clear()
        if os.path.exists(HIST_FILE):
            try:
                os.remove(HIST_FILE)
                print("Historical data file deleted.")
            except Exception as e:
                print(f"Error deleting file: {e}")
                return {"status": "error", "message": str(e)}
        return {"status": "success", "message": "Historical data cleared"}
    except Exception as e:
        return {"status": "error", "message": f"Error clearing data: {str(e)}"}

# Register cleanup handlers
atexit.register(cleanup)
signal.signal(signal.SIGINT, lambda s, f: cleanup())
signal.signal(signal.SIGTERM, lambda s, f: cleanup())

if __name__ == "__main__":
    if start_act1():
        try:
            while True:
                print(f"Temp: {sensor_data['temperature']}°C, Humidity: {sensor_data['humidity']}%")
                time.sleep(5)
        except KeyboardInterrupt:
            cleanup()
