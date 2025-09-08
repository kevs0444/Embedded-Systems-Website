// ==========================
// act1.js - Toggle Removed
// ==========================

// ==========================
// Global Vars
// ==========================
let realChart = null;
let hist1Chart = null;
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
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');

    if (modalClose) modalClose.addEventListener('click', hideBackModal);
    if (modalCancel) modalCancel.addEventListener('click', hideBackModal);
    if (modalConfirm) modalConfirm.addEventListener('click', handleBackConfirmation);
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
            x: { title: { display: true, text: 'Time' }, ticks: { autoSkip: true, maxTicksLimit: 12 } },
            y: { beginAtZero: true, title: { display: true, text: 'Value' }, ticks: { maxTicksLimit: 8 } }
        },
        elements: { line: { tension: 0.3 } }
    };

    // Real-time chart
    realChart = new Chart(realCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Temperature (°C)', data: [], borderColor: tempColor, backgroundColor: 'rgba(255,87,34,0.08)', fill: true, pointRadius: 5, pointHoverRadius: 12, pointBackgroundColor: tempColor },
                { label: 'Humidity (%)', data: [], borderColor: humColor, backgroundColor: 'rgba(33,150,243,0.08)', fill: true, pointRadius: 5, pointHoverRadius: 12, pointBackgroundColor: humColor }
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
                { label: 'Avg Temp (°C)', data: [], borderColor: tempColor, backgroundColor: 'rgba(255,87,34,0.06)', borderDash: [6,4], fill: true, pointRadius: 0 },
                { label: 'Peak Temp (°C)', data: [], borderColor: tempColor, backgroundColor: 'rgba(255,87,34,0.08)', fill: true, pointRadius: 8, pointHoverRadius: 12, pointBackgroundColor: tempColor },
                { label: 'Avg Humidity (%)', data: [], borderColor: humColor, backgroundColor: 'rgba(33,150,243,0.06)', borderDash: [6,4], fill: true, pointRadius: 0 },
                { label: 'Peak Humidity (%)', data: [], borderColor: humColor, backgroundColor: 'rgba(33,150,243,0.08)', fill: true, pointRadius: 8, pointHoverRadius: 12, pointBackgroundColor: humColor }
            ]
        },
        options: baseOptions
    });
}

// ==========================
// Helpers
// ==========================
function normalizeArray(arr, len) {
    if (!Array.isArray(arr)) arr = [];
    if (arr.length > len) return arr.slice(-len);
    if (arr.length === len) return arr;
    return Array(len - arr.length).fill(null).concat(arr);
}

