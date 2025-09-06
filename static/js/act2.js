class SimpleChart {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.data = { labels: [], datasets: [] };
        this.colors = ['#2196f3']; // only distance now
        this.maxPoints = options.maxPoints || 20;
        this.padding = 40;
        this.hidden = false;
        this.tooltip = null;

        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.hideTooltip());

        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
        this.draw();
    }

    setTooltip(el) { this.tooltip = el; }

    addData(label, values) {
        if (!this.data.datasets[0]) this.data.datasets[0] = { data: [] };

        this.data.labels.push(label);
        this.data.datasets[0].data.push(values.distance ?? null);

        if (this.data.labels.length > this.maxPoints) {
            this.data.labels.shift();
            this.data.datasets.forEach(ds => ds.data.shift());
        }

        this.draw();
    }

    draw() {
        if (this.hidden) return;
        const ctx = this.ctx;
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        const padding = this.padding;

        ctx.clearRect(0, 0, width, height);
        if (!this.data.labels.length) return;

        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        // Fixed Y-axis for distance
        const yAxisLabels = [0, 5, 10, 15, 20];
        const min = yAxisLabels[0];
        const max = yAxisLabels[yAxisLabels.length - 1];
        const range = max - min || 1;
        const stepX = chartWidth / (this.data.labels.length - 1 || 1);

        // Grid + Y labels
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5;
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        yAxisLabels.forEach(yVal => {
            const y = padding + chartHeight - ((yVal - min) / range) * chartHeight;
            ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
            ctx.fillText(yVal.toFixed(0), 2, y + 3);
        });

        // Draw dataset (distance only)
        const ds = this.data.datasets[0];
        ctx.strokeStyle = this.colors[0];
        ctx.lineWidth = 2; ctx.beginPath();
        ds.data.forEach((v, i) => {
            if (v == null) return;
            const x = padding + i * stepX;
            const y = padding + chartHeight - ((v - min) / range) * chartHeight;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.fillStyle = this.colors[0];
        ds.data.forEach((v, i) => {
            if (v == null) return;
            const x = padding + i * stepX;
            const y = padding + chartHeight - ((v - min) / range) * chartHeight;
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        });
    }

    handleMouseMove(e) {
        if (!this.tooltip || !this.data.labels.length) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const chartWidth = this.canvas.width / (window.devicePixelRatio || 1) - this.padding * 2;
        const stepX = chartWidth / (this.data.labels.length - 1 || 1);
        const idx = Math.round((x - this.padding) / stepX);
        if (idx >= 0 && idx < this.data.labels.length) this.showTooltip(e.clientX, e.clientY, idx);
        else this.hideTooltip();
    }

    showTooltip(x, y, idx) {
        if (!this.tooltip) return;
        const label = this.data.labels[idx];
        const distance = this.data.datasets[0].data[idx];

        this.tooltip.innerHTML = `
            <div>Time: ${label}</div>
            <div>Distance: ${distance?.toFixed(1) ?? '--'} cm</div>
        `;
        const tooltipRect = this.tooltip.getBoundingClientRect();
        let left = x + 10, top = y - tooltipRect.height - 10;
        if (left + tooltipRect.width > window.innerWidth) left = x - tooltipRect.width - 10;
        if (top < 0) top = y + 10;
        this.tooltip.style.left = left + 'px';
        this.tooltip.style.top = top + 'px';
        this.tooltip.classList.add('show');
    }

    hideTooltip() { if (this.tooltip) this.tooltip.classList.remove('show'); }

    toggle() { this.hidden = !this.hidden; this.canvas.style.display = this.hidden ? 'none' : 'block'; if (!this.hidden) this.draw(); }

    setData(data) {
        this.data = data;
        this.draw();
    }
}

// ------------------------ Modal functions ------------------------
function showBackModal() {
    const modal = document.getElementById('backModal');
    modal.classList.add('show');
}

function hideBackModal() {
    const modal = document.getElementById('backModal');
    modal.classList.remove('show');
}

function handleBackConfirmation() {
    hideBackModal();
    window.location.href = '/stop_act2';
}

// ------------------------ Initialize everything ------------------------
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCharts();
    initNotifications();
    initModalHandlers();
    fetchHistoricalData();
    fetchRealTimeData();
    setInterval(fetchRealTimeData, 2000);
});

// ------------------------ Initialize modal handlers ------------------------
function initModalHandlers() {
    const backButton = document.getElementById('backBtn');
    if (backButton) {
        backButton.addEventListener('click', function(e) {
            e.preventDefault();
            showBackModal();
        });
    }

    document.getElementById('modalClose').addEventListener('click', hideBackModal);
    document.getElementById('modalCancel').addEventListener('click', hideBackModal);
    document.getElementById('modalConfirm').addEventListener('click', handleBackConfirmation);

    document.getElementById('backModal').addEventListener('click', function(e) {
        if (e.target === this) hideBackModal();
    });
}

// ------------------------ Global vars ------------------------
let realChart, histChart;
let errorNotificationShown = false;

// ------------------------ Theme ------------------------
function initTheme() {
    const themeBtn = document.getElementById('themeBtn');
    const saved = localStorage.getItem('theme') || 'light';

    document.body.setAttribute('data-theme', saved);
    themeBtn.textContent = saved === 'light' ? '🌙' : '☀️';

    themeBtn.onclick = () => {
        const current = document.body.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        themeBtn.textContent = newTheme === 'light' ? '🌙' : '☀️';
        localStorage.setItem('theme', newTheme);
        setTimeout(() => {
            if (realChart) realChart.draw();
            if (histChart) histChart.draw();
        }, 100);
    };
}

