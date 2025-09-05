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
            // fetch again after 2 seconds
            setTimeout(fetchUltrasonicData, 2000);
        });
}

fetchUltrasonicData();

