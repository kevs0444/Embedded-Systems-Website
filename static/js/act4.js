/* ============================
   act4.js - Gas + Vibration + Buzzer Dashboard
   Updated with Bubble Chart (time scale)
   Modern bubble colors + shadows
   ============================ */

let errorNotificationShown = false;
// ----------------- Email Notification -----------------
let emailNotifShown = false;
// ----------------- Bubble Chart Setup -----------------
let gasBubbleChart = null;
let gasData = []; // store last N readings

function initGasChart() {
    const ctx = document.getElementById('gasBubbleChart').getContext('2d');
    gasBubbleChart = new Chart(ctx, {
        type: 'bubble',
        data: {
            datasets: [{
                label: 'Gas Sensor Readings',
                data: [], // {x, y, r, backgroundColor, borderColor}
                borderWidth: 2,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return `⏱ ${new Date(ctx.raw.x).toLocaleTimeString()} | 🌫 Gas: ${ctx.raw.y} ppm`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'second' },
                    title: { display: true, text: "Time" }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Gas (ppm)" }
                }
            }
        }
    });
}

function updateGasChart(newGasValue) {
    if (!gasBubbleChart) return;

    const bubble = {
        x: Date.now(),
        y: newGasValue,
        r: Math.max(6, Math.min(newGasValue / 8, 25)) // bubble size
    };

    // ✅ Modern bubble colors
    let bubbleColor, borderCol;
    if (newGasValue >= 200) {
        bubbleColor = 'rgba(139, 0, 0, 0.85)';   // dark red fill
        borderCol = 'rgba(183, 28, 28, 1)';      // strong red border
    } else if (newGasValue >= 100) {
        bubbleColor = 'rgba(255, 152, 0, 0.75)'; // orange fill
        borderCol = 'rgba(255, 87, 34, 1)';      // deep orange border
    } else {
        bubbleColor = 'rgba(33, 150, 243, 0.75)'; // blue fill
        borderCol = 'rgba(13, 71, 161, 1)';       // dark blue border
    }

    bubble.backgroundColor = bubbleColor;
    bubble.borderColor = borderCol;

    gasData.push(bubble);
    if (gasData.length > 15) gasData.shift();

    gasBubbleChart.data.datasets[0].data = [...gasData];
    gasBubbleChart.update();
}

// ----------------- DOMContentLoaded -----------------
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNotifications();
    initGasChart();
    fetchData();
    setInterval(fetchData, 2000); // fetch every 2s

    const backButton = document.querySelector('.back-btn');
    if (backButton) backButton.addEventListener('click', e => { 
        e.preventDefault(); 
        showBackModal(); 
    });

    const modalClose = document.getElementById('modalClose');
    const modalCancel = document.getElementById('modalCancel');
    const modalConfirm = document.getElementById('modalConfirm');
    if (modalClose) modalClose.addEventListener('click', hideBackModal);
    if (modalCancel) modalCancel.addEventListener('click', hideBackModal);
    if (modalConfirm) modalConfirm.addEventListener('click', handleBackConfirmation);
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
    window.location.href = '/stop_act4'; 
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

// ----------------- Fetch Data -----------------
async function fetchData() {
    try {
        const resp = await fetch('/act4_sensor'); 
        if (!resp.ok) throw new Error('Sensor fetch failed');
        const data = await resp.json();

        updateStatus(true);

        const gasValue = Number(data.gas);
        const vibrationDetected = Boolean(data.vibration);
        const buzzerActive = Boolean(data.buzzer);

        // Update UI
        const gasEl = document.getElementById('gas');
        const vibrationEl = document.getElementById('vibration');
        if (gasEl) gasEl.textContent = gasValue + ' ppm';
        if (vibrationEl) vibrationEl.textContent = vibrationDetected ? 'Detected' : 'None';

        updateBadges(gasValue, vibrationDetected);
        updateBuzzerUI(buzzerActive);
        updateGasChart(gasValue); // bubble chart

        hideErrorNotification();
        updateTime();
    } catch (err) {
        console.error(err);
        updateStatus(false);
        showErrorNotification();
    }
}

// ----------------- Update Badges -----------------
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

// ----------------- Update Buzzer UI -----------------
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

function showEmailNotification() {
    const n = document.getElementById('emailNotif');
    if (!n || emailNotifShown) return;
    n.classList.add('show');
    n.style.display = 'block';
    emailNotifShown = true;

    setTimeout(() => {
        hideEmailNotification();
    }, 5000); // hide after 5 seconds
}

function hideEmailNotification() {
    const n = document.getElementById('emailNotif');
    if (!n) return;
    n.classList.remove('show');
    n.style.display = 'none';
    emailNotifShown = false;
}

// ----------------- Poll for Email Status -----------------
async function checkEmailStatus() {
    try {
        const resp = await fetch('/act4_email_status');
        if (!resp.ok) throw new Error('Email status fetch failed');
        const data = await resp.json();
        if (data.sent) {
            showEmailNotification();
        }
    } catch (err) {
        console.error(err);
    }
}

// Call periodically
setInterval(checkEmailStatus, 3000); // check every 3 seconds

// ----------------- Email Modal -----------------
const emailBtn = document.getElementById('emailBtn');
const emailModal = document.getElementById('emailModal');
const sendEmailBtn = document.getElementById('sendEmailBtn');
const recipientInput = document.getElementById('recipientEmail');
const emailStatus = document.getElementById('emailStatus');

if (emailBtn && emailModal) {
    emailBtn.addEventListener('click', () => {
        emailModal.style.display = 'block';
    });
}

// Close modal when clicking outside content
window.addEventListener('click', (e) => {
    if (e.target === emailModal) emailModal.style.display = 'none';
});

if (sendEmailBtn) {
    sendEmailBtn.addEventListener('click', async () => {
        const email = recipientInput.value.trim();
        if (!email) {
            emailStatus.textContent = "Please enter a valid email";
            emailStatus.style.color = "#f44336";
            return;
        }
        emailStatus.textContent = "Sending...";
        emailStatus.style.color = "#2196f3";

        try {
            const resp = await fetch('/send_email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recipient: email })
            });
            const result = await resp.json();
            if (result.success) {
                emailStatus.textContent = "✉️ Email sent successfully!";
                emailStatus.style.color = "#4caf50";
                setTimeout(() => { emailModal.style.display = 'none'; emailStatus.textContent = ""; }, 2000);
            } else {
                emailStatus.textContent = "Failed to send email.";
                emailStatus.style.color = "#f44336";
            }
        } catch (err) {
            console.error(err);
            emailStatus.textContent = "Error sending email.";
            emailStatus.style.color = "#f44336";
        }
    });
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
