from flask import Flask, render_template, jsonify, send_from_directory, redirect, url_for, request
import os
import signal
import threading
import time
import act1, act2

app = Flask(__name__)

# Global variables to track if activities are running
act1_running = False
act2_running = False

# -------------------- ACTIVITY 2 Globals --------------------
act2_latest = {"distance": None, "time": None, "error": None}
act2_history = []

# -------------------- ACT2 Background Loop --------------------
def act2_loop():
    global act2_latest, act2_history, act2_running
    while act2_running:  # only run if activity is active
        try:
            data = act2.get_sensor_data()
            data["time"] = time.strftime("%H:%M:%S")

            act2_latest = data
            act2_history.append(data)
        except Exception as e:
            act2_latest = {
                "distance": None,
                "time": time.strftime("%H:%M:%S"),
                "error": str(e)
            }
        time.sleep(2)  # 🔁 get distance every 2 seconds

# -------------------- Signal handler --------------------
def signal_handler(signum, frame):
    print("\nCleaning up and shutting down...")
    global act1_running, act2_running
    if act1_running:
        act1.cleanup()
        act1_running = False
    if act2_running:
        act2.cleanup()
        act2_running = False
    os._exit(0)

@app.route("/")
def index():
    return render_template("index.html")

# -------------------- ACTIVITY 1 --------------------
@app.route("/act1")
def act1_page():
    global act1_running
    if not act1_running:
        success = act1.start_act1()
        if success:
            act1_running = True
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
    global act1_running
    if act1_running:
        act1.cleanup()
        act1_running = False
        print("Act1 monitoring stopped and GPIO cleaned up")
    return redirect(url_for('index'))

# -------------------- ACTIVITY 2 --------------------
@app.route("/act2")
def act2_page():
    global act2_running
    if not act2_running:
        success = act2.start_act2()
        if success:
            act2_running = True
            print("Act2 ultrasonic started successfully")

            # start background thread
            t = threading.Thread(target=act2_loop, daemon=True)
            t.start()
        else:
            print("Failed to start Act2")
    return render_template("act2.html")

@app.route("/sensor2")
def sensor2_data():
    return jsonify(act2_latest)

@app.route("/history2")
def history2_data():
    return jsonify(act2_history)

@app.route("/clear_history2", methods=["POST"])
def clear_history2():
    act2_history.clear()
    return jsonify({"status": "cleared"})

@app.route("/stop_act2")
def stop_act2():
    global act2_running
    if act2_running:
        act2.cleanup()
        act2_running = False
        print("Act2 monitoring stopped and GPIO cleaned up")
    return redirect(url_for('index'))

# -------------------- STATIC + CLEANUP --------------------
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

@app.teardown_appcontext
def shutdown_session(exception=None):
    global act1_running, act2_running
    if exception:
        if act1_running:
            act1.cleanup()
            act1_running = False
            print("GPIO cleaned up for Act1 on server error")
        if act2_running:
            act2.cleanup()
            act2_running = False
            print("GPIO cleaned up for Act2 on server error")

if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        app.run(debug=False, host="0.0.0.0")
    except Exception as e:
        print(f"Error running server: {e}")
        if act1_running:
            act1.cleanup()
            act1_running = False
        if act2_running:
            act2.cleanup()
            act2_running = False
