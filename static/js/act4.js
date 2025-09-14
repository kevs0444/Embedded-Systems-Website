/* ============================
   act4.js - Gas + Vibration + Buzzer Dashboard
   Bubble Chart (time scale)
   Modern theme-aware colors + High Gas Table
   ============================ */

// ----------------- Globals -----------------
let errorNotificationShown = false;
let emailNotifShown = false;
let gasBubbleChart = null;
let lastEmailSent = false;
let modalShown = false;

// =========================
// Chart Functions
// =========================
function initGasChart() {
    const ctx = document.getElementById('gasBubbleChart').getContext('2d');
    const labelColor = getComputedStyle(document.body).getPropertyValue('--chart-label').trim();

    gasBubbleChart = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [
                {
                    label: "✅ Normal (<100 ppm)",
                    data: [],
                    backgroundColor: "rgba(66, 165, 245, 0.6)",
                    borderColor: "rgba(25, 118, 210, 1)",
                },
                {
                    label: "🔶 Medium (100–199 ppm)",
                    data: [],
                    backgroundColor: "rgba(255, 193, 7, 0.6)",
                    borderColor: "rgba(255, 160, 0, 1)",
                },
                {
                    label: "🚨 High (>=200 ppm)",
                    data: [],
                    backgroundColor: "rgba(244, 67, 54, 0.6)",
                    borderColor: "rgba(211, 47, 47, 1)",
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { labels: { color: labelColor } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.raw.y} ppm` } }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'second', tooltipFormat: 'HH:mm:ss' },
                    ticks: { color: labelColor, source: 'data' },
                    grid: { color: 'rgba(128,128,128,0.2)' }
                },
                y: {
                    min: 0,
                    suggestedMax: 300,
                    ticks: { stepSize: 50, color: labelColor },
                    grid: { color: 'rgba(128,128,128,0.2)' }
                }
            }
        }
    });
}

function updateGasChart(newGasValue) {
    if (!gasBubbleChart) return;

    const now = new Date();
    const radius = Math.max(10, Math.min(newGasValue / 8 + 5, 25));

    // Determine dataset index based on value
    let datasetIndex = 0; // Normal (Blue)
    if (newGasValue >= 200) datasetIndex = 2; // High (Red)
    else if (newGasValue >= 100) datasetIndex = 1; // Medium (Yellow)

    // Update all datasets
    gasBubbleChart.data.datasets.forEach((ds, index) => {
        if (index === datasetIndex) {
            // Active dataset gets actual bubble
            ds.data.push({ x: now, y: newGasValue, r: radius });
        } else {
            // Inactive datasets get null so bubble disappears
            ds.data.push({ x: now, y: null, r: 0 });
        }

        // Keep only last 10 points
        while (ds.data.length > 10) ds.data.shift();
    });

    gasBubbleChart.update();
}



function applyChartTheme() {
    if (!gasBubbleChart) return;
    const labelColor = getComputedStyle(document.body).getPropertyValue('--chart-label').trim();
    gasBubbleChart.options.scales.x.ticks.color = labelColor;
    gasBubbleChart.options.scales.y.ticks.color = labelColor;
    gasBubbleChart.options.plugins.legend.labels.color = labelColor;
    gasBubbleChart.update();
}

// =========================
// High Gas History Table
// =========================
function formatDateTime(date) {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;

    return `${dd}/${mm}/${yy} ${hours}:${minutes}:${seconds} ${ampm}`;
}

function updateGasHistory(gasValue) {
    const tbody = document.getElementById("gasHistoryBody");
    if (!tbody) return;

    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    const valueCell = document.createElement("td");

    timeCell.style.textAlign = "center";
    valueCell.style.textAlign = "center";

    timeCell.textContent = formatDateTime(new Date());
    valueCell.textContent = gasValue + " ppm";

    row.appendChild(timeCell);
    row.appendChild(valueCell);

    tbody.insertBefore(row, tbody.firstChild);

    // Keep only latest 5 entries in table
    while (tbody.rows.length > 5) {
        tbody.deleteRow(tbody.rows.length - 1);
    }
}

// =========================
// Load Old High Gas History
// =========================
async function loadGasHistory() {
    try {
        const resp = await fetch('/act4_hist');
        if (!resp.ok) throw new Error("History fetch failed");
        const history = await resp.json();

        const tbody = document.getElementById("gasHistoryBody");
        if (!tbody) return;

        tbody.innerHTML = ""; // clear old table contents

        history.reverse().forEach(entry => {
            const row = document.createElement("tr");
            const timeCell = document.createElement("td");
            const valueCell = document.createElement("td");

            timeCell.style.textAlign = "center";
            valueCell.style.textAlign = "center";

            timeCell.textContent = entry.time;
            valueCell.textContent = entry.ppm + " ppm";

            row.appendChild(timeCell);
            row.appendChild(valueCell);

            tbody.insertBefore(row, tbody.firstChild);
        });
    } catch (err) {
        console.error("Error loading gas history:", err);
    }
}

// ----------------- Vibration Chart -----------------
let vibrationChart = null;

function initVibrationChart() {
    const ctx = document.getElementById('vibrationChart').getContext('2d');
    const labelColor = getComputedStyle(document.body).getPropertyValue('--chart-label').trim();

    vibrationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [], // timestamps
            datasets: [
                {
                    label: 'Detected',
                    data: [],
                    backgroundColor: 'rgba(244, 67, 54, 0.6)', // red
                    borderColor: 'rgba(244, 67, 54, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Not Detected',
                    data: [],
                    backgroundColor: 'rgba(33, 150, 243, 0.6)', // blue
                    borderColor: 'rgba(33, 150, 243, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: labelColor },
                    grid: { color: 'rgba(128,128,128,0.2)' },
                    title: { display: true, text: 'Time', color: labelColor }
                },
                y: {
                    stacked: true,
                    min: -1,
                    max: 1,
                    ticks: {
                        color: labelColor,
                        callback: function(val) {
                            if (val === 1) return 'Detected';
                            if (val === -1) return 'Not Detected';
                            return '';
                        }
                    },
                    grid: { color: 'rgba(128,128,128,0.2)' },
                    title: { display: true, text: 'Vibration Status', color: labelColor }
                }
            },
            plugins: {
                legend: {
                    labels: { color: labelColor }
                }
            }
        }
    });
}

function updateVibrationChart(vibDetected) {
    if (!vibrationChart) return;

    const timestamp = new Date().toLocaleTimeString();

    // Push timestamp
    vibrationChart.data.labels.push(timestamp);

    // Push positive value for Detected, negative for Not Detected
    vibrationChart.data.datasets[0].data.push(vibDetected ? 1 : 0); // Detected
    vibrationChart.data.datasets[1].data.push(vibDetected ? 0 : -1); // Not Detected

    // Keep only last 10 entries
    if (vibrationChart.data.labels.length > 10) {
        vibrationChart.data.labels.shift();
        vibrationChart.data.datasets.forEach(ds => ds.data.shift());
    }

    vibrationChart.update();
}

function applyVibrationChartTheme() {
    if (!vibrationChart) return;
    const labelColor = getComputedStyle(document.body).getPropertyValue('--chart-label').trim();
    vibrationChart.options.scales.x.ticks.color = labelColor;
    vibrationChart.options.scales.y.ticks.color = labelColor;
    vibrationChart.options.scales.x.title.color = labelColor;
    vibrationChart.options.scales.y.title.color = labelColor;
    vibrationChart.options.plugins.legend.labels.color = labelColor;
    vibrationChart.update();
}

// =========================
// Vibration History Table
// =========================
// ============================
// Vibration History Functions
// ============================

// ============================
// Vibration History Functions
// ============================

let lastFetchedTime = null; // Track last vibration timestamp

function updateVibrationHistory(vibDetected) {
    if (!vibDetected) return; // Only log detected events

    const tbody = document.getElementById("vibrationHistoryBody");
    if (!tbody) return;

    const now = new Date();
    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    const valueCell = document.createElement("td");

    timeCell.style.textAlign = "center";
    valueCell.style.textAlign = "center";

    timeCell.textContent = formatDateTime(now);
    valueCell.textContent = "Detected";

    row.appendChild(timeCell);
    row.appendChild(valueCell);
    tbody.insertBefore(row, tbody.firstChild);

    // Keep only the latest 5 rows
    while (tbody.rows.length > 5) {
        tbody.deleteRow(tbody.rows.length - 1);
    }

    // Optional: send detected event to backend
    fetch('/add_vibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ detected: true, time: timeCell.textContent })
    }).catch(err => console.error("Error sending vibration data:", err));
}

async function fetchNewVibrationHistory() {
    try {
        const resp = await fetch('/act4_vib_hist');
        if (!resp.ok) throw new Error("Vibration history fetch failed");
        const history = await resp.json();

        const tbody = document.getElementById("vibrationHistoryBody");
        if (!tbody) return;

        // Filter detected events
        const detectedEvents = history.filter(entry => entry.detected);

        detectedEvents.forEach(entry => {
            // Skip if already displayed
            if (lastFetchedTime && entry.time <= lastFetchedTime) return;

            const row = document.createElement("tr");
            const timeCell = document.createElement("td");
            const valueCell = document.createElement("td");

            timeCell.style.textAlign = "center";
            valueCell.style.textAlign = "center";

            timeCell.textContent = entry.time;
            valueCell.textContent = "Detected";

            row.appendChild(timeCell);
            row.appendChild(valueCell);
            tbody.insertBefore(row, tbody.firstChild);
        });

        // Update lastFetchedTime
        if (detectedEvents.length > 0) {
            lastFetchedTime = detectedEvents[detectedEvents.length - 1].time;
        }

        // Keep only latest 5 rows
        while (tbody.rows.length > 5) {
            tbody.deleteRow(tbody.rows.length - 1);
        }

    } catch (err) {
        console.error("Error fetching vibration history:", err);
    }
}

// ============================
// Helper: format datetime
// ============================
function formatDateTime(date) {
    const options = { year: '2-digit', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                      hour12: true };
    return new Intl.DateTimeFormat('en-US', options).format(date);
}

// ============================
// Auto-fetch new vibrations every 2 seconds
// ============================
fetchNewVibrationHistory(); // Initial fetch
setInterval(fetchNewVibrationHistory, 2000);

// =========================
// Modal Functions
// =========================
function showBackModal() {
    const m = document.getElementById('backModal');
    if (m) m.classList.add('show');
}
function hideBackModal() {
    const m = document.getElementById('backModal');
    if (m) m.classList.remove('show');
}
function handleBackConfirmation() {
    hideBackModal();
    window.location.href = '/stop_act4';
}

// =========================
// Theme Functions
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

            if (themeIcon) {
                themeIcon.src = next === 'light' ? '/static/icons/dark-mode.png' : '/static/icons/light-mode.png';
                themeIcon.alt = next === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
            }
            applyVibrationChartTheme();
            applyChartTheme();
        });
    }
}

// =========================
// Email Functions
// =========================
async function sendEmail() {
    try {
        showEmailSending();
        const resp = await fetch('/act4_send_email');
        if (!resp.ok) throw new Error('Email send failed');
        const data = await resp.json();
        if (data.success) {
            setTimeout(() => {
                hideEmailSending();
                showEmailNotification();
            }, 500);
        } else {
            hideEmailSending();
            alert("Email failed to send.");
        }
    } catch (err) {
        hideEmailSending();
        console.error(err);
        alert("Email send failed.");
    }
}

// =========================
// Notification Functions
// =========================
function initNotifications() {
    const closeNotif = document.getElementById('closeNotif');
    if (closeNotif) closeNotif.addEventListener('click', hideErrorNotification);
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

function showEmailSending(reason = "Alert") {
    const n = document.getElementById('emailNotif');
    if (!n) return;

    // Show the reason in the notification
    n.textContent = `📧 Email is being sent... (${reason})`;
    n.classList.add('show');
    n.style.display = 'block';
}

function hideEmailSending() {
    const n = document.getElementById('emailNotif');
    if (!n) return;
    n.classList.remove('show');
    n.style.display = 'none';
}

function showEmailNotification() {
    const n = document.getElementById('emailNotif');
    if (!n || emailNotifShown) return;
    n.classList.add('show');
    n.style.display = 'block';
    emailNotifShown = true;
    setTimeout(() => hideEmailNotification(), 5000);
}
function hideEmailNotification() {
    const n = document.getElementById('emailNotif');
    if (!n) return;
    n.classList.remove('show');
    n.style.display = 'none';
    emailNotifShown = false;
}

function showModal(message) {
    const modal = document.getElementById('alertModal');
    const alertText = document.getElementById('alertMessage');
    alertText.textContent = message;
    modal.classList.add('show');
}

function closeModal() {
    const modal = document.getElementById('alertModal');
    modal.classList.remove('show');
}

// =========================
// Data Fetching & Updates
// =========================
let lastGasHigh = false;
let lastVibrationDetected = false;

async function fetchData() {
    try {
        const resp = await fetch('/act4_sensor');
        if (!resp.ok) throw new Error('Sensor fetch failed');
        const data = await resp.json();
        if (!data || typeof data.gas === "undefined") throw new Error("Invalid data");

        updateStatus(true);

        const gasValue = Number(data.gas ?? 0);
        const vibrationDetected = Boolean(data.vibration);
        const buzzerActive = Boolean(data.buzzer);

        document.getElementById('gas').textContent = gasValue + ' ppm';
        document.getElementById('vibration').textContent = vibrationDetected ? 'Detected' : 'None';

        updateBadges(gasValue, vibrationDetected);
        updateBuzzerUI(buzzerActive);
        updateGasChart(gasValue);
        updateVibrationChart(vibrationDetected);

        // -------------------------------
        // Trigger modal only on rising edge
        // -------------------------------
        if (gasValue >= 200 && !lastGasHigh) {
            showModal(`🚨 High Gas Detected: ${gasValue} ppm`);
        }
        lastGasHigh = gasValue >= 200;

        if (vibrationDetected && !lastVibrationDetected) {
            showModal("⚠️ Vibration Detected!");
        }
        lastVibrationDetected = vibrationDetected;

        hideErrorNotification();
        updateTime();
    } catch (err) {
        console.error("Fetch error:", err);
        updateStatus(false);
        showErrorNotification();
    }
}

function updateBadges(gasValue, vibrationDetected) {
    const gasBadge = document.getElementById('gasBadge');
    const vibrationBadge = document.getElementById('vibrationBadge');

    if (gasBadge) {
        gasBadge.className = gasValue >= 200 ? 'badge danger' : gasValue >= 100 ? 'badge warn' : 'badge ok';
        gasBadge.textContent = gasValue >= 200 ? '🚨 High' : gasValue >= 100 ? '🔶 Medium' : '✅ Normal';
    }

    if (vibrationBadge) {
        vibrationBadge.className = vibrationDetected ? 'badge danger' : 'badge ok';
        vibrationBadge.textContent = vibrationDetected ? '⚠️ Detected' : '✅ None';
    }
}

function updateBuzzerUI(buzzerActive) {
    const buzzerIcon = document.getElementById('buzzer');
    const buzzerText = document.getElementById('buzzerText');
    const buzzerStatusIcon = document.getElementById('buzzerStatusIcon');
    const buzzerBadge = document.getElementById('buzzerBadge');

    if (buzzerIcon && buzzerText && buzzerStatusIcon && buzzerBadge) {
        if (buzzerActive) {
            buzzerIcon.className = 'buzzer-icon buzzer-active';
            buzzerText.textContent = 'ALERT';
            buzzerStatusIcon.src = '/static/icons/speaker.png';
            buzzerBadge.className = 'badge danger';
        } else {
            buzzerIcon.className = 'buzzer-icon';
            buzzerText.textContent = 'Standby';
            buzzerStatusIcon.src = '/static/icons/mute.png';
            buzzerBadge.className = 'badge ok';
        }
    }
}

// =========================
// Email Status Polling
// =========================
async function checkEmailStatus() {
    try {
        const resp = await fetch('/act4_email_status');
        if (!resp.ok) throw new Error('Email status fetch failed');
        const data = await resp.json();

        if (data.sent && lastEmailSent === false) {
            // Determine reason
            let reason = "Unknown";
            if (data.source === "gas") reason = "Gas Alert";
            else if (data.source === "vibration") reason = "Vibration Alert";

            showEmailSending(reason);
            setTimeout(() => hideEmailNotification(), 5000);
        }

        lastEmailSent = data.sent;
    } catch (err) {
        console.error(err);
    }
}

setInterval(checkEmailStatus, 3000);

// =========================
// Status & Time
// =========================
function updateStatus(connected) {
    const st = document.getElementById('status');
    if (st) st.textContent = connected ? '🟢' : '🔴';
}
function updateTime() {
    const t = document.getElementById('time');
    if (t) t.textContent = new Date().toLocaleTimeString();
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNotifications();
    initGasChart();
    initVibrationChart();
    fetchData();
    setInterval(fetchData, 2000);

    loadGasHistory();
    loadVibrationHistory(); // NEW: Load vibration history table

    const backButton = document.querySelector('.back-btn');
    if (backButton) backButton.addEventListener('click', e => {
        e.preventDefault();
        showBackModal();
    });

    // Modal buttons
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');
    if (modalClose) modalClose.addEventListener('click', hideBackModal);
    if (modalCancel) modalCancel.addEventListener('click', hideBackModal);
    if (modalConfirm) modalConfirm.addEventListener('click', handleBackConfirmation);
});