import time
import board
import digitalio

# Setup pins
trigger = digitalio.DigitalInOut(board.D23)
trigger.direction = digitalio.Direction.OUTPUT

echo = digitalio.DigitalInOut(board.D24)
echo.direction = digitalio.Direction.INPUT

buzzer = digitalio.DigitalInOut(board.D18)
buzzer.direction = digitalio.Direction.OUTPUT

history = []

def get_distance():
    trigger.value = True
    time.sleep(0.00001)
    trigger.value = False

    timeout = time.monotonic_ns() + 100_000_000  # 100ms timeout

    while not echo.value:
        if time.monotonic_ns() > timeout:
            raise RuntimeError("Timeout waiting for echo high")
    start = time.monotonic_ns()

    timeout = time.monotonic_ns() + 100_000_000
    while echo.value:
        if time.monotonic_ns() > timeout:
            raise RuntimeError("Timeout waiting for echo low")
    stop = time.monotonic_ns()

    elapsed = (stop - start) / 1_000_000_000
    return (elapsed * 34300) / 2

def get_sensor_data():
    try:
        distance = get_distance()

        # ✅ Beep when distance is >= 12 cm
        buzzer.value = distance >= 12

        data = {"distance": round(distance, 2)}
        history.append(data)

        # ⏲️ Wait 2 seconds before next reading
        time.sleep(2)

        return data
    except Exception as e:
        return {"error": str(e)}

def get_history():
    return history

def clear_history():
    history.clear()
    return {"status": "cleared"}

def start_act2():
    buzzer.value = False
    return True

def cleanup():
    buzzer.value = False
