let distanceChart=null, histChart=null;
let errorNotificationShown=false;
let dist1Data=[], dist2Data=[], distLabels=[];

// Modal and Theme
document.addEventListener('DOMContentLoaded',()=>{
    initTheme();
    initCharts();
    initNotifications();
    fetchData();
    setInterval(fetchData,2000);

    const clearBtn=document.getElementById('clearData');
    if(clearBtn) clearBtn.addEventListener('click',clearHistoricalData);

    const backButton=document.querySelector('.back-btn');
    if(backButton) backButton.addEventListener('click',function(e){ e.preventDefault(); showBackModal(); });

    const modalClose=document.getElementById('modalClose');
    const modalCancel=document.getElementById('modalCancel');
    const modalConfirm=document.getElementById('modalConfirm');
    if(modalClose) modalClose.addEventListener('click',hideBackModal);
    if(modalCancel) modalCancel.addEventListener('click',hideBackModal);
    if(modalConfirm) modalConfirm.addEventListener('click',handleBackConfirmation);
});

function showBackModal(){ const m=document.getElementById('backModal'); if(m) m.classList.add('show'); }
function hideBackModal(){ const m=document.getElementById('backModal'); if(m) m.classList.remove('show'); }
function handleBackConfirmation(){ hideBackModal(); window.location.href='/stop_act2'; }

function initTheme(){
    const themeBtn=document.getElementById('themeBtn'), themeIcon=document.getElementById('themeIcon');
    const saved=localStorage.getItem('theme')||'light';
    document.body.setAttribute('data-theme',saved);
    if(themeIcon) themeIcon.src=saved==='light'?'/static/icons/dark-mode.png':'/static/icons/light-mode.png';
    if(themeBtn) themeBtn.addEventListener('click',()=>{
        const current=document.body.getAttribute('data-theme')||'light';
        const next=current==='light'?'dark':'light';
        document.body.setAttribute('data-theme',next);
        localStorage.setItem('theme',next);
        if(themeIcon) themeIcon.src=next==='light'?'/static/icons/dark-mode.png':'/static/icons/light-mode.png';
    });
}

function initNotifications(){
    const closeNotif=document.getElementById('closeNotif');
    if(closeNotif) closeNotif.addEventListener('click',hideErrorNotification);
}

function showErrorNotification(){
    const n=document.getElementById('errorNotif'); if(!n) return;
    if(!errorNotificationShown){ n.classList.add('show'); n.style.display='block'; errorNotificationShown=true; }
}
function hideErrorNotification(){
    const n=document.getElementById('errorNotif'); if(!n) return;
    n.classList.remove('show'); n.style.display='none'; errorNotificationShown=false;
}

// ===================== Charts =====================
function initCharts(){
    const distCtx=document.getElementById('distanceChart').getContext('2d');
    const histCtx=document.getElementById('histChart').getContext('2d');

    distanceChart=new Chart(distCtx,{
        type:'scatter',
        data:{datasets:[
            {label:'Distance 1 (cm)', data:[], backgroundColor:'#ff5722'},
            {label:'Distance 2 (cm)', data:[], backgroundColor:'#2196f3'}
        ]},
        options:{
            responsive:true, animation:false,
            scales:{
                x:{title:{display:true,text:'Time (s)'}},
                y:{beginAtZero:true,title:{display:true,text:'Distance (cm)'}}
            }
        }
    });

    const tempColor='#ff5722', humColor='#2196f3';
    const baseOptions={responsive:true, maintainAspectRatio:false, animation:false, layout:{padding:{top:6,right:8,bottom:6,left:8}}, interaction:{mode:'index', intersect:false}, plugins:{legend:{display:true}}, scales:{x:{title:{display:true,text:'Time'}},y:{beginAtZero:true,title:{display:true,text:'Value'}}}, elements:{line:{tension:0.3}}};
    
    histChart=new Chart(histCtx,{
        type:'line',
        data:{labels:[], datasets:[
            {label:'Temperature (°C)', data:[], borderColor:tempColor, backgroundColor:'rgba(255,87,34,0.08)', fill:true, pointRadius:5, pointHoverRadius:12, pointBackgroundColor:tempColor},
            {label:'Humidity (%)', data:[], borderColor:humColor, backgroundColor:'rgba(33,150,243,0.08)', fill:true, pointRadius:5, pointHoverRadius:12, pointBackgroundColor:humColor}
        ]},
        options:baseOptions
    });
}

