// ==========================
// act1.js - Full file
// ==========================

// ==========================
// Global Vars
// ==========================
let realChart, hist1Chart;
let errorNotificationShown = false;

// ==========================
// Modal functions
// ==========================
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
    window.location.href = '/stop_act1';
}

// ==========================
// DOM Ready
// ==========================
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCharts();
    initNotifications();

    // Initial loads
    loadHistoricalData();
    fetchData();

    // Intervals
    setInterval(fetchData, 5000);    // fetch every 5s (real-time)
    setInterval(loadHistoricalData, 60000); // refresh history every 1min

    // Buttons
    const clearBtn = document.getElementById('clearData');
    if (clearBtn) clearBtn.addEventListener('click', clearHistoricalData);

    const backButton = document.querySelector('.back-btn');
    if (backButton) {
        backButton.addEventListener('click', function (e) {
            e.preventDefault();
            showBackModal();
        });
    }

    const modalClose = document.getElementById('modalClose');
    if (modalClose) modalClose.addEventListener('click', hideBackModal);
    const modalCancel = document.getElementById('modalCancel');
    if (modalCancel) modalCancel.addEventListener('click', hideBackModal);
    const modalConfirm = document.getElementById('modalConfirm');
    if (modalConfirm) modalConfirm.addEventListener('click', handleBackConfirmation);

    // Error notification close handled in initNotifications()
});

// ==========================
// Theme Handler
// ==========================
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
        });
    }
}

// ==========================
// Chart.js Setup
// ==========================
function initCharts() {
    const realCanvas = document.getElementById('realChart');
    const histCanvas = document.getElementById('hist1Chart');

    if (!realCanvas || !histCanvas) {
        console.error('Charts not found in DOM.');
        return;
    }

    const realCtx = realCanvas.getContext('2d');
    const histCtx = histCanvas.getContext('2d');

    const tempColor = '#ff5722';
    const humColor = '#2196f3';

    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 6, right: 8, bottom: 6, left: 8 } },
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: true },
            tooltip: {
                enabled: true,
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: ctx => `${ctx.dataset.label}: ${ctx.formattedValue}`
                }
            }
        },
        scales: {
            x: {
                title: { display: true, text: 'Time' },
                ticks: {
                    autoSkip: true,
                    maxTicksLimit: 12,
                    callback: function(value) {
                        const label = this.getLabelForValue(value);
                        const date = new Date(label);
                        if (isNaN(date)) return label;
                        const hours = date.getHours() % 12 || 12;
                        const minutes = date.getMinutes().toString().padStart(2, '0');
                        const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
                        const day = date.getDate().toString().padStart(2, '0');
                        const month = (date.getMonth() + 1).toString().padStart(2, '0');
                        const year = date.getFullYear();
                        return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
                    }
                }
            },
            y: { beginAtZero: true, title: { display: true, text: 'Value' }, ticks: { maxTicksLimit: 8 } }
        },
        elements: {
            line: { tension: 0.3 }
        }
    };

    // Real-time chart
    realChart = new Chart(realCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: [],
                    borderColor: tempColor,
                    backgroundColor: 'rgba(255,87,34,0.08)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 12,
                    pointBackgroundColor: tempColor
                },
                {
                    label: 'Humidity (%)',
                    data: [],
                    borderColor: humColor,
                    backgroundColor: 'rgba(33,150,243,0.08)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 5,
                    pointHoverRadius: 12,
                    pointBackgroundColor: humColor
                }
            ]
        },
        options: baseOptions
    });

    // Historical chart
    hist1Chart = new Chart(histCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Avg Temp (°C)',
                    data: [],
                    borderColor: tempColor,
                    backgroundColor: 'rgba(255,87,34,0.06)',
                    borderDash: [6, 4],
                    fill: true,
                    tension: 0.2,
                    pointRadius: 0
                },
                {
                    label: 'Peak Temp (°C)',
                    data: [],
                    borderColor: tempColor,
                    backgroundColor: 'rgba(255,87,34,0.08)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 8,
                    pointHoverRadius: 12,
                    pointBackgroundColor: tempColor
                },
                {
                    label: 'Avg Humidity (%)',
                    data: [],
                    borderColor: humColor,
                    backgroundColor: 'rgba(33,150,243,0.06)',
                    borderDash: [6, 4],
                    fill: true,
                    tension: 0.2,
                    pointRadius: 0
                },
                {
                    label: 'Peak Humidity (%)',
                    data: [],
                    borderColor: humColor,
                    backgroundColor: 'rgba(33,150,243,0.08)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 8,
                    pointHoverRadius: 12,
                    pointBackgroundColor: humColor
                }
            ]
        },
        options: baseOptions
    });

    // Toggle buttons
    const toggleRealBtn = document.getElementById('toggleReal');
    if (toggleRealBtn) toggleRealBtn.addEventListener('click', () => {
        const card = realCanvas.closest('.chart-card') || realCanvas.parentElement;
        if (!card) return;
        card.style.display = card.style.display === 'none' ? '' : 'none';
    });

    const toggleHistBtn = document.getElementById('toggleHist');
    if (toggleHistBtn) toggleHistBtn.addEventListener('click', () => {
        const card = histCanvas.closest('.chart-card') || histCanvas.parentElement;
        if (!card) return;
        card.style.display = card.style.display === 'none' ? '' : 'none';
    });
}

