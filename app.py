from flask import Flask, render_template, jsonify, send_from_directory, redirect, url_for, request
import os
import signal
import time
import json
import act1, act2

app = Flask(__name__, static_folder='static', template_folder='templates')

# Track current activity
current_activity = None  # 'act1', 'act2', or None

# Path for saving historical data (Act2)
ACT2_HISTORY_DIR = "/home/systemshapers/Embedded-Systems-Website/historicaldataact2"
ACT2_HISTORY_FILE = os.path.join(ACT2_HISTORY_DIR, "historical_data_act2.json")

# -------------------- Signal handler --------------------
def signal_handler(signum, frame):
    print("\nCleaning up and shutting down...")
    global current_activity
    if current_activity == 'act1':
        act1.cleanup()
    elif current_activity == 'act2':
        act2.cleanup()
        save_act2_history()
    current_activity = None
    os._exit(0)

# -------------------- Helper Functions --------------------
def stop_current_activity():
    global current_activity
    if current_activity == 'act1':
        act1.cleanup()
        print("Act1 monitoring stopped and GPIO cleaned up")
    elif current_activity == 'act2':
        act2.cleanup()
        save_act2_history()
        print("Act2 monitoring stopped and GPIO cleaned up")
    current_activity = None

def save_act2_history():
    """Save Act2 history to JSON file without duplication."""
    try:
        if not os.path.exists(ACT2_HISTORY_DIR):
            os.makedirs(ACT2_HISTORY_DIR, exist_ok=True)

        # Just save the current in-memory history directly
        current_history = act2.get_history()
        with open(ACT2_HISTORY_FILE, "w") as f:
            json.dump(current_history, f, indent=4)

        print(f"Act2 history saved ({len(current_history)} records)")

    except Exception as e:
        print(f"Error saving Act2 history: {e}")

def load_act2_history():
    """Load Act2 history from JSON file if it exists and merge into act2."""
    try:
        if os.path.exists(ACT2_HISTORY_FILE):
            with open(ACT2_HISTORY_FILE, "r") as f:
                history = json.load(f)
            if isinstance(history, list):
                act2.set_history(history)
                print(f"Act2 history loaded from {ACT2_HISTORY_FILE} ({len(history)} records)")
            else:
                print("Invalid Act2 history file format, starting fresh")
        else:
            print("No Act2 history file found, starting fresh")
    except Exception as e:
        print(f"Error loading Act2 history: {e}")

# -------------------- ACTIVITY 1 --------------------
@app.route("/act1")
def act1_page():
    global current_activity
    if current_activity:
        stop_current_activity()
        time.sleep(1)
    success = act1.start_act1()
    current_activity = 'act1' if success else None
    return render_template("act1.html")

@app.route("/sensor")
def sensor_data():
    return jsonify(act1.get_sensor_data())

@app.route("/history")
def history():
    # Return the historical data in the expected format
    hist_data = act1.get_history()
    return jsonify(hist_data)

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
    return redirect(url_for("index"))

# -------------------- ACTIVITY 2 --------------------
@app.route("/act2")
def act2_page():
    global current_activity
    if current_activity:
        stop_current_activity()
        time.sleep(1)
    
    # Load history BEFORE starting the activity
    load_act2_history()
    
    success = act2.start_act2()
    current_activity = 'act2' if success else None
    return render_template("act2.html")

@app.route("/sensor2")
def sensor_data2():
    return jsonify(act2.get_sensor_data())

@app.route("/history2")
def history2():
    data = act2.get_history()
    labels, distance = [], []
    for entry in data:
        labels.append(f"{entry.get('date','')} {entry.get('time','')}")
        distance.append(entry.get("distance"))
    return jsonify({
        "labels": labels,
        "distance": distance
    })

@app.route("/clear_history2", methods=["POST"])
def clear_history2():
    try:
        # Make sure directory exists
        os.makedirs(ACT2_HISTORY_DIR, exist_ok=True)

        # Overwrite file with empty list
        with open(ACT2_HISTORY_FILE, "w") as f:
            json.dump([], f, indent=2)

        # Also reset in-memory history in act2
        act2.set_history([])

        print("Act2 history cleared")
        return jsonify({"status": "ok", "message": "Historical data cleared"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/stop_act2")
def stop_act2():
    global current_activity
    if current_activity == 'act2':
        act2.cleanup()
        save_act2_history()
        current_activity = None
        print("Act2 monitoring stopped and GPIO cleaned up")
    return redirect(url_for("index"))

# -------------------- Static Files --------------------
@app.route('/static/<path:path>')
def send_static(path):
    full_path = os.path.join(app.static_folder, path)
    if os.path.isfile(full_path):
        return send_from_directory(app.static_folder, path)
    return "", 204  # Prevent 404 for missing static files

# -------------------- Main --------------------
@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Load Act2 history at startup
    load_act2_history()

    try:
        app.run(debug=True, host="0.0.0.0", port=5000)
    finally:
        if current_activity == 'act1':
            act1.cleanup()
        elif current_activity == 'act2':
            act2.cleanup()
            save_act2_history()
        print("GPIO cleaned up. Goodbye!")