/* ==========================
   act2.js - Distance Sensor Dashboard
   Updated to match Activity 1 design
   ========================== */

let distanceChart = null, histChart = null;
let errorNotificationShown = false;
let dist1Data = [], dist2Data = [], distLabels = [];
let tempHistData = [], humHistData = [], histLabels5s = [];
let tempBuffer = [], humBuffer = [], minStats = [];
let lastTemp, lastHum;

// ----------------- DOMContentLoaded -----------------
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCharts();
    initNotifications();
    fetchData();
    setInterval(fetchData, 2000); // fetch every 2s
    setInterval(updateMinuteStats, 60000); // every 1 min

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

    // Add stats table below the chart
    addStatsTable();
});

// ----------------- Modal -----------------
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
    window.location.href = '/stop_act2'; 
}

// ----------------- Theme -----------------
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
            
            updateChartColors();
        });
    }
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

    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: { padding: { top: 6, right: 8, bottom: 6, left: 8 } },
        interaction: { mode: 'x', intersect: false },
        plugins: {
            legend: { display: true },
            tooltip: {
                enabled: true,
                mode: 'x',
                intersect: false,
                callbacks: {
                    title: ctxs => {
                        if (ctxs.length && ctxs[0].parsed && typeof ctxs[0].parsed.x !== 'undefined') {
                            const d = new Date(ctxs[0].parsed.x * 1000);
                            return `Time: ${d.toLocaleTimeString()}`;
                        }
                        return '';
                    },
                    label: (ctx) => {
                        // 🔹 Fix: Prevent duplicate peak labels
                        if (ctx && ctx.dataset && ctx.dataset.data[ctx.dataIndex] && ctx.parsed.y != null) {
                            return `${ctx.dataset.label}: ${ctx.parsed.y}`;
                        }
                        return null;
                    }
                }
            }
        },
        scales: {
            x: { 
                title: { display: true, text: 'Time (h:m:s)' },
                type: 'linear',
                ticks: {
                    stepSize: 2, // 2-second intervals
                    callback: value => {
                        const d = new Date(value * 1000);
                        return d.toLocaleTimeString();
                    },
                    autoSkip: true,
                    maxTicksLimit: 12
                }
            },
            y: { 
                beginAtZero: true, 
                title: { display: true, text: 'Value' }, 
                ticks: { maxTicksLimit: 8 } 
            }
        },
        elements: { line: { tension: 0.3 } }
    };

    // Distance scatter chart
    distanceChart = new Chart(distCtx, {
        type: 'scatter',
        data: {
            datasets: [
                { 
                    label: 'Distance 1', 
                    data: [], 
                    backgroundColor: '#ff5722', 
                    borderColor: '#ff5722', 
                    borderWidth: 2, 
                    pointRadius: 6, 
                    pointHoverRadius: 10 
                },
                { 
                    label: 'Distance 2', 
                    data: [], 
                    backgroundColor: '#2196f3', 
                    borderColor: '#2196f3', 
                    borderWidth: 2, 
                    pointRadius: 6, 
                    pointHoverRadius: 10 
                }
            ]
        },
        options: {
            ...baseOptions,
            scales: {
                ...baseOptions.scales,
                y: { title: { display: true, text: 'Distance (cm)' } }
            }
        }
    });

    // Historical chart (Avg + Peak per min with vertical lines)
    histChart = new Chart(histCtx, {
        type: 'line',
        data: { 
            labels: [], 
            datasets: [
                { 
                    label: 'Avg Temp (°C)', 
                    data: [], 
                    borderColor: '#ff5722',   // orange
                    borderDash: [6, 6],       // dotted
                    borderWidth: 2,
                    fill: false, 
                    pointRadius: 0            // no circles
                },
                { 
                    label: 'Peak Temp (°C)', 
                    data: [], 
                    borderColor: '#ff5722',   // orange
                    borderWidth: 2,
                    fill: false, 
                    pointRadius: 5,           // circle markers
                    pointBackgroundColor: '#ff5722'
                },
                { 
                    label: 'Avg Hum (%)', 
                    data: [], 
                    borderColor: '#2196f3',   // blue
                    borderDash: [6, 6],       // dotted
                    borderWidth: 2,
                    fill: false, 
                    pointRadius: 0            // no circles
                },
                { 
                    label: 'Peak Hum (%)', 
                    data: [], 
                    borderColor: '#2196f3',   // blue
                    borderWidth: 2,
                    fill: false, 
                    pointRadius: 5,           // circle markers
                    pointBackgroundColor: '#2196f3'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'x', intersect: false },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            if (ctx.dataset.data[ctx.dataIndex] && ctx.parsed.y != null) {
                                return `${ctx.dataset.label}: ${ctx.parsed.y}`;
                            }
                            return null; // 🔹 Prevent duplicate hover
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'category',
                    title: { display: true, text: 'Time (h:m:s)' },
                    ticks: { autoSkip: true }
                },
                y: {
                    beginAtZero: true,
                    max: 100, // 🔹 Fix: cap at 100 for temp & humidity
                    title: { display: true, text: 'Values' }
                }
            }
        }
    });

}

