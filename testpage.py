import smbus2
import time
import board
import digitalio
from gpiozero import Buzzer, LED

# -----------------------------
# PCF8591 Setup (Analog MQ-2)
# -----------------------------
PCF8591_ADDR = 0x48
AIN0 = 0x40  # Control byte for channel 0 (MQ-2 AO)
bus = smbus2.SMBus(1)

# -----------------------------
# Vibration Sensor Setup
# -----------------------------
vib_pin = digitalio.DigitalInOut(board.D26)   # Vibration DO -> GPIO26 (Pin 37)
vib_pin.direction = digitalio.Direction.INPUT

# -----------------------------
# Buzzer + LEDs Setup
# -----------------------------
BUZZER_PIN = 17  # Pin 11
GREEN_LED_PIN = 5  # Pin 29 -> vibration
RED_LED_PIN = 6    # Pin 31 -> gas

buzzer = Buzzer(BUZZER_PIN)
green_led = LED(GREEN_LED_PIN)
red_led = LED(RED_LED_PIN)

# Initialize off
buzzer.off()
green_led.off()
red_led.off()

print("MQ-2 + Vibration + Buzzer + LEDs Test (GPIO5/6)")
time.sleep(1)

# -----------------------------
# Main Loop
# -----------------------------
try:
    while True:
        # MQ-2 analog read
        bus.write_byte(PCF8591_ADDR, AIN0)
        gas_value = bus.read_byte(PCF8591_ADDR)  # 0–255 range
        print(f"MQ-2 Value: {gas_value}")

        # Detection
        gas_detected = gas_value > 200  # Adjust threshold as needed
        vib_detected = vib_pin.value    # Active HIGH

        # Gas detection
        if gas_detected:
            red_led.on()
            print("⚠️ Gas Detected!")
        else:
            red_led.off()

        # Vibration detection
        if vib_detected:
            green_led.on()
            print("⚠️ Vibration Detected!")
        else:
            green_led.off()

        # Buzzer if either detected
        if gas_detected or vib_detected:
            buzzer.on()
        else:
            buzzer.off()
            print("No gas / vibration.")

        print("-----")
        time.sleep(1)

except KeyboardInterrupt:
    print("\nProgram stopped by user.")
    buzzer.off()
    green_led.off()
    red_led.off()
    bus.close()
