import serial
import pynmea2
import time

SERIAL_PORT = '/dev/serial0'
BAUD_RATE = 9600
MIN_SATS = 4  # minimum satellites for reliable fix

def has_fix(msg):
    """Check if GPS has a reliable fix."""
    if hasattr(msg, 'latitude') and hasattr(msg, 'longitude') and hasattr(msg, 'num_sats'):
        if msg.num_sats >= MIN_SATS and (msg.latitude != 0.0 or msg.longitude != 0.0):
            return True
    return False

def test_gps():
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print("📡 GPS Test started (Ctrl+C to stop)...")
        start_time = time.time()
        fix_acquired = False

        while True:
            line = ser.readline().decode('ascii', errors='ignore').strip()
            if line.startswith('$GPGGA') or line.startswith('$GPRMC'):
                try:
                    msg = pynmea2.parse(line)

                    if has_fix(msg):
                        if not fix_acquired:
                            fix_acquired = True
                            ttff = time.time() - start_time
                            print(f"✅ First GPS Fix Acquired in {ttff:.1f} seconds")

                        print(f"📍 Latitude: {msg.latitude:.6f}, Longitude: {msg.longitude:.6f}")
                        print(f"🛰️ Satellites in view: {msg.num_sats}")
                    else:
                        print("⏳ Waiting for reliable GPS fix...")

                except pynmea2.ParseError:
                    print("⚠️ Parse error, ignoring line")
                    continue
            else:
                print("⏳ Waiting for GPS data...")

            time.sleep(1)

    except KeyboardInterrupt:
        print("\n🛑 GPS Test stopped by user")

    except serial.SerialException as e:
        print(f"❌ Serial error: {e}")

    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()
        print("🔌 Serial connection closed")

if __name__ == "__main__":
    test_gps()
