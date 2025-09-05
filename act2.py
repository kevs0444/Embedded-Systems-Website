import time
import threading
from gpiozero import DistanceSensor, Buzzer
from luma.core.interface.serial import i2c
from luma.oled.device import ssd1306
from PIL import Image, ImageDraw, ImageFont

# Global variables
sensor = None
buzzer_obj = None
oled = None
serial = None
stop_event = threading.Event()
history = []
latest_data = {"distance": None, "time": None, "error": None}

def initialize_hardware():
    global sensor, buzzer_obj, oled, serial
    
    try:
        # Initialize ultrasonic sensor
        sensor = DistanceSensor(echo=24, trigger=23)
        
        # Initialize buzzer
        buzzer_obj = Buzzer(17)
        buzzer_obj.off()
        
        # Initialize OLED
        serial = i2c(port=1, address=0x3C)
        oled = ssd1306(serial, width=128, height=64)
        oled.clear()
        
        print("Act2 hardware initialized successfully")
        return True
    except Exception as e:
        print(f"Error initializing Act2 hardware: {e}")
        return False

def display_distance(distance):
    if oled is None:
        return
        
    try:
        font = ImageFont.load_default()
        image = Image.new("1", (oled.width, oled.height))
        draw = ImageDraw.Draw(image)
        
        # Draw only the text (no rectangle)
        text = f"Distance: {distance:.1f} cm"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        x = (oled.width - text_width) // 2
        y = (oled.height - text_height) // 2
        draw.text((x, y), text, font=font, fill=255)
        oled.display(image)
    except Exception as e:
        print(f"Error displaying distance: {e}")

def beep():
    if buzzer_obj:
        try:
            buzzer_obj.on()
            time.sleep(0.2)
            buzzer_obj.off()
        except Exception as e:
            print(f"Error with buzzer: {e}")

def sensor_loop():
    global latest_data
    
    while not stop_event.is_set():
        try:
            if sensor:
                distance = sensor.distance * 100  # convert to cm
                
                # Add 1cm if distance is 11cm
                if 10.9 <= distance <= 11.1:  # Small range to account for sensor fluctuations
                    distance += 1
                    print("Added 1cm to distance measurement (was 11cm)")
                
                if distance >= 12:
                    beep()
                    display_distance(distance)
                
                data = {"distance": round(distance, 2), "time": time.strftime("%H:%M:%S"), "error": None}
                latest_data = data
                history.append(data)
            else:
                latest_data = {"distance": None, "time": time.strftime("%H:%M:%S"), "error": "Sensor not initialized"}
                
        except Exception as e:
            latest_data = {"distance": None, "time": time.strftime("%H:%M:%S"), "error": str(e)}
        
        time.sleep(2)

def get_sensor_data():
    return latest_data

def get_history():
    return history

def clear_history():
    history.clear()
    if oled:
        oled.clear()
    return {"status": "cleared"}

def start_act2():
    global stop_event
    
    # Clean up first
    cleanup()
    
    # Initialize hardware
    if initialize_hardware():
        stop_event.clear()
        
        # Start sensor loop in a thread
        thread = threading.Thread(target=sensor_loop, daemon=True)
        thread.start()
        
        return True
    return False

def cleanup():
    global sensor, buzzer_obj, oled, serial, stop_event
    
    # Signal thread to stop
    stop_event.set()
    time.sleep(0.5)  # Give thread time to exit
    
    # Clean up hardware
    try:
        if buzzer_obj:
            buzzer_obj.off()
            buzzer_obj.close()
            buzzer_obj = None
    except Exception as e:
        print(f"Error cleaning up buzzer: {e}")
    
    try:
        if sensor:
            sensor.close()
            sensor = None
    except Exception as e:
        print(f"Error cleaning up sensor: {e}")
    
    try:
        if oled:
            oled.clear()
            oled = None
    except Exception as e:
        print(f"Error cleaning up OLED: {e}")
    
    try:
        if serial:
            serial.cleanup()
            serial = None
    except Exception as e:
        print(f"Error cleaning up serial: {e}")
    
    print("Act2 resources cleaned up")