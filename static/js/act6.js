let map;
let marker;
let errorNotificationShown = false;
let mapInitialized = false;

let lastLat = null;
let lastLon = null;
let lastCity = ""; // store current city name

// =========================
// Map Styles
// =========================
const lightMapStyle = [];
const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
    { featureType: "poi", elementType: "geometry", stylers: [{ color: "#282828" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#383838" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] }
];

// =========================
// Accelerometer Chart Setup
// =========================
let accelChart;
let accelData = {
    labels: [],
    datasets: [
        { label: "Accel X", borderColor: "rgba(255, 99, 132, 1)", backgroundColor: "rgba(255, 99, 132, 0.2)", data: [], fill: false, tension: 0.4 },
        { label: "Accel Y", borderColor: "rgba(54, 162, 235, 1)", backgroundColor: "rgba(54, 162, 235, 0.2)", data: [], fill: false, tension: 0.4 },
        { label: "Accel Z", borderColor: "rgba(75, 192, 192, 1)", backgroundColor: "rgba(75, 192, 192, 0.2)", data: [], fill: false, tension: 0.4 }
    ]
};

// =========================
// Gyroscope Chart Setup
// =========================
let gyroChart;
let gyroData = {
    labels: [],
    datasets: [
        { label: "Gyro X", borderColor: "rgba(255, 206, 86, 1)", backgroundColor: "rgba(255, 206, 86, 0.2)", data: [], fill: false, tension: 0.4 },
        { label: "Gyro Y", borderColor: "rgba(153, 102, 255, 1)", backgroundColor: "rgba(153, 102, 255, 0.2)", data: [], fill: false, tension: 0.4 },
        { label: "Gyro Z", borderColor: "rgba(255, 159, 64, 1)", backgroundColor: "rgba(255, 159, 64, 0.2)", data: [], fill: false, tension: 0.4 }
    ]
};

// =========================
// Initialize Google Map
// =========================
function initMap() {
    try {
        const loadingLocation = { lat: 0, lng: 0 };
        const savedTheme = localStorage.getItem('theme') || 'light';

        map = new google.maps.Map(document.getElementById("map"), {
            center: loadingLocation,
            zoom: 2,
            styles: savedTheme === 'dark' ? darkMapStyle : lightMapStyle,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
        });

        marker = new google.maps.Marker({
            position: loadingLocation,
            map: map,
            title: "Waiting for GPS...",
            visible: false,
            icon: { url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", scaledSize: new google.maps.Size(40, 40) }
        });

        mapInitialized = true;
        console.log("Google Maps initialized (GPS loading...)");

        showGPSLoadingNotification();

        setInterval(updateGPSLocation, 2000); // GPS every 2s
        setInterval(updateSensorCharts, 2000); // Sensors every 2s

        initTheme();
        initNotifications();
        initSpeakerButton(); // initialize speaker button
    } catch (error) {
        console.error("Error initializing Google Maps:", error);
        showErrorNotification();
    }
}

// =========================
// Update GPS
// =========================
function updateGPSLocation() {
    fetch('/act6_data')
        .then(res => res.json())
        .then(data => {
            if (data.lat && data.lon) {
                lastLat = data.lat;
                lastLon = data.lon;
                lastCity = data.city || "";
            }

            if (lastLat !== null && lastLon !== null) {
                const newPos = { lat: lastLat, lng: lastLon };
                if (mapInitialized && marker) {
                    marker.setPosition(newPos);
                    marker.setVisible(true);
                    if (data.fix) {
                        map.setCenter(newPos);
                        map.setZoom(16);
                    }
                }
            } else {
                updateGPSDisplayLoading();
            }

            updateGPSDisplay(data);
            updateStatus(true);
            hideErrorNotification();
        })
        .catch(err => {
            console.error("Error fetching GPS data:", err);
            updateStatus(false);
            showErrorNotification();
        });
}

// =========================
// Update Sensor Charts
// =========================
function updateSensorCharts() {
    fetch('/act6_data')
        .then(res => res.json())
        .then(data => {
            const now = new Date().toLocaleTimeString();

            if (data.accel) {
                accelData.labels.push(now);
                accelData.datasets[0].data.push(data.accel.x);
                accelData.datasets[1].data.push(data.accel.y);
                accelData.datasets[2].data.push(data.accel.z);
                if (accelData.labels.length > 10) {
                    accelData.labels.shift();
                    accelData.datasets.forEach(ds => ds.data.shift());
                }
                accelChart.update('active');
            }

            if (data.gyro) {
                gyroData.labels.push(now);
                gyroData.datasets[0].data.push(data.gyro.x);
                gyroData.datasets[1].data.push(data.gyro.y);
                gyroData.datasets[2].data.push(data.gyro.z);
                if (gyroData.labels.length > 10) {
                    gyroData.labels.shift();
                    gyroData.datasets.forEach(ds => ds.data.shift());
                }
                gyroChart.update('active');
            }
        })
        .catch(err => console.error("Error fetching sensor data:", err));
}

// =========================
// GPS Display Functions
// =========================
function updateGPSDisplayLoading() {
    document.getElementById('latitude').textContent = "--";
    document.getElementById('longitude').textContent = "--";

    const badge = document.getElementById('gpsStatusBadge');
    const text = document.getElementById('gpsStatusText');
    const icon = document.getElementById('gpsIcon');
    if (badge) badge.className = 'badge warn';
    if (text) text.textContent = 'Loading...';
    if (icon) icon.innerHTML = '<img src="/static/icons/finding.png" alt="GPS Loading Icon">';
}

function updateGPSDisplay(data) {
    if (!data.lat || !data.lon) return;

    document.getElementById('latitude').textContent = data.lat.toFixed(6);
    document.getElementById('longitude').textContent = data.lon.toFixed(6);

    const badge = document.getElementById('gpsStatusBadge');
    const text = document.getElementById('gpsStatusText');
    const icon = document.getElementById('gpsIcon');

    if (data.fix) {
        badge.className = 'badge ok';
        text.textContent = 'Acquired';
        icon.innerHTML = '<img src="/static/icons/gps-on.png" alt="GPS On Icon">';
    } else {
        badge.className = 'badge danger';
        text.textContent = 'Searching';
        icon.innerHTML = '<img src="/static/icons/gps-off.png" alt="GPS Off Icon">';
    }

    document.getElementById('latitudeBadge').textContent = data.lat >= 0 ? 'N' : 'S';
    document.getElementById('longitudeBadge').textContent = data.lon >= 0 ? 'E' : 'W';
    document.getElementById('satelliteCard').textContent = data.satellites;

    lastCity = data.city || "";
}

// =========================
// Speaker Button (Activity 6) - DEBUG VERSION
// =========================
function initSpeakerButton() {
    const btn = document.getElementById('speakerBtn');
    if (!btn) return;

    let voices = [];
    function loadVoices() { voices = window.speechSynthesis.getVoices(); }
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = loadVoices;

    function speakText(text) {
        if (!text) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voices.find(v => v.lang.includes('en')) || voices[0];
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;
        window.speechSynthesis.speak(utterance);
    }

    btn.addEventListener('click', () => {
        fetch('/speak_text')
            .then(res => res.json())
            .then(data => speakText(data.text))
            .catch(err => speakText("Unable to fetch GPS data. Please try again."));
    });
}

// =========================
// Theme & Notifications
// =========================
function initTheme() {
    const themeBtn = document.getElementById('themeBtn');
    const themeIcon = document.getElementById('themeIcon');
    const saved = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', saved);

    if (themeIcon) {
        themeIcon.src = saved === 'light' ? '/static/icons/dark-mode.png' : '/static/icons/light-mode.png';
        themeIcon.alt = saved === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const current = document.body.getAttribute('data-theme') || 'light';
            const next = current === 'light' ? 'dark' : 'light';
            document.body.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            themeIcon.src = next === 'light' ? '/static/icons/dark-mode.png' : '/static/icons/light-mode.png';
            themeIcon.alt = next === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
            if (map) map.setOptions({ styles: next === 'dark' ? darkMapStyle : lightMapStyle });
        });
    }
}

function initNotifications() {
    const closeNotif = document.getElementById('closeNotif');
    if (closeNotif) closeNotif.addEventListener('click', hideErrorNotification);
}

function showGPSLoadingNotification() {
    const n = document.createElement("div");
    n.className = "notification gps-loading";
    n.innerHTML = "⏳ GPS is loading... searching for satellites";
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 5000);
}

