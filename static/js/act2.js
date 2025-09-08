let distanceChart = null;
let envChart = null;
let tick = 0;

function initCharts() {
    // Distance Chart
    const ctxDist = document.getElementById('distanceChart').getContext('2d');
    distanceChart = new Chart(ctxDist, {
        type: 'scatter',
        data: {
            datasets: [
                { label:'Ultrasonic 1', data:[], borderColor:'#007bff', backgroundColor:'#007bff', pointRadius:4, showLine:false },
                { label:'Ultrasonic 2', data:[], borderColor:'#28a745', backgroundColor:'#28a745', pointRadius:4, showLine:false }
            ]
        },
        options:{
            responsive:true,
            animation:false,
            plugins:{
                tooltip:{
                    enabled:true,
                    mode:'nearest',
                    intersect:true,
                    callbacks:{
                        label: function(ctx){
                            const d1 = ctx.dataset.label === 'Ultrasonic 1' ? ctx.raw.y : distanceChart.data.datasets[0].data[ctx.dataIndex]?.y;
                            const d2 = ctx.dataset.label === 'Ultrasonic 2' ? ctx.raw.y : distanceChart.data.datasets[1].data[ctx.dataIndex]?.y;
                            return `Time:${ctx.raw.x} | Dist1:${d1}cm | Dist2:${d2}cm`;
                        }
                    }
                }
            },
            scales:{
                x:{ beginAtZero:true, title:{display:true,text:'Time (index)'} },
                y:{ beginAtZero:true, title:{display:true,text:'Distance (cm)'} }
            }
        }
    });

    // Environment Chart (Temp & Humidity)
    const ctxEnv = document.getElementById('envChart').getContext('2d');
    envChart = new Chart(ctxEnv, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label:'Temperature (°C)', data:[], borderColor:'#ff5722', backgroundColor:'rgba(255,87,34,0.2)', fill:true, tension:0.3 },
                { label:'Humidity (%)', data:[], borderColor:'#2196f3', backgroundColor:'rgba(33,150,243,0.2)', fill:true, tension:0.3 }
            ]
        },
        options:{
            responsive:true,
            animation:false,
            plugins:{
                tooltip:{
                    enabled:true,
                    mode:'nearest',
                    intersect:true
                }
            },
            scales:{
                x:{ beginAtZero:true, title:{display:true,text:'Time (index)'} },
                y:{ beginAtZero:true, title:{display:true,text:'Value'} }
            }
        }
    });
}

async function fetchData(){
    try{
        const res = await fetch('/sensor2', {cache:'no-store'});
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Update cards
        document.getElementById('val-dist1').innerText = data.distance1;
        document.getElementById('val-dist2').innerText = data.distance2;
        document.getElementById('val-temp').innerText = data.temperature;
        document.getElementById('val-humid').innerText = data.humidity;

        // Update distance chart
        distanceChart.data.datasets[0].data.push({x:tick, y:data.distance1});
        distanceChart.data.datasets[1].data.push({x:tick, y:data.distance2});
        distanceChart.data.datasets.forEach(ds=>ds.data=ds.data.slice(-20));
        distanceChart.update();

        // Update environment chart
        envChart.data.labels.push(tick);
        envChart.data.datasets[0].data.push(data.temperature);
        envChart.data.datasets[1].data.push(data.humidity);
        envChart.data.labels = envChart.data.labels.slice(-20);
        envChart.data.datasets.forEach(ds=>ds.data=ds.data.slice(-20));
        envChart.update();

        tick++;
    } catch(err){
        console.error('fetchData error', err);
    }
}

window.addEventListener('DOMContentLoaded', ()=>{
    initCharts();
    setInterval(fetchData, 1000);
});
