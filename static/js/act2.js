// Lightweight chart implementation without external dependencies
class SimpleChart {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.data = { labels: [], datasets: [] };
        this.options = options;
        this.colors = ['#2196f3', '#f44336', '#4caf50']; // Added colors for temp and humidity
        this.maxPoints = options.maxPoints || 20;
        this.hidden = false;
        this.tooltip = null;
        this.padding = 40;
        
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.hideTooltip());
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(dpr, dpr);
        
        if (this.data.labels.length > 0) {
            this.draw();
        }
    }

    setTooltip(tooltipElement) {
        this.tooltip = tooltipElement;
    }

    handleMouseMove(e) {
        if (this.hidden || !this.tooltip || !this.data.labels.length) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const chartWidth = this.canvas.width / (window.devicePixelRatio || 1) - this.padding * 2;
        const stepX = chartWidth / (this.data.labels.length - 1 || 1);
        
        const dataIndex = Math.round((x - this.padding) / stepX);
        
        if (dataIndex >= 0 && dataIndex < this.data.labels.length) {
            this.showTooltip(e.clientX, e.clientY, dataIndex);
        } else {
            this.hideTooltip();
        }
    }

    showTooltip(x, y, index) {
        const label = this.data.labels[index];
        const distance = this.data.datasets[0]?.data[index];
        const temperature = this.data.datasets[1]?.data[index];
        const humidity = this.data.datasets[2]?.data[index];

        // Add distance status to tooltip
        let distanceStatus = '';
        if (distance !== null && distance !== undefined) {
            if (distance >= 12) {
                distanceStatus = ' (Far Away)';
            } else if (distance < 1) {
                distanceStatus = ' (Too Close)';
            } else {
                distanceStatus = ' (Normal)';
            }
        }

        this.tooltip.innerHTML = `
            <div class="tooltip-time">${label}</div>
            <div class="tooltip-data">
                <div class="tooltip-item">
                    <div class="tooltip-color" style="background: #2196f3;"></div>
                    <span>Distance: ${distance?.toFixed(1) || '--'} cm${distanceStatus}</span>
                </div>
                <div class="tooltip-item">
                    <div class="tooltip-color" style="background: #f44336;"></div>
                    <span>Temp: ${temperature?.toFixed(1) || '--'} °C</span>
                </div>
                <div class="tooltip-item">
                    <div class="tooltip-color" style="background: #4caf50;"></div>
                    <span>Humidity: ${humidity?.toFixed(1) || '--'} %</span>
                </div>
            </div>
        `;

        const rect = this.canvas.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        
        // Calculate position to keep tooltip within viewport
        let left = x + 15;
        let top = y - 15;
        
        // Check if tooltip would go off the right edge
        if (left + tooltipRect.width > window.innerWidth) {
            left = x - tooltipRect.width - 15;
        }
        
        // Check if tooltip would go off the bottom edge
        if (top + tooltipRect.height > window.innerHeight) {
            top = y - tooltipRect.height - 15;
        }
        
        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
        this.tooltip.classList.add('show');
    }

    hideTooltip() {
        if (this.tooltip) {
            this.tooltip.classList.remove('show');
        }
    }

    setData(data) {
        this.data = data;
        this.draw();
    }

    addData(label, values) {
        // Ensure we have valid data before adding
        const hasValidData = values.distance !== null && values.distance !== undefined;
        
        if (hasValidData) {
            this.data.labels.push(label);
            
            // Initialize datasets if they don't exist
            if (!this.data.datasets[0]) {
                this.data.datasets[0] = { data: [] }; // Distance
            }
            if (!this.data.datasets[1]) {
                this.data.datasets[1] = { data: [] }; // Temperature
            }
            if (!this.data.datasets[2]) {
                this.data.datasets[2] = { data: [] }; // Humidity
            }
            
            // Add values to each dataset
            this.data.datasets[0].data.push(values.distance);
            this.data.datasets[1].data.push(values.temperature);
            this.data.datasets[2].data.push(values.humidity);

            if (this.data.labels.length > this.maxPoints) {
                this.data.labels.shift();
                this.data.datasets.forEach(dataset => dataset.data.shift());
            }
            this.draw();
        }
    }

    draw() {
        if (this.hidden) return;
        
        const { width, height } = this.canvas;
        const ctx = this.ctx;
        const padding = this.padding;
        const chartWidth = width / (window.devicePixelRatio || 1) - padding * 2;
        const chartHeight = height / (window.devicePixelRatio || 1) - padding * 2;

        ctx.clearRect(0, 0, width, height);
        
        if (!this.data.labels.length) return;

        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#fff' : '#333';
        const gridColor = isDark ? '#404040' : '#e0e0e0';

        // Find min and max across all datasets for proper scaling
        let min = Infinity, max = -Infinity;
        let hasValidData = false;
        
        this.data.datasets.forEach(dataset => {
            dataset.data.forEach(value => {
                if (value !== null && value !== undefined && !isNaN(value)) {
                    min = Math.min(min, value);
                    max = Math.max(max, value);
                    hasValidData = true;
                }
            });
        });
        
        // If no valid data, don't draw
        if (!hasValidData) return;
        
        // Add padding to range for better visualization
        const paddingRange = (max - min) * 0.1;
        min = min - paddingRange;
        max = max + paddingRange;
        
        // If all values are the same, add some range for visibility
        if (min === max) {
            min = min - 1;
            max = max + 1;
        }
        
        const range = max - min || 1;
        const stepX = chartWidth / (this.data.labels.length - 1 || 1);

        // Draw grid lines
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 5; i++) {
            const y = padding + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width / (window.devicePixelRatio || 1) - padding, y);
            ctx.stroke();
        }

        // Draw each dataset
        this.data.datasets.forEach((dataset, index) => {
            if (!dataset.data.length) return;
            
            ctx.strokeStyle = this.colors[index];
            ctx.lineWidth = 2;
            ctx.beginPath();

            let firstValidPoint = true;
            dataset.data.forEach((value, i) => {
                if (value === null || value === undefined) {
                    firstValidPoint = true; // Start new path on next valid point
                    return;
                }
                
                const x = padding + i * stepX;
                const y = padding + chartHeight - ((value - min) / range) * chartHeight;
                
                if (firstValidPoint) {
                    ctx.moveTo(x, y);
                    firstValidPoint = false;
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();

            // Draw points
            ctx.fillStyle = this.colors[index];
            dataset.data.forEach((value, i) => {
                if (value === null || value === undefined) return;
                
                const x = padding + i * stepX;
                const y = padding + chartHeight - ((value - min) / range) * chartHeight;
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            });
        });

        // Draw Y-axis labels
        ctx.fillStyle = textColor;
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        for (let i = 0; i <= 4; i++) {
            const value = min + (range / 4) * (4 - i);
            const y = padding + (chartHeight / 4) * i;
            ctx.fillText(value.toFixed(1), 25, y + 4);
        }
    }

    toggle() {
        this.hidden = !this.hidden;
        this.canvas.style.display = this.hidden ? 'none' : 'block';
        if (!this.hidden) this.draw();
    }
}

// Global vars
let realChart, histChart;
let errorNotificationShown = false;

// Modal functions
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

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initCharts();
    initNotifications();
    loadHistoricalData();
    fetchData();
    setInterval(fetchData, 2000);

    document.getElementById('clearData').onclick = clearHistoricalData;

    const backButton = document.querySelector('.back-btn');
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
});

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

