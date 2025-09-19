import threading
import time
import serial
import pynmea2

# Globals
running = False
location_data = {
    "lat": None,
    "lon": None,
    "fix": False,
    "satellites": 0,
    "altitude": None,
    "speed": None,
    "timestamp": None
}
lock = threading.Lock()
thread = None
gps_serial = None

last_fix_status = None
last_sat_count = None

def parse_gps_data(data):
    global last_fix_status, last_sat_count
    try:
        if data.startswith('$GPGGA'):
            msg = pynmea2.parse(data)
            with lock:
                location_data["lat"] = msg.latitude
                location_data["lon"] = msg.longitude
                location_data["altitude"] = msg.altitude
                location_data["satellites"] = msg.num_sats
                location_data["fix"] = (msg.gps_qual > 0)

            # Debug logs
            if location_data["fix"] != last_fix_status:
                if location_data["fix"]:
                    print(f"[GPS] ✅ Fix acquired! Lat={msg.latitude}, Lon={msg.longitude}, Sats={msg.num_sats}")
                else:
                    print("[GPS] ❌ Lost fix, searching...")
                last_fix_status = location_data["fix"]

            if location_data["satellites"] != last_sat_count:
                print(f"[GPS] 📡 Satellites in view: {location_data['satellites']}")
                last_sat_count = location_data["satellites"]

        elif data.startswith('$GPRMC'):
            msg = pynmea2.parse(data)
            with lock:
                # RMC status 'A' = active fix, 'V' = void
                if getattr(msg, "status", "V") == "A":
                    location_data["fix"] = True
                location_data["lat"] = msg.latitude or location_data["lat"]
                location_data["lon"] = msg.longitude or location_data["lon"]
                location_data["speed"] = getattr(msg, 'spd_over_grnd', None)
                location_data["timestamp"] = f"{msg.datestamp} {msg.timestamp}"

    except (pynmea2.ParseError, serial.SerialException, UnicodeDecodeError) as e:
        print(f"[GPS parsing error] {e}")

def gps_loop():
    global running, gps_serial
    try:
        gps_serial = serial.Serial('/dev/serial0', 9600, timeout=1)
        print("[GPS] Serial connection established on /dev/serial0")
        while running:
            line = gps_serial.readline()
            if line:
                parse_gps_data(line.decode('ascii', errors='ignore').strip())
            time.sleep(0.1)
    except serial.SerialException as e:
        print(f"[GPS ERROR] {e}")
    finally:
        if gps_serial and gps_serial.is_open:
            gps_serial.close()
            print("[GPS] Serial connection closed")

def start_act6():
    global running, thread
    if not running:
        running = True
        thread = threading.Thread(target=gps_loop, daemon=True)
        thread.start()
        return True
    return False

def stop_act6():
    global running, thread, gps_serial
    running = False
    if thread:
        thread.join(timeout=2)
        thread = None
    if gps_serial and gps_serial.is_open:
        gps_serial.close()

def get_location():
    with lock:
        return dict(location_data)
