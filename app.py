# app.py - Main Flask Server with Main Menu + Activity Management
from flask import Flask, render_template, jsonify, send_from_directory, redirect, url_for, request
import os
import signal
import time
import threading
import json
import act1
import act2  # Updated version with deferred GPIO setup
import act4
from act4 import get_sensor_data, start_act4, stop_act4, email_sent, email_sent_lock
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='static', template_folder='templates')

# -------------------- Globals --------------------
current_activity = None  # 'act1', 'act2', or None

# Path for saving historical data (Act2)
ACT2_HISTORY_DIR = "/home/systemshapers/Embedded-Systems-Website/historicaldataact2"
ACT2_HISTORY_FILE = os.path.join(ACT2_HISTORY_DIR, "historical_data_act2.json")


# Path for saving historical data (Act4)
ACT4_HISTORY_DIR = "/home/systemshapers/Embedded-Systems-Website/historicaldataact4"
ACT4_HISTORY_FILE = os.path.join(ACT4_HISTORY_DIR, "gas.json")

# Track last save time for Act2 sensor data
last_act2_save = time.time()

# -------------------- Signal handler --------------------
def signal_handler(signum, frame):
    print("\nCleaning up and shutting down...")
    stop_current_activity()
    exit(0)

# -------------------- Helper Functions --------------------
def stop_current_activity():
    global current_activity
    if current_activity == 'act1':
        act1.cleanup()
        print("Act1 monitoring stopped and GPIO cleaned up")
    elif current_activity == 'act2':
        act2.stop_act2_loop()
        act2.cleanup()
        save_act2_history()
        print("Act2 monitoring stopped and GPIO cleaned up")
    current_activity = None

def save_act2_history():
    """Save Act2 history to JSON file."""
    try:
        if not os.path.exists(ACT2_HISTORY_DIR):
            os.makedirs(ACT2_HISTORY_DIR, exist_ok=True)
        current_history = act2.get_history()
        with open(ACT2_HISTORY_FILE, "w") as f:
            json.dump(current_history, f, indent=4)
        print(f"Act2 history saved ({len(current_history)} records)")
    except Exception as e:
        print(f"Error saving Act2 history: {e}")

def load_act2_history():
    """Load Act2 history from JSON file."""
    try:
        if os.path.exists(ACT2_HISTORY_FILE):
            # Check if file is empty
            if os.path.getsize(ACT2_HISTORY_FILE) == 0:
                print("Act2 history file is empty, starting fresh")
                # Initialize with empty array
                with open(ACT2_HISTORY_FILE, "w") as f:
                    json.dump([], f)
                return
            
            with open(ACT2_HISTORY_FILE, "r") as f:
                content = f.read().strip()
                if not content:  # Empty file
                    print("Act2 history file is empty, starting fresh")
                    # Initialize with empty array
                    with open(ACT2_HISTORY_FILE, "w") as f:
                        json.dump([], f)
                    return
                    
                history = json.loads(content)
                
            if isinstance(history, list):
                act2.set_history(history)
                print(f"Act2 history loaded ({len(history)} records)")
            else:
                print("Invalid Act2 history format, starting fresh")
                # Initialize with empty array
                with open(ACT2_HISTORY_FILE, "w") as f:
                    json.dump([], f)
        else:
            print("No Act2 history file found, creating empty one")
            if not os.path.exists(ACT2_HISTORY_DIR):
                os.makedirs(ACT2_HISTORY_DIR, exist_ok=True)
            # Create empty file
            with open(ACT2_HISTORY_FILE, "w") as f:
                json.dump([], f)
    except json.JSONDecodeError:
        print("JSON decode error in Act2 history file, creating new one")
        # Create empty file
        with open(ACT2_HISTORY_FILE, "w") as f:
            json.dump([], f)
    except Exception as e:
        print(f"Error loading Act2 history: {e}")

def save_sensor_data_to_history(sensor_data):
    """Save individual sensor readings to history file"""
    try:
        if not os.path.exists(ACT2_HISTORY_DIR):
            os.makedirs(ACT2_HISTORY_DIR, exist_ok=True)
        
        # Load existing data
        if os.path.exists(ACT2_HISTORY_FILE):
            with open(ACT2_HISTORY_FILE, "r") as f:
                existing_data = json.load(f)
        else:
            existing_data = []
        
        # Add timestamp and append new data
        data_with_timestamp = {
            "temperature": float(sensor_data.get('temperature', 0)),
            "humidity": float(sensor_data.get('humidity', 0)),
            "distance1": float(sensor_data.get('distance1', 0)),
            "distance2": float(sensor_data.get('distance2', 0)),
            "timestamp": datetime.now().isoformat()
        }
        
        # Only add valid readings (not 0 values)
        if (data_with_timestamp["temperature"] > 0 and 
            data_with_timestamp["humidity"] > 0):
            existing_data.append(data_with_timestamp)
            
            # Keep only last 100 records to prevent file from growing too large
            existing_data = existing_data[-100:]
            
            # Save back to file
            with open(ACT2_HISTORY_FILE, "w") as f:
                json.dump(existing_data, f, indent=2)
            
            print(f"Sensor data saved: Temp: {data_with_timestamp['temperature']}°C, Hum: {data_with_timestamp['humidity']}%")
    except Exception as e:
        print(f"Error saving sensor data to history: {e}")

