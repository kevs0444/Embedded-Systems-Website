# act6.py - GPS Module for NEO-6M MV2 Ublox
import threading
import time
import serial
import pynmea2

# Globals
running = False
location_data = {
    "lat": 14.5995,   # Default Manila latitude
    "lon": 120.9842,  # Default Manila longitude
    "fix": False,     # GPS fix status
    "satellites": 0,  # Number of satellites
    "altitude": 0,    # Altitude in meters
    "speed": 0        # Speed in knots
}
lock = threading.Lock()
thread = None
gps_serial = None

def parse_gps_data(data):
    """Parse NMEA sentences from GPS module"""
    try:
        if data.startswith('$GPGGA'):
            msg = pynmea2.parse(data)
            if msg.latitude != 0 and msg.longitude != 0:
                with lock:
                    location_data["lat"] = msg.latitude
                    location_data["lon"] = msg.longitude
                    location_data["altitude"] = msg.altitude
                    location_data["fix"] = (msg.gps_qual > 0)
                    location_data["satellites"] = msg.num_sats
        
        elif data.startswith('$GPRMC'):
            msg = pynmea2.parse(data)
            if hasattr(msg, 'spd_over_grnd'):
                with lock:
                    location_data["speed"] = msg.spd_over_grnd
    except (pynmea2.ParseError, serial.SerialException) as e:
        print(f"GPS parsing error: {e}")

def gps_loop():
    global running, gps_serial
    try:
        # Initialize serial connection to GPS module
        gps_serial = serial.Serial(
            port='/dev/ttyS0',  # GPIO serial port on Raspberry Pi
            baudrate=9600,
            timeout=1
        )
        
        print("GPS serial connection established")
        
        while running:
            try:
                data = gps_serial.readline().decode('ascii', errors='replace').strip()
                if data:
                    parse_gps_data(data)
            except (serial.SerialException, UnicodeDecodeError) as e:
                print(f"GPS read error: {e}")
                time.sleep(1)
                
    except serial.SerialException as e:
        print(f"Failed to initialize GPS: {e}")
        # Fallback to static data if GPS is not available
        while running:
            time.sleep(2)
    finally:
        if gps_serial and gps_serial.is_open:
            gps_serial.close()

def start_act6():
    """Start Act6 GPS monitoring loop."""
    global running, thread
    if not running:
        running = True
        thread = threading.Thread(target=gps_loop, daemon=True)
        thread.start()
        print("Act6 (GPS) started")
        return True
    return False

def stop_act6():
    """Stop Act6 GPS monitoring loop."""
    global running, thread, gps_serial
    running = False
    if thread:
        thread.join(timeout=1)
        thread = None
    if gps_serial and gps_serial.is_open:
        gps_serial.close()
    print("Act6 (GPS) stopped")

def get_location():
    """Return the latest GPS location as dict."""
    with lock:
        return dict(location_data)