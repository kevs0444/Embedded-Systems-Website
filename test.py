import time
import board
import digitalio

# Pins
TRIG_PIN = board.D23  # Trigger
ECHO_PIN = board.D24  # Echo

# Setup
trigger = digitalio.DigitalInOut(TRIG_PIN)
trigger.direction = digitalio.Direction.OUTPUT

echo = digitalio.DigitalInOut(ECHO_PIN)
echo.direction = digitalio.Direction.INPUT

def get_distance():
    # Ensure trigger is low
    trigger.value = False
    time.sleep(0.05)

    # Send 10us pulse
    trigger.value = True
    time.sleep(0.00001)
    trigger.value = False

    # Initialize times
    start_time = time.time()
    end_time = start_time

    # Wait for echo to go HIGH
    timeout = start_time + 0.04  # 40ms timeout
    while not echo.value:
        if time.time() > timeout:
            return None  # Timeout, no echo received
        start_time = time.time()

    # Wait for echo to go LOW
    timeout = time.time() + 0.04
    while echo.value:
        if time.time() > timeout:
            return None  # Timeout, echo too long
        end_time = time.time()

    # Calculate distance
    pulse_duration = end_time - start_time
    distance_cm = pulse_duration * 17150  # cm
    return round(distance_cm, 2)

# Test
try:
    while True:
        dist = get_distance()
        if dist is not None:
            print("Distance:", dist, "cm")
        else:
            print("No echo detected")
        time.sleep(1)
except KeyboardInterrupt:
    print("Exiting...")
