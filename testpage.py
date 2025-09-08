from flask import Flask, render_template, jsonify
import act2

app = Flask(__name__, static_folder='static', template_folder='templates')

@app.route("/")
def index():
    return render_template("act2.html")

@app.route("/sensor2")
def sensor2():
    return jsonify(act2.get_sensor_data())

if __name__=="__main__":
    act2.start_act2()
    app.run(debug=True, host="0.0.0.0", port=5000)