// ==========================
// Helpers
// ==========================
function normalizeArray(arr, len) {
    if (!Array.isArray(arr)) arr = [];
    // keep most recent values on the right
    if (arr.length > len) return arr.slice(-len);
    if (arr.length === len) return arr;
    const pad = new Array(len - arr.length).fill(null);
    return pad.concat(arr);
}

function pickFirstArray(data, names) {
    // names: array of possible keys to try in order
    for (const n of names) {
        if (Array.isArray(data[n])) return data[n];
        if (data.data && Array.isArray(data.data[n])) return data.data[n];
    }
    return [];
}

// ==========================
// Data Handling (History)
// ==========================
function loadHistoricalData() {
    fetch('/history')
        .then(res => {
            if (!res.ok) throw new Error('History fetch failed');
            return res.json();
        })
        .then(data => {
            // Accept many shapes:
            // { labels, avg_temp/ temp_avg / temp, peak_temp / temp_peak, avg_hum / hum_avg / hum, peak_hum / hum_peak }
            const labels = data.labels || (data.data && data.data.labels) || [];

            if (!labels || labels.length === 0) {
                // clear chart if no history
                hist1Chart.data.labels = [];
                hist1Chart.data.datasets.forEach(ds => ds.data = []);
                hist1Chart.update();
                return;
            }

            const avgTemp = pickFirstArray(data, ['avg_temp', 'temp_avg', 'avgTemp', 'temp']);
            const peakTemp = pickFirstArray(data, ['peak_temp', 'temp_peak', 'peakTemp', 'temp']);
            const avgHum = pickFirstArray(data, ['avg_hum', 'hum_avg', 'avgHum', 'hum']);
            const peakHum = pickFirstArray(data, ['peak_hum', 'hum_peak', 'peakHum', 'hum']);

            const L = labels.length;
            hist1Chart.data.labels = labels.slice(-L);

            hist1Chart.data.datasets[0].data = normalizeArray(avgTemp, L);
            hist1Chart.data.datasets[1].data = normalizeArray(peakTemp, L);
            hist1Chart.data.datasets[2].data = normalizeArray(avgHum, L);
            hist1Chart.data.datasets[3].data = normalizeArray(peakHum, L);

            hist1Chart.update();
        })
        .catch(err => {
            console.error('Error loading historical data:', err);
        });
}

// ==========================
// Fetch Real-time sensor
// ==========================
async function fetchData() {
    try {
        const resp = await fetch('/sensor');
        if (!resp.ok) throw new Error('Sensor fetch failed');
        const data = await resp.json();

        updateStatus(true);

        if (data.error || data.temperature === null || data.humidity === null) {
            updateUI('--', '--', 'OFF');
            showErrorNotification();
        } else {
            // Keep UI updates consistent with previous structure
            const t = typeof data.temperature === 'number' ? data.temperature : parseFloat(data.temperature);
            const h = typeof data.humidity === 'number' ? data.humidity : parseFloat(data.humidity);
            const buz = data.buzzer !== undefined ? data.buzzer : 'OFF';

            updateUI(t, h, buz);
            updateRealTimeChart(t, h);
            hideErrorNotification();
        }

        updateTime();
    } catch (err) {
        console.error('Fetch error:', err);
        updateStatus(false);
        showErrorNotification();
    }
}

