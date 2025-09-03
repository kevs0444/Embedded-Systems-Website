from flask import Flask, render_template, jsonify, send_from_directory, redirect, url_for
import os
import signal
import act1

app = Flask(__name__)

# Global variable to track if act1 is running
act1_running = False

# Signal handler for graceful shutdown
def signal_handler(signum, frame):
    print("\nCleaning up and shutting down...")
    global act1_running
    if act1_running:
        act1.cleanup()
        act1_running = False
    os._exit(0)

@app.route("/")
def index():
    return render_template("index.html")

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
    data = act1.get_sensor_data()
    return jsonify(data)

@app.route("/history")
def history_data():
    data = act1.get_history()
    return jsonify(data)

@app.route("/clear-history")
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

# Serve static files
@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)

# Only cleanup on actual server shutdown
@app.teardown_appcontext
def shutdown_session(exception=None):
    if exception:
        global act1_running
        if act1_running:
            act1.cleanup()
            act1_running = False
            print("GPIO cleaned up on server error")

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