// ----------------- Update Chart Colors -----------------
function updateChartColors() {
    if (!distanceChart || !histChart) return;
    distanceChart.update();
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

        // save last readings for 5s chart cycle
        lastTemp = t;
        lastHum = h;

        // ---- UI updates ----
        const dist1El = document.getElementById('dist1');
        const dist2El = document.getElementById('dist2');
        if (dist1El) dist1El.textContent = d1 + ' cm';
        if (dist2El) dist2El.textContent = d2 + ' cm';

        updateDistanceBadges(d1, d2);
        updateUI(t, h, buz);

        // ---- Distance chart ----
        const now = Math.round(Date.now() / 1000);
        distLabels.push(now);
        dist1Data.push({ x: now, y: d1 });
        dist2Data.push({ x: now, y: d2 });
        
        if (dist1Data.length > 20) { 
            dist1Data.shift(); 
            dist2Data.shift(); 
            distLabels.shift(); 
        }
        distanceChart.data.datasets[0].data = dist1Data;
        distanceChart.data.datasets[1].data = dist2Data;
        distanceChart.update();

        // ---- Buffers for 1-min avg/peak ----
        tempBuffer.push(t);
        humBuffer.push(h);

        hideErrorNotification();
        updateTime();
    } catch (err) {
        console.error(err);
        updateStatus(false);
        showErrorNotification();
    }
}

// ----------------- Update 5s Chart -----------------

function update5sChart() {
    if (typeof lastTemp === 'undefined' || typeof lastHum === 'undefined') return;

    const now = new Date().toLocaleTimeString();
    histLabels5s.push(now);
    tempHistData.push(lastTemp);
    humHistData.push(lastHum);

    // keep only last 12 (1 minute worth at 5s interval)
    if (histLabels5s.length > 12) {
        histLabels5s.shift();
        tempHistData.shift();
        humHistData.shift();
    }

    // update chart datasets for raw line
    histChart.data.labels = histLabels5s;
    histChart.data.datasets[0].data = tempHistData; // Temp 5s values
    histChart.data.datasets[2].data = humHistData;  // Hum 5s values

    histChart.update();
}

// ----------------- Update 1-min Avg/Peak -----------------
function updateMinuteStats() {
    if (!tempBuffer.length || !humBuffer.length) return;

    const avgTemp = (tempBuffer.reduce((a,b)=>a+b,0)/tempBuffer.length).toFixed(1);
    const avgHum = (humBuffer.reduce((a,b)=>a+b,0)/tempBuffer.length).toFixed(1);
    const peakTemp = Math.max(...tempBuffer);
    const peakHum = Math.max(...humBuffer);
    const label = new Date().toLocaleTimeString();

    // Add vertical dotted line at start of new 1-minute cycle
    if (!histChart.options.plugins.annotation) histChart.options.plugins.annotation = { annotations: {} };
    histChart.options.plugins.annotation.annotations[`cycle_${label}`] = {
        type: 'line',
        xMin: label,
        xMax: label,
        borderColor: '#999',
        borderWidth: 1,
        borderDash: [4, 4]
    };

    // Push data for this 1-min cycle
    histChart.data.labels.push(label);
    histChart.data.datasets[0].data.push(avgTemp);    // Avg Temp
    histChart.data.datasets[1].data.push(peakTemp);   // Peak Temp
    histChart.data.datasets[2].data.push(avgHum);     // Avg Hum
    histChart.data.datasets[3].data.push(peakHum);    // Peak Hum

    // Maintain last N cycles in chart, but old data remains
    const maxCycles = 12; // e.g., last 12 minutes visible
    if (histChart.data.labels.length > maxCycles) {
        // shift data visually (we don’t remove old data points, just shift view)
        histChart.options.scales.x.min = histChart.data.labels[histChart.data.labels.length - maxCycles];
        histChart.options.scales.x.max = histChart.data.labels[histChart.data.labels.length - 1];
    }

    histChart.update();

    // Save for stats table
    minStats.push({ time: label, avgTemp, avgHum, peakTemp, peakHum });
    if (minStats.length > 10) minStats.shift();
    renderStatsTable();

    tempBuffer = [];
    humBuffer = [];
}