// ==========================
// UI Updates
// ==========================
function updateUI(temp, hum, buzzer) {
    document.getElementById('temp').textContent = temp !== '--' ? `${temp} °C` : '--';
    document.getElementById('humidity').textContent = hum !== '--' ? `${hum} %` : '--';

    const tempBadge = document.getElementById('tempBadge');
    const t = parseFloat(temp);

    if (!isNaN(t)) {
        if (t >= 38) {
            tempBadge.className = 'badge danger';
            tempBadge.textContent = '⚠️ High';
        } else if (t >= 30) {
            tempBadge.className = 'badge warn';
            tempBadge.textContent = '🔶 Warm';
        } else {
            tempBadge.className = 'badge ok';
            tempBadge.textContent = '✅ Normal';
        }
    } else {
        tempBadge.className = 'badge';
        tempBadge.textContent = '--';
    }

    // Buzzer UI
    const buzzerIcon = document.getElementById('buzzer');
    const buzzerText = document.getElementById('buzzerText');
    const buzzerStatusIcon = document.getElementById('buzzerStatusIcon');
    const buzzerBadge = document.getElementById('buzzerBadge');

    const isAlert = buzzer === 'ON' || (!isNaN(t) && t >= 38);

    if (isAlert) {
        if (buzzerIcon) buzzerIcon.className = 'buzzer-icon buzzer-active';
        if (buzzerText) buzzerText.textContent = 'ALERT';
        if (buzzerStatusIcon) {
            buzzerStatusIcon.src = '/static/icons/speaker.png';
            buzzerStatusIcon.alt = 'Speaker Icon';
        }
        if (buzzerBadge) buzzerBadge.className = 'badge danger';
    } else {
        if (buzzerIcon) buzzerIcon.className = 'buzzer-icon';
        if (buzzerText) buzzerText.textContent = 'Standby';
        if (buzzerStatusIcon) {
            buzzerStatusIcon.src = '/static/icons/mute.png';
            buzzerStatusIcon.alt = 'Mute Icon';
        }
        if (buzzerBadge) buzzerBadge.className = 'badge ok';
    }
}

function updateRealTimeChart(temp, hum) {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    realChart.data.labels.push(time);
    realChart.data.datasets[0].data.push(Number(temp));
    realChart.data.datasets[1].data.push(Number(hum));

    // keep only last 10 points
    if (realChart.data.labels.length > 10) {
        realChart.data.labels.shift();
        realChart.data.datasets.forEach(ds => ds.data.shift());
    }

    realChart.update();
}

// ==========================
// Status & Time
// ==========================
function updateStatus(connected) {
    const s = document.getElementById('status');
    if (s) s.textContent = connected ? '🟢' : '🔴';
}

function updateTime() {
    const el = document.getElementById('time');
    if (el) el.textContent = new Date().toLocaleTimeString();
}

// ==========================
// Notifications
// ==========================
function initNotifications() {
    const closeNotif = document.getElementById('closeNotif');
    if (closeNotif) {
        closeNotif.addEventListener('click', hideErrorNotification);
    }
}

function showErrorNotification() {
    const n = document.getElementById('errorNotif');
    if (!n) return;
    if (!errorNotificationShown) {
        n.classList.add('show');
        // fallback to display block if CSS doesn't use .show
        n.style.display = 'block';
        errorNotificationShown = true;
    }
}

function hideErrorNotification() {
    const n = document.getElementById('errorNotif');
    if (!n) return;
    n.classList.remove('show');
    n.style.display = 'none';
    errorNotificationShown = false;
}

// ==========================
// Clear Historical Data
// ==========================
function clearHistoricalData() {
    if (!confirm('Are you sure you want to clear all historical data? This action cannot be undone.')) return;

    fetch('/clear_history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(res => res.json())
        .then(result => {
            if (result.status === 'success' || result.status === 'ok') {
                // clear chart
                if (hist1Chart) {
                    hist1Chart.data.labels = [];
                    hist1Chart.data.datasets.forEach(ds => ds.data = []);
                    hist1Chart.update();
                }
                alert('Historical data cleared successfully!');
            } else {
                alert('Error clearing data: ' + (result.message || JSON.stringify(result)));
            }
        })
        .catch(err => {
            console.error('Error clearing historical data:', err);
            alert('Error clearing data. Please try again.');
        });
}
