from flask import Flask, render_template, jsonify, send_from_directory, redirect, url_for, request
import os
import signal
import threading
import time
import act1, act2

app = Flask(__name__)

# Global variables to track if activities are running
current_activity = None  # 'act1', 'act2', or None

# -------------------- ACT2 Background Loop --------------------
# REMOVED the act2_loop() function - it's not needed since act2.py has its own sensor_loop()

# -------------------- Signal handler --------------------
def signal_handler(signum, frame):
    print("\nCleaning up and shutting down...")
    global current_activity
    if current_activity == 'act1':
        act1.cleanup()
    elif current_activity == 'act2':
        act2.cleanup()
    current_activity = None
    os._exit(0)

@app.route("/")
def index():
    return render_template("index.html")

# -------------------- Helper Functions --------------------
def stop_current_activity():
    global current_activity
    if current_activity == 'act1':
        act1.cleanup()
        print("Act1 monitoring stopped and GPIO cleaned up")
    elif current_activity == 'act2':
        act2.cleanup()
        print("Act2 monitoring stopped and GPIO cleaned up")
    current_activity = None

# -------------------- ACTIVITY 1 --------------------
@app.route("/act1")
def act1_page():
    global current_activity
    
    # Stop any currently running activity
    if current_activity:
        stop_current_activity()
        time.sleep(1)  # Give hardware time to reset
    
    # Start Activity 1
    success = act1.start_act1()
    if success:
        current_activity = 'act1'
        print("Act1 monitoring started successfully")
    else:
        print("Failed to start Act1 monitoring")
    
    return render_template("act1.html")

@app.route("/sensor")
def sensor_data():
    return jsonify(act1.get_sensor_data())

@app.route("/history")
def history_data():
    return jsonify(act1.get_history())

@app.route("/clear_history", methods=["POST"])
def clear_history():
    return jsonify(act1.clear_history())

@app.route("/stop_act1")
def stop_act1():
    global current_activity
    if current_activity == 'act1':
        act1.cleanup()
        current_activity = None
        print("Act1 monitoring stopped and GPIO cleaned up")
    return redirect(url_for('index'))

# -------------------- ACTIVITY 2 --------------------
@app.route("/act2")
def act2_page():
    global current_activity
    
    # Stop any currently running activity
    if current_activity:
        stop_current_activity()
        time.sleep(1)  # Give hardware time to reset
    
    # Start Activity 2
    success = act2.start_act2()
    if success:
        current_activity = 'act2'
        print("Act2 monitoring started successfully")
    else:
        print("Failed to start Act2 monitoring")
    
    return render_template("act2.html")

@app.route("/sensor2")
def sensor2_data():
    data = act2.get_sensor_data()
    # Add buzzer status based on distance - match the frontend logic
    if data["distance"] is not None and data["distance"] >= 12:
        data["buzzer"] = "ON"
    else:
        data["buzzer"] = "OFF"
    return jsonify(data)

@app.route("/history2")
def history2_data():
    history = act2.get_history()
    # Format history for all sensors
    labels = [entry["time"] for entry in history]
    distance = [entry["distance"] for entry in history]
    temperature = [entry["temperature"] for entry in history]
    humidity = [entry["humidity"] for entry in history]
    return jsonify({
        "labels": labels, 
        "distance": distance,
        "temperature": temperature,
        "humidity": humidity
    })

@app.route("/clear_history2", methods=["POST"])
def clear_history2():
    return jsonify(act2.clear_history())

@app.route("/stop_act2")
def stop_act2():
    global current_activity
    if current_activity == 'act2':
        act2.cleanup()
        current_activity = None
        print("Act2 monitoring stopped and GPIO cleaned up")
    return redirect(url_for('index'))

# -------------------- STATIC + CLEANUP --------------------
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.teardown_appcontext
def shutdown_session(exception=None):
    global current_activity
    if exception:
        if current_activity == 'act1':
            act1.cleanup()
            current_activity = None
            print("GPIO cleaned up for Act1 on server error")
        elif current_activity == 'act2':
            act2.cleanup()
            current_activity = None
            print("GPIO cleaned up for Act2 on server error")

if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        app.run(debug=False, host="0.0.0.0")
    except Exception as e:
        print(f"Error running server: {e}")
        if current_activity == 'act1':
            act1.cleanup()
            current_activity = None
        elif current_activity == 'act2':
            act2.cleanup()
            current_activity = None