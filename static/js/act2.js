/* ==========================
   act2.js - Distance Sensor Dashboard
   Full Dark/Light Mode + Dynamic Charts
   ========================== */

let distanceChart = null, histChart = null;
let errorNotificationShown = false;
let dist1Data = [], dist2Data = [], distLabels = [];

// ----------------- DOMContentLoaded -----------------
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCharts();
    initNotifications();
    fetchData();
    setInterval(fetchData, 2000);

    const clearBtn = document.getElementById('clearData');
    if (clearBtn) clearBtn.addEventListener('click', clearHistoricalData);

    const backButton = document.querySelector('.back-btn');
    if (backButton) backButton.addEventListener('click', e => { e.preventDefault(); showBackModal(); });

    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');
    if (modalClose) modalClose.addEventListener('click', hideBackModal);
    if (modalCancel) modalCancel.addEventListener('click', hideBackModal);
    if (modalConfirm) modalConfirm.addEventListener('click', handleBackConfirmation);
});

// ----------------- Modal -----------------
function showBackModal() { const m = document.getElementById('backModal'); if (m) m.classList.add('show'); }
function hideBackModal() { const m = document.getElementById('backModal'); if (m) m.classList.remove('show'); }
function handleBackConfirmation() { hideBackModal(); window.location.href = '/stop_act2'; }

// ----------------- Theme -----------------
function initTheme() {
    const themeBtn = document.getElementById('themeBtn'), themeIcon = document.getElementById('themeIcon');
    const saved = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', saved);
    if (themeIcon) themeIcon.src = saved === 'light' ? '/static/icons/dark-mode.png' : '/static/icons/light-mode.png';

    if (themeBtn) themeBtn.addEventListener('click', () => {
        const current = document.body.getAttribute('data-theme') || 'light';
        const next = current === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        if (themeIcon) themeIcon.src = next === 'light' ? '/static/icons/dark-mode.png' : '/static/icons/light-mode.png';
        updateChartColors();
    });
}

// ----------------- Notifications -----------------
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

// ----------------- Charts -----------------
function initCharts() {
    const distCtx = document.getElementById('distanceChart').getContext('2d');
    const histCtx = document.getElementById('histChart').getContext('2d');

    distanceChart = new Chart(distCtx, {
        type: 'scatter',
        data: {
            datasets: [
                { label: 'Distance 1 (cm)', data: [], backgroundColor: '#ff9800', borderColor: '#ff9800', borderWidth: 2, pointRadius: 8, pointHoverRadius: 12 },
                { label: 'Distance 2 (cm)', data: [], backgroundColor: '#2196f3', borderColor: '#2196f3', borderWidth: 2, pointRadius: 8, pointHoverRadius: 12 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    title: { display: true, text: 'Time' },
                    grid: { color: 'rgba(255,255,255,0.08)' },
                    ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text'), callback: val => new Date(val*1000).toLocaleTimeString() }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Distance (cm)' },
                    grid: { color: 'rgba(255,255,255,0.08)' },
                    ticks: { callback: val => Math.round(val), color: getComputedStyle(document.documentElement).getPropertyValue('--text') }
                }
            },
            plugins: {
                legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text'), font: { size: 16 } } }
            }
        }
    });

    histChart = new Chart(histCtx, {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'Temperature (°C)', data: [], borderColor: '#ff5722', backgroundColor: 'rgba(255,87,34,0.08)', fill: true, pointRadius: 5, pointHoverRadius: 12, pointBackgroundColor: '#ff5722' },
            { label: 'Humidity (%)', data: [], borderColor: '#2196f3', backgroundColor: 'rgba(33,150,243,0.08)', fill: true, pointRadius: 5, pointHoverRadius: 12, pointBackgroundColor: '#2196f3' }
        ]},
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            layout: { padding: 8 },
            interaction: { mode: 'index', intersect: false },
            elements: { line: { tension: 0.3 } },
            scales: {
                x: { title: { display: true, text: 'Time' }, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') }, grid: { color: 'rgba(255,255,255,0.08)' } },
                y: { beginAtZero: true, title: { display: true, text: 'Value' }, ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text') }, grid: { color: 'rgba(255,255,255,0.08)' } }
            },
            plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text'), font: { size: 16 } } } }
        }
    });
}