// ==========================
// Data Handling (History)
// ==========================
function loadHistoricalData() {
    fetch('/history')
        .then(res => res.ok ? res.json() : Promise.reject('History fetch failed'))
        .then(data => {
            const responseData = data.data || data;
            const rawLabels = responseData.labels || [];
            if (!rawLabels.length) {
                if (hist1Chart) {
                    hist1Chart.data.labels = [];
                    hist1Chart.data.datasets.forEach(ds => ds.data = []);
                    hist1Chart.update();
                }
                return;
            }

            const labels = rawLabels;
            const avgTemp = responseData.avg_temp || [];
            const peakTemp = responseData.peak_temp || [];
            const avgHum = responseData.avg_hum || [];
            const peakHum = responseData.peak_hum || [];

            const L = labels.length;
            hist1Chart.data.labels = labels.slice(-L);
            hist1Chart.data.datasets[0].data = normalizeArray(avgTemp, L);
            hist1Chart.data.datasets[1].data = normalizeArray(peakTemp, L);
            hist1Chart.data.datasets[2].data = normalizeArray(avgHum, L);
            hist1Chart.data.datasets[3].data = normalizeArray(peakHum, L);

            hist1Chart.update();
        })
        .catch(err => console.error('Error loading historical data:', err));
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

        if (data.error || data.temperature == null || data.humidity == null) {
            updateUI('--','--','OFF');
            showErrorNotification();
        } else {
            const t = Number(data.temperature);
            const h = Number(data.humidity);
            const buz = data.buzzer || 'OFF';

            updateUI(t, h, buz);
            updateRealTimeChart(t, h);

            // <<< ADD THIS LINE TO REFRESH HISTORICAL DATA
            loadHistoricalData();

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
    const tempEl = document.getElementById('temp');
    const humEl = document.getElementById('humidity');
    if (tempEl) tempEl.textContent = temp !== '--' ? `${temp} °C` : '--';
    if (humEl) humEl.textContent = hum !== '--' ? `${hum} %` : '--';

    const tempBadge = document.getElementById('tempBadge');
    const t = Number(temp);
    if (!isNaN(t)) {
        if (t >= 38) { 
            tempBadge.className='badge danger'; 
            tempBadge.textContent='⚠️ High'; 
        }
        else if (t >= 30){ 
            tempBadge.className='badge warn'; 
            tempBadge.textContent='🔶 Warm'; 
        }
        else { 
            tempBadge.className='badge ok'; 
            tempBadge.textContent='✅ Normal'; 
        }
    } else { 
        tempBadge.className='badge'; 
        tempBadge.textContent='--'; 
    }

    const buzzerIcon = document.getElementById('buzzer');
    const buzzerText = document.getElementById('buzzerText');
    const buzzerStatusIcon = document.getElementById('buzzerStatusIcon');
    const buzzerBadge = document.getElementById('buzzerBadge');

    const isAlert = buzzer === 'ON' || (!isNaN(t) && t >= 38);

    if (isAlert) {
        if(buzzerIcon) buzzerIcon.className='buzzer-icon buzzer-active';
        if(buzzerText) buzzerText.textContent='ALERT';
        if(buzzerStatusIcon){ 
            buzzerStatusIcon.src='/static/icons/speaker.png'; 
            buzzerStatusIcon.alt='Speaker Icon'; 
        }
        if(buzzerBadge) buzzerBadge.className='badge danger';
    } else {
        if(buzzerIcon) buzzerIcon.className='buzzer-icon';
        if(buzzerText) buzzerText.textContent='Standby';
        if(buzzerStatusIcon){ 
            buzzerStatusIcon.src='/static/icons/mute.png'; 
            buzzerStatusIcon.alt='Mute Icon'; 
        }
        if(buzzerBadge) buzzerBadge.className='badge ok';
    }
}

// ==========================
// Real-time chart update (with year in x-axis)
// ==========================
function updateRealTimeChart(temp, hum) {
    const time = new Date().toLocaleString('en-US', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:true });
    realChart.data.labels.push(time);
    realChart.data.datasets[0].data.push(Number(temp));
    realChart.data.datasets[1].data.push(Number(hum));

    if(realChart.data.labels.length > 10){
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
    if(s) s.textContent = connected ? '🟢' : '🔴';
}

function updateTime(){
    const el = document.getElementById('time');
    if(el) el.textContent = new Date().toLocaleTimeString();
}

// ==========================
// Notifications
// ==========================
function initNotifications(){
    const closeNotif = document.getElementById('closeNotif');
    if(closeNotif) closeNotif.addEventListener('click', hideErrorNotification);
}

function showErrorNotification(){
    const n = document.getElementById('errorNotif');
    if(!n) return;
    if(!errorNotificationShown){ 
        n.classList.add('show'); 
        n.style.display='block'; 
        errorNotificationShown=true; 
    }
}

function hideErrorNotification(){
    const n = document.getElementById('errorNotif');
    if(!n) return;
    n.classList.remove('show'); 
    n.style.display='none'; 
    errorNotificationShown=false;
}

// ==========================
// Clear Historical Data
// ==========================
function clearHistoricalData(){
    if(!confirm('Are you sure you want to clear all historical data? This action cannot be undone.')) return;

    fetch('/clear_history',{method:'POST',headers:{'Content-Type':'application/json'}})
        .then(res=>res.json())
        .then(result=>{
            if(result.status==='success'||result.status==='ok'){
                if(hist1Chart){
                    hist1Chart.data.labels=[];
                    hist1Chart.data.datasets.forEach(ds=>ds.data=[]);
                    hist1Chart.update();
                }
                alert('Historical data cleared successfully!');
            }else{
                alert('Error clearing data: '+(result.message||JSON.stringify(result)));
            }
        }).catch(err=>{
            console.error('Error clearing historical data:', err);
            alert('Error clearing data. Please try again.');
        });
}
