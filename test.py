import time
import board
import digitalio

# -------------------- Pins --------------------
TRIG_PIN = board.D27   # GPIO27 (Physical Pin 13)
ECHO_PIN = board.D22   # GPIO22 (Physical Pin 15)

# -------------------- Setup --------------------
trigger = digitalio.DigitalInOut(TRIG_PIN)
trigger.direction = digitalio.Direction.OUTPUT
trigger.value = False

echo = digitalio.DigitalInOut(ECHO_PIN)
echo.direction = digitalio.Direction.INPUT

print("Ultrasonic Sensor 2 Test (TRIG=GPIO27, ECHO=GPIO22)")
time.sleep(2)

def get_distance():
    # Send trigger pulse
    trigger.value = False
    time.sleep(0.0005)

    trigger.value = True
    time.sleep(0.00001)
    trigger.value = False

    # Wait for echo to go HIGH
    timeout_start = time.time()
    while not echo.value:
        if time.time() - timeout_start > 0.1:
            return None
    pulse_start = time.time()

    # Wait for echo to go LOW
    timeout_start = time.time()
    while echo.value:
        if time.time() - timeout_start > 0.1:
            return None
    pulse_end = time.time()

    # Calculate distance
    pulse_duration = pulse_end - pulse_start
    distance_cm = pulse_duration * 34300 / 2

    if 2 <= distance_cm <= 400:
        return round(distance_cm, 1)
    return None

try:
    while True:
        distance = get_distance()
        if distance is not None:
            print(f"Distance: {distance} cm")
        else:
            print("Out of range / timeout")
        time.sleep(1)

except KeyboardInterrupt:
    print("Test stopped by user")

finally:
    trigger.deinit()
    echo.deinit()
    print("GPIO released")
