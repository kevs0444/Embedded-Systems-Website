let map;
let marker;
let errorNotificationShown = false;
let mapInitialized = false;

// Initialize Google Map with loading state
function initMap() {
    try {
        // Neutral start position (no Manila default)
        const loadingLocation = { lat: 0, lng: 0 };

        map = new google.maps.Map(document.getElementById("map"), {
            center: loadingLocation,
            zoom: 2, // zoomed out world view
            styles: [
                {
                    featureType: "all",
                    elementType: "labels.text.fill",
                    stylers: [{ saturation: 36 }, { color: "#000000" }, { lightness: 40 }]
                },
                {
                    featureType: "all",
                    elementType: "labels.text.stroke",
                    stylers: [{ visibility: "on" }, { color: "#000000" }, { lightness: 16 }]
                },
                {
                    featureType: "all",
                    elementType: "labels.icon",
                    stylers: [{ visibility: "off" }]
                },
                {
                    featureType: "administrative",
                    elementType: "geometry.fill",
                    stylers: [{ color: "#000000" }, { lightness: 20 }]
                },
                {
                    featureType: "administrative",
                    elementType: "geometry.stroke",
                    stylers: [{ color: "#000000" }, { lightness: 17 }, { weight: 1.2 }]
                },
                {
                    featureType: "landscape",
                    elementType: "geometry",
                    stylers: [{ color: "#000000" }, { lightness: 20 }]
                },
                {
                    featureType: "poi",
                    elementType: "geometry",
                    stylers: [{ color: "#000000" }, { lightness: 21 }]
                },
                {
                    featureType: "road.highway",
                    elementType: "geometry.fill",
                    stylers: [{ color: "#000000" }, { lightness: 17 }]
                },
                {
                    featureType: "road.highway",
                    elementType: "geometry.stroke",
                    stylers: [{ color: "#000000" }, { lightness: 29 }, { weight: 0.2 }]
                },
                {
                    featureType: "road.arterial",
                    elementType: "geometry",
                    stylers: [{ color: "#000000" }, { lightness: 18 }]
                },
                {
                    featureType: "road.local",
                    elementType: "geometry",
                    stylers: [{ color: "#000000" }, { lightness: 16 }]
                },
                {
                    featureType: "transit",
                    elementType: "geometry",
                    stylers: [{ color: "#000000" }, { lightness: 19 }]
                },
                {
                    featureType: "water",
                    elementType: "geometry",
                    stylers: [{ color: "#000000" }, { lightness: 17 }]
                }
            ]
        });

        // Hidden marker until GPS fix
        marker = new google.maps.Marker({
            position: loadingLocation,
            map: map,
            title: "Waiting for GPS...",
            visible: false,
            icon: {
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                scaledSize: new google.maps.Size(40, 40)
            }
        });

        mapInitialized = true;
        console.log("Google Maps initialized (GPS loading...)");

        showGPSLoadingNotification();

        // Update GPS data every 2 seconds
        setInterval(updateGPSLocation, 2000);

        initTheme();
        initNotifications();

    } catch (error) {
        console.error("Error initializing Google Maps:", error);
        showErrorNotification();

        setTimeout(() => {
            if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
                initMap();
            }
        }, 3000);
    }
}

// Handle Google Maps API loading errors
window.gm_authFailure = function() {
    console.error("Google Maps authentication failed");
    showErrorNotification();
};

// =========================
// Update map with GPS data
// =========================
function updateGPSLocation() {
    fetch('/act6_data') // <-- corrected endpoint
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (!data.lat || !data.lon) {
                console.log("Waiting for GPS fix...");
                updateGPSDisplayLoading();
                return;
            }

            const newPos = { lat: data.lat, lng: data.lon };

            if (mapInitialized && marker) {
                marker.setPosition(newPos);
                marker.setVisible(true);

                if (data.fix) {
                    map.setCenter(newPos);
                    map.setZoom(16);
                }
            }

            updateGPSDisplay(data);
            updateStatus(true);
            hideErrorNotification();
            updateTime();
        })
        .catch(error => {
            console.error('Error fetching GPS data:', error);
            updateStatus(false);
            showErrorNotification();
        });
}

// GPS loading display
function updateGPSDisplayLoading() {
    document.getElementById('latitude').textContent = "--";
    document.getElementById('longitude').textContent = "--";
    document.getElementById('gpsFix').textContent = "Loading...";
    document.getElementById('gpsFix').className = 'value bad';
    document.getElementById('satellites').textContent = "--";
    document.getElementById('altitude').textContent = "--";
    document.getElementById('speed').textContent = "--";

    const gpsStatusBadge = document.getElementById('gpsStatusBadge');
    const gpsStatusText = document.getElementById('gpsStatusText');
    const gpsIcon = document.getElementById('gpsIcon');
    if (gpsStatusBadge) gpsStatusBadge.className = 'badge warn';
    if (gpsStatusText) gpsStatusText.textContent = 'Loading...';
    if (gpsIcon) gpsIcon.innerHTML = '<img src="/static/icons/finding.png" alt="GPS Loading Icon">';
}

// Update GPS display with real data
function updateGPSDisplay(data) {
    document.getElementById('latitude').textContent = data.lat.toFixed(6);
    document.getElementById('longitude').textContent = data.lon.toFixed(6);

    const gpsFixElement = document.getElementById('gpsFix');
    gpsFixElement.textContent = data.fix ? 'Acquired' : 'Searching';
    gpsFixElement.className = data.fix ? 'value good' : 'value bad';
    document.getElementById('satellites').textContent = data.satellites;
    document.getElementById('latitudeValue').textContent = data.lat.toFixed(6);
    document.getElementById('longitudeValue').textContent = data.lon.toFixed(6);
    document.getElementById('altitude').textContent = data.altitude + 'm';
    document.getElementById('speed').textContent = data.speed + 'knots';

    const gpsStatusBadge = document.getElementById('gpsStatusBadge');
    const gpsStatusText = document.getElementById('gpsStatusText');
    const gpsIcon = document.getElementById('gpsIcon');

    if (data.fix) {
        gpsStatusBadge.className = 'badge ok';
        gpsStatusText.textContent = 'Acquired';
        if (gpsIcon) gpsIcon.innerHTML = '<img src="/static/icons/gps-on.png" alt="GPS On Icon">';
    } else {
        gpsStatusBadge.className = 'badge danger';
        gpsStatusText.textContent = 'Searching';
        if (gpsIcon) gpsIcon.innerHTML = '<img src="/static/icons/gps-off.png" alt="GPS Off Icon">';
    }

    document.getElementById('latitudeBadge').textContent = data.lat >= 0 ? 'N' : 'S';
    document.getElementById('longitudeBadge').textContent = data.lon >= 0 ? 'E' : 'W';
}

// Show temporary GPS loading notification
function showGPSLoadingNotification() {
    const n = document.createElement("div");
    n.className = "notification gps-loading";
    n.innerHTML = "⏳ GPS is loading... searching for satellites";
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 5000);
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
        });
    }
}

// =========================
// Notifications
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
    window.location.href = '/';
}

document.addEventListener('DOMContentLoaded', () => {
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

    setTimeout(() => {
        if (!mapInitialized && typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
            initMap();
        } else if (!mapInitialized) {
            console.error("Google Maps API failed to load");
            showErrorNotification();
        }
    }, 3000);
});