def process_act2_historical_data(raw_data):
    """Process Act2 raw data into the format expected by the frontend chart"""
    if not isinstance(raw_data, list) or len(raw_data) == 0:
        return {
            "labels": [],
            "avg_temp": [],
            "peak_temp": [],
            "avg_hum": [],
            "peak_hum": []
        }
    
    # Group data by minute
    minute_data = {}
    for reading in raw_data:
        # Check if we have the required fields
        if not all(key in reading for key in ['temperature', 'humidity', 'timestamp']):
            continue
            
        try:
            # Skip invalid readings
            if reading['temperature'] in [0, None, "0"] or reading['humidity'] in [0, None, "0"]:
                continue
                
            # Parse timestamp and round to minute
            timestamp_str = reading['timestamp']
            if 'Z' in timestamp_str:
                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            else:
                timestamp = datetime.fromisoformat(timestamp_str)
                
            minute_key = timestamp.replace(second=0, microsecond=0)
            
            if minute_key not in minute_data:
                minute_data[minute_key] = {
                    'temps': [],
                    'hums': []
                }
            
            # Add valid readings
            minute_data[minute_key]['temps'].append(float(reading['temperature']))
            minute_data[minute_key]['hums'].append(float(reading['humidity']))
        except (ValueError, KeyError) as e:
            print(f"Error processing timestamp: {e}")
            continue
    
    # Sort by time and process
    sorted_minutes = sorted(minute_data.keys())
    labels = []
    avg_temps = []
    peak_temps = []
    avg_hums = []
    peak_hums = []
    
    for minute in sorted_minutes:
        data = minute_data[minute]
        if data['temps'] and data['hums']:
            labels.append(minute.strftime('%H:%M'))
            avg_temps.append(round(sum(data['temps']) / len(data['temps']), 1))
            peak_temps.append(round(max(data['temps']), 1))
            avg_hums.append(round(sum(data['hums']) / len(data['hums']), 1))
            peak_hums.append(round(max(data['hums']), 1))
    
    # Return the last 20 minutes
    return {
        "labels": labels[-20:],
        "avg_temp": avg_temps[-20:],
        "peak_temp": peak_temps[-20:],
        "avg_hum": avg_hums[-20:],
        "peak_hum": peak_hums[-20:]
    }

# -------------------- Main Menu --------------------
@app.route("/")
def index():
    return render_template("index.html")

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
    return redirect(url_for("index"))

# -------------------- ACTIVITY 2 --------------------
@app.route("/act2")
def act2_page():
    global current_activity
    if current_activity:
        stop_current_activity()
        time.sleep(1)
    load_act2_history()
    success = act2.start_act2_loop()
    current_activity = 'act2' if success else None
    
    # Force refresh of historical data on page load
    try:
        if os.path.exists(ACT2_HISTORY_FILE) and os.path.getsize(ACT2_HISTORY_FILE) > 0:
            with open(ACT2_HISTORY_FILE, "r") as f:
                content = f.read().strip()
                if content:
                    raw_data = json.loads(content)
                    # Update the in-memory history
                    act2.set_history(raw_data)
    except Exception as e:
        print(f"Error refreshing Act2 history on page load: {e}")
    
    return render_template("act2.html")

# Correct endpoint for act2.js fetch
@app.route("/act2_sensor")
def act2_sensor():
    global last_act2_save
    data = act2.get_sensor_data()
    
    # Add buzzer status for UI
    buz_status = "ON" if data.get("distance1",0)>=12 or data.get("distance2",0)>=12 else "OFF"
    data["buzzer"] = buz_status
    
    # Save sensor data to history file every 30 seconds
    current_time = time.time()
    if current_time - last_act2_save >= 30:  # Save every 30 seconds
        try:
            save_sensor_data_to_history(data)
            last_act2_save = current_time
        except Exception as e:
            print(f"Error saving sensor data: {e}")
    
    return jsonify(data)

@app.route("/act2_hist")
def act2_hist():
    """Return historical data for Act2 in the same format as Act1"""
    try:
        # First try to load from the JSON file
        if os.path.exists(ACT2_HISTORY_FILE) and os.path.getsize(ACT2_HISTORY_FILE) > 0:
            with open(ACT2_HISTORY_FILE, "r") as f:
                content = f.read().strip()
                if content:  # Only parse if file has content
                    raw_data = json.loads(content)
                else:
                    raw_data = []
        else:
            # Fall back to in-memory history if file doesn't exist
            raw_data = act2.get_history()
        
        # Process the data into chart format
        processed_data = process_act2_historical_data(raw_data)
        return jsonify(processed_data)
    except json.JSONDecodeError:
        print("JSON decode error in Act2 history file, returning empty data")
        return jsonify({
            "labels": [],
            "avg_temp": [],
            "peak_temp": [],
            "avg_hum": [],
            "peak_hum": []
        })
    except Exception as e:
        print(f"Error loading Act2 historical data: {e}")
        return jsonify({
            "labels": [],
            "avg_temp": [],
            "peak_temp": [],
            "avg_hum": [],
            "peak_hum": []
        })

