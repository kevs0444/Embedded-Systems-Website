# act1.py
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

# -------------------- Hardware globals --------------------
dht_device = None
buzzer = None

# -------------------- In-memory runtime --------------------
sensor_data = {"temperature": None, "humidity": None, "buzzer": "OFF", "time": None, "error": False}
stop_event = threading.Event()

# buffers for 1-minute aggregation
temp_readings_buffer = []
humidity_readings_buffer = []
buffer_start_time = None

# -------------------- Historical data storage --------------------
HIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "historicaldataact1")
HIST_FILE = os.path.join(HIST_DIR, "historical_data_act1.json")
os.makedirs(HIST_DIR, exist_ok=True)

# New canonical structure (always ensure these keys exist)
historical_data = {
    "labels": [],
    "avg_temp": [],
    "avg_hum": [],
    "peak_temp": [],
    "peak_hum": []
}

last_historical_save = None

# store 1-minute intervals
HISTORICAL_INTERVAL = 60  # seconds (1 minute)
MAX_HISTORICAL_POINTS = 1440  # keep up to 24 hours of 1-min points

# -------------------- Hardware init / cleanup --------------------
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

        # quick initial read attempts
        time.sleep(2)
        for _ in range(3):
            try:
                test_temp = dht_device.temperature
                test_hum = dht_device.humidity
                if test_temp is not None and test_hum is not None:
                    print(f"Initial reading - Temp: {test_temp}°C, Humidity: {test_hum}%")
                    return True
            except Exception:
                time.sleep(2)
                continue
        # even if initial reads failed, still return True (sensor may recover) - or return False to abort start
        # return False
        return True
    except Exception as e:
        print(f"Error initializing hardware: {e}")
        cleanup(silent=True)
        return False

def cleanup(silent=False):
    """Stop threads, save pending buffer if any, and release hardware."""
    global dht_device, buzzer

    if not silent:
        print("Cleaning up GPIO...")

    # signal threads to stop
    stop_event.set()

    # If there are pending buffered readings, try to save them if possible
    try:
        if (temp_readings_buffer or humidity_readings_buffer):
            # guard: only save if we have at least one valid numeric reading
            save_averaged_data()
    except Exception as e:
        # Avoid exceptions during cleanup from crashing atexit handlers
        if not silent:
            print(f"Error while trying to save averaged data during cleanup: {e}")

    # try to release buzzer/dht resources
    if buzzer is not None:
        try:
            buzzer.value = False
            buzzer.deinit()
        except Exception:
            pass
        buzzer = None

    if dht_device is not None:
        try:
            dht_device.exit()
        except Exception:
            pass
        dht_device = None

    # small pause to ensure threads can join if needed
    time.sleep(0.5)