function initCharts() {
    const realCanvas = document.getElementById('realChart');
    const histCanvas = document.getElementById('histChart');

    realChart = new SimpleChart(realCanvas, { maxPoints: 20 });
    histChart = new SimpleChart(histCanvas, { maxPoints: 500 });

    realChart.setTooltip(document.getElementById('realTooltip'));
    histChart.setTooltip(document.getElementById('histTooltip'));

    document.getElementById('toggleReal').onclick = () => realChart.toggle();
    document.getElementById('toggleHist').onclick = () => histChart.toggle();
}

function loadHistoricalData() {
    fetch('/history2')
        .then(res => res.json())
        .then(data => {
            if (data.labels && data.labels.length > 0) {
                histChart.setData({
                    labels: data.labels,
                    datasets: [
                        { data: data.distance || [] },
                        { data: data.temperature || [] },
                        { data: data.humidity || [] }
                    ]
                });
                console.log(`Loaded ${data.labels.length} historical data points`);
            }
        })
        .catch(error => {
            console.error('Error loading historical data:', error);
        });
}

async function fetchData() {
    try {
        const response = await fetch('/sensor2');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        updateStatus(true);
        
        // Validate data structure
        if (data.error || data.distance === null || data.distance === undefined) {
            updateUI('--', '--', '--', 'OFF');
            showErrorNotification();
        } else {
            // Ensure numeric values
            const distance = !isNaN(parseFloat(data.distance)) ? parseFloat(data.distance) : '--';
            const temperature = !isNaN(parseFloat(data.temperature)) ? parseFloat(data.temperature) : '--';
            const humidity = !isNaN(parseFloat(data.humidity)) ? parseFloat(data.humidity) : '--';
            
            updateUI(distance, temperature, humidity, data.buzzer);
            updateRealTimeChart({
                distance: distance !== '--' ? distance : null,
                temperature: temperature !== '--' ? temperature : null,
                humidity: humidity !== '--' ? humidity : null
            });
            hideErrorNotification();
        }
        updateTime();
    } catch (error) {
        console.error('Fetch error:', error);
        updateStatus(false);
        showErrorNotification();
    }
}

