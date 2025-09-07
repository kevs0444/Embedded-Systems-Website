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
        this.chartId = options.chartId || 'chart'; // Add chart identifier

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

        // ------------------- Dynamic Y-axis -------------------
        const ds = this.data.datasets[0];
        const validData = ds.data.filter(v => v != null);
        const dataMin = Math.min(...validData, 0);
        const dataMax = Math.max(...validData, 20); // default max 20

        // Compute nice Y-axis step
        let step = 5; 
        let range = dataMax - dataMin;
        if (range > 20) step = Math.ceil(range / 5 / 5) * 5; // adjust step dynamically
        const min = Math.floor(dataMin / step) * step;
        const max = Math.ceil(dataMax / step) * step;
        
        // Create Y-axis labels
        const yAxisLabels = [];
        for (let y = min; y <= max; y += step) yAxisLabels.push(y);

        const totalRange = max - min || 1;
        const stepX = chartWidth / (this.data.labels.length - 1 || 1);

        // ------------------- Grid + Y labels -------------------
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5;
        ctx.fillStyle = '#666';
        ctx.font = '10px sans-serif';
        yAxisLabels.forEach(yVal => {
            const y = padding + chartHeight - ((yVal - min) / totalRange) * chartHeight;
            ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
            ctx.fillText(yVal.toFixed(0), 2, y + 3);
        });

        // ------------------- Draw dataset -------------------
        ctx.strokeStyle = this.colors[0];
        ctx.lineWidth = 2; ctx.beginPath();
        ds.data.forEach((v, i) => {
            if (v == null) return;
            const x = padding + i * stepX;
            const y = padding + chartHeight - ((v - min) / totalRange) * chartHeight;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.fillStyle = this.colors[0];
        ds.data.forEach((v, i) => {
            if (v == null) return;
            const x = padding + i * stepX;
            const y = padding + chartHeight - ((v - min) / totalRange) * chartHeight;
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        });
    }

    showTooltip(x, y, index) {
        if (!this.tooltip) return;
        const label = this.data.labels[index];
        const distance = this.data.datasets[0].data[index];

        // Format time based on chart type
        let timeDisplay;
        if (this.maxPoints === 20) { // Real-time chart
            const time = new Date();
            timeDisplay = time.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } else {
            timeDisplay = label;
        }

        this.tooltip.innerHTML = `
            <div class="tooltip-time">${timeDisplay}</div>
            <div class="tooltip-data">
                <div class="tooltip-item">
                    <div class="tooltip-color" style="background: #2196f3;"></div>
                    <span>Distance: ${distance?.toFixed(1) || '--'} cm</span>
                </div>
            </div>
        `;

        const rect = this.canvas.getBoundingClientRect();
        const offsetX = x - rect.left;
        const offsetY = y - rect.top;

        // Position tooltip with offset from cursor
        this.tooltip.style.left = `${offsetX + 15}px`;
        this.tooltip.style.top = `${offsetY - 15}px`;

        this.tooltip.classList.add('show');
    }

    handleMouseMove(e) {
        if (!this.tooltip || !this.data.labels.length) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Check if mouse is within chart area
        if (mouseX < this.padding || mouseX > rect.width - this.padding ||
            mouseY < this.padding || mouseY > rect.height - this.padding) {
            this.hideTooltip();
            return;
        }
        
        const chartWidth = rect.width - (this.padding * 2);
        const stepX = chartWidth / (this.data.labels.length - 1 || 1);
        
        // Find closest data point
        const xPos = mouseX - this.padding;
        const idx = Math.round(xPos / stepX);
        
        if (idx >= 0 && idx < this.data.labels.length) {
            const value = this.data.datasets[0].data[idx];
            if (value !== null) {
                this.showTooltip(e.clientX, e.clientY, idx);
            } else {
                this.hideTooltip();
            }
        }
    }

    hideTooltip() { if (this.tooltip) this.tooltip.classList.remove('show'); }

    toggle() {
        this.hidden = !this.hidden;
        this.canvas.style.display = this.hidden ? 'none' : 'block';
        if (!this.hidden) this.draw();
        
        // Update toggle icon
        const chartId = this.canvas.id.replace('Chart', '');
        updateChartToggleIcon(chartId, this.hidden);
    }

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
    const themeIcon = document.getElementById('themeIcon');
    const saved = localStorage.getItem('theme') || 'light';

    document.body.setAttribute('data-theme', saved);
    
    // Set initial icon
    if (saved === 'light') {
        themeIcon.src = '/static/icons/dark-mode.png';
        themeIcon.alt = 'Switch to dark mode';
    } else {
        themeIcon.src = '/static/icons/light-mode.png';
        themeIcon.alt = 'Switch to light mode';
    }

    themeBtn.onclick = () => {
        const current = document.body.getAttribute('data-theme');
        const newTheme = current === 'light' ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        
        // Update the icon
        if (newTheme === 'light') {
            themeIcon.src = '/static/icons/dark-mode.png';
            themeIcon.alt = 'Switch to dark mode';
        } else {
            themeIcon.src = '/static/icons/light-mode.png';
            themeIcon.alt = 'Switch to light mode';
        }
        
        localStorage.setItem('theme', newTheme);
        
        setTimeout(() => {
            if (realChart) realChart.draw();
            if (histChart) histChart.draw();
        }, 100);
    };
}

// ------------------------ Initialize charts ------------------------
function initCharts() {
    realChart = new SimpleChart(document.getElementById('realChart'), {
        maxPoints: 20,
        chartId: 'realChart'
    });
    realChart.setTooltip(document.getElementById('realTooltip'));
    document.getElementById('toggleReal').onclick = () => realChart.toggle();

    histChart = new SimpleChart(document.getElementById('histChart'), {
        maxPoints: 500,
        chartId: 'histChart'
    });
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

    const time = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

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
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>
                    <img src="/static/icons/warning.png" alt="Warning" style="width:24px;height:24px;vertical-align:middle;margin-right:8px;">
                    Clear Historical Data
                </h3>
                <button class="modal-close">×</button>
            </div>
            <div class="modal-body">
                <p>Are you sure you want to clear all historical data?</p>
                <p>This action cannot be undone.</p>
            </div>
            <div class="modal-footer">
                <button class="modal-btn cancel">Cancel</button>
                <button class="modal-btn confirm">Clear Data</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('show');

    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    };

    modal.querySelector('.modal-close').onclick = closeModal;
    modal.querySelector('.cancel').onclick = closeModal;
    
    modal.querySelector('.confirm').onclick = () => {
        fetch('/clear_history2', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'ok') {
                    histChart.setData({ labels: [], datasets: [{ data: [] }] });
                    alert('Historical data cleared successfully!');
                } else {
                    alert('Error: ' + data.message);
                }
                closeModal();
            })
            .catch(err => {
                console.error(err);
                alert('Error clearing historical data');
                closeModal();
            });
    };

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

// Add these functions after the existing code
function updateChartToggleIcon(chartId, isHidden) {
    const toggleBtn = document.getElementById(`toggle${chartId}`);
    if (toggleBtn) {
        const img = toggleBtn.querySelector('img') || document.createElement('img');
        img.src = `/static/icons/${isHidden ? 'unhide' : 'hide'}.png`;
        img.alt = isHidden ? 'Show chart' : 'Hide chart';
        img.style.width = '20px';
        img.style.height = '20px';
        if (!toggleBtn.contains(img)) {
            toggleBtn.innerHTML = '';
            toggleBtn.appendChild(img);
        }
    }
}