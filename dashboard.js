// --- HOBART HUB: Dashboard Module ---
// Covers, food/bev split, cross-venue dashboard, prime cost, manager hub, handover/debrief

// =============================================================================
// VERSION INFO — Shows build version and update details
// =============================================================================
window._hubBuildDate = '11 May 2026';
window._hubBuildId = '20260511a';

window._showVersionInfo = () => {
    // Try to get SW cache version
    let swVersion = 'N/A';
    const showModal = (sv) => {
        window.openModal('ℹ️ Hobart Hub Version', `
            <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 15px;font-size:13px;">
                <span style="color:var(--text-muted);">Build:</span><strong>${window._hubBuildId}</strong>
                <span style="color:var(--text-muted);">Last Update:</span><strong>${window._hubBuildDate}</strong>
                <span style="color:var(--text-muted);">SW Cache:</span><strong>${sv}</strong>
                <span style="color:var(--text-muted);">Recipes:</span><strong>${(window.recipes||[]).length}</strong>
                <span style="color:var(--text-muted);">Inventory:</span><strong>${(window.inventoryItems||[]).length}</strong>
                <span style="color:var(--text-muted);">Venue:</span><strong>${(window._venues||[]).find(v=>v.id===window.getDeviceVenue())?((window._venues.find(v=>v.id===window.getDeviceVenue())).emoji+' '+(window._venues.find(v=>v.id===window.getDeviceVenue())).name):'Unknown'}</strong>
            </div>
            <div style="margin-top:15px;font-size:11px;color:var(--text-muted);">
                Today's updates: Clickable health score breakdown, margin fix actions (instant sell price update), supplier cutoff alerts, prep list generator, KB full-text search, service calendar, GP_TARGET consolidation.
            </div>
        `);
    };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        const mc = new MessageChannel();
        mc.port1.onmessage = (e) => showModal(e.data.version || 'Unknown');
        navigator.serviceWorker.controller.postMessage({type:'GET_VERSION'}, [mc.port2]);
        setTimeout(() => showModal('N/A (timeout)'), 1000);
    } else {
        showModal('No SW active');
    }
};

window.printWeeklySummary = () => {
    const text = window._weeklySummaryText || '';
    const win = window.open('','_blank');
    win.document.write('<!DOCTYPE html><html><head><title>Weekly Summary</title><style>body{font-family:monospace;font-size:13px;max-width:650px;margin:30px auto;white-space:pre-wrap;line-height:1.7;}@media print{body{margin:15px;}}</style></head><body>' + text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '<script>window.onload=()=>{window.print();}<\/script></body></html>');
    win.document.close(); window.closeModal();
};


// =============================================================================
// COVERS TRACKER
// Log covers (guests) per service, calculate spend per head
// =============================================================================
window.logCoversForm = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2,'0');
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const yyyy = today.getFullYear();
    const todayStr = dd+'/'+mm+'/'+yyyy;
    const existing = (window.salesData||[]).find(s=>s.date===todayStr);
    const html = '<label style="font-size:11px;color:var(--text-muted);">Date</label>' +
        '<input type="text" id="cov-date" class="input-box" value="'+todayStr+'" placeholder="DD/MM/YYYY">' +
        '<label style="font-size:11px;color:var(--text-muted);">Service</label>' +
        '<select id="cov-service" class="input-box"><option>Dinner</option><option>Lunch</option><option>Bar</option><option>Event</option></select>' +
        '<label style="font-size:11px;color:var(--text-muted);">Number of Covers (Guests)</label>' +
        '<input type="number" id="cov-count" class="input-box" value="'+(existing&&existing.covers||'')+'" placeholder="e.g. 45">' +
        '<button onclick="window.saveCovers()" class="btn btn-green" style="width:100%;margin-top:5px;">Save Covers</button>';
    window.openModal('👥 Log Covers', html);
};

window.saveCovers = () => {
    const date = document.getElementById('cov-date').value.trim();
    const count = parseInt(document.getElementById('cov-count').value) || 0;
    const service = document.getElementById('cov-service').value;
    if (!date || !count) return window.showToast('Date and covers required.','error');
    const idx = (window.salesData||[]).findIndex(s=>s.date===date);
    if (idx >= 0) {
        window.salesData[idx].covers = count;
        window.salesData[idx].service = service;
    } else {
        if (!window.salesData) window.salesData = [];
        window.salesData.push({ date, covers: count, service, total: 0 });
    }
    window.saveToDisk(); window.closeModal(); window.showView('sales');
    window.showToast('Covers logged — '+count+' guests!');
};

// --- AUTO-LOG BOOKED COVERS (from SevenRooms paste) ---
// Writes ONLY to coversBooked field (separate from `covers` which is actual served).
// Future Lightspeed sync will write to `covers` — these never collide.
// Accepts ISO date (YYYY-MM-DD) or DD/MM/YYYY — normalises to DD/MM/YYYY for salesData consistency.
window._autoLogBookedCovers = (dateStr, count, bookingCount) => {
    if (!dateStr || !count) return false;
    // Normalise ISO → DD/MM/YYYY
    let normDate = dateStr;
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const [y,m,d] = dateStr.substring(0,10).split('-');
        normDate = `${d}/${m}/${y}`;
    }
    if (!window.salesData) window.salesData = [];
    const idx = window.salesData.findIndex(s => s.date === normDate);
    if (idx >= 0) {
        window.salesData[idx].coversBooked = count;
    } else {
        window.salesData.push({ date: normDate, coversBooked: count, total: 0 });
    }
    window.saveToDisk();
    const suffix = bookingCount ? ` (${bookingCount} bookings)` : '';
    window.showToast(`📋 ${count} booked covers logged from SevenRooms${suffix}`);
    return true;
};


// =============================================================================
// FOOD vs BEVERAGE COST ANALYSIS
// =============================================================================
window.showFoodBevSplit = () => {
    const recipes = (window.recipes||[]).filter(r=>r.type==='Menu'&&r.price>0&&!r.archived);
    const foodRecipes = recipes.filter(r => {
        const cat = (r.category||r.station||'').toLowerCase();
        return !cat.includes('bar') && !cat.includes('cocktail') && !cat.includes('beverage') && !cat.includes('drink');
    });
    const bevRecipes = recipes.filter(r => {
        const cat = (r.category||r.station||'').toLowerCase();
        return cat.includes('bar') || cat.includes('cocktail') || cat.includes('beverage') || cat.includes('drink');
    });
    const avgGp = arr => arr.length > 0 ? (arr.reduce((s,r)=>s+r.gp,0)/arr.length).toFixed(1) : 'N/A';
    const avgCost = arr => arr.length > 0 ? (arr.reduce((s,r)=>s+(r.cost||0),0)/arr.length).toFixed(2) : 'N/A';
    const avgPrice = arr => arr.length > 0 ? (arr.reduce((s,r)=>s+(r.price||0),0)/arr.length).toFixed(2) : 'N/A';
    const fGp = avgGp(foodRecipes), bGp = avgGp(bevRecipes);
    const html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">' +
        '<div class="card" style="border-top:4px solid var(--orange);text-align:center;">' +
            '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">🍱 Food</div>' +
            '<div style="font-size:36px;font-weight:bold;color:' + (fGp>=67?'var(--green)':'var(--red)') + ';">' + fGp + '%</div>' +
            '<div style="font-size:12px;color:var(--text-muted);">Avg GP · ' + foodRecipes.length + ' recipes</div>' +
            '<div style="font-size:12px;margin-top:8px;">Avg Cost: <strong>$' + avgCost(foodRecipes) + '</strong> · Avg Sell: <strong>$' + avgPrice(foodRecipes) + '</strong></div>' +
        '</div>' +
        '<div class="card" style="border-top:4px solid var(--blue);text-align:center;">' +
            '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px;">🍶 Beverage</div>' +
            '<div style="font-size:36px;font-weight:bold;color:' + (bGp>=67?'var(--green)':'var(--red)') + ';">' + bGp + '%</div>' +
            '<div style="font-size:12px;color:var(--text-muted);">Avg GP · ' + bevRecipes.length + ' recipes</div>' +
            '<div style="font-size:12px;margin-top:8px;">Avg Cost: <strong>$' + avgCost(bevRecipes) + '</strong> · Avg Sell: <strong>$' + avgPrice(bevRecipes) + '</strong></div>' +
        '</div>' +
    '</div>' +
    '<p style="font-size:12px;color:var(--text-muted);margin:0;">Items are categorised by station/category. Assign Bar/Cocktail/Beverage categories for accurate split.</p>';
    window.openModal('📊 Food vs Beverage Cost Split', html);
};


// =============================================================================
// OWNER CROSS-VENUE DASHBOARD
// Shows both venues side by side — PIN protected
// Loads live data from Firebase for both venues
// =============================================================================
window.renderCrossVenueDashboard = () => {
    const container = document.getElementById('mainContent');
    if (!container) return;

    container.innerHTML = '<div style="max-width:1200px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">' +
            '<div><h2 style="margin:0;">🏢 Owner Dashboard</h2>' +
            '<small style="color:var(--text-muted);">Live view across all venues · ' + new Date().toLocaleDateString('en-AU',{weekday:"long",day:"numeric",month:"long"}) + '</small></div>' +
            '<button onclick="window.showView(\'dashboard\')" class="btn btn-outline">← Back</button>' +
        '</div>' +
        '<div id="cross-venue-content"><div style="text-align:center;padding:40px;color:var(--text-muted);">Loading venue data...</div></div>' +
    '</div>';

    // Load data from both venues via Firebase
    const venues = window._venues || [];
    const venueData = {};
    let loaded = 0;

    venues.forEach(v => {
        if (typeof db === 'undefined') {
            venueData[v.id] = null;
            loaded++;
            if (loaded === venues.length) renderCrossContent(venueData, venues);
            return;
        }
        db.collection('venueData').doc(v.docId).get().then(doc => {
            venueData[v.id] = doc.exists ? doc.data() : null;
            loaded++;
            if (loaded === venues.length) renderCrossContent(venueData, venues);
        }).catch(() => {
            venueData[v.id] = null;
            loaded++;
            if (loaded === venues.length) renderCrossContent(venueData, venues);
        });
    });
};

function renderCrossContent(venueData, venues) {
    const today = new Date();
    const parseDate = (str) => {
        const m = str && str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        return m ? new Date(parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1])) : null;
    };
    const todayStr = String(today.getDate()).padStart(2,'0') + '/' + String(today.getMonth()+1).padStart(2,'0') + '/' + today.getFullYear();

    const getVenueSummary = (data) => {
        if (!data) return null;
        const sales = data.salesData || [];
        const todaySale = sales.find(s => s.date === todayStr);
        const isWeekend = [0,5,6].includes(today.getDay());
        const inv = data.inventoryItems || [];
        const lowStock = inv.filter(i => !i.archived && i.stock < (isWeekend?(i.parWeekend||i.par||0):(i.parWeekday||i.par||0)));
        const defects = (data.defectLogs||[]).filter(d=>d.status==='Open');
        const incidents = (data.incidentLogs||[]).filter(i=>window._isToday(i.time));
        const freqMap = {'Weekly':7,'Fortnightly':14,'Monthly':30,'Quarterly':90};
        const overdueTasks = (data.rotationalTasks||[]).filter(t=>{
            if(!t.lastLogIso) return true;
            return ((today-new Date(t.lastLogIso))/(1000*3600*24))>=(freqMap[t.freq]||7);
        });
        const tempLogs = (data.tempLogs||[]).filter(t=>window._isToday(t.time));
        const weekStart = new Date(today); weekStart.setDate(weekStart.getDate()-today.getDay()+1); weekStart.setHours(0,0,0,0);
        const weekSales = sales.filter(s=>{const d=parseDate(s.date);return d&&d>=weekStart&&d<=today;});
        const weekRevenue = weekSales.reduce((s,d)=>s+Number(d.total||0),0);

        return { todaySale, lowStock, defects, incidents, overdueTasks, tempLogs, weekRevenue, invCount: inv.filter(i=>!i.archived).length };
    };

    const venueCards = venues.map(v => {
        const data = venueData[v.id];
        const s = getVenueSummary(data);

        if (!s) {
            return '<div class="card" style="border-top:5px solid var(--border);">' +
                '<div style="display:flex;align-items:center;gap:12px;margin-bottom:15px;">' +
                    '<span style="font-size:28px;">' + v.emoji + '</span>' +
                    '<div><h3 style="margin:0;color:var(--text-muted);">' + esc(v.name) + '</h3>' +
                    '<small style="color:var(--text-muted);">No data yet — venue not set up</small></div>' +
                '</div>' +
                '<button onclick="window.switchVenue(\'' + v.id + '\')" class="btn btn-outline" style="width:100%;">Switch to ' + esc(v.name) + ' to set up →</button>' +
            '</div>';
        }

        const todayRev = s.todaySale ? Number(s.todaySale.total||0) : null;
        const revColor = todayRev !== null ? 'var(--green)' : 'var(--text-muted)';
        const revStr = todayRev !== null ? '$' + todayRev.toLocaleString('en-AU',{minimumFractionDigits:0}) : 'Not logged';

        const statusItems = [
            { label: 'Stock below PAR', value: s.lowStock.length, alert: s.lowStock.length > 0, icon: '📦' },
            { label: 'Open tickets', value: s.defects.length, alert: s.defects.length > 0, icon: '🛠️' },
            { label: 'Overdue tasks', value: s.overdueTasks.length, alert: s.overdueTasks.length > 0, icon: '🔄' },
            { label: "Today\'s incidents", value: s.incidents.length, alert: s.incidents.length > 0, icon: '⚠️' },
            { label: 'Temp logs today', value: s.tempLogs.length, alert: s.tempLogs.length === 0, icon: '🌡️' },
        ];

        const statusHtml = statusItems.map(item =>
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border);">' +
                '<span style="font-size:13px;color:var(--text-muted);">' + item.icon + ' ' + item.label + '</span>' +
                '<span style="font-weight:bold;color:' + (item.alert?'var(--red)':'var(--green)') + ';font-size:14px;">' + item.value + '</span>' +
            '</div>'
        ).join('');

        return '<div class="card" style="border-top:5px solid ' + v.color + ';">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                    '<span style="font-size:28px;">' + v.emoji + '</span>' +
                    '<div><h3 style="margin:0;color:' + v.color + ';">' + esc(v.name) + '</h3>' +
                    '<small style="color:var(--text-muted);">' + s.invCount + ' inventory items</small></div>' +
                '</div>' +
                '<button onclick="window.switchVenue(\'' + v.id + '\')" class="btn btn-outline" style="font-size:11px;padding:5px 12px;">Go to ' + esc(v.name) + ' →</button>' +
            '</div>' +
            // Revenue
            '<div style="background:var(--bg-main);border-radius:8px;padding:15px;margin-bottom:15px;">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Today\'s Revenue</div>' +
                '<div style="font-size:24px;font-weight:bold;color:' + revColor + ';">' + revStr + '</div>' +
                (s.todaySale ? '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">EFTPOS: $' + (s.todaySale.eftpos||0) + ' · Cash: $' + (s.todaySale.cash||0) + '</div>' : '') +
                '<div style="margin-top:8px;font-size:13px;color:var(--text-muted);">This week: <strong style="color:var(--blue);">$' + Math.round(s.weekRevenue).toLocaleString('en-AU') + '</strong></div>' +
            '</div>' +
            // Status
            statusHtml +
        '</div>';
    }).join('');

    const totalTodayRevenue = venues.reduce((sum, v) => {
        const s = getVenueSummary(venueData[v.id]);
        return sum + (s && s.todaySale ? Number(s.todaySale.total||0) : 0);
    }, 0);

    const totalWeekRevenue = venues.reduce((sum, v) => {
        const s = getVenueSummary(venueData[v.id]);
        return sum + (s ? s.weekRevenue : 0);
    }, 0);

    const el = document.getElementById('cross-venue-content');
    if (!el) return;
    el.innerHTML =
        // Combined KPIs
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:15px;">' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--green);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Combined Today</div>' +
                '<div style="font-size:30px;font-weight:bold;color:var(--green);">$' + totalTodayRevenue.toLocaleString('en-AU',{minimumFractionDigits:0}) + '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--blue);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Combined This Week</div>' +
                '<div style="font-size:30px;font-weight:bold;color:var(--blue);">$' + Math.round(totalWeekRevenue).toLocaleString('en-AU') + '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--orange);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Venues Active</div>' +
                '<div style="font-size:30px;font-weight:bold;color:var(--orange);">' + venues.length + '</div>' +
            '</div>' +
        '</div>' +
        // Venue cards side by side
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:20px;">' +
            venueCards +
        '</div>';
}


// =============================================================================
// PRIME COST DASHBOARD
// Food cost % + Labour % = Prime cost. Target < 65% of revenue
// =============================================================================
window.renderPrimeCostView = () => {
    const sales = window.salesData || [];
    const parseDate = (str) => { const m=str&&str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m?new Date(parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1])):null; };

    // Date range — last 4 weeks by default
    const today = new Date();
    const fourWeeksAgo = new Date(today); fourWeeksAgo.setDate(fourWeeksAgo.getDate()-28);
    const recentSales = sales.filter(s => { const d=parseDate(s.date); return d&&d>=fourWeeksAgo&&d<=today; });

    const totalRevenue = recentSales.reduce((s,d)=>s+Number(d.total||0),0);
    const totalWages = recentSales.reduce((s,d)=>s+Number(d.wages||0),0);

    // Food cost from wastage + recipe costs (estimated)
    const recipes = (window.recipes||[]).filter(r=>r.type==='Menu'&&!r.archived&&r.price>0);
    const avgFoodCostPct = recipes.length > 0 ? recipes.reduce((s,r)=>s+(r.gp?100-r.gp:33),0)/recipes.length : 33;
    const estimatedFoodCost = totalRevenue * (avgFoodCostPct/100);

    const labourPct = totalRevenue > 0 && totalWages > 0 ? (totalWages/totalRevenue*100) : null;
    const foodCostPct = avgFoodCostPct;
    const primeCost = labourPct !== null ? foodCostPct + labourPct : null;

    // Tanda live data
    const tanda = window._tandaData;
    const todayRevSale = sales.find(s => { const d=parseDate(s.date); return d&&d.toDateString()===today.toDateString(); });
    const todayRev = todayRevSale ? Number(todayRevSale.total||0) : 0;
    const tandaWagePct = tanda && todayRev > 0 ? (Number(tanda.estimatedWageCost)/todayRev*100).toFixed(1) : null;

    // Week by week breakdown
    const weeks = [];
    for (let w=0; w<4; w++) {
        const wEnd = new Date(today); wEnd.setDate(wEnd.getDate()-(w*7));
        const wStart = new Date(wEnd); wStart.setDate(wStart.getDate()-6);
        const wSales = sales.filter(s=>{ const d=parseDate(s.date); return d&&d>=wStart&&d<=wEnd; });
        const wRev = wSales.reduce((s,d)=>s+Number(d.total||0),0);
        const wWages = wSales.reduce((s,d)=>s+Number(d.wages||0),0);
        const wLabour = wRev>0&&wWages>0?(wWages/wRev*100):null;
        const wFood = foodCostPct;
        const wPrime = wLabour!==null?wFood+wLabour:null;
        weeks.push({ label:'Week '+(w+1), start:wStart.toLocaleDateString('en-AU',{day:'numeric',month:'short'}), end:wEnd.toLocaleDateString('en-AU',{day:'numeric',month:'short'}), revenue:wRev, wages:wWages, labourPct:wLabour, foodPct:wFood, primeCost:wPrime });
    }
    weeks.reverse();

    const pcColor = (pc) => pc === null ? 'var(--text-muted)' : pc <= 55 ? 'var(--green)' : pc <= 65 ? 'var(--orange)' : 'var(--red)';
    const pcLabel = (pc) => pc === null ? 'No Data' : pc <= 55 ? '✅ Excellent' : pc <= 65 ? '⚠️ Watch It' : '🔴 Over Target';

    const weekRows = weeks.map(w =>
        '<tr style="border-bottom:1px solid var(--border);">' +
        '<td style="padding:7px 12px;font-size:12px;color:var(--text-muted);">' + w.start + ' – ' + w.end + '</td>' +
        '<td style="padding:7px 12px;font-weight:bold;font-size:13px;">$' + Math.round(w.revenue).toLocaleString('en-AU') + '</td>' +
        '<td style="padding:7px 12px;font-size:12px;color:var(--orange);">' + w.foodPct.toFixed(1) + '%</td>' +
        '<td style="padding:7px 12px;font-size:12px;color:var(--blue);">' + (w.labourPct !== null ? w.labourPct.toFixed(1)+'%' : '<span style="color:var(--text-muted);">No wage data</span>') + '</td>' +
        '<td style="padding:7px 12px;font-weight:bold;font-size:14px;color:' + pcColor(w.primeCost) + ';">' + (w.primeCost !== null ? w.primeCost.toFixed(1)+'%' : '—') + '</td>' +
        '<td style="padding:7px 12px;font-size:11px;color:' + pcColor(w.primeCost) + ';">' + pcLabel(w.primeCost) + '</td>' +
        '</tr>'
    ).join('');

    return '<div style="max-width:1050px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0;">Prime Cost Dashboard</h2>' +
            '<small style="color:var(--text-muted);">Food Cost % + Labour % = Prime Cost. Industry target: under 65%</small></div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
            '<button onclick="window.openTandaSettings()" class="btn btn-outline" style="font-size:12px;">⏱️ ' + (window.getTandaToken?.()?'Tanda Connected':'Connect Tanda') + '</button>' +
            '<button onclick="window.openLightspeedSettings()" class="btn btn-outline" style="font-size:12px;">🛒 ' + (window.isLsConnected?.()?'Lightspeed Connected':'Connect Lightspeed') + '</button>' +
            '</div>' +
        '</div>' +

        // KPI Cards
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px;margin-bottom:15px;">' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--orange);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Food Cost %</div>' +
                '<div style="font-size:32px;font-weight:bold;color:var(--orange);">' + foodCostPct.toFixed(1) + '%</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">From recipe GP avg</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--blue);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Labour % (4wk avg)</div>' +
                '<div style="font-size:32px;font-weight:bold;color:var(--blue);">' + (labourPct !== null ? labourPct.toFixed(1)+'%' : '—') + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + (labourPct !== null ? 'From takings wages' : 'Add wages to takings') + '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid ' + pcColor(primeCost) + ';">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Prime Cost</div>' +
                '<div style="font-size:32px;font-weight:bold;color:' + pcColor(primeCost) + ';">' + (primeCost !== null ? primeCost.toFixed(1)+'%' : '—') + '</div>' +
                '<div style="font-size:11px;color:' + pcColor(primeCost) + ';">' + pcLabel(primeCost) + '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--green);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">4wk Revenue</div>' +
                '<div style="font-size:32px;font-weight:bold;color:var(--green);">$' + Math.round(totalRevenue/1000) + 'k</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">Last 28 days</div>' +
            '</div>' +
        '</div>' +

        // Tanda live today card (enhanced)
        (tanda ? '<div class="card" style="border-left:4px solid var(--blue);padding:15px;margin-bottom:20px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">' +
            '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;">⏱️ Tanda — Today Live</div>' +
            '<div style="font-size:11px;color:var(--text-muted);">Updated: ' + tanda.lastUpdated + ' · <a onclick="window.loadTandaData()" style="color:var(--blue);cursor:pointer;">Refresh</a></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
            '<div><div style="font-size:11px;color:var(--text-muted);">Rostered</div><div style="font-size:18px;font-weight:700;color:var(--blue);">$' + tanda.estimatedWageCost + '</div><div style="font-size:11px;color:var(--text-muted);">' + tanda.staffCount + ' staff · ' + tanda.rosteredHours + 'h</div></div>' +
            (Number(tanda.actualHours) > 0 ?
            '<div><div style="font-size:11px;color:var(--text-muted);">Actual</div><div style="font-size:18px;font-weight:700;color:' + (Number(tanda.actualWageCost) > Number(tanda.estimatedWageCost) ? 'var(--red)' : 'var(--green)') + ';">$' + tanda.actualWageCost + '</div><div style="font-size:11px;color:var(--text-muted);">' + tanda.actualStaffCount + ' staff · ' + tanda.actualHours + 'h</div></div>' : '') +
            '</div>' +
            (tandaWagePct ? '<div style="font-size:12px;color:var(--text-muted);margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">Labour %: <strong style="color:var(--blue);">' + tandaWagePct + '%</strong></div>' : '') +
            ((tanda.clockedIn||[]).length > 0 ? '<div style="font-size:11px;color:var(--green);margin-top:6px;">🟢 ' + tanda.clockedIn.length + ' on floor: ' + tanda.clockedIn.slice(0,5).map(function(c){return c.name;}).join(', ') + (tanda.clockedIn.length > 5 ? ' +' + (tanda.clockedIn.length-5) : '') + '</div>' : '') +
        '</div>' : '') +

        // Week breakdown table
        '<div class="card" style="padding:0;overflow:hidden;">' +
            '<div style="padding:15px 20px;border-bottom:1px solid var(--border);">' +
                '<h3 style="margin:0;font-size:15px;">Weekly Breakdown</h3>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;">' +
                '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
                    '<th style="padding:10px 15px;text-align:left;">Week</th>' +
                    '<th style="padding:10px 15px;text-align:left;">Revenue</th>' +
                    '<th style="padding:10px 15px;text-align:left;">Food Cost</th>' +
                    '<th style="padding:10px 15px;text-align:left;">Labour</th>' +
                    '<th style="padding:10px 15px;text-align:left;">Prime Cost</th>' +
                    '<th style="padding:10px 15px;text-align:left;">Status</th>' +
                '</tr></thead>' +
                '<tbody>' + weekRows + '</tbody>' +
            '</table>' +
        '</div>' +

        '<div style="margin-top:15px;padding:12px;background:var(--bg-main);border-radius:8px;font-size:12px;color:var(--text-muted);">' +
            '📌 Food cost % is estimated from your recipe GP averages. Connect Tanda for live labour data. Enter wages in Takings & KPIs for historical labour %.' +
        '</div>' +
    '</div>';
};

