import smbus2
import time

# PCF8591 default I2C address
PCF8591_ADDR = 0x48
AIN0 = 0x40  # Control byte for channel 0

# Initialize I2C (Bus 1 for Raspberry Pi)
bus = smbus2.SMBus(1)

print("MQ-2 Sensor Test with PCF8591 (Raspberry Pi)")
time.sleep(1)

try:
    while True:
        # Read from AIN0 (gas sensor analog input)
        bus.write_byte(PCF8591_ADDR, AIN0)
        value = bus.read_byte(PCF8591_ADDR)  # Read 8-bit ADC value (0–255)
        
        print(f"MQ-2 Value: {value}")
        time.sleep(1)

except KeyboardInterrupt:
    print("\nProgram stopped by user.")
    bus.close()