@app.route("/save_minute_stats", methods=["POST"])
def save_minute_stats():
    """Save minute statistics from Act2 frontend to JSON file"""
    try:
        data = request.json
        # Load existing data
        if os.path.exists(ACT2_HISTORY_FILE) and os.path.getsize(ACT2_HISTORY_FILE) > 0:
            with open(ACT2_HISTORY_FILE, "r") as f:
                existing_data = json.load(f)
        else:
            existing_data = []
        
        # Add timestamp and append new data
        data_with_timestamp = {
            "temperature": float(data.get('avgTemp', 0)),
            "humidity": float(data.get('avgHum', 0)),
            "timestamp": datetime.now().isoformat()
        }
        existing_data.append(data_with_timestamp)
        
        # Keep only last 100 records to prevent file from growing too large
        existing_data = existing_data[-100:]
        
        # Save back to file
        with open(ACT2_HISTORY_FILE, "w") as f:
            json.dump(existing_data, f, indent=2)
        
        print(f"Minute stats saved: {data.get('time', 'Unknown')} - Temp: {data.get('avgTemp', 0)}°C, Hum: {data.get('avgHum', 0)}%")
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Error saving minute stats: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/history2")
def history2():
    return jsonify(act2.get_history())

@app.route("/save_hist", methods=["POST"])
def save_hist():
    try:
        payload = request.json
        if payload:
            # optional: you could update act2 internal history if needed
            print("Received historical data save:", len(payload.get("labels",[])), "points")
        return jsonify({"status":"ok"})
    except Exception as e:
        return jsonify({"status":"error","message":str(e)}),500

@app.route("/clear_hist", methods=["POST"])
def clear_hist():
    return clear_history2()

@app.route("/clear_history2", methods=["POST"])
def clear_history2():
    try:
        os.makedirs(ACT2_HISTORY_DIR, exist_ok=True)
        with open(ACT2_HISTORY_FILE, "w") as f:
            json.dump([], f, indent=2)
        act2.set_history([])
        print("Act2 history cleared")
        return jsonify({"status": "success", "message": "Historical data cleared"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/stop_act2")
def stop_act2():
    global current_activity
    if current_activity == 'act2':
        act2.stop_act2_loop()
        act2.cleanup()
        save_act2_history()
        current_activity = None
        print("Act2 monitoring stopped and GPIO cleaned up")
    return redirect(url_for("index"))

# -------------------- ACTIVITY 3 --------------------
@app.route("/act3")
def act3_page():
    # If Act3 also has GPIO or background tasks, handle here.
    # For now, just render the HTML page.
    global current_activity
    if current_activity:
        stop_current_activity()
        time.sleep(1)
    current_activity = 'act3'
    return render_template("act3.html")

# -------------------- ACTIVITY 4 --------------------
@app.route("/act4")
def act4_page():
    global current_activity
    if current_activity:
        stop_current_activity()
        time.sleep(1)
    success = act4.start_act4()
    current_activity = 'act4' if success else None
    return render_template("act4.html")

@app.route('/act4_email_status')
def act4_email_status():
    with email_sent_lock:
        sent = email_sent
        # Determine source
        sensor_data_snapshot = act4.get_sensor_data()
        if sensor_data_snapshot["gas"] >= 200:
            source = "gas"
        elif sensor_data_snapshot["vibration"]:
            source = "vibration"
        else:
            source = "unknown"

        return jsonify({"sent": sent, "source": source})

@app.route("/act4_sensor")
def act4_sensor():
    """Return gas, vibration, buzzer data for frontend"""
    return jsonify(act4.get_sensor_data())

@app.route("/act4_hist")
def act4_hist():
    try:
        history = act4.load_high_gas_history()
        return jsonify(history[-5:])  # only last 5 events
    except Exception as e:
        print(f"Error loading Act4 history: {e}")
        return jsonify([])

@app.route("/stop_act4")
def stop_act4_page():
    global current_activity
    if current_activity == 'act4':
        act4.stop_act4()
        current_activity = None
        print("Act4 monitoring stopped and GPIO cleaned up")
    return redirect(url_for("index"))

# -------------------- Static Files --------------------
@app.route('/static/<path:path>')
def send_static(path):
    full_path = os.path.join(app.static_folder, path)
    if os.path.isfile(full_path):
        return send_from_directory(app.static_folder, path)
    return "", 204

# -------------------- Main --------------------
if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Initialize Act2 history file
    if not os.path.exists(ACT2_HISTORY_DIR):
        os.makedirs(ACT2_HISTORY_DIR, exist_ok=True)
    if not os.path.exists(ACT2_HISTORY_FILE) or os.path.getsize(ACT2_HISTORY_FILE) == 0:
        with open(ACT2_HISTORY_FILE, "w") as f:
            json.dump([], f)
    
    load_act2_history()
    try:
        app.run(debug=True, host="0.0.0.0", port=5000)
    finally:
        stop_current_activity()
        print("GPIO cleaned up. Goodbye!")