function updateUI(distance, temperature, humidity, buzzer) {
    document.getElementById('distance').textContent = distance;
    document.getElementById('temperature').textContent = temperature;
    document.getElementById('humidity').textContent = humidity;

    const distanceBadge = document.getElementById('distanceBadge');
    const tempBadge = document.getElementById('tempBadge');
    const humBadge = document.getElementById('humBadge');
    
    const d = parseFloat(distance);
    const t = parseFloat(temperature);
    const h = parseFloat(humidity);
    
    // UPDATED: Distance badge logic
    if (isNaN(d)) {
        distanceBadge.className = 'badge';
        distanceBadge.textContent = '--';
    } else if (d >= 12) {
        distanceBadge.className = 'badge danger';
        distanceBadge.textContent = '⚠️ Far Away';
    } else if (d < 1) {
        distanceBadge.className = 'badge warn';
        distanceBadge.textContent = '🔶 Too Close';
    } else {
        distanceBadge.className = 'badge ok';
        distanceBadge.textContent = '✅ Normal';
    }
    
    // Temperature badge
    if (isNaN(t)) {
        tempBadge.className = 'badge';
        tempBadge.textContent = '--';
    } else if (t > 35) {
        tempBadge.className = 'badge danger';
        tempBadge.textContent = '🔥 Hot';
    } else if (t < 15) {
        tempBadge.className = 'badge warn';
        tempBadge.textContent = '❄️ Cold';
    } else {
        tempBadge.className = 'badge ok';
        tempBadge.textContent = '✅ Normal';
    }
    
    // Humidity badge
    if (isNaN(h)) {
        humBadge.className = 'badge';
        humBadge.textContent = '--';
    } else if (h > 80) {
        humBadge.className = 'badge danger';
        humBadge.textContent = '💧 High';
    } else if (h < 30) {
        humBadge.className = 'badge warn';
        humBadge.textContent = '🏜️ Low';
    } else {
        humBadge.className = 'badge ok';
        humBadge.textContent = '✅ Normal';
    }

    const buzzerIcon = document.getElementById('buzzer');
    const buzzerText = document.getElementById('buzzerText');
    const buzzerStatusIcon = document.getElementById('buzzerStatusIcon');
    const buzzerBadge = document.getElementById('buzzerBadge');
    
    // UPDATED: Check if distance is 12cm or more for alert
    const isAlert = buzzer === 'ON' || (d >= 12 && !isNaN(d));

    if (isAlert) {
        buzzerIcon.className = 'buzzer-icon buzzer-active';
        buzzerText.textContent = 'ALERT';
        buzzerStatusIcon.src = '/static/icons/speaker.png';
        buzzerStatusIcon.alt = 'Speaker Icon';
        buzzerBadge.className = 'badge danger';
        buzzerBadge.textContent = '🔊 Active';
    } else {
        buzzerIcon.className = 'buzzer-icon';
        buzzerText.textContent = 'Standby';
        buzzerStatusIcon.src = '/static/icons/mute.png';
        buzzerStatusIcon.alt = 'Mute Icon';
        buzzerBadge.className = 'badge ok';
        buzzerBadge.textContent = '🔇 Muted';
    }
}

function updateRealTimeChart(data) {
    const time = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    // Only add data if distance is valid
    if (data.distance !== null && data.distance !== undefined) {
        realChart.addData(time, {
            distance: parseFloat(data.distance),
            temperature: data.temperature !== null ? parseFloat(data.temperature) : null,
            humidity: data.humidity !== null ? parseFloat(data.humidity) : null
        });
    }
}

function updateStatus(connected) {
    document.getElementById('status').textContent = connected ? '🟢' : '🔴';
}

function updateTime() {
    document.getElementById('time').textContent = new Date().toLocaleTimeString();
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

function clearHistoricalData() {
    if (confirm('Are you sure you want to clear all historical data? This action cannot be undone.')) {
        fetch('/clear_history2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                histChart.setData({
                    labels: [],
                    datasets: [
                        { data: [] },
                        { data: [] },
                        { data: [] }
                    ]
                });
                alert('Historical data cleared successfully!');
            } else {
                alert('Error clearing data: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error clearing historical data:', error);
            alert('Error clearing data. Please try again.');
        });
    }
}

setInterval(() => {
    loadHistoricalData();
}, 60000);