# -------------------- Historical persistence --------------------
def load_historical_data():
    """Load historical data from HIST_FILE. Support multiple legacy shapes and convert to canonical schema."""
    global historical_data, last_historical_save
    try:
        if os.path.exists(HIST_FILE):
            with open(HIST_FILE, "r") as f:
                raw = json.load(f)

            # raw could be: {"data": {...}, "last_save": "..."} OR direct historic dict OR legacy {labels, temp, hum}
            if isinstance(raw, dict) and "data" in raw and isinstance(raw["data"], dict):
                loaded = raw["data"]
            else:
                loaded = raw

            # if loaded is a list of entries (older style), attempt to convert
            if isinstance(loaded, list):
                # convert list of {date,time,distance} style -> labels + arrays (not likely for act1 but defensive)
                labels = []
                avg_temp = []
                avg_hum = []
                peak_temp = []
                peak_hum = []
                for entry in loaded:
                    # try to extract
                    date = entry.get("date", "")
                    tm = entry.get("time", "")
                    labels.append(f"{date} {tm}".strip())
                    # try different keys
                    if "temperature" in entry:
                        vtemp = entry.get("temperature")
                        avg_temp.append(vtemp)
                        peak_temp.append(vtemp)
                    elif "temp" in entry:
                        avg_temp.append(entry.get("temp"))
                        peak_temp.append(entry.get("temp"))
                    else:
                        avg_temp.append(None)
                        peak_temp.append(None)

                    if "humidity" in entry:
                        vhum = entry.get("humidity")
                        avg_hum.append(vhum)
                        peak_hum.append(vhum)
                    elif "hum" in entry:
                        avg_hum.append(entry.get("hum"))
                        peak_hum.append(entry.get("hum"))
                    else:
                        avg_hum.append(None)
                        peak_hum.append(None)

                historical_data = {
                    "labels": labels,
                    "avg_temp": avg_temp,
                    "avg_hum": avg_hum,
                    "peak_temp": peak_temp,
                    "peak_hum": peak_hum
                }
            elif isinstance(loaded, dict):
                # try to detect many possible key names and normalize to canonical names
                labels = loaded.get("labels") or loaded.get("times") or loaded.get("timestamps") or []
                # try many variants for avg/peak keys
                avg_temp = loaded.get("avg_temp") or loaded.get("temp_avg") or loaded.get("avgTemp") or loaded.get("temp") or []
                peak_temp = loaded.get("peak_temp") or loaded.get("temp_peak") or loaded.get("peakTemp") or []
                avg_hum = loaded.get("avg_hum") or loaded.get("hum_avg") or loaded.get("avgHum") or loaded.get("hum") or []
                peak_hum = loaded.get("peak_hum") or loaded.get("hum_peak") or loaded.get("peakHum") or []

                # If file had only temp & hum arrays (legacy), treat them as avg and set peaks = same
                if avg_temp and not peak_temp:
                    peak_temp = list(avg_temp)
                if avg_hum and not peak_hum:
                    peak_hum = list(avg_hum)

                # Ensure arrays align in length
                min_len = min(len(labels), len(avg_temp or []), len(avg_hum or [])) if labels else 0
                if min_len == 0:
                    # fallback: if labels empty but arrays present, infer labels from array length
                    length = max(len(avg_temp), len(avg_hum), len(peak_temp), len(peak_hum))
                    labels = labels or [datetime.now().strftime("%H:%M") for _ in range(length)]

                # Finally set canonical structure - pad/truncate to the same length
                length = len(labels)
                def normalize_list(lst):
                    if not isinstance(lst, list):
                        return [None] * length
                    if len(lst) < length:
                        return lst + [None] * (length - len(lst))
                    return lst[-length:]

                historical_data = {
                    "labels": labels[-MAX_HISTORICAL_POINTS:],
                    "avg_temp": normalize_list(avg_temp)[-MAX_HISTORICAL_POINTS:],
                    "avg_hum": normalize_list(avg_hum)[-MAX_HISTORICAL_POINTS:],
                    "peak_temp": normalize_list(peak_temp)[-MAX_HISTORICAL_POINTS:],
                    "peak_hum": normalize_list(peak_hum)[-MAX_HISTORICAL_POINTS:]
                }
            else:
                # unknown format -> reset
                historical_data = {
                    "labels": [],
                    "avg_temp": [],
                    "avg_hum": [],
                    "peak_temp": [],
                    "peak_hum": []
                }

            # read last_save if present (compatible if raw had last_save)
            last_historical_save_str = None
            if isinstance(raw, dict):
                last_historical_save_str = raw.get("last_save") or raw.get("lastsave")
            if last_historical_save_str:
                try:
                    last_historical_save = datetime.fromisoformat(last_historical_save_str)
                except Exception:
                    last_historical_save = None

            print(f"Loaded {len(historical_data['labels'])} historical data points from {HIST_FILE}")
    except Exception as e:
        print(f"Error loading historical data: {e}")
        historical_data = {
            "labels": [],
            "avg_temp": [],
            "avg_hum": [],
            "peak_temp": [],
            "peak_hum": []
        }

def save_historical_data():
    """Persist historical_data to disk safely."""
    global last_historical_save
    try:
        payload = {
            "data": historical_data,
            "last_save": last_historical_save.isoformat() if last_historical_save else None
        }
        with open(HIST_FILE, "w") as f:
            json.dump(payload, f, indent=2)
        # print for debugging
        print(f"Saved {len(historical_data['labels'])} historical points to {HIST_FILE}")
    except Exception as e:
        print(f"Error saving historical data: {e}")

# -------------------- Buffering & aggregation --------------------
def add_to_buffer(temperature, humidity):
    """Add reading to buffers and save average/peak if interval reached."""
    global buffer_start_time
    if temperature is None or humidity is None:
        return

    now = datetime.now()
    if buffer_start_time is None:
        buffer_start_time = now

    try:
        temp_readings_buffer.append(float(temperature))
        humidity_readings_buffer.append(float(humidity))
    except Exception:
        # ignore values we cannot parse
        pass

    elapsed = (now - buffer_start_time).total_seconds() if buffer_start_time else 0

    # if we've reached the interval duration (or we have an excessive number of samples), save
    if elapsed >= HISTORICAL_INTERVAL:
        save_averaged_data()