function showErrorNotification() {
    const n = document.getElementById('errorNotif');
    if (!n || errorNotificationShown) return;
    n.classList.add('show');
    n.style.display = 'block';
    errorNotificationShown = true;
}

function hideErrorNotification() {
    const n = document.getElementById('errorNotif');
    if (!n) return;
    n.classList.remove('show');
    n.style.display = 'none';
    errorNotificationShown = false;
}

// =========================
// Status & Time
// =========================
function updateStatus(connected) {
    const st = document.getElementById('status');
    if (st) st.textContent = connected ? '🟢' : '🔴';
}

function updateTime() {
    const now = new Date().toLocaleTimeString();
    const footerTime = document.getElementById('time');
    const cardTime = document.getElementById('timeCard');
    if (footerTime) footerTime.textContent = now;
    if (cardTime) cardTime.textContent = now;
}

// =========================
// DOM Ready - UPDATED
// =========================
document.addEventListener('DOMContentLoaded', () => {
    setInterval(updateTime, 1000);

    // Initialize speaker button immediately
    initSpeakerButton();

    const accelCtx = document.getElementById("accelChart").getContext("2d");
    accelChart = new Chart(accelCtx, {
        type: "line",
        data: accelData,
        options: {
            responsive: true,
            animation: { duration: 1800, easing: "easeInOutCubic" },
            plugins: { legend: { position: "top" } },
            scales: { x: { title: { display: true, text: "Time" } }, y: { title: { display: true, text: "Acceleration (g)" } } },
            interaction: { intersect: false, mode: 'index' },
            elements: { line: { tension: 0.4 } }
        }
    });

    const gyroCtx = document.getElementById("gyroChart").getContext("2d");
    gyroChart = new Chart(gyroCtx, {
        type: "line",
        data: gyroData,
        options: {
            responsive: true,
            animation: { duration: 1800, easing: "easeInOutCubic" },
            plugins: { legend: { position: "top" } },
            scales: { x: { title: { display: true, text: "Time" } }, y: { title: { display: true, text: "Angular Velocity (°/s)" } } },
            interaction: { intersect: false, mode: 'index' },
            elements: { line: { tension: 0.4 } }
        }
    });

    setTimeout(() => {
        if (!mapInitialized && typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            initMap();
        } else if (!mapInitialized) {
            console.error("Google Maps API failed to load");
            showErrorNotification();
        }
    }, 1000);
});