// ===================== Fetch Data =====================
async function fetchData(){
    try{
        const resp=await fetch('/act2_sensor'); if(!resp.ok) throw new Error('Sensor fetch failed');
        const data=await resp.json();

        updateStatus(true);

        const d1=Number(data.distance1), d2=Number(data.distance2);
        const t=Number(data.temperature), h=Number(data.humidity);
        const buz=data.buzzer||'OFF';

        document.getElementById('dist1').textContent=d1+' cm';
        document.getElementById('dist2').textContent=d2+' cm';
        updateUI(t,h,buz);

        // Scatter chart last 20 points
        const now=Date.now()/1000;
        distLabels.push(now);
        dist1Data.push({x:now,y:d1}); dist2Data.push({x:now,y:d2});
        if(dist1Data.length>20){ dist1Data.shift(); dist2Data.shift(); distLabels.shift(); }
        distanceChart.data.datasets[0].data=dist1Data;
        distanceChart.data.datasets[1].data=dist2Data;
        distanceChart.update();

        // Historical chart for temp/humidity
        updateHistChart(t,h);

        hideErrorNotification();
        updateTime();
    }catch(err){
        console.error(err);
        updateStatus(false);
        showErrorNotification();
    }
}

function updateHistChart(t,h){
    // Append new value
    const labels=histChart.data.labels;
    const tempData=histChart.data.datasets[0].data;
    const humData=histChart.data.datasets[1].data;
    const now=new Date().toLocaleTimeString();

    labels.push(now); tempData.push(t); humData.push(h);
    if(labels.length>60){ labels.shift(); tempData.shift(); humData.shift(); }

    histChart.update();

    // Save to JSON
    fetch('/save_hist', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({temperature:tempData, humidity:humData, labels:labels})});
}

function updateUI(temp,hum,buzzer){
    const tempEl=document.getElementById('temp'); const humEl=document.getElementById('humidity');
    if(tempEl) tempEl.textContent=temp+' °C';
    if(humEl) humEl.textContent=hum+' %';

    const tempBadge=document.getElementById('tempBadge'); const t=Number(temp);
    if(t>=38){ tempBadge.className='badge danger'; tempBadge.textContent='⚠️ High'; }
    else if(t>=30){ tempBadge.className='badge warn'; tempBadge.textContent='🔶 Warm'; }
    else{ tempBadge.className='badge ok'; tempBadge.textContent='✅ Normal'; }

    const buzzerIcon=document.getElementById('buzzer'); const buzzerText=document.getElementById('buzzerText'); const buzzerStatusIcon=document.getElementById('buzzerStatusIcon'); const buzzerBadge=document.getElementById('buzzerBadge');
    if(buzzer==='ON'||t>=38){ buzzerIcon.className='buzzer-icon buzzer-active'; buzzerText.textContent='ALERT'; buzzerStatusIcon.src='/static/icons/speaker.png'; buzzerBadge.className='badge danger'; }
    else{ buzzerIcon.className='buzzer-icon'; buzzerText.textContent='Standby'; buzzerStatusIcon.src='/static/icons/mute.png'; buzzerBadge.className='badge ok'; }
}

function updateStatus(connected){ const s=document.getElementById('status'); if(s) s.textContent=connected?'🟢':'🔴'; }
function updateTime(){ const el=document.getElementById('time'); if(el) el.textContent=new Date().toLocaleTimeString(); }

function clearHistoricalData(){
    if(!confirm('Are you sure you want to clear historical data?')) return;
    fetch('/clear_hist',{method:'POST'}).then(r=>r.json()).then(res=>{
        if(res.status==='success'){ histChart.data.labels=[]; histChart.data.datasets.forEach(ds=>ds.data=[]); histChart.update(); alert('Cleared!'); }
        else alert('Error clearing');
    });
}
