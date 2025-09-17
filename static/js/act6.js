let map;
let marker;

// Initialize Google Map
function initMap() {
  const defaultLocation = { lat: 14.5995, lng: 120.9842 }; // Manila

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultLocation,
    zoom: 13,
  });

  marker = new google.maps.Marker({
    position: defaultLocation,
    map: map,
    title: "Default Location: Manila",
  });

  // Start updating GPS data every 2 seconds
  setInterval(updateGPSLocation, 2000);
}

// Function to update map with GPS data
function updateGPSLocation() {
  fetch('/act6_location')
    .then(response => response.json())
    .then(data => {
      const lat = data.lat;
      const lon = data.lon;
      const newPos = { lat: lat, lng: lon };

      // Update marker position
      marker.setPosition(newPos);

      // Update map view if we have a GPS fix
      if (data.fix) {
        map.setCenter(newPos);
        map.setZoom(16);

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <b>Current Location</b><br>
            Lat: ${lat.toFixed(6)}<br>
            Lon: ${lon.toFixed(6)}<br>
            Altitude: ${data.altitude}m<br>
            Speed: ${data.speed}knots<br>
            Satellites: ${data.satellites}
          `
        });
        infoWindow.open(map, marker);
      }

      // Update status display
      updateStatusDisplay(data);
    })
    .catch(error => console.error('Error fetching GPS data:', error));
}

// Function to update status display
function updateStatusDisplay(data) {
  const statusDiv = document.getElementById('gps-status');
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