// ----------------- Update Chart Colors -----------------
function updateChartColors() {
    if (!distanceChart || !histChart) return;
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text');

    distanceChart.options.scales.x.ticks.color = textColor;
    distanceChart.options.scales.y.ticks.color = textColor;
    distanceChart.options.plugins.legend.labels.color = textColor;
    distanceChart.update();

    histChart.options.scales.x.ticks.color = textColor;
    histChart.options.scales.y.ticks.color = textColor;
    histChart.options.plugins.legend.labels.color = textColor;
    histChart.update();
}

// ----------------- Fetch Data -----------------
async function fetchData() {
    try {
        const resp = await fetch('/act2_sensor'); 
        if (!resp.ok) throw new Error('Sensor fetch failed');
        const data = await resp.json();

        updateStatus(true);

        const d1 = Math.round(Number(data.distance1));
        const d2 = Math.round(Number(data.distance2));
        const t = Number(data.temperature);
        const h = Number(data.humidity);
        const buz = data.buzzer || 'OFF';

        document.getElementById('dist1').textContent = d1 + ' cm';
        document.getElementById('dist2').textContent = d2 + ' cm';

        updateUI(t, h, buz);

        // Scatter chart last 20 points
        const now = Date.now()/1000;
        distLabels.push(now);
        dist1Data.push({ x: now, y: d1 });
        dist2Data.push({ x: now, y: d2 });
        if (dist1Data.length > 20) { dist1Data.shift(); dist2Data.shift(); distLabels.shift(); }

        distanceChart.data.datasets[0].data = dist1Data;
        distanceChart.data.datasets[1].data = dist2Data;
        distanceChart.update();

        // Historical chart last 60 points
        const histLabels = histChart.data.labels;
        const tempData = histChart.data.datasets[0].data;
        const humData = histChart.data.datasets[1].data;

        histLabels.push(new Date().toLocaleTimeString());
        tempData.push(t); humData.push(h);
        if (histLabels.length > 60) { histLabels.shift(); tempData.shift(); humData.shift(); }

        histChart.update();

        hideErrorNotification();
        updateTime();

    } catch(err) {
        console.error(err);
        updateStatus(false);
        showErrorNotification();
    }
}

// ----------------- Update UI -----------------
function updateUI(temp, hum, buzzer) {
    document.getElementById('temp').textContent = temp + ' °C';
    document.getElementById('humidity').textContent = hum + ' %';

    const tempBadge = document.getElementById('tempBadge');
    if (temp >= 38) tempBadge.className = 'badge danger', tempBadge.textContent = '⚠️ High';
    else if (temp >= 30) tempBadge.className = 'badge warn', tempBadge.textContent = '🔶 Warm';
    else tempBadge.className = 'badge ok', tempBadge.textContent = '✅ Normal';

    const buzzerIcon = document.getElementById('buzzer');
    const buzzerText = document.getElementById('buzzerText');
    const buzzerStatusIcon = document.getElementById('buzzerStatusIcon');
    const buzzerBadge = document.getElementById('buzzerBadge');

    if (buzzer === 'ON' || temp >= 38) {
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

// ----------------- Status & Time -----------------
function updateStatus(connected) { document.getElementById('status').textContent = connected ? '🟢' : '🔴'; }
function updateTime() { document.getElementById('time').textContent = new Date().toLocaleTimeString(); }

// ----------------- Clear Historical -----------------
function clearHistoricalData() {
    if (!confirm('Are you sure you want to clear historical data?')) return;
    fetch('/clear_hist', { method:'POST' }).then(r => r.json()).then(res => {
        if(res.status==='success') {
            histChart.data.labels=[]; histChart.data.datasets.forEach(ds=>ds.data=[]); histChart.update(); 
            alert('Cleared!');
        } else alert('Error clearing');
    });
}