// ----------------- Stats Table -----------------
function addStatsTable() {
    const histChartEl = document.getElementById('histChart');
    if (!histChartEl) return;
    const chartCard = histChartEl.closest('.chart-card');
    if (!chartCard) return;
    const statsDiv = document.createElement('div');
    statsDiv.id = 'statsTableDiv';
    statsDiv.style.marginTop = '18px';
    chartCard.appendChild(statsDiv);
    renderStatsTable();
}
function renderStatsTable() {
    const statsDiv = document.getElementById('statsTableDiv');
    if (!statsDiv) return;
    if (minStats.length === 0) {
        statsDiv.innerHTML = '<em>No 1-min stats yet.</em>';
        return;
    }
    let html = `<table style="width:100%;border-collapse:collapse;font-size:1rem;">
        <thead><tr>
            <th>Minute</th><th>Avg Temp (°C)</th><th>Avg Hum (%)</th><th>Peak Temp (°C)</th><th>Peak Hum (%)</th>
        </tr></thead><tbody>`;
    for (let stat of minStats.slice().reverse()) {
        html += `<tr>
            <td>${stat.time}</td><td>${stat.avgTemp}</td><td>${stat.avgHum}</td>
            <td>${stat.peakTemp}</td><td>${stat.peakHum}</td>
        </tr>`;
    }
    html += '</tbody></table>';
    statsDiv.innerHTML = html;
}

// ----------------- Update Distance Badges -----------------
function updateDistanceBadges(d1, d2) {
    const dist1Badge = document.getElementById('dist1Badge');
    const dist2Badge = document.getElementById('dist2Badge');
    if (!dist1Badge || !dist2Badge) return;
    dist1Badge.className = d1 >= 12 ? 'badge danger' : d1 >= 6 ? 'badge warn' : 'badge ok';
    dist1Badge.textContent = d1 >= 12 ? '⚠️ Far' : d1 >= 6 ? '🔶 Medium' : '✅ Near';
    dist2Badge.className = d2 >= 12 ? 'badge danger' : d2 >= 6 ? 'badge warn' : 'badge ok';
    dist2Badge.textContent = d2 >= 12 ? '⚠️ Far' : d2 >= 6 ? '🔶 Medium' : '✅ Near';
}

// ----------------- Update UI -----------------
function updateUI(temp, hum, buzzer) {
    const tempEl = document.getElementById('temp');
    const humEl = document.getElementById('humidity');
    if (tempEl) tempEl.textContent = temp + ' °C';
    if (humEl) humEl.textContent = hum + ' %';

    const tempBadge = document.getElementById('tempBadge');
    if (tempBadge) {
        tempBadge.className = temp >= 38 ? 'badge danger' : temp >= 30 ? 'badge warn' : 'badge ok';
        tempBadge.textContent = temp >= 38 ? '⚠️ High' : temp >= 30 ? '🔶 Warm' : '✅ Normal';
    }
    const humBadge = document.getElementById('humBadge');
    if (humBadge) {
        humBadge.className = hum >= 80 ? 'badge danger' : hum >= 60 ? 'badge warn' : 'badge ok';
        humBadge.textContent = hum >= 80 ? '⚠️ High' : hum >= 60 ? '🔶 Moderate' : '✅ Normal';
    }

    const buzzerIcon = document.getElementById('buzzer');
    const buzzerText = document.getElementById('buzzerText');
    const buzzerStatusIcon = document.getElementById('buzzerStatusIcon');
    const buzzerBadge = document.getElementById('buzzerBadge');
    if (buzzerIcon && buzzerText && buzzerStatusIcon && buzzerBadge) {
        if (buzzer === 'ON') {
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

// ----------------- Status & Time -----------------
function updateStatus(connected) { 
    const st = document.getElementById('status');
    if (st) st.textContent = connected ? '🟢' : '🔴';
}
function updateTime() { 
    const t = document.getElementById('time');
    if (t) t.textContent = new Date().toLocaleTimeString();
}

// ----------------- Clear Historical -----------------
function clearHistoricalData() {
    if (!confirm('Are you sure you want to clear historical data?')) return;
    fetch('/clear_hist', { method:'POST' })
        .then(r => r.json())
        .then(res => {
            if(res.status === 'success') {
                if (histChart && histChart.data) {
                    histChart.data.labels = []; 
                    histChart.data.datasets.forEach(ds => ds.data = []); 
                    histChart.update();
                }
                alert('Historical data cleared!');
            } else alert('Error clearing data');
        })
        .catch(err => {
            console.error('Error clearing data:', err);
            alert('Error clearing data. Please try again.');
        });
}

setInterval(fetchData, 2000);     // still fetch every 2s
setInterval(update5sChart, 5000); // push to chart every 5s
setInterval(updateMinuteStats, 60000); // overlay avg+peak every 1 min
