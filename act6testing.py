# act6testing.py - Test script for NEO-6M GPS on Raspberry Pi 5
import serial
import time
import sys

def parse_gpgga(sentence):
    """Parse GPGGA sentence to extract latitude and longitude in decimal degrees."""
    try:
        parts = sentence.split(",")
        if parts[0] != "$GPGGA":
            return None

        # Position Fix Indicator is part[6]
        fix_status = parts[6]
        if fix_status == "0":
            return "NO_FIX"

        lat_raw = parts[2]
        lat_dir = parts[3]
        lon_raw = parts[4]
        lon_dir = parts[5]

        if not lat_raw or not lon_raw:
            return None

        # Latitude conversion
        lat_deg = float(lat_raw[:2])
        lat_min = float(lat_raw[2:])
        latitude = lat_deg + (lat_min / 60.0)
        if lat_dir == "S":
            latitude = -latitude

        # Longitude conversion
        lon_deg = float(lon_raw[:3])
        lon_min = float(lon_raw[3:])
        longitude = lon_deg + (lon_min / 60.0)
        if lon_dir == "W":
            longitude = -longitude

        return latitude, longitude
    except Exception:
        return None

def open_gps_serial():
    """Open GPS on GPIO UART (serial0)."""
    try:
        gps = serial.Serial("/dev/serial0", baudrate=9600, timeout=1)
        print("✅ Connected to GPS on /dev/serial0")
        return gps
    except Exception as e:
        print(f"❌ Could not open /dev/serial0: {e}")
        return None

def main():
    gps = open_gps_serial()
    if gps is None:
        print("⚠️ No GPS module found on /dev/serial0. Check wiring and raspi-config.")
        sys.exit(1)

    print("📡 Listening to GPS data... (Press Ctrl+C to stop)")
    try:
        while True:
            line = gps.readline().decode("ascii", errors="replace").strip()
            print("RAW:", line)   # 👈 Add this line
            if line.startswith("$GPGGA"):
                coords = parse_gpgga(line)
                if coords == "NO_FIX":
                    print("🔎 Searching for satellites...")
                elif coords:
                    lat, lon = coords
                    print(f"✅ Fix acquired → Latitude: {lat:.6f}, Longitude: {lon:.6f}")
        time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nExiting...")
        sys.exit(0)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
