import random
from flask import jsonify

# For testing only
last_read = {"distance1": 0, "distance2":0, "temperature":0, "humidity":0}

def start_act2():
    return True

def get_sensor_data():
    # Generate random values for testing
    last_read["distance1"] = random.randint(10, 100)
    last_read["distance2"] = random.randint(10, 100)
    last_read["temperature"] = random.randint(20, 40)
    last_read["humidity"] = random.randint(30, 80)
    return last_read
