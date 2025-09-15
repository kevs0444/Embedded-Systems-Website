// Initialize the map centered on Manila (default coords)
let map = L.map('map').setView([14.5995, 120.9842], 13);

// Load MapTiler tiles (modern style)
L.tileLayer('https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=8CIM9NVDHRIdzhftDVPp', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors &copy; <a href="https://www.maptiler.com/">MapTiler</a>',
  tileSize: 512,
  zoomOffset: -1,
  maxZoom: 22
}).addTo(map);

// Add a marker at default location
let marker = L.marker([14.5995, 120.9842]).addTo(map);
marker.bindPopup("<b>Default Location:</b> Manila").openPopup();

// Function to update map with GPS data
function updateGPSLocation() {
  fetch('/act6_location')
    .then(response => response.json())
    .then(data => {
      const lat = data.lat;
      const lon = data.lon;
      
      // Update marker position
      marker.setLatLng([lat, lon]);
      
      // Update map view if we have a GPS fix
      if (data.fix) {
        map.setView([lat, lon], 16);
        marker.bindPopup(`
          <b>Current Location</b><br>
          Lat: ${lat.toFixed(6)}<br>
          Lon: ${lon.toFixed(6)}<br>
          Altitude: ${data.altitude}m<br>
          Speed: ${data.speed}knots<br>
          Satellites: ${data.satellites}
        `).openPopup();
      } else {
        marker.bindPopup("<b>Searching for GPS signal...</b>").openPopup();
      }
      
      // Update status display
      updateStatusDisplay(data);
    })
    .catch(error => console.error('Error fetching GPS data:', error));
}

// Function to update status display
function updateStatusDisplay(data) {
  const statusDiv = document.getElementById('gps-status') || createStatusDisplay();
  
  statusDiv.innerHTML = `
    <div class="status-item">
      <span class="label">GPS Fix:</span>
      <span class="value ${data.fix ? 'good' : 'bad'}">${data.fix ? 'Acquired' : 'Searching'}</span>
    </div>
    <div class="status-item">
      <span class="label">Satellites:</span>
      <span class="value">${data.satellites}</span>
    </div>
    <div class="status-item">
      <span class="label">Latitude:</span>
      <span class="value">${data.lat.toFixed(6)}</span>
    </div>
    <div class="status-item">
      <span class="label">Longitude:</span>
      <span class="value">${data.lon.toFixed(6)}</span>
    </div>
    <div class="status-item">
      <span class="label">Altitude:</span>
      <span class="value">${data.altitude}m</span>
    </div>
    <div class="status-item">
      <span class="label">Speed:</span>
      <span class="value">${data.speed}knots</span>
    </div>
  `;
}

// Function to create status display if it doesn't exist
function createStatusDisplay() {
  const statusDiv = document.createElement('div');
  statusDiv.id = 'gps-status';
  statusDiv.style.cssText = `
    position: absolute;
    top: 10px;
    right: 10px;
    background: white;
    padding: 10px;
    border-radius: 5px;
    z-index: 1000;
    font-family: Arial, sans-serif;
    font-size: 12px;
    box-shadow: 0 0 10px rgba(0,0,0,0.2);
  `;
  
  document.body.appendChild(statusDiv);
  return statusDiv;
}

// Update GPS location every 2 seconds
setInterval(updateGPSLocation, 2000);

// Initial update
updateGPSLocation();

// Optional: add geolocation support for browser location
map.locate({ setView: true, maxZoom: 16 });

map.on('locationfound', function(e) {
  let radius = e.accuracy / 2;

  L.marker(e.latlng).addTo(map)
    .bindPopup("You are within " + radius.toFixed(0) + " meters from this point").openPopup();

  L.circle(e.latlng, radius).addTo(map);
});

map.on('locationerror', function() {
  alert("Could not access your location.");
});