window.renderManagerHub = () => {
    // Fetch weather async
    fetch('https://api.open-meteo.com/v1/forecast?latitude=-42.8794&longitude=147.3294&current=temperature_2m,weather_code')
        .then(res => res.json())
        .then(data => {
            const el = document.getElementById('pulse-weather');
            if (el) el.innerHTML = Math.round(data.current.temperature_2m) + '°C <span style="font-size:11px;color:var(--text-muted);margin-left:4px;">Hobart</span>';
        }).catch(() => {});

    const today = new Date();
    const todayStr = window._isoDate();
    const isWeekend = [0, 5, 6].includes(today.getDay());
    const hour = today.getHours();
    const E = window.esc;
    const _isStaffSession = !!window._activeStaffMember;
    const _isManagerRole = _isStaffSession && (window._activeStaffMember.role === 'Manager');
    const _showFinancials = !_isStaffSession || _isManagerRole; // hide financials for non-manager staff

    // --- DATE HELPERS ---
    const fmtDate = (d) => d.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    const parseDate = (str) => { const m = str && str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1])) : null; };
    const getSalesForDate = (d) => (window.salesData||[]).find(s => s.date === fmtDate(d));

    // --- TODAY'S DATA ---
    // Prefer live Lightspeed POS revenue when available, fall back to manual `total`
    const todaySales = getSalesForDate(today);
    const todayLsRev = todaySales ? Number(todaySales.lsRevenue||0) : 0;
    const todayManualRev = todaySales ? Number(todaySales.total||0) : 0;
    const todayRev = todayLsRev > 0 ? todayLsRev : todayManualRev;
    const todayRevSource = todayLsRev > 0 ? 'lightspeed' : (todayManualRev > 0 ? 'manual' : 'none');
    const todayLsCovers = todaySales ? Number(todaySales.lsCovers||0) : 0;
    const todayManualCovers = todaySales ? Number(todaySales.covers||0) : 0;
    const todayCovers = todayLsCovers > 0 ? todayLsCovers : todayManualCovers;
    const todayBookedCovers = todaySales ? Number(todaySales.coversBooked||0) : 0;
    const todayWages = todaySales ? Number(todaySales.wages||0) : 0;
    const hasTodayData = !!todaySales && todayRev > 0;

    // --- LAST WEEK SAME DAY ---
    const lwDate = new Date(today); lwDate.setDate(lwDate.getDate() - 7);
    const lwSales = getSalesForDate(lwDate);
    const lwRev = lwSales ? Number(lwSales.total||0) : 0;
    const revDelta = lwRev > 0 && hasTodayData ? ((todayRev - lwRev) / lwRev * 100) : null;

    // --- 7-DAY HISTORY ---
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const s = getSalesForDate(d);
        last7.push({ date: d, rev: s ? Number(s.total||0) : 0, covers: s ? Number(s.covers||0) : 0, wages: s ? Number(s.wages||0) : 0 });
    }
    const maxRev7 = Math.max(...last7.map(d => d.rev), 1);
    const avg7Rev = last7.reduce((s,d)=>s+d.rev,0) / 7;

    // --- STOCK HEALTH ---
    const activeItems = (window.inventoryItems||[]).filter(i => !i.archived);
    const lowStock = activeItems.filter(i => {
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return par > 0 && i.stock < par;
    });
    const totalInvValue = activeItems.reduce((s,i) => s + ((i.price||0)*(i.stock||0)), 0);
    const itemsWithPar = activeItems.filter(i => (isWeekend?(i.parWeekend||i.par):( i.parWeekday||i.par)) > 0);
    const stockHealthPct = itemsWithPar.length > 0 ? Math.round((1 - lowStock.length / itemsWithPar.length) * 100) : 100;

    // --- COMPLIANCE ---
    const todayTemps = (window.tempLogs||[]).filter(t => window._isToday(t.time));
    const breaches = todayTemps.filter(t => {
        const v = parseFloat(t.value);
        if (isNaN(v)) return false;
        const u = (t.unit || '').toLowerCase();
        const isFreezer = u.includes('freezer') || u.includes('freeze');
        return isFreezer ? (v > -15) : (v > 5);
    });
    const shiftType = hour < 14 ? 'opening' : hour < 20 ? 'preservice' : 'closing';
    const activeList = ((window.shiftChecklistItems||{})[shiftType]) || [];
    const checkSaved = JSON.parse(localStorage.getItem('shiftCheck_' + todayStr + '_' + shiftType) || '[]');
    const checkPct = activeList.length > 0 ? Math.round(checkSaved.length / activeList.length * 100) : 100;

    // --- TASKS ---
    const freqMap = { 'Weekly':7, 'Fortnightly':14, 'Monthly':30, 'Quarterly':90 };
    const _isTaskOverdue = (t) => {
        if (t.dueDateMode === 'specific') return t.specificDueDate && new Date(t.specificDueDate) <= today;
        if (t.lastLogIso) return ((today - new Date(t.lastLogIso)) / 86400000) >= (freqMap[t.freq]||7);
        if (t.anchorDate) { const ad = new Date(t.anchorDate); if (ad > today) return false; const ds = (today-ad)/86400000; const iv = freqMap[t.freq]||7; return today >= new Date(ad.getTime()+Math.floor(ds/iv)*iv*86400000); }
        return true;
    };
    const _taskDaysUntilDue = (t) => {
        if (t.dueDateMode === 'specific' && t.specificDueDate) return Math.round((new Date(t.specificDueDate) - today) / 86400000);
        const iv = freqMap[t.freq] || 7;
        if (t.lastLogIso) return Math.ceil(iv - ((today - new Date(t.lastLogIso)) / 86400000));
        if (t.anchorDate) { const ad = new Date(t.anchorDate); if (ad > today) return Math.round((ad - today) / 86400000); const ds = (today-ad)/86400000; return Math.ceil(iv - (ds % iv)); }
        return 0;
    };
    const overdueTasks = (window.rotationalTasks||[]).filter(_isTaskOverdue);
    const upcomingTasks = (window.rotationalTasks||[]).filter(t => !_isTaskOverdue(t)).map(t => ({...t, _daysUntil: _taskDaysUntilDue(t)})).filter(t => t._daysUntil <= 7 && t._daysUntil > 0).sort((a,b) => a._daysUntil - b._daysUntil);
    const openTickets = (window.defectLogs||[]).filter(d => d.status !== 'Resolved');

    // --- FRIDGE TEMP COVERAGE ---
    const allFridgeUnits = window.fridgeUnits || [];
    const loggedUnitsToday = [...new Set(todayTemps.map(t => t.unit))];
    const unloggedFridges = allFridgeUnits.filter(u => !loggedUnitsToday.includes(u));
    const fridgeCoverage = allFridgeUnits.length > 0 ? Math.round((loggedUnitsToday.length / allFridgeUnits.length) * 100) : 100;

    // --- TEAM ---
    const activeStaff = (window.staffDirectory||[]).filter(s => s.status !== 'Inactive');
    const expiringQuals = [];
    activeStaff.forEach(s => {
        (window.qualificationTypes||[]).forEach(qt => {
            const q = (s.qualifications||{})[qt.id];
            if (!q || !q.expiry) return;
            const dl = (new Date(q.expiry) - today) / 86400000;
            if (dl < 0) expiringQuals.push({ staff: s.name, qual: qt.name, status: 'expired' });
            else if (dl <= 30) expiringQuals.push({ staff: s.name, qual: qt.name, status: 'expiring', days: Math.ceil(dl) });
        });
    });

    // --- MARGIN ALERTS ---
    const marginAlerts = typeof window.checkRecipeMargins === 'function' ? window.checkRecipeMargins() : [];

    // --- RECIPE COSTING HEALTH ---
    const _activeRecipes = (window.recipes||[]).filter(r => !r.archived);
    const _totalIngs = _activeRecipes.reduce((s,r) => s + (r.ingredients||[]).length, 0);
    const _linkedIngs = _activeRecipes.reduce((s,r) => s + (r.ingredients||[]).filter(i => i.type==='inv'||i.type==='batch').length, 0);
    const _rawIngs = _totalIngs - _linkedIngs;
    const _costingAccuracy = _totalIngs > 0 ? Math.round(_linkedIngs / _totalIngs * 100) : 100;
    const _fullyCost = _activeRecipes.filter(r => (r.ingredients||[]).length > 0 && (r.ingredients||[]).every(i => i.type==='inv'||i.type==='batch')).length;
    const _partiallyCost = _activeRecipes.filter(r => { const ings = r.ingredients||[]; return ings.length > 0 && ings.some(i => i.type==='raw') && ings.some(i => i.type==='inv'||i.type==='batch'); }).length;
    const _top5Unlinked = _activeRecipes.map(r => ({ id:r.id, name:r.name, rawCount:(r.ingredients||[]).filter(i => i.type==='raw').length })).filter(r => r.rawCount > 0).sort((a,b) => b.rawCount - a.rawCount).slice(0, 5);

    // --- COGS (from today's wastage + depletion) ---
    const todayWastage = (window.wastageLogs||[]).filter(w => window._isToday(w.time)).reduce((s,w)=>s+(w.value||0), 0);

    // --- LABOR % ---
    const laborPct = hasTodayData && todayWages > 0 ? (todayWages / todayRev * 100) : null;
    const wageTarget = (window.salesTargets||{}).wageTarget || 30;

    // --- HEALTH SCORE (0-100) ---
    let healthScore = 100;
    // Revenue: -15 if no data today
    if (!hasTodayData) healthScore -= 15;
    // Labor: -15 if over target
    if (laborPct && laborPct > wageTarget) healthScore -= Math.min(15, Math.round((laborPct - wageTarget) / 2));
    // Stock: -20 max based on % below par
    healthScore -= Math.round((1 - stockHealthPct/100) * 20);
    // Compliance: -15 for breaches, -10 for incomplete checklist
    if (breaches.length > 0) healthScore -= Math.min(15, breaches.length * 5);
    if (checkPct < 100) healthScore -= Math.round((1 - checkPct/100) * 10);
    // Fridge coverage: -8 if not all units logged
    if (fridgeCoverage < 100 && allFridgeUnits.length > 0) healthScore -= Math.round((1 - fridgeCoverage/100) * 8);
    // Tasks: -3 per overdue
    healthScore -= Math.min(15, overdueTasks.length * 3);
    // Tickets: -2 per open
    healthScore -= Math.min(10, openTickets.length * 2);
    healthScore = Math.max(0, Math.min(100, healthScore));
    const scoreColor = healthScore >= 80 ? 'var(--green)' : healthScore >= 50 ? 'var(--orange)' : 'var(--red)';
    const scoreLabel = healthScore >= 80 ? 'Running Smoothly' : healthScore >= 50 ? 'Needs Attention' : 'Issues Detected';

    // --- HEALTH SCORE BREAKDOWN (clickable) ---
    const _hsBreakdown = [];
    _hsBreakdown.push({ label: 'Revenue logged', points: hasTodayData ? 0 : -15, max: 15, status: hasTodayData ? 'ok' : 'issue', fix: 'Log takings', view: 'sales', action: 'window.manualTakingsForm()' });
    const _labPenalty = (laborPct && laborPct > wageTarget) ? Math.min(15, Math.round((laborPct - wageTarget) / 2)) : 0;
    _hsBreakdown.push({ label: 'Labor within target', points: -_labPenalty, max: 15, status: _labPenalty === 0 ? 'ok' : 'issue', fix: 'Review staffing', view: 'sales' });
    const _stockPenalty = Math.round((1 - stockHealthPct/100) * 20);
    _hsBreakdown.push({ label: 'Stock at PAR (' + stockHealthPct + '%)', points: -_stockPenalty, max: 20, status: _stockPenalty === 0 ? 'ok' : _stockPenalty <= 5 ? 'warn' : 'issue', fix: lowStock.length + ' items below PAR', view: 'inventory' });
    const _breachPenalty = breaches.length > 0 ? Math.min(15, breaches.length * 5) : 0;
    _hsBreakdown.push({ label: 'Temp compliance', points: -_breachPenalty, max: 15, status: _breachPenalty === 0 ? 'ok' : 'issue', fix: breaches.length + ' breach(es)', view: 'compliance' });
    const _checkPenalty = checkPct < 100 ? Math.round((1 - checkPct/100) * 10) : 0;
    _hsBreakdown.push({ label: 'Shift checklist (' + checkPct + '%)', points: -_checkPenalty, max: 10, status: _checkPenalty === 0 ? 'ok' : 'warn', fix: 'Complete checklist', view: 'compliance' });
    const _fridgePenalty = (fridgeCoverage < 100 && allFridgeUnits.length > 0) ? Math.round((1 - fridgeCoverage/100) * 8) : 0;
    _hsBreakdown.push({ label: 'Fridge coverage (' + loggedUnitsToday.length + '/' + allFridgeUnits.length + ')', points: -_fridgePenalty, max: 8, status: _fridgePenalty === 0 ? 'ok' : 'warn', fix: 'Log temps for ' + unloggedFridges.length + ' units', view: 'compliance' });
    const _taskPenalty = Math.min(15, overdueTasks.length * 3);
    _hsBreakdown.push({ label: 'Tasks current', points: -_taskPenalty, max: 15, status: _taskPenalty === 0 ? 'ok' : 'issue', fix: overdueTasks.length + ' overdue', view: 'tasks' });
    const _ticketPenalty = Math.min(10, openTickets.length * 2);
    _hsBreakdown.push({ label: 'Maintenance tickets', points: -_ticketPenalty, max: 10, status: _ticketPenalty === 0 ? 'ok' : 'warn', fix: openTickets.length + ' open', view: 'maintenance' });

    window._showHealthBreakdown = () => {
        const statusIcon = { ok: '✅', warn: '⚠️', issue: '❌' };
        const statusColor = { ok: 'var(--green)', warn: 'var(--orange)', issue: 'var(--red)' };
        let bHtml = '<div style="margin-bottom:16px;text-align:center;">';
        bHtml += '<div style="font-size:48px;font-weight:800;color:' + scoreColor + ';">' + healthScore + '<span style="font-size:18px;color:var(--text-muted);"> / 100</span></div>';
        bHtml += '<div style="font-size:13px;color:' + scoreColor + ';">' + scoreLabel + '</div></div>';
        bHtml += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Score Breakdown</div>';
        _hsBreakdown.forEach(b => {
            const ptsStr = b.points === 0 ? '<span style="color:var(--green);">+0</span>' : '<span style="color:var(--red);">' + b.points + '</span>';
            bHtml += '<div onclick="window.closeModal();window.showView(\'' + b.view + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 8px;border-bottom:1px solid var(--border);cursor:pointer;" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'\'">';
            bHtml += '<span style="font-size:16px;">' + statusIcon[b.status] + '</span>';
            bHtml += '<span style="flex:1;font-size:13px;">' + b.label + '</span>';
            bHtml += '<span style="font-size:13px;font-weight:700;min-width:40px;text-align:right;">' + ptsStr + '</span>';
            bHtml += '</div>';
        });
        const issueItems = _hsBreakdown.filter(b => b.points < 0);
        if (issueItems.length > 0) {
            bHtml += '<div style="margin-top:14px;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Quick Fixes</div>';
            issueItems.forEach(b => {
                const click = b.action ? b.action : "window.closeModal();window.showView('" + b.view + "')";
                bHtml += '<button onclick="' + click + '" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 12px;margin-bottom:4px;background:var(--bg-main);border:1px solid var(--border);border-radius:8px;color:var(--text-main);cursor:pointer;font-size:12px;text-align:left;">';
                bHtml += '<span style="color:' + statusColor[b.status] + ';font-weight:600;">' + b.fix + '</span>';
                bHtml += '<span style="margin-left:auto;color:var(--text-muted);font-size:10px;">→</span></button>';
            });
        }
        window.openModal('📊 Health Score Breakdown', bHtml);
    };

    // --- SVG HELPERS ---
    const sparkline = (data, w, h, color) => {
        if (!data.length || data.every(d => d === 0)) return '';
        const max = Math.max(...data, 1);
        const pts = data.map((v,i) => (i/(data.length-1))*w + ',' + (h - (v/max)*h*0.85)).join(' ');
        return '<svg width="'+w+'" height="'+h+'" style="display:block;"><polyline points="'+pts+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    };

    const scoreRing = (pct, size, stroke, color) => {
        const r = (size - stroke) / 2;
        const c = Math.PI * 2 * r;
        const offset = c - (pct / 100) * c;
        return '<svg width="'+size+'" height="'+size+'" style="transform:rotate(-90deg);">' +
            '<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="var(--border)" stroke-width="'+stroke+'"/>' +
            '<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="'+stroke+'" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+offset+'" style="transition:stroke-dashoffset 1s ease;"/>' +
        '</svg>';
    };

    // --- EXPIRING DOCS ---
    const expiringDocs = (window.digitalSafe||[]).filter(d => { if (!d.expiry) return false; const dl = (new Date(d.expiry)-today)/86400000; return dl <= 30 && dl > -30; });

    // --- RECENT HANDOVER ---
    const recentHandover = (window.handoverLogs||[]).slice().reverse().find(h => {
        const hd = parseDate(h.date);
        return hd && (today - hd) / 86400000 <= 2;
    });

    // --- TODAY'S FOCUS ---
    const focusItems = [];
    breaches.forEach(t => focusItems.push({pri:0, icon:'🌡️', color:'var(--red)', text:E((t.unit||'Unit')+' temp breach: '+t.value+'°C'), view:'compliance'}));
    // Unlogged fridge units (only alert if past noon — give time for opening logs)
    if (hour >= 12 && unloggedFridges.length > 0) {
        if (unloggedFridges.length <= 3) {
            unloggedFridges.forEach(u => focusItems.push({pri:0, icon:'🌡️', color:'var(--orange)', text:E(u)+' — no temp logged today', view:'compliance'}));
        } else {
            focusItems.push({pri:0, icon:'🌡️', color:'var(--orange)', text:unloggedFridges.length+'/'+allFridgeUnits.length+' fridge units not logged today', view:'compliance'});
        }
    }
    overdueTasks.forEach(t => focusItems.push({pri:1, icon:'🔄', color:'var(--red)', text:E(t.name)+(t.zone?' ('+E(t.zone)+')':'')+' is overdue', view:'tasks'}));
    expiringDocs.filter(d => (new Date(d.expiry)-today)/86400000 <= 7).forEach(d => {
        const dl = (new Date(d.expiry)-today)/86400000;
        focusItems.push({pri:2, icon:'📄', color:dl<0?'var(--red)':'var(--orange)', text:E(d.name)+' — '+(dl<0?'EXPIRED':'Expires in '+Math.ceil(dl)+'d'), view:'safe'});
    });
    lowStock.slice(0,4).forEach(i => focusItems.push({pri:3, icon:'📦', color:'var(--orange)', text:E(i.name)+' below par', view:'inventory'}));
    if (lowStock.length > 4) focusItems.push({pri:3, icon:'📦', color:'var(--orange)', text:'+'+(lowStock.length-4)+' more below par', view:'inventory'});
    openTickets.slice(0,2).forEach(t => focusItems.push({pri:4, icon:'🛠️', color:'var(--orange)', text:E(t.item)+' — open ticket', view:'maintenance'}));
    expiringQuals.slice(0,2).forEach(q => focusItems.push({pri:5, icon:'🎓', color:q.status==='expired'?'var(--red)':'var(--orange)', text:E(q.staff)+' — '+E(q.qual)+(q.status==='expired'?' EXPIRED':' expires in '+q.days+'d'), view:'orientation'}));
    marginAlerts.slice(0,2).forEach(a => focusItems.push({pri:6, icon:'📉', color:'var(--red)', text:E(a.name)+' margin: '+a.currentGp+'%', view:'margins'}));
    // Supplier cutoff alerts — warn if items below PAR and cutoff approaching
    const _nowHour = today.getHours();
    const _todayDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()];
    const _tomorrowDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][(today.getDay()+1)%7];
    (window.suppliers||[]).forEach(s => {
        if (!s.cutoff || !s.deliveryDays) return;
        const deliversTomorrow = s.deliveryDays.includes(_tomorrowDay);
        if (!deliversTomorrow) return;
        const cutoffParts = s.cutoff.match(/(\d{1,2}):(\d{2})/);
        if (!cutoffParts) return;
        const cutoffHour = parseInt(cutoffParts[1]);
        const hoursUntil = cutoffHour - _nowHour;
        if (hoursUntil > 3 || hoursUntil < 0) return; // only warn within 3 hours
        const supItems = lowStock.filter(i => i.supplier === s.name);
        if (supItems.length === 0) return;
        focusItems.push({pri:0, icon:'🚚', color:'var(--red)', text:E(s.name)+' cutoff '+E(s.cutoff)+' — '+supItems.length+' item'+(supItems.length===1?'':'s')+' below PAR', view:'prep-list'});
    });

    // Pending order draft alerts
    const pendingDrafts = (Array.isArray(window.orderDrafts) ? window.orderDrafts : []).filter(d => d && d.status === 'pending');
    if (pendingDrafts.length > 0) {
        const totalDraftSpend = pendingDrafts.reduce((s, d) => s + (d.estSpend || 0), 0);
        focusItems.push({pri:1, icon:'📦', color:'var(--blue)', text:pendingDrafts.length+' order draft'+(pendingDrafts.length===1?'':'s')+' pending — $'+Math.round(totalDraftSpend).toLocaleString('en-AU')+' est.', view:'order-drafts'});
    }

    // Tanda leave alerts
    if (window._tandaData && window._tandaData.upcomingLeave) {
        var _todayStr = new Date().toISOString().split('T')[0];
        var _tmrw = new Date(); _tmrw.setDate(_tmrw.getDate() + 1); var _tmrwStr = _tmrw.toISOString().split('T')[0];
        window._tandaData.upcomingLeave.forEach(function(l) {
            var isToday = l.from <= _todayStr && l.to >= _todayStr;
            var isTmrw = l.from === _tmrwStr;
            if (isToday) focusItems.push({pri:1, icon:'🏖️', color:'var(--orange)', text:E(l.name)+' on leave today ('+E(l.type)+')', view:'orientation'});
            else if (isTmrw) focusItems.push({pri:2, icon:'🏖️', color:'var(--blue)', text:E(l.name)+' on leave tomorrow — check coverage', view:'orientation'});
        });
    }
    focusItems.sort((a,b) => a.pri - b.pri);

    // =====================================================
    // BUILD HTML
    // =====================================================
    let html = '<div style="max-width:1100px;margin:auto;">';

    // --- AI MORNING BRIEFING (loaded async) ---
    const todayKey = today.toISOString().split('T')[0];
    const existingBriefing = (window.dailyBriefings || []).find(b => b.date === todayKey);
    if (_showFinancials) {
    html += '<div id="ai-briefing-container">';
    if (existingBriefing) {
        html += window._renderBriefingCard(existingBriefing);
    } else {
        html += '<div class="card" style="border-top:3px solid var(--purple);padding:16px;margin-bottom:16px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div><div style="font-size:13px;font-weight:700;">🌅 AI Morning Briefing</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Get a personalised daily briefing from your Hub data</div></div>';
        html += '<button onclick="window.generateMorningBriefing()" class="btn btn-purple" style="padding:8px 16px;font-size:12px;">✨ Generate Briefing</button>';
        html += '</div></div>';
    }
    html += '</div>';
    } // end _showFinancials (briefing)

    // --- HERO BANNER ---
    const gradBg = healthScore >= 80 ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.05))' :
                   healthScore >= 50 ? 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.03))' :
                   'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(245,158,11,0.04))';
    html += '<div style="background:'+gradBg+';border:1px solid var(--border);border-radius:14px;padding:24px 28px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;">';
    // Left: venue info
    html += '<div style="flex:1;min-width:200px;">';
    html += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);font-weight:600;">Venue Pulse</div>';
    html += '<h2 style="margin:4px 0 0;font-size:22px;color:var(--text-main);">' + today.toLocaleDateString('en-AU',{weekday:'long',year:'numeric',month:'long',day:'numeric'}) + '</h2>';
    html += '<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;">';
    html += '<span style="font-size:12px;padding:3px 10px;border-radius:20px;background:rgba(59,130,246,0.1);color:var(--blue);border:1px solid rgba(59,130,246,0.2);">' + (isWeekend?'Weekend':'Weekday') + ' PAR</span>';
    html += '<span style="font-size:12px;padding:3px 10px;border-radius:20px;background:rgba(139,92,246,0.1);color:var(--purple);border:1px solid rgba(139,92,246,0.2);">' + ({opening:'Morning',preservice:'Pre-Service',closing:'Closing'}[shiftType]) + ' Shift</span>';
    html += '<span id="pulse-weather" style="font-size:12px;padding:3px 10px;border-radius:20px;background:rgba(59,130,246,0.1);color:var(--blue);border:1px solid rgba(59,130,246,0.2);">--°C</span>';
    html += '<span id="pulse-version" style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(16,185,129,0.1);color:var(--green);border:1px solid rgba(16,185,129,0.2);cursor:pointer;" onclick="window._showVersionInfo()" title="Click for version details">🔄 ' + window._hubBuildId + '</span>';
    html += '</div></div>';
    // Right: health score ring (clickable)
    html += '<div onclick="window._showHealthBreakdown()" style="text-align:center;position:relative;width:110px;height:110px;flex-shrink:0;cursor:pointer;" title="Click for score breakdown">';
    html += scoreRing(healthScore, 110, 8, scoreColor);
    html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(0deg);text-align:center;">';
    html += '<div style="font-size:28px;font-weight:800;color:'+scoreColor+';line-height:1;">'+healthScore+'</div>';
    html += '<div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-top:2px;">'+scoreLabel+'</div>';
    html += '</div></div>';
    html += '</div>';

    // --- FINANCIAL ROW (3 cards) --- Manager only
    if (_showFinancials) {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:14px;margin-bottom:14px;">';

    // Card 1: Today's Revenue
    html += '<div class="card" style="padding:20px;border-top:3px solid var(--green);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
    html += '<div>';
    const revHeaderTag = todayRevSource === 'lightspeed'
        ? ' <span style="font-size:9px;padding:1px 6px;border-radius:6px;background:rgba(16,185,129,0.15);color:var(--green);border:1px solid rgba(16,185,129,0.3);font-weight:700;letter-spacing:0.3px;" title="Live from Lightspeed POS">⚡ LIVE POS</span>'
        : '';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Today\'s Revenue' + revHeaderTag + '</div>';
    html += '<div style="font-size:32px;font-weight:800;color:' + (hasTodayData?'var(--green)':'var(--text-muted)') + ';margin:4px 0;">' + (hasTodayData ? '$'+todayRev.toLocaleString('en-AU',{maximumFractionDigits:0}) : '—') + '</div>';
    if (hasTodayData && todaySales) {
        if (todayRevSource === 'lightspeed') {
            const orderInfo = todaySales.lsOrderCount ? todaySales.lsOrderCount + ' orders' : '';
            const syncInfo = todaySales.lsLastSync ? ' · synced ' + new Date(todaySales.lsLastSync).toLocaleTimeString('en-AU',{hour:'2-digit',minute:'2-digit'}) : '';
            html += '<div style="font-size:11px;color:var(--text-muted);">' + orderInfo + syncInfo + '</div>';
        } else {
            html += '<div style="font-size:11px;color:var(--text-muted);">EFT $'+(todaySales.eftpos||0)+' · Cash $'+(todaySales.cash||0)+(todaySales.meandu?' · Me&u $'+todaySales.meandu:'')+'</div>';
        }
    }
    if (revDelta !== null) {
        const arrow = revDelta >= 0 ? '↑' : '↓';
        const dColor = revDelta >= 0 ? 'var(--green)' : 'var(--red)';
        html += '<div style="font-size:12px;margin-top:4px;color:'+dColor+';font-weight:600;">'+arrow+' '+Math.abs(revDelta).toFixed(0)+'% vs last '+lwDate.toLocaleDateString('en-AU',{weekday:'short'})+'</div>';
    }
    html += '</div>';
    html += '<div style="align-self:center;">'+sparkline(last7.map(d=>d.rev), 80, 40, '#10b981')+'</div>';
    html += '</div>';
    if (!hasTodayData) html += '<button onclick="window.manualTakingsForm()" class="btn btn-green" style="width:100%;margin-top:12px;font-size:13px;">+ Log Takings</button>';
    else html += '<button onclick="window.manualTakingsForm()" class="btn btn-outline" style="width:100%;margin-top:12px;font-size:12px;">✏️ Edit Entry</button>';
    html += '</div>';

    // Card 2: Labor Cost
    html += '<div class="card" style="padding:20px;border-top:3px solid '+(laborPct!==null && laborPct > wageTarget?'var(--red)':'var(--blue)')+'">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Labor Cost</div>';
    if (laborPct !== null) {
        const labColor = laborPct <= wageTarget ? 'var(--green)' : laborPct <= wageTarget+5 ? 'var(--orange)' : 'var(--red)';
        html += '<div style="font-size:32px;font-weight:800;color:'+labColor+';margin:4px 0;">'+laborPct.toFixed(0)+'%</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);">$'+todayWages.toLocaleString('en-AU',{maximumFractionDigits:0})+' wages on $'+todayRev.toLocaleString('en-AU',{maximumFractionDigits:0})+' rev</div>';
        html += '<div style="margin-top:8px;background:var(--bg-main);border-radius:6px;height:6px;overflow:hidden;"><div style="height:100%;border-radius:6px;width:'+Math.min(laborPct/50*100,100)+'%;background:'+labColor+';"></div></div>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Target: '+wageTarget+'%</div>';
    } else {
        html += '<div style="font-size:32px;font-weight:800;color:var(--text-muted);margin:4px 0;">—</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);">Log takings with wages to see labor %</div>';
    }
    // Tanda data — rostered vs actual (always show if connected)
    if (window._tandaData) {
        const td = window._tandaData;
        const staleMs = td._lastUpdatedTs ? (Date.now() - td._lastUpdatedTs) : 0;
        const isStale = staleMs > 30 * 60 * 1000; // >30 minutes
        html += '<div style="border-top:1px solid var(--border);margin-top:10px;padding-top:8px;font-size:11px;">';
        html += '<div style="color:var(--purple);font-weight:600;margin-bottom:4px;">⏱️ Tanda Live';
        if (isStale) html += ' <span style="color:var(--orange);font-weight:normal;">⚠️ stale (' + Math.round(staleMs/60000) + 'min ago)</span>';
        else html += ' <span style="color:var(--text-muted);font-weight:normal;">· ' + td.lastUpdated + '</span>';
        html += '</div>';
        html += '<div style="color:var(--text-muted);">Rostered: ' + td.staffCount + ' staff · ' + td.rosteredHours + 'h · $' + td.estimatedWageCost + '</div>';
        if (Number(td.actualHours) > 0) {
            const variance = Number(td.actualWageCost) - Number(td.estimatedWageCost);
            const varColor = variance <= 0 ? 'var(--green)' : 'var(--red)';
            const varLabel = variance <= 0 ? ('$' + Math.abs(variance).toFixed(0) + ' under') : ('$' + variance.toFixed(0) + ' over');
            html += '<div style="color:var(--text-muted);">Actual: ' + td.actualStaffCount + ' staff · ' + td.actualHours + 'h · <strong style="color:' + varColor + ';">$' + td.actualWageCost + '</strong></div>';
            html += '<div style="color:' + varColor + ';font-weight:600;">' + varLabel + ' budget</div>';
        }
        html += '</div>';
    } else if (window.getTandaToken && window.getTandaToken()) {
        html += '<div style="border-top:1px solid var(--border);margin-top:10px;padding-top:8px;font-size:11px;">';
        html += '<div style="color:var(--text-muted);">⏱️ Tanda: loading...</div>';
        html += '</div>';
    }
    html += '</div>';

    // Card 3: Daily P&L Estimate
    html += '<div class="card" style="padding:20px;border-top:3px solid var(--purple);">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Daily P&L Estimate</div>';
    if (hasTodayData) {
        const estCogs = todayWastage; // Will grow as depletion/stock tracking matures
        const estProfit = todayRev - todayWages - estCogs;
        const profitColor = estProfit > 0 ? 'var(--green)' : 'var(--red)';
        html += '<div style="font-size:32px;font-weight:800;color:'+profitColor+';margin:4px 0;">$'+Math.round(estProfit).toLocaleString('en-AU')+'</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);line-height:1.8;">';
        html += 'Revenue: <strong style="color:var(--green);">$'+todayRev.toLocaleString('en-AU',{maximumFractionDigits:0})+'</strong><br>';
        html += 'Labor: <strong style="color:var(--red);">-$'+todayWages.toLocaleString('en-AU',{maximumFractionDigits:0})+'</strong><br>';
        if (estCogs > 0) html += 'Wastage: <strong style="color:var(--orange);">-$'+estCogs.toFixed(0)+'</strong><br>';
        html += '</div>';
        if (todayCovers > 0) {
            html += '<div style="font-size:11px;color:var(--blue);margin-top:4px;">👥 '+todayCovers+' covers · $'+(todayRev/todayCovers).toFixed(0)+' avg spend';
            if (todayBookedCovers > 0) {
                const variance = todayCovers - todayBookedCovers;
                const vColor = variance >= 0 ? 'var(--green)' : 'var(--red)';
                const vLabel = variance > 0 ? '+'+variance+' walk-ins' : (variance < 0 ? variance+' no-shows' : 'as booked');
                html += ' <span style="color:var(--text-muted);">· booked '+todayBookedCovers+'</span> <span style="color:'+vColor+';font-weight:600;">('+vLabel+')</span>';
            }
            html += '</div>';
        } else if (todayBookedCovers > 0) {
            html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">📋 Booked: '+todayBookedCovers+' covers (awaiting service)</div>';
        }
    } else {
        html += '<div style="font-size:32px;font-weight:800;color:var(--text-muted);margin:4px 0;">—</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);">Revenue data needed for P&L</div>';
    }
    html += '</div>';
    html += '</div>';

    } // end _showFinancials (financial row)

    // --- DOCUMENT STATUS (managers + directors only) ---
    if (window.renderDocStatusWidget) {
        const docWidget = window.renderDocStatusWidget();
        if (docWidget) html += '<div style="margin-bottom:14px;">' + docWidget + '</div>';
    }

    // --- STORAGE USAGE (managers + directors only) ---
    if (window.renderStorageUsageWidget) {
        const role = window._activeStaffMember?.role;
        const isMgr = role === 'Manager' || role === 'Director' || (!window._activeStaffMember && !window.isLocked);
        if (isMgr) {
            const storageWidget = window.renderStorageUsageWidget();
            if (storageWidget) html += '<div style="margin-bottom:14px;" id="storage-widget-host">' + storageWidget + '</div>';
        }
    }

    // --- OPERATIONAL PULSE (4 compact metric cards) ---
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px;">';

    // Stock Health
    const shColor = stockHealthPct >= 90 ? 'var(--green)' : stockHealthPct >= 70 ? 'var(--orange)' : 'var(--red)';
    html += '<div class="card" style="padding:14px;cursor:pointer;" onclick="window.showView(\'inventory\')">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">📦 Stock</div>';
    html += '<div style="font-size:22px;font-weight:800;color:'+shColor+';">'+stockHealthPct+'%</div>';
    html += '</div>';
    html += '<div style="background:var(--bg-main);border-radius:4px;height:4px;margin:8px 0 4px;overflow:hidden;"><div style="height:100%;width:'+stockHealthPct+'%;background:'+shColor+';border-radius:4px;"></div></div>';
    html += '<div style="font-size:11px;color:var(--text-muted);">' + lowStock.length + ' below PAR · $' + totalInvValue.toLocaleString('en-AU',{maximumFractionDigits:0}) + ' value</div>';
    html += '</div>';

    // Compliance
    const compColor = breaches.length > 0 ? 'var(--red)' : checkPct === 100 ? 'var(--green)' : 'var(--orange)';
    html += '<div class="card" style="padding:14px;cursor:pointer;" onclick="window.showView(\'compliance\')">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">🌡️ Compliance</div>';
    html += '<div style="font-size:22px;font-weight:800;color:'+compColor+';">'+(breaches.length>0?breaches.length+'!':checkPct+'%')+'</div>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">'+todayTemps.length+' temp logs · '+(breaches.length>0?'<span style="color:var(--red);font-weight:600;">'+breaches.length+' breach'+(breaches.length===1?'':'es')+'</span>':'0 breaches')+'</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Checklist: '+checkPct+'% complete</div>';
    if (allFridgeUnits.length > 0) {
        var fcCol = fridgeCoverage === 100 ? 'var(--green)' : fridgeCoverage >= 50 ? 'var(--orange)' : 'var(--red)';
        html += '<div style="font-size:11px;margin-top:2px;color:'+fcCol+';font-weight:'+(fridgeCoverage<100?'600':'400')+';">Fridges: '+loggedUnitsToday.length+'/'+allFridgeUnits.length+' logged</div>';
    }
    html += '</div>';

    // Tasks
    const taskColor = overdueTasks.length === 0 ? 'var(--green)' : 'var(--red)';
    html += '<div class="card" style="padding:14px;cursor:pointer;" onclick="window.showView(\'tasks\')">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">🔄 Tasks</div>';
    html += '<div style="font-size:22px;font-weight:800;color:'+taskColor+';">'+overdueTasks.length+'</div>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">'+(overdueTasks.length === 0 ? 'All current' : overdueTasks.length+' overdue')+'</div>';
    if (overdueTasks.length > 0) {
        var zoneBreakdown = {};
        overdueTasks.forEach(function(t) { var z = t.zone || 'Unassigned'; zoneBreakdown[z] = (zoneBreakdown[z]||0) + 1; });
        var zbText = Object.entries(zoneBreakdown).map(function(e) { return e[1] + ' ' + e[0]; }).join(' · ');
        html += '<div style="font-size:10px;color:var(--red);margin-top:2px;opacity:0.8;">'+zbText+'</div>';
    } else {
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+(window.rotationalTasks||[]).length+' total tracked</div>';
    }
    if (upcomingTasks.length > 0) {
        html += '<div style="font-size:10px;color:var(--orange);margin-top:2px;">'+upcomingTasks.length+' due this week</div>';
    }
    html += '</div>';

    // Team + On Floor
    var _ci = (window._tandaData && window._tandaData.clockedIn) ? window._tandaData.clockedIn : [];
    html += '<div class="card" style="padding:14px;cursor:pointer;" onclick="window._staffHubTab=\'qualifications\';window.showView(\'orientation\')">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">👥 Team</div>';
    html += '<div style="font-size:22px;font-weight:800;color:'+(expiringQuals.length>0?'var(--orange)':'var(--green)')+';">'+activeStaff.length+'</div>';
    html += '</div>';
    if (_ci.length > 0) {
        html += '<div style="font-size:11px;color:var(--green);font-weight:600;margin-top:6px;">🟢 ' + _ci.length + ' on floor now</div>';
        html += '<div style="font-size:10px;color:var(--text-muted);margin-top:2px;line-height:1.5;">' + _ci.slice(0, 4).map(function(c) { return c.name + (c.since ? ' <span style="opacity:0.6;">(' + c.since + ')</span>' : ''); }).join(', ') + (_ci.length > 4 ? ' +' + (_ci.length - 4) + ' more' : '') + '</div>';
    }
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">'+(expiringQuals.length > 0 ? '<span style="color:var(--orange);font-weight:600;">'+expiringQuals.length+' qual alert'+(expiringQuals.length===1?'':'s')+'</span>' : 'All qualifications OK')+'</div>';
    if (openTickets.length > 0) html += '<div style="font-size:11px;color:var(--orange);margin-top:2px;">🛠️ '+openTickets.length+' open ticket'+(openTickets.length===1?'':'s')+'</div>';
    html += '</div>';
    html += '</div>';

    // --- 7-DAY REVENUE CHART --- Manager only
    if (_showFinancials) {
    html += '<div class="card" style="padding:20px;margin-bottom:14px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<div><div style="font-size:14px;font-weight:700;">7-Day Revenue</div><div style="font-size:11px;color:var(--text-muted);">Avg $'+Math.round(avg7Rev).toLocaleString('en-AU')+'/day</div></div>';
    html += '<button onclick="window.showView(\'sales\')" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">View All →</button>';
    html += '</div>';
    // Bar chart
    html += '<div style="display:flex;gap:6px;align-items:flex-end;height:120px;">';
    last7.forEach((d, i) => {
        const h = maxRev7 > 0 ? Math.max(4, (d.rev / maxRev7) * 100) : 4;
        const isToday = i === 6;
        const dayLabel = d.date.toLocaleDateString('en-AU',{weekday:'short'}).substring(0,3);
        const barColor = isToday ? 'var(--green)' : d.rev > 0 ? 'var(--blue)' : 'var(--border)';
        html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">';
        html += '<div style="font-size:10px;color:var(--text-muted);">'+(d.rev>0?'$'+Math.round(d.rev/1000)+'k':'')+'</div>';
        html += '<div style="width:100%;height:'+h+'px;background:'+barColor+';border-radius:4px 4px 0 0;min-height:4px;transition:height 0.5s ease;'+(isToday?'box-shadow:0 0 8px rgba(16,185,129,0.3);':'')+'"></div>';
        html += '<div style="font-size:10px;color:'+(isToday?'var(--green)':'var(--text-muted)')+';font-weight:'+(isToday?'700':'400')+';">'+dayLabel+'</div>';
        html += '</div>';
    });
    html += '</div>';
    // Covers sparkline if data exists
    const coversData = last7.map(d => d.covers);
    if (coversData.some(c => c > 0)) {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--border);">';
        html += '<div style="font-size:12px;color:var(--text-muted);">👥 Covers trend (7d)</div>';
        html += sparkline(coversData, 120, 30, '#3b82f6');
        html += '<div style="font-size:12px;color:var(--blue);font-weight:600;">'+coversData.reduce((s,c)=>s+c,0)+' total</div>';
        html += '</div>';
    }
    html += '</div>';

    } // end _showFinancials (7-day revenue)

    // --- TODAY'S FOCUS + QUICK ACTIONS (2-column) ---
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:14px;margin-bottom:14px;">';

    // Focus
    html += '<div class="card" style="padding:0;overflow:hidden;'+(focusItems.length > 0 ? 'border-top:3px solid var(--red);' : 'border-top:3px solid var(--green);')+'">';
    if (focusItems.length === 0) {
        html += '<div style="padding:24px;text-align:center;"><span style="font-size:28px;">✅</span><div style="font-weight:600;color:var(--green);margin-top:8px;">All Clear</div><div style="font-size:13px;color:var(--text-muted);margin-top:4px;">Nothing needs your attention</div></div>';
    } else {
        html += '<div style="padding:12px 16px;background:rgba(239,68,68,0.04);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">';
        html += '<strong style="font-size:13px;">🎯 Today\'s Focus</strong>';
        html += '<span style="font-size:11px;color:var(--text-muted);">'+focusItems.length+' item'+(focusItems.length===1?'':'s')+'</span></div>';
        focusItems.slice(0,6).forEach(f => {
            html += '<div class="focus-item" onclick="window.showView(\''+f.view+'\')" style="border-bottom:1px solid var(--border);">';
            html += '<span style="font-size:14px;">'+f.icon+'</span><span style="flex:1;color:'+f.color+';font-size:13px;">'+f.text+'</span>';
            html += '<span style="color:var(--text-muted);font-size:10px;">→</span></div>';
        });
    }
    html += '</div>';

    // Quick Actions
    html += '<div class="card" style="padding:16px;">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:12px;">⚡ Quick Actions</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">';
    const actions = [
        {label:'Stock Count', icon:'✅', view:'stock-count', color:'var(--green)'},
        {label:'Log Temps', icon:'🌡️', view:'compliance', color:'var(--blue)'},
        {label:'Wastage', icon:'🗑️', view:'wastage', color:'var(--orange)'},
        {label:'Incident', icon:'⚠️', view:'incidents', color:'var(--red)'}
    ];
    if (_showFinancials) {
        actions.push(
            {label:'Handover', icon:'📝', onclick:'window.newHandoverForm()', color:'var(--purple)'},
            {label:'Covers', icon:'👥', onclick:'window.logCoversForm()', color:'var(--blue)'},
            {label:'EOD Summary', icon:'📊', onclick:'window.generateEodSummary()', color:'var(--purple)'},
            {label:'Ask Hub', icon:'🤖', onclick:"window.showView('ask-hub')", color:'var(--blue)'},
            {label:'EOD Run', icon:'✨', onclick:'window.openAiDepletion()', color:'var(--purple)'},
            {label:'All Venues', icon:'🏢', onclick:"window.showView('cross-venue')", color:'var(--green)'}
        );
    }
    actions.forEach(a => {
        const click = a.onclick || "window.showView('"+a.view+"')";
        html += '<button onclick="'+click+'" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-main);border:1px solid var(--border);border-radius:8px;color:'+a.color+';cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s;" onmouseover="this.style.borderColor=\''+a.color+'\'" onmouseout="this.style.borderColor=\'var(--border)\'">';
        html += '<span style="font-size:16px;">'+a.icon+'</span>'+a.label+'</button>';
    });
    html += '</div></div>';
    html += '</div>';

    // --- RECENT HANDOVER --- Manager only
    if (_showFinancials && recentHandover) {
        html += '<div class="card" style="padding:16px;margin-bottom:14px;border-left:3px solid var(--purple);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
        html += '<div style="font-size:13px;font-weight:700;">📝 Latest Handover</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);">'+E(recentHandover.date||'')+' · '+E(recentHandover.shift||'')+' · '+E(recentHandover.manager||'')+'</div>';
        html += '</div>';
        if (recentHandover.urgent) html += '<div style="color:var(--red);font-size:12px;font-weight:600;margin-bottom:6px;">🚨 URGENT FLAG</div>';
        const handoverText = recentHandover.debrief || recentHandover.notes || '';
        html += '<div style="font-size:13px;color:var(--text-muted);line-height:1.6;max-height:80px;overflow:hidden;">'+E(handoverText.substring(0,300))+(handoverText.length>300?'...':'')+'</div>';
        html += '<button onclick="window.showView(\'handover\')" class="btn btn-outline" style="font-size:11px;padding:4px 12px;margin-top:8px;">View All Handovers →</button>';
        html += '</div>';
    }

    // --- MARGIN ALERTS with Fix Actions ---
    if (_showFinancials && marginAlerts.length > 0) {
        html += '<div class="card" style="padding:16px;margin-bottom:14px;border-left:3px solid var(--purple);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
        html += '<div style="font-size:13px;font-weight:700;">📉 Margin Alerts <span style="font-size:11px;background:var(--purple);color:#fff;padding:1px 8px;border-radius:10px;margin-left:6px;">'+marginAlerts.length+'</span></div>';
        html += '<button onclick="window.showView(\'margins\')" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">View All →</button></div>';
        const _gpTarget = window.GP_TARGET || 67;
        marginAlerts.slice(0,5).forEach(a => {
            const suggestedPrice = a.cost > 0 ? (parseFloat(a.cost) / (1 - _gpTarget/100)).toFixed(0) : null;
            const recipe = (window.recipes||[]).find(r=>r.name===a.name);
            const currentPrice = recipe ? recipe.price : 0;
            html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px;gap:8px;">';
            html += '<span style="color:var(--red);flex:1;">'+E(a.name)+'</span>';
            html += '<span style="font-size:12px;color:var(--text-muted);">$'+a.cost+' cost</span>';
            html += '<span style="font-weight:700;color:var(--red);min-width:50px;text-align:right;">'+a.currentGp+'%</span>';
            if (suggestedPrice && recipe && Number(suggestedPrice) > currentPrice) {
                html += '<button onclick="window._quickFixPrice(\''+recipe.id+'\','+suggestedPrice+')" class="btn btn-outline" style="font-size:10px;padding:3px 8px;color:var(--green);border-color:var(--green);white-space:nowrap;" title="Update sell price to $'+suggestedPrice+' for '+_gpTarget+'% GP">Fix → $'+suggestedPrice+'</button>';
            }
            html += '</div>';
        });
        if (marginAlerts.length > 5) html += '<div style="font-size:11px;color:var(--text-muted);padding-top:6px;">+' + (marginAlerts.length-5) + ' more below target</div>';
        html += '</div>';
    }

    // Quick-fix sell price from margin alert
    window._quickFixPrice = (recipeId, newPrice) => {
        const recipe = (window.recipes||[]).find(r=>r.id===recipeId);
        if (!recipe) return;
        const oldPrice = recipe.price;
        window.confirmAction({
            title: '💰 Update Sell Price',
            message: '<strong>'+window.esc(recipe.name)+'</strong><br><br>Current: $'+oldPrice+' → New: <strong style="color:var(--green);">$'+newPrice+'</strong><br><br>This will achieve '+(window.GP_TARGET||67)+'% GP based on current costs ($'+recipe.cost?.toFixed(2)+').',
            confirmLabel: 'Update Price',
            tier: 'standard',
            onConfirm: () => {
                recipe.price = Number(newPrice);
                recipe.gp = parseFloat(((recipe.price - recipe.cost) / recipe.price * 100).toFixed(1));
                recipe.modifiedAt = new Date().toISOString();
                window.saveToDisk();
                window.showToast(recipe.name + ' price updated to $' + newPrice);
                window.showView('dashboard');
            }
        });
    };

    // --- RECIPE COSTING HEALTH WIDGET ---
    if (_showFinancials && _totalIngs > 0) {
        const _accColor = _costingAccuracy >= 80 ? 'var(--green)' : _costingAccuracy >= 50 ? 'var(--orange)' : 'var(--red)';
        html += '<div class="card" style="padding:16px;margin-bottom:14px;border-top:3px solid '+_accColor+';">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
        html += '<div style="font-size:13px;font-weight:700;">⚖️ Recipe Costing Health</div>';
        html += '<button onclick="window.showView(\'batch-linker\')" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">Link Ingredients →</button></div>';
        html += '<div style="display:flex;gap:20px;align-items:center;">';
        html += '<div style="position:relative;width:80px;height:80px;flex-shrink:0;">';
        html += scoreRing(_costingAccuracy, 80, 6, _accColor);
        html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;">';
        html += '<div style="font-size:20px;font-weight:800;color:'+_accColor+';">'+_costingAccuracy+'%</div>';
        html += '</div></div>';
        html += '<div style="flex:1;font-size:12px;line-height:1.8;color:var(--text-muted);">';
        html += _activeRecipes.length+' recipes · '+_linkedIngs+'/'+_totalIngs+' ingredients linked<br>';
        html += '<span style="color:var(--green);">'+_fullyCost+' fully costed</span> · <span style="color:var(--orange);">'+_partiallyCost+' partial</span> · <span style="color:var(--red);">'+_rawIngs+' unlinked</span>';
        html += '</div></div>';
        if (_costingAccuracy < 80) {
            html += '<div style="margin-top:10px;padding:8px;background:rgba(239,68,68,0.06);border-radius:6px;font-size:12px;color:var(--red);font-weight:600;">GP% may be unreliable — '+_rawIngs+' unlinked ingredients have $0 cost</div>';
        }
        if (_top5Unlinked.length > 0) {
            html += '<div style="margin-top:10px;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Top Unlinked Recipes</div>';
            _top5Unlinked.forEach(r => {
                html += '<div onclick="window.viewRecipe(\''+r.id+'\')" style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed var(--border);font-size:12px;cursor:pointer;">';
                html += '<span>'+E(r.name)+'</span><span style="color:var(--red);font-weight:600;">'+r.rawCount+' raw</span></div>';
            });
        }
        html += '</div>';
    }

    // --- WEEK AHEAD — Upcoming tasks ---
    if (upcomingTasks.length > 0 || overdueTasks.length > 0) {
        html += '<div class="card" style="padding:16px;margin-bottom:14px;border-top:3px solid var(--orange);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
        html += '<div style="font-size:13px;font-weight:700;">📅 Week Ahead — Tasks</div>';
        html += '<button onclick="window.showView(\'tasks\')" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">View All →</button></div>';
        // Overdue first
        overdueTasks.slice(0, 3).forEach(function(t) {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--border);font-size:13px;">';
            html += '<span style="color:var(--red);font-size:11px;font-weight:700;min-width:60px;">OVERDUE</span>';
            html += '<span style="flex:1;">'+E(t.name)+'</span>';
            html += (t.zone ? '<span style="font-size:10px;background:var(--bg-main);color:var(--brand-accent);padding:1px 6px;border-radius:8px;border:1px solid var(--border);">'+E(t.zone)+'</span>' : '');
            html += '</div>';
        });
        if (overdueTasks.length > 3) {
            html += '<div style="font-size:11px;color:var(--red);padding:4px 0;">+' + (overdueTasks.length - 3) + ' more overdue</div>';
        }
        // Upcoming
        upcomingTasks.slice(0, 5).forEach(function(t) {
            var dayLabel = t._daysUntil === 1 ? 'Tomorrow' : 'In ' + t._daysUntil + ' days';
            var dayColor = t._daysUntil <= 2 ? 'var(--orange)' : 'var(--text-muted)';
            html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--border);font-size:13px;">';
            html += '<span style="color:'+dayColor+';font-size:11px;font-weight:600;min-width:60px;">'+dayLabel+'</span>';
            html += '<span style="flex:1;">'+E(t.name)+'</span>';
            html += (t.zone ? '<span style="font-size:10px;background:var(--bg-main);color:var(--brand-accent);padding:1px 6px;border-radius:8px;border:1px solid var(--border);">'+E(t.zone)+'</span>' : '');
            html += '</div>';
        });
        html += '</div>';
    }

    // --- SHIFT FEEDBACK TRENDS (on dashboard) ---
    if (window._renderFeedbackTrendsCard) html += window._renderFeedbackTrendsCard();

    // --- TEAM LEADERBOARD (on dashboard) ---
    if (window._renderLeaderboardCard) html += window._renderLeaderboardCard();

    // --- KUDOS BOARD (on dashboard) ---
    if (window.renderKudosCard) html += window.renderKudosCard();

    // --- ACTIVE ANNOUNCEMENTS SUMMARY ---
    const activeAnns = (window.announcements || []).filter(a => !a.expiry || new Date(a.expiry) >= today).slice(0, 3);
    if (activeAnns.length > 0) {
        const prioColors = {urgent:'var(--red)',warning:'var(--orange)',info:'var(--blue)'};
        html += '<div class="card" style="padding:16px;margin-bottom:14px;border-top:3px solid var(--blue);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-size:13px;font-weight:700;">📢 Noticeboard</div>';
        html += '<button onclick="window.showView(\'noticeboard\')" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">View All →</button></div>';
        activeAnns.forEach(a => {
            html += '<div style="padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px;display:flex;gap:8px;align-items:center;">';
            html += '<span style="width:8px;height:8px;border-radius:50%;background:'+(prioColors[a.priority]||'var(--blue)')+';flex-shrink:0;"></span>';
            html += '<span style="flex:1;">'+E(a.title)+'</span>';
            html += '<span style="font-size:11px;color:var(--text-muted);">'+E(a.date||'')+'</span></div>';
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
};

// --- 10. HANDOVER ---
window._handoverExpanded = window._handoverExpanded || {};
window._handoverRange = window._handoverRange || 14;
window.renderHandoverView = () => {
    const E = window.esc;
    const logs = (window.handoverLogs || []).slice().reverse();
    const range = window._handoverRange || 14;
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - range);

    // Filter by date range
    const filtered = logs.filter(h => {
        if (!h.date) return true;
        const parts = h.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (!parts) return true;
        const d = new Date(parseInt(parts[3]), parseInt(parts[2])-1, parseInt(parts[1]));
        return d >= cutoff;
    });

    // Auto-expand latest
    if (filtered.length > 0 && Object.keys(window._handoverExpanded).length === 0) {
        window._handoverExpanded[0] = true;
    }

    const emptyHtml = logs.length === 0
        ? `<div style="text-align:center;padding:48px 20px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px;">📝</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main);">No handovers yet</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5;">Complete your first shift debrief to keep the team aligned across shifts.</div></div>`
        : '';

    const rangePills = [7,14,30].map(r =>
        `<span class="tag-pill ${range===r?'active':''}" onclick="window._handoverRange=${r};window._handoverExpanded={};window.showView('handover');">${r}d</span>`
    ).join('');

    const tableRows = filtered.map((h, i) => {
        const isExpanded = !!window._handoverExpanded[i];
        const isFirst = i === 0;
        const snippet = h.debrief ? h.debrief.substring(0, 80) + (h.debrief.length > 80 ? '...' : '') : (h.notes || '').substring(0, 80);
        const urgentBadge = h.urgent ? '<span style="color:var(--red);font-size:12px;font-weight:bold;">⚠️</span>' : '';

        let expandedContent = '';
        if (isExpanded) {
            const urgentHtml = h.urgent ? `<div style="margin-top:12px;padding:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;font-size:13px;color:var(--red);"><strong>⚠️ Needs attention:</strong> ${E(h.urgent)}</div>` : '';
            const debriefHtml = h.debrief
                ? `<div style="white-space:pre-wrap;font-size:14px;line-height:1.8;color:var(--text-main);">${E(h.debrief)}</div>`
                : `<p style="color:var(--text-muted);font-size:13px;font-style:italic;">No AI debrief — raw notes only.</p><div style="white-space:pre-wrap;font-size:14px;line-height:1.7;">${E(h.notes||'')}</div>`;
            expandedContent = `<tr><td colspan="5" style="padding:15px 20px;background:${isFirst?'rgba(139,92,246,0.04)':'var(--bg-main)'};border-bottom:2px solid var(--border);">
                <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Closed ${h.closeTime||'—'} · Out ${h.outTime||'—'} · KH ${h.khTime||'—'}</div>
                ${debriefHtml}${urgentHtml}
                ${h.debrief?`<button onclick="window.copyDebrief(${logs.length-1-i})" class="btn btn-outline" style="font-size:11px;margin-top:12px;padding:6px 14px;">📋 Copy</button>`:''}
            </td></tr>`;
        }

        return `<tr onclick="window._handoverExpanded[${i}]=!window._handoverExpanded[${i}];window.showView('handover');" style="cursor:pointer;border-bottom:1px solid var(--border);border-left:3px solid ${h.urgent?'var(--red)':isFirst?'var(--purple)':'transparent'};" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background=''">
            <td style="padding:10px 12px;font-size:13px;font-weight:600;white-space:nowrap;">${E(h.date||'')}</td>
            <td style="padding:10px 12px;font-size:13px;">${E(h.shift||'')}</td>
            <td style="padding:10px 12px;font-size:13px;">${E(h.manager||'')}</td>
            <td style="padding:10px 12px;font-size:12px;color:var(--text-muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${urgentBadge} ${E(snippet)}</td>
            <td style="padding:10px 12px;font-size:14px;text-align:center;">${isExpanded?'▾':'▸'}</td>
        </tr>${expandedContent}`;
    }).join('');

    const tableHtml = filtered.length > 0 ? `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table style="width:100%;background:var(--card-bg);border-radius:8px;border-collapse:collapse;">
        <thead><tr style="text-align:left;background:#111;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-muted);text-transform:uppercase;">
            <th style="padding:10px 12px;">Date</th><th style="padding:10px 12px;">Shift</th><th style="padding:10px 12px;">Manager</th><th style="padding:10px 12px;">Summary</th><th style="padding:10px 12px;width:40px;"></th>
        </tr></thead><tbody>${tableRows}</tbody></table></div>` : '';

    return `<div style="max-width:900px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
            <div>
                <h2 style="margin:0;">Shift Handover</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">End-of-shift debriefs for the opening team, managers, and ownership</div>
            </div>
            <button onclick="window.newHandoverForm()" class="btn btn-purple" style="font-size:14px;padding:10px 20px;">✨ Log Tonight's Shift</button>
        </div>
        <div style="margin-bottom:15px;display:flex;gap:6px;align-items:center;"><span style="font-size:12px;color:var(--text-muted);margin-right:4px;">Show:</span>${rangePills}</div>
        ${emptyHtml}${tableHtml}
    </div>`;
};

window.newHandoverForm = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const timeNow = hh + ':' + mm;
    // Enhanced auto-populate from today's data
    const prefills = window._generateHandoverPrefill ? window._generateHandoverPrefill() : {};

    const sections = (window.handoverTemplateConfig || {}).sections || ['Service Summary', 'Off Menu Items', 'Stock Alerts', 'Issues / Follow-ups', 'Opening Notes for Tomorrow'];

    const sectionFields = sections.map((sec, i) => {
        let placeholder = 'Notes...';
        const prefill = prefills[sec] || '';
        if (sec.toLowerCase().includes('off menu')) placeholder = 'List any items off menu during service...';
        if (sec.toLowerCase().includes('stock')) placeholder = 'Stock issues or items running low...';
        if (sec.toLowerCase().includes('service summary')) placeholder = 'How was the shift? Covers, vibe, any issues...';
        if (sec.toLowerCase().includes('opening')) placeholder = 'What does the opening team need to know?';
        if (sec.toLowerCase().includes('issue') || sec.toLowerCase().includes('follow')) placeholder = 'Equipment issues, booking follow-ups, staff matters...';

        return '<div class="handover-section" style="padding:12px;margin-bottom:8px;"><h4 style="margin:0 0 6px 0;font-size:12px;">' + sec + (prefill ? ' <span style="font-size:10px;color:var(--green);">✓ auto-filled</span>' : '') + '</h4>' +
            '<textarea id="h-sec-' + i + '" class="input-box" placeholder="' + placeholder + '" style="height:70px;margin:0;line-height:1.5;">' + prefill + '</textarea></div>';
    }).join('');
    
    const html = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">
            <div><label style="font-size:11px;color:var(--text-muted);">Manager Name</label>
            <input type="text" id="h-mgr" class="input-box" placeholder="Your name" style="margin:0;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Shift</label>
            <select id="h-shift" class="input-box" style="margin:0;"><option>PM Shift</option><option>AM Shift</option><option>Full Day</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:15px;">
            <div><label style="font-size:11px;color:var(--text-muted);">Close Time</label>
            <input type="time" id="h-close" class="input-box" value="${timeNow}" style="margin:0;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Out of Building</label>
            <input type="time" id="h-out" class="input-box" style="margin:0;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">KH Finish</label>
            <input type="time" id="h-kh" class="input-box" style="margin:0;"></div>
        </div>
        ${sectionFields}
        <label style="font-size:11px;color:var(--red);font-weight:600;">⚠️ Anything urgent for opening team? (optional)</label>
        <input type="text" id="h-urgent" class="input-box" placeholder="e.g. Walk-in fridge door seal broken — call repairman first thing" style="margin-bottom:20px;border-color:rgba(239,68,68,0.4);">
        <button onclick="window.saveAndGenerateDebrief()" class="btn btn-purple" style="width:100%;font-size:15px;padding:14px;" id="btn-debrief">✨ Generate Shift Debrief</button>`;
    window.openModal('📝 Log Tonight\'s Shift', html);
};

window.saveAndGenerateDebrief = async () => {
    const mgr = document.getElementById('h-mgr').value.trim();
    const notesEl = document.getElementById('h-notes');
    const notes = notesEl ? notesEl.value.trim() : '';
    if (!mgr) return window.showToast('Enter your name.', 'error');

    // Gather structured section data before validation
    const sections = (window.handoverTemplateConfig || {}).sections || ['Service Summary', 'Off Menu Items', 'Stock Alerts', 'Issues / Follow-ups', 'Opening Notes for Tomorrow'];
    const sectionData = {};
    sections.forEach((sec, i) => {
        const el = document.getElementById('h-sec-' + i);
        if (el && el.value.trim()) sectionData[sec] = el.value.trim();
    });
    const structuredNotes = Object.entries(sectionData).map(([k, v]) => k + ':\n' + v).join('\n\n');
    const combinedNotes = structuredNotes || notes;

    if (!combinedNotes) return window.showToast('Add some shift notes or fill in the sections above.', 'error');

    const btn = document.getElementById('btn-debrief');
    btn.innerText = '✨ Writing debrief...';
    btn.disabled = true;

    const shift = document.getElementById('h-shift').value;
    const closeTime = document.getElementById('h-close').value;
    const outTime = document.getElementById('h-out').value;
    const khTime = document.getElementById('h-kh').value;
    const urgent = document.getElementById('h-urgent').value.trim();
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-AU');

    // D5: Pull richer ops data for AI context
    const todaySales = (window.salesData||[]).find(s => s.date === today.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'/'));
    const todayRevenue = todaySales ? Number(todaySales.total||0) : null;
    const openTickets = (window.defectLogs||[]).filter(d=>d.status==='Open');
    const todayWasteLogs = (window.wastageLogs||[]).filter(l=>window._isToday(l.time));
    const wasteTotal = todayWasteLogs.reduce((s,w) => s + Number(w.value||0), 0);
    const todayIncidents = (window.incidentLogs||[]).filter(i=>window._isToday(i.time));
    const isWeekend = [0,5,6].includes(today.getDay());
    const belowPar = (window.inventoryItems||[]).filter(i => {
        if (i.archived) return false;
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return i.stock < par;
    });
    const topBelowPar = belowPar.slice(0,5).map(i=>i.name).join(', ');
    const todayTemps = (window.tempLogs||[]).filter(t=>window._isToday(t.time));
    const tempBreaches = todayTemps.filter(t=>parseFloat(t.value) > 5);
    const newTicketsToday = openTickets.filter(t=>window._isToday(t.date));

    const prompt = `You are writing an end-of-shift debrief for a hospitality venue called ${window._getVenueName()}.

The manager (${mgr}) has provided the following shift notes:
"${combinedNotes}"

Operational context for tonight's debrief:
- Shift: ${shift}
- Venue closed at: ${closeTime||'not recorded'}
- Manager out of building: ${outTime||'not recorded'}
- Kitchen hand finished: ${khTime||'not recorded'}
${todayRevenue ? '- It was a ' + (todayRevenue > 25000 ? 'big' : todayRevenue > 15000 ? 'solid' : 'quiet') + ' night for the venue.' : '- Revenue: not yet logged'}
- Wastage logged today: ${todayWasteLogs.length} items ($${wasteTotal.toFixed(2)})${todayWasteLogs.length > 0 ? ' — ' + todayWasteLogs.map(w=>w.itemName).join(', ') : ''}
- Maintenance tickets opened today: ${newTicketsToday.length}${newTicketsToday.length > 0 ? ' (' + newTicketsToday.map(t=>t.item).join(', ') + ')' : ''}
- Total open maintenance tickets: ${openTickets.length}${openTickets.length > 0 ? ' (' + openTickets.slice(0,3).map(t=>t.item).join(', ') + ')' : ''}
- Stock below par: ${belowPar.length} items${belowPar.length > 0 ? ' (' + topBelowPar + ')' : ''}
- Incidents today: ${todayIncidents.length}${todayIncidents.length > 0 ? ' — ' + todayIncidents.map(i=>i.type||'General').join(', ') : ''}
- Temp logs today: ${todayTemps.length} readings, ${tempBreaches.length} ${tempBreaches.length===1?'breach':'breaches'} above 5°C
${urgent ? '- URGENT for opening team: ' + urgent : ''}

Write a clear, friendly shift debrief that the opening team and management will read tomorrow.
- Write in plain paragraphs, no bullet points, no headers
- Tone is professional but warm — like a message from a capable colleague
- Cover: how the shift went, anything running low or needing attention, any follow-ups needed
- Reference specific items from the operational context above where relevant (e.g. name specific low-stock items, mention wastage if significant)
- If there's an urgent item, make sure it's prominent
- Do NOT mention revenue figures, wage percentages or financial targets
- Keep it to 3-4 short paragraphs maximum
- End with the close/out times as a simple sign-off line`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        const data = await response.json();
        const debrief = data.content && data.content[0] ? data.content[0].text : null;

        const entry = { date: dateStr, shift, manager: mgr, closeTime, outTime, khTime, notes, urgent, debrief };
        if (!window.handoverLogs) window.handoverLogs = [];
        window.handoverLogs.push(entry);
        window.saveToDisk();
        window.closeModal();
        window.showView('handover');
        window.showToast('Shift debrief saved!');

    } catch(e) {
        // Save raw notes even if AI fails
        const entry = { date: dateStr, shift, manager: mgr, closeTime, outTime, khTime, notes, urgent, debrief: null };
        if (!window.handoverLogs) window.handoverLogs = [];
        window.handoverLogs.push(entry);
        window.saveToDisk();
        window.closeModal();
        window.showView('handover');
        window.showToast('Saved without AI debrief — check API connection.', 'error');
    }
};

window.copyDebrief = (idx) => {
    const h = (window.handoverLogs||[])[idx];
    if (!h) return;
    const venueName = window._getVenueName();
    const text = `${venueName} — Shift Debrief\n${h.shift} · ${h.date} · ${h.manager}\n\n${h.debrief||h.notes}${h.urgent ? '\n\n⚠️ URGENT: ' + h.urgent : ''}\n\nClosed: ${h.closeTime||'—'} · Out: ${h.outTime||'—'} · KH: ${h.khTime||'—'}`;
    navigator.clipboard.writeText(text).then(() => window.showToast('Copied to clipboard!')).catch(() => window.showToast('Copy failed — try manually.', 'error'));
};


