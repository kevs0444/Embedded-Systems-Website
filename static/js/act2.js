function fetchUltrasonicData() {
    fetch("/sensor2")
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                document.getElementById("status").textContent = "🔴 Error reading sensor";
                return;
            }
            document.getElementById("status").textContent = "🟢 Running";
            document.getElementById("distance").textContent = data.distance;
            document.getElementById("time").textContent = data.time;
        })
        .catch(() => {
            document.getElementById("status").textContent = "⚠️ Connection error";
        })
        .finally(() => {
            setTimeout(fetchUltrasonicData, 200);  // fetch again after 200ms
        });
}

fetchUltrasonicData();


// static/js/act2.js
setInterval(fetchUltrasonicData, 300);  // fetch every 300ms
fetchUltrasonicData();

