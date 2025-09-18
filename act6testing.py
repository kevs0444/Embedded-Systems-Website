import serial
import pynmea2
import time

SERIAL_PORT = '/dev/serial0'
BAUD_RATE = 9600

ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
print("📡 Reading GPS... Ctrl+C to stop")

try:
    while True:
        line = ser.readline().decode('ascii', errors='ignore').strip()
        if line.startswith('$GPGGA') or line.startswith('$GPRMC'):
            try:
                msg = pynmea2.parse(line)
                if hasattr(msg, 'latitude') and hasattr(msg, 'longitude'):
                    print(f"📍 Latitude: {msg.latitude:.6f}, Longitude: {msg.longitude:.6f}")
                if hasattr(msg, 'num_sats'):
                    print(f"🛰️ Satellites: {msg.num_sats}")
            except pynmea2.ParseError:
                continue
        time.sleep(0.5)
except KeyboardInterrupt:
    print("\n🛑 GPS stopped")
finally:
    ser.close()