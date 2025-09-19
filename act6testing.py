import serial
import pynmea2

SERIAL_PORT = '/dev/serial0'
BAUD_RATE = 9600

ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
print("📡 Reading GPS... Ctrl+C to stop")

try:
    while True:
        line = ser.readline().decode('ascii', errors='ignore').strip()
        if not line.startswith(('$GPGGA', '$GPRMC')):
            continue

        try:
            msg = pynmea2.parse(line)

            if line.startswith('$GPGGA'):
                print(f"🛰️ Satellites: {msg.num_sats}")
                if msg.gps_qual > 0:  # 1 = GPS fix, 2 = DGPS fix
                    print(f"📍 Latitude: {msg.latitude:.6f}, Longitude: {msg.longitude:.6f}")
                else:
                    print("⏳ Waiting for GPS fix...")

            elif line.startswith('$GPRMC'):
                print(f"⏰ Time (UTC): {msg.datestamp} {msg.timestamp}")

        except pynmea2.ParseError:
            continue

except KeyboardInterrupt:
    print("\n🛑 GPS stopped")
finally:
    ser.close()
