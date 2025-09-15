#!/usr/bin/env python3
# simple_gps_test.py
import serial
import time

print("🔍 Testing GPS on /dev/ttyAMA0...")
print("Press Ctrl+C to stop after 10 seconds\n")

try:
    # Try to open the serial port
    ser = serial.Serial('/dev/ttyAMA0', baudrate=9600, timeout=2)
    print("✅ Successfully opened /dev/ttyAMA0")
    print("📡 Listening for GPS data (10 seconds)...")
    
    start_time = time.time()
    data_count = 0
    
    while time.time() - start_time < 10:
        try:
            # Read a line from GPS
            line = ser.readline().decode('ascii', errors='ignore').strip()
            if line and line.startswith('$GP'):
                data_count += 1
                print(f"📨 [{data_count}] {line}")
                
                # Show info for common sentence types
                if line.startswith('$GPGGA'):
                    print("   📍 Position data")
                elif line.startswith('$GPRMC'):
                    print("   🧭 Navigation data")
                elif line.startswith('$GPGSV'):
                    print("   🛰️  Satellite data")
                elif line.startswith('$GPGSA'):
                    print("   📊 GPS DOP and active satellites")
                    
        except UnicodeDecodeError:
            print("⚠️  Could not decode data - trying different baud rate?")
        except Exception as e:
            print(f"❌ Error: {e}")
            break
    
    print(f"\n📊 Summary: Received {data_count} NMEA sentences")
    
    if data_count == 0:
        print("\n❌ No GPS data received. Possible issues:")
        print("1. Wrong baud rate - try 4800, 9600, 115200")
        print("2. GPS module not powered properly")
        print("3. TX/RX wires swapped")
        print("4. GPS module needs time to get fix (1-5 minutes)")
        print("5. Need to be outdoors for better signal")
    
except serial.SerialException as e:
    print(f"❌ Failed to open serial port: {e}")
    print("\nTry these solutions:")
    print("1. Run with sudo: sudo python3 simple_gps_test.py")
    print("2. Enable UART: Add 'enable_uart=1' to /boot/config.txt and reboot")
    print("3. Check physical connections")

except Exception as e:
    print(f"❌ Unexpected error: {e}")

finally:
    if 'ser' in locals() and ser.is_open:
        ser.close()
        print("🔌 Serial port closed")