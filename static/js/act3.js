/* ============================
   act3.js - Motion Sensor & Camera Dashboard
   ============================ */

let realChart, histChart;
let events = [];

// ----------------- Initialize Charts -----------------
function initCharts() {
    const ctx1 = document.getElementById('realChart').getContext('2d');
    const ctx2 = document.getElementById('histChart').getContext('2d');

    realChart = new Chart(ctx1, {
        type: 'line',
        data: { labels: [], datasets: [{
            label: 'Motion Events',
            borderColor: '#ff5722',
            backgroundColor: 'rgba(255,87,34,0.2)',
            data: [],
            fill: true,
            tension: 0.3
        }]},
        options: {
            scales: {
                x: { ticks: { color: '#666' }},
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#666' }}
            }
        }
    });

    histChart = new Chart(ctx2, {
        type: 'bar',
        data: { labels: [], datasets: [{
            label: 'Events per Minute',
            backgroundColor: '#2196f3',
            data: []
        }]},
        options: {
            scales: {
                x: { ticks: { color: '#666' }},
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#666' }}
            }
        }
    });
}

// ----------------- Fetch Data -----------------
async function fetchData() {
    try {
        const resp = await fetch('/act3_sensor');
        if (!resp.ok) throw new Error("Sensor fetch failed");
        const data = await resp.json();

        // Update motion status
        const motionEl = document.getElementById('motionStatus');
        const motionBadge = document.getElementById('motionBadge');
        const buzzerText = document.getElementById('buzzerText');
        const buzzerBadge = document.getElementById('buzzerBadge');
        const buzzerIcon = document.getElementById('buzzerStatusIcon');

        motionEl.textContent = data.motion ? "Detected" : "None";
        motionBadge.className = data.motion ? "badge danger" : "badge ok";
        motionBadge.textContent = data.motion ? "⚠️ Motion" : "✅ Clear";

        if (data.buzzer) {
            buzzerText.textContent = "ALERT";
            buzzerBadge.className = "badge danger";
            buzzerIcon.src = "/static/icons/speaker.png";
        } else {
            buzzerText.textContent = "Standby";
            buzzerBadge.className = "badge ok";
            buzzerIcon.src = "/static/icons/mute.png";
        }

        // Update charts
        updateCharts(data);

        // Add to events log
        if (data.motion) {
            const event = {
                time: new Date().toLocaleTimeString(),
                type: "Motion Detected",
                action: "Snapshot taken"
            };
            events.unshift(event);
            updateEvents();
        }

        updateStatus(true);
        updateTime();
        hideErrorNotification();
    } catch (err) {
        console.error(err);
        updateStatus(false);
        showErrorNotification();
    }
}

// ----------------- Update Charts -----------------
function updateCharts(data) {
    const now = new Date().toLocaleTimeString();

    // Real-time chart
    realChart.data.labels.push(now);
    realChart.data.datasets[0].data.push(data.motion ? 1 : 0);
    if (realChart.data.labels.length > 20) {
        realChart.data.labels.shift();
        realChart.data.datasets[0].data.shift();
    }
    realChart.update();

    // Historical chart (bucketed per minute)
    const minute = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    let idx = histChart.data.labels.indexOf(minute);
    if (idx === -1) {
        histChart.data.labels.push(minute);
        histChart.data.datasets[0].data.push(1);
    } else {
        histChart.data.datasets[0].data[idx] += 1;
    }
    if (histChart.data.labels.length > 10) {
        histChart.data.labels.shift();
        histChart.data.datasets[0].data.shift();
    }
    histChart.update();
}

// ----------------- Events Log -----------------
function updateEvents() {
    const list = document.getElementById("eventsList");
    list.innerHTML = "";
    events.slice(0, 10).forEach(e => {
        const div = document.createElement("div");
        div.className = "event-item";
        div.innerHTML = `
            <span class="event-time">${e.time}</span>
            <span class="event-type">${e.type}</span>
            <span class="event-action">${e.action}</span>
        `;
        list.appendChild(div);
    });
}

// ----------------- Utility -----------------
function updateStatus(connected) {
    const st = document.getElementById("status");
    if (st) st.textContent = connected ? "🟢" : "🔴";
}
function updateTime() {
    const t = document.getElementById("time");
    if (t) t.textContent = new Date().toLocaleTimeString();
}
function showErrorNotification() {
    const n = document.getElementById("errorNotif");
    n.style.display = "block";
}
function hideErrorNotification() {
    const n = document.getElementById("errorNotif");
    n.style.display = "none";
}

// ----------------- Camera Controls -----------------
document.addEventListener("DOMContentLoaded", () => {
    initCharts();
    fetchData();
    setInterval(fetchData, 2000);

    document.getElementById("captureImage").addEventListener("click", async () => {
        const resp = await fetch("/act3_capture");
        const data = await resp.json();
        document.getElementById("captureInfo").textContent = data.message;
        document.getElementById("cameraPreview").innerHTML = `<img src="/static/captures/${data.file}" alt="Captured">`;
    });

    document.getElementById("startRecording").addEventListener("click", async () => {
        await fetch("/act3_start_record");
        document.getElementById("recordingInfo").textContent = "Recording...";
        document.getElementById("startRecording").disabled = true;
        document.getElementById("stopRecording").disabled = false;
    });

    document.getElementById("stopRecording").addEventListener("click", async () => {
        const resp = await fetch("/act3_stop_record");
        const data = await resp.json();
        document.getElementById("recordingInfo").textContent = data.message;
        document.getElementById("cameraPreview").innerHTML = `<video src="/static/captures/${data.file}" controls autoplay></video>`;
        document.getElementById("startRecording").disabled = false;
        document.getElementById("stopRecording").disabled = true;
    });

    document.getElementById("clearData").addEventListener("click", () => {
        histChart.data.labels = [];
        histChart.data.datasets[0].data = [];
        histChart.update();
    });

    document.getElementById("refreshEvents").addEventListener("click", updateEvents);
});
