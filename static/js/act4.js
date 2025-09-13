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
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.raw.y} ppm`
                    }
                }
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

    // Ensure visible radius even if gas = 0
    const radius = Math.max(10, Math.min(newGasValue / 8 + 5, 25)); // min radius 10

    // Use exact current timestamp for bubble x
    const timestamp = new Date();
    const bubble = { x: timestamp, y: newGasValue, r: radius };

    let datasetIndex;
    if (newGasValue >= 200) datasetIndex = 2;
    else if (newGasValue >= 100) datasetIndex = 1;
    else datasetIndex = 0;

    gasBubbleChart.data.datasets[datasetIndex].data.push(bubble);

    // Keep only last 10 points in each dataset
    gasBubbleChart.data.datasets.forEach(ds => {
        while (ds.data.length > 10) ds.data.shift();
    });

    // Update chart dynamically
    gasBubbleChart.update();

    // Update high gas history if needed
    if (newGasValue >= 200) updateGasHistory(newGasValue);
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

        // -------------------------------
        // Trigger alert modal if thresholds exceeded
        // -------------------------------
        if (!modalShown && gasValue >= 200) {
            showModal(`🚨 High Gas Detected: ${gasValue} ppm`);
            modalShown = true;
        } else if (!modalShown && vibrationDetected) {
            showModal("⚠️ Vibration Detected!");
            modalShown = true;
        }

        // Reset modal flag if all normal
        if (gasValue < 200 && !vibrationDetected) {
            modalShown = false;
        }

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

// =========================
// DOM Ready
// =========================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme, notifications, chart, and first sensor fetch
    initTheme();
    initNotifications();
    initGasChart();
    fetchData();
    setInterval(fetchData, 2000);

    // Load previously saved high gas events from gas.json
    loadGasHistory();

    // Handle back button with confirmation modal
    const backButton = document.querySelector('.back-btn');
    if (backButton) {
        backButton.addEventListener('click', e => {
            e.preventDefault();
            showBackModal();
        });
    }

    // Modal close/cancel/confirm buttons
    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');
    if (modalClose) modalClose.addEventListener('click', hideBackModal);
    if (modalCancel) modalCancel.addEventListener('click', hideBackModal);
    if (modalConfirm) modalConfirm.addEventListener('click', handleBackConfirmation);
});