// ------------------------ Initialize charts ------------------------
function initCharts() {
    realChart = new SimpleChart(document.getElementById('realChart'), { maxPoints: 20 });
    realChart.setTooltip(document.getElementById('realTooltip'));
    document.getElementById('toggleReal').onclick = () => realChart.toggle();

    histChart = new SimpleChart(document.getElementById('histChart'), { maxPoints: 500 });
    histChart.setTooltip(document.getElementById('histTooltip'));
    document.getElementById('toggleHist').onclick = () => histChart.toggle();

    // Hook up Clear button
    const clearBtn = document.getElementById('clearData');
    if (clearBtn) {
        clearBtn.onclick = clearHistoricalData;
    }
}

// ------------------------ Fetch data ------------------------
async function fetchRealTimeData() {
    let temperature = null, humidity = null, distance = null, buzzer = 'OFF';

    try {
        const res = await fetch('/sensor2'); 
        if (res.ok) {
            const data = await res.json();
            temperature = parseFloat(data.temperature);
            humidity = parseFloat(data.humidity);
            distance = parseFloat(data.distance);
            buzzer = data.buzzer ?? 'OFF';
        }
        updateStatus(true);
    } catch (err) {
        console.error('Fetch error:', err);
        updateStatus(false);
    }

    const lastDistance = realChart.data.datasets[0]?.data.slice(-1)[0] ?? 0;
    distance = !isNaN(distance) ? distance : lastDistance;

    const time = new Date().toLocaleTimeString('en-US', { hour12: false });

    realChart.addData(time, { distance });
    histChart.addData(time, { distance });

    updateCards(distance, temperature, humidity, buzzer);
    document.getElementById('time').textContent = time;
}

// ------------------------ Load historical data ------------------------
async function fetchHistoricalData() {
    try {
        const res = await fetch('/history2');
        if (!res.ok) return;

        const data = await res.json();
        if (!data.labels || !data.distance) return;

        histChart.setData({
            labels: data.labels,
            datasets: [{ data: data.distance }]
        });
    } catch (err) {
        console.error('Error loading historical data:', err);
    }
}

// ------------------------ Cards update ------------------------
function updateCards(distance, temperature, humidity, buzzer) {
    document.getElementById('distance').textContent =
        distance != null ? distance.toFixed(1) + ' cm' : '--';
    const distBadge = document.getElementById('distanceBadge');
    distBadge.className = distance >= 12 ? 'badge danger' :
                          distance < 1 ? 'badge warn' : 'badge ok';
    distBadge.textContent = distance >= 12 ? '⚠️ Far Away' :
                            distance < 1 ? '📶 Too Close' : '✅ Normal';

    document.getElementById('temperature').textContent =
        temperature != null ? temperature.toFixed(1) + '°C' : '--';
    const tempBadge = document.getElementById('tempBadge');
    tempBadge.className = temperature > 35 ? 'badge danger' :
                          temperature < 15 ? 'badge warn' : 'badge ok';
    tempBadge.textContent = temperature > 35 ? '🔥 Hot' :
                            temperature < 15 ? '❄️ Cold' : '✅ Normal';

    document.getElementById('humidity').textContent =
        humidity != null ? humidity.toFixed(1) + '%' : '--';
    const humBadge = document.getElementById('humBadge');
    humBadge.className = humidity > 80 ? 'badge danger' :
                         humidity < 30 ? 'badge warn' : 'badge ok';
    humBadge.textContent = humidity > 80 ? '💧 High' :
                           humidity < 30 ? '🏜️ Low' : '✅ Normal';

    const buzzerIcon = document.getElementById('buzzer');
    const buzzerText = document.getElementById('buzzerText');
    const buzzerStatusIcon = document.getElementById('buzzerStatusIcon');
    if (buzzer === 'ON') {
        buzzerIcon.classList.add('buzzer-active');
        buzzerText.textContent = 'Active';
        buzzerStatusIcon.src = '/static/icons/speaker.png';
    } else {
        buzzerIcon.classList.remove('buzzer-active');
        buzzerText.textContent = 'Standby';
        buzzerStatusIcon.src = '/static/icons/mute.png';
    }
}

// ------------------------ Status & notifications ------------------------
function updateStatus(connected) {
    document.getElementById('status').textContent = connected ? '🟢' : '🔴';
}

function initNotifications() {
    document.getElementById('closeNotif').onclick = hideErrorNotification;
}

function showErrorNotification() {
    if (!errorNotificationShown) {
        document.getElementById('errorNotif').classList.add('show');
        errorNotificationShown = true;
    }
}

function hideErrorNotification() {
    document.getElementById('errorNotif').classList.remove('show');
    errorNotificationShown = false;
}

// ------------------------ Clear historical ------------------------
function clearHistoricalData() {
    if (confirm('Are you sure you want to clear all historical data?')) {
        fetch('/clear_history2', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'ok') {
                    histChart.setData({ labels: [], datasets: [{ data: [] }] });
                    alert('Historical data cleared!');
                } else {
                    alert('Error: ' + data.message);
                }
            })
            .catch(err => console.error(err));
    }
}