def save_averaged_data():
    """Compute avg & peak from buffers, append to historical_data and persist to disk."""
    global buffer_start_time, last_historical_save, historical_data

    # ensure canonical keys exist to avoid KeyError
    for k in ("labels", "avg_temp", "avg_hum", "peak_temp", "peak_hum"):
        historical_data.setdefault(k, [])

    if not temp_readings_buffer or not humidity_readings_buffer:
        # nothing to save
        buffer_start_time = None
        return False

    try:
        avg_temp = sum(temp_readings_buffer) / len(temp_readings_buffer)
        avg_humidity = sum(humidity_readings_buffer) / len(humidity_readings_buffer)
        peak_temp = max(temp_readings_buffer)
        peak_humidity = max(humidity_readings_buffer)

        # use timestamp of buffer start (human friendly)
        timestamp = buffer_start_time.strftime("%I:%M %p") if buffer_start_time else datetime.now().strftime("%I:%M %p")
        historical_data["labels"].append(timestamp)
        historical_data["avg_temp"].append(round(avg_temp, 1))
        historical_data["avg_hum"].append(round(avg_humidity, 1))
        historical_data["peak_temp"].append(round(peak_temp, 1))
        historical_data["peak_hum"].append(round(peak_humidity, 1))

        # trim to max allowed
        for k in ("labels", "avg_temp", "avg_hum", "peak_temp", "peak_hum"):
            if len(historical_data[k]) > MAX_HISTORICAL_POINTS:
                historical_data[k] = historical_data[k][-MAX_HISTORICAL_POINTS:]

        last_historical_save = datetime.now()
        save_historical_data()
    except Exception as e:
        print(f"Error computing/saving averaged data: {e}")
        return False
    finally:
        # reset buffers regardless (so we don't re-save the same samples)
        temp_readings_buffer.clear()
        humidity_readings_buffer.clear()
        buffer_start_time = None

    return True

# -------------------- Sensor reading loop --------------------
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

                    # buffer for 1-minute aggregation
                    add_to_buffer(temperature, humidity)
                    error_count = 0

                    # Buzzer logic
                    if buzzer is not None:
                        if temperature >= 38:
                            # variable beep timing depending on temperature
                            beep_delay = max(0.1, 1.0 - 0.35 * (temperature - 38))
                            buzzer.value = True
                            time.sleep(0.1)
                            buzzer.value = False
                            time.sleep(beep_delay)
                            sensor_data["buzzer"] = "ON"
                            # continue to next loop iteration (sensor_data already set)
                            continue
                        else:
                            buzzer.value = False
                            sensor_data["buzzer"] = "OFF"

        except RuntimeError as e:
            # DHT read error - retry after short sleep
            print(f"DHT Read Error: {e}")
            error_count += 1
            sensor_data["error"] = True
            time.sleep(2)
        except Exception as e:
            print(f"Unexpected error in sensor loop: {e}")
            error_count += 1
            sensor_data["error"] = True

        # If errors accumulate, try reinitializing hardware
        if error_count >= 3:
            print("Too many errors, reinitializing hardware...")
            initialize_hardware()
            error_count = 0

        # standard delay between reads
        time.sleep(5)

# -------------------- Cleanup thread (old data) --------------------
def cleanup_thread():
    while not stop_event.is_set():
        time.sleep(3600)  # every hour
        if not stop_event.is_set():
            clean_old_data()

def clean_old_data():
    """Remove historical points older than 24 hours (by label approximated to current year)."""
    if not historical_data["labels"]:
        return

    now = datetime.now()
    cutoff_time = now - timedelta(hours=24)
    keep_from = 0
    for i, label in enumerate(historical_data["labels"]):
        try:
            # label format is H:M or maybe 'Mon DD HH:MM AM' - try several formats
            # We'll try to parse as "%Y %H:%M" using current year if possible
            try:
                point_time = datetime.strptime(f"{now.year} {label}", "%Y %H:%M")
            except Exception:
                # fallback: just keep the recent half if parsing fails
                point_time = now
            if point_time >= cutoff_time:
                keep_from = i
                break
        except Exception:
            continue

    if keep_from > 0:
        for k in ("labels", "avg_temp", "avg_hum", "peak_temp", "peak_hum"):
            historical_data[k] = historical_data[k][keep_from:]
        save_historical_data()
        print(f"Cleaned up {keep_from} old data points")

# -------------------- Control helpers --------------------
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
    # return the canonical historical_data dict
    return historical_data

def clear_history():
    """Clear in-memory and on-disk historical data."""
    global historical_data, last_historical_save, buffer_start_time
    try:
        historical_data = {
            "labels": [],
            "avg_temp": [],
            "avg_hum": [],
            "peak_temp": [],
            "peak_hum": []
        }
        last_historical_save = None
        buffer_start_time = None
        temp_readings_buffer.clear()
        humidity_readings_buffer.clear()
        if os.path.exists(HIST_FILE):
            os.remove(HIST_FILE)
            print("Historical data file deleted.")
        return {"status": "success", "message": "Historical data cleared"}
    except Exception as e:
        return {"status": "error", "message": f"Error clearing data: {str(e)}"}

# -------------------- Register cleanup handlers --------------------
atexit.register(cleanup)
signal.signal(signal.SIGINT, lambda s, f: cleanup())
signal.signal(signal.SIGTERM, lambda s, f: cleanup())

# -------------------- Main (for standalone run) --------------------
if __name__ == "__main__":
    if start_act1():
        try:
            while True:
                print(f"Temp: {sensor_data['temperature']}°C, Humidity: {sensor_data['humidity']}%")
                time.sleep(5)
        except KeyboardInterrupt:
            cleanup()
