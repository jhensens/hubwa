// --- HOBART HUB: Analytics Module ---
// Lines 1-697 from mgmt.js: Forecasting, analytics hub, takings/KPI dashboard, CSV import, wage targets

// --- 1. TAKINGS & KPI DASHBOARD ---
window._salesTab = window._salesTab || 'week';
window._salesMonth = window._salesMonth || null; // 'YYYY-MM' format


// =============================================================================
// REVENUE FORECASTING
// Day-of-week median + seasonal adjustment + YoY trend
// =============================================================================
window.renderForecastView = () => {
    const sales = window.salesData || [];
    if (sales.length < 30) {
        return '<div style="max-width:900px;margin:auto;"><div class="card" style="text-align:center;padding:40px;">' +
            '<div style="font-size:48px;margin-bottom:10px;">📊</div>' +
            '<h3 style="color:var(--text-muted);margin:0;">Not enough data yet</h3>' +
            '<p style="color:var(--text-muted);font-size:13px;margin-top:8px;">Need at least 30 days of takings data to generate forecasts.</p>' +
            '</div></div>';
    }

    // Parse BWI date format DD/MM/YYYY
    const parseDate = (str) => {
        const m = str && str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        return m ? new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1])) : null;
    };

    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    // Build day-of-week stats from historical data
    const byDow = {0:[],1:[],2:[],3:[],4:[],5:[],6:[]};
    sales.forEach(s => {
        const d = parseDate(s.date);
        if (d && s.total > 0) byDow[d.getDay()].push(Number(s.total));
    });

    // Calculate median for each day of week
    const median = arr => {
        if (arr.length === 0) return 0;
        const sorted = arr.slice().sort((a,b)=>a-b);
        const mid = Math.floor(sorted.length/2);
        return sorted.length%2 !== 0 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
    };
    const dowMedian = {};
    for (let d=0;d<7;d++) dowMedian[d] = median(byDow[d]);

    // Calculate YoY trend (last 90 days vs same period last year)
    const now = new Date();
    const ninetyAgo = new Date(now); ninetyAgo.setDate(ninetyAgo.getDate()-90);
    const lastYearEnd = new Date(now); lastYearEnd.setFullYear(lastYearEnd.getFullYear()-1);
    const lastYearStart = new Date(lastYearEnd); lastYearStart.setDate(lastYearStart.getDate()-90);

    const recentTotal = sales.filter(s => { const d=parseDate(s.date); return d && d>=ninetyAgo && d<=now; }).reduce((sum,s)=>sum+Number(s.total||0),0);
    const lastYearTotal = sales.filter(s => { const d=parseDate(s.date); return d && d>=lastYearStart && d<=lastYearEnd; }).reduce((sum,s)=>sum+Number(s.total||0),0);
    const yoyTrend = lastYearTotal > 0 ? (recentTotal - lastYearTotal) / lastYearTotal : 0;

    // Seasonal adjustment — compare this month's avg to annual avg
    const thisMonth = now.getMonth();
    const byMonth = {};
    sales.forEach(s => {
        const d = parseDate(s.date);
        if (d && s.total > 0) {
            const m = d.getMonth();
            if (!byMonth[m]) byMonth[m] = [];
            byMonth[m].push(Number(s.total));
        }
    });
    const monthAvgs = {};
    for (let m=0;m<12;m++) monthAvgs[m] = byMonth[m] ? byMonth[m].reduce((a,b)=>a+b,0)/byMonth[m].length : 0;
    const overallAvg = Object.values(monthAvgs).filter(v=>v>0).reduce((a,b)=>a+b,0) / Object.values(monthAvgs).filter(v=>v>0).length;
    const seasonalFactor = monthAvgs[thisMonth] > 0 && overallAvg > 0 ? monthAvgs[thisMonth]/overallAvg : 1;

    // Generate next 7 days forecast
    const next7 = [];
    for (let i=1; i<=7; i++) {
        const date = new Date(now); date.setDate(date.getDate()+i);
        const dow = date.getDay();
        const base = dowMedian[dow];
        const forecast = base * (1 + yoyTrend * 0.5) * (0.7 + seasonalFactor * 0.3);
        const low = forecast * 0.85;
        const high = forecast * 1.15;
        // Check if we have actual data for this date
        const dd = String(date.getDate()).padStart(2,'0');
        const mm = String(date.getMonth()+1).padStart(2,'0');
        const yyyy = date.getFullYear();
        const dateStr = dd+'/'+mm+'/'+yyyy;
        const actual = sales.find(s=>s.date===dateStr);
        next7.push({ date, dateStr, dow, forecast, low, high, actual: actual ? Number(actual.total) : null, dayName: dayNames[dow], dayShort: dayShort[dow] });
    }

    // Generate next 30 days by week
    const weeks = [[],[],[],[]];
    for (let i=1; i<=28; i++) {
        const date = new Date(now); date.setDate(date.getDate()+i);
        const dow = date.getDay();
        const base = dowMedian[dow];
        // Seasonal adjustment for future months
        const futureMonth = date.getMonth();
        const futureSeasonal = monthAvgs[futureMonth] > 0 && overallAvg > 0 ? monthAvgs[futureMonth]/overallAvg : 1;
        const forecast = base * (1 + yoyTrend * 0.5) * (0.7 + futureSeasonal * 0.3);
        weeks[Math.floor((i-1)/7)].push(forecast);
    }
    const weekTotals = weeks.map(w => w.reduce((a,b)=>a+b,0));

    // 7-day chart
    const _forecastHighs = next7.map(d=>d.high);
    const maxForecast = _forecastHighs.length > 0 ? Math.max(..._forecastHighs) : 0;
    const barHtml = next7.map(d => {
        const barPct = maxForecast > 0 ? (d.forecast/maxForecast*100) : 0;
        const isWeekend = d.dow === 0 || d.dow === 5 || d.dow === 6;
        const barColor = isWeekend ? 'var(--green)' : 'var(--blue)';
        const fmt = n => '$' + Math.round(n).toLocaleString('en-AU');
        return '<div style="text-align:center;flex:1;">' +
            '<div style="font-size:10px;color:var(--text-muted);margin-bottom:2px;">' + d.dayShort + '</div>' +
            '<div style="font-size:10px;color:var(--text-muted);margin-bottom:8px;">' + d.date.getDate() + '/' + (d.date.getMonth()+1) + '</div>' +
            '<div style="height:120px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px;">' +
                '<div style="font-size:11px;color:var(--text-muted);">' + fmt(d.high) + '</div>' +
                '<div style="width:40px;background:' + barColor + ';opacity:0.3;border-radius:4px 4px 0 0;height:' + (barPct*0.15) + 'px;"></div>' +
                '<div style="width:40px;background:' + barColor + ';border-radius:0;height:' + (barPct*0.7) + 'px;"></div>' +
                '<div style="width:40px;background:' + barColor + ';opacity:0.3;border-radius:0 0 4px 4px;height:' + (barPct*0.15) + 'px;"></div>' +
                '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">' + fmt(d.low) + '</div>' +
            '</div>' +
            '<div style="margin-top:8px;font-weight:bold;font-size:14px;color:' + barColor + ';">' + fmt(d.forecast) + '</div>' +
            (d.actual !== null ? '<div style="font-size:11px;color:var(--green);margin-top:2px;">Actual: ' + fmt(d.actual) + '</div>' : '') +
        '</div>';
    }).join('');

    // Week-by-week 30-day table
    const weekRows = weekTotals.map((total, i) => {
        const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() + i*7 + 1);
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + i*7 + 7);
        const label = 'Week ' + (i+1) + ' (' + weekStart.getDate() + '/' + (weekStart.getMonth()+1) + ' – ' + weekEnd.getDate() + '/' + (weekEnd.getMonth()+1) + ')';
        const low = total * 0.85, high = total * 1.15;
        return '<tr style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:12px 15px;">' + label + '</td>' +
            '<td style="padding:12px 15px;color:var(--text-muted);">$' + Math.round(low).toLocaleString('en-AU') + '</td>' +
            '<td style="padding:12px 15px;font-weight:bold;font-size:16px;color:var(--blue);">$' + Math.round(total).toLocaleString('en-AU') + '</td>' +
            '<td style="padding:12px 15px;color:var(--text-muted);">$' + Math.round(high).toLocaleString('en-AU') + '</td>' +
        '</tr>';
    }).join('');

    const totalForecast30 = weekTotals.reduce((a,b)=>a+b,0);
    const yoyPct = (yoyTrend * 100).toFixed(1);
    const yoyColor = yoyTrend >= 0 ? 'var(--green)' : 'var(--red)';

    return '<div style="max-width:1050px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0;">Revenue Forecast</h2>' +
            '<small style="color:var(--text-muted);">Based on ' + sales.length + ' days of historical data · Day-of-week patterns + seasonal adjustment</small></div>' +
            '<div style="text-align:right;">' +
                '<div style="font-size:12px;color:var(--text-muted);">YoY Trend</div>' +
                '<div style="font-size:16px;font-weight:bold;color:' + yoyColor + ';">' + (yoyTrend>=0?'▲':'▼') + ' ' + Math.abs(yoyPct) + '%</div>' +
            '</div>' +
        '</div>' +
        // KPI cards
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:15px;">' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--blue);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Next 7 Days</div>' +
                '<div style="font-size:28px;font-weight:bold;color:var(--blue);">$' + Math.round(next7.reduce((a,d)=>a+d.forecast,0)).toLocaleString('en-AU') + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">forecast</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--purple);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Next 30 Days</div>' +
                '<div style="font-size:28px;font-weight:bold;color:var(--purple);">$' + Math.round(totalForecast30).toLocaleString('en-AU') + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">forecast</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--green);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Best Day (7d)</div>' +
                '<div style="font-size:28px;font-weight:bold;color:var(--green);">$' + (next7.length>0?Math.round(Math.max(...next7.map(d=>d.forecast))).toLocaleString('en-AU'):'0') + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + (next7.length>0?(next7.reduce((best,d)=>d.forecast>best.forecast?d:best,next7[0])||{}).dayName:'—') + '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--orange);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Quietest Day (7d)</div>' +
                '<div style="font-size:28px;font-weight:bold;color:var(--orange);">$' + (next7.length>0?Math.round(Math.min(...next7.map(d=>d.forecast))).toLocaleString('en-AU'):'0') + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + (next7.length>0?(next7.reduce((worst,d)=>d.forecast<worst.forecast?d:worst,next7[0])||{}).dayName:'—') + '</div>' +
            '</div>' +
        '</div>' +
        // 7-day bar chart
        '<div class="card" style="margin-bottom:20px;">' +
            '<h3 style="margin:0 0 20px 0;font-size:15px;">Next 7 Days — Day by Day</h3>' +
            '<div style="display:flex;gap:8px;padding-bottom:10px;">' + barHtml + '</div>' +
            '<div style="margin-top:15px;padding-top:10px;border-top:1px solid var(--border);display:flex;gap:20px;font-size:12px;color:var(--text-muted);">' +
                '<span>📊 Bar = forecast · Faded = confidence range (±15%)</span>' +
                '<span style="color:var(--green);">■ Weekend</span>' +
                '<span style="color:var(--blue);">■ Weekday</span>' +
            '</div>' +
        '</div>' +
        // 30-day weekly breakdown
        '<div class="card" style="padding:0;overflow:hidden;">' +
            '<div style="padding:15px 20px;border-bottom:1px solid var(--border);">' +
                '<h3 style="margin:0;font-size:15px;">Next 30 Days — Weekly Overview</h3>' +
            '</div>' +
            '<table style="width:100%;border-collapse:collapse;">' +
                '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
                    '<th style="padding:10px 15px;text-align:left;">Period</th>' +
                    '<th style="padding:10px 15px;text-align:left;">Low</th>' +
                    '<th style="padding:10px 15px;text-align:left;">Forecast</th>' +
                    '<th style="padding:10px 15px;text-align:left;">High</th>' +
                '</tr></thead>' +
                '<tbody>' + weekRows + '</tbody>' +
                '<tfoot><tr style="background:rgba(139,92,246,0.1);border-top:2px solid var(--purple);">' +
                    '<td style="padding:12px 15px;font-weight:bold;">Total 30 Days</td>' +
                    '<td style="padding:12px 15px;color:var(--text-muted);">$' + Math.round(totalForecast30*0.85).toLocaleString('en-AU') + '</td>' +
                    '<td style="padding:12px 15px;font-weight:bold;font-size:18px;color:var(--purple);">$' + Math.round(totalForecast30).toLocaleString('en-AU') + '</td>' +
                    '<td style="padding:12px 15px;color:var(--text-muted);">$' + Math.round(totalForecast30*1.15).toLocaleString('en-AU') + '</td>' +
                '</tr></tfoot>' +
            '</table>' +
        '</div>' +
        '<div style="margin-top:12px;font-size:11px;color:var(--text-muted);">Forecasts use median revenue for each day of week, adjusted for YoY trend and seasonal patterns. Confidence range is ±15%. Actual results may vary.</div>' +
    '</div>';
};

window._analyticsTab = window._analyticsTab || 'takings';

window.renderAnalyticsHub = () => {
    const tab = window._analyticsTab;
    const tabs = [
        { id: 'takings', label: '📈 Takings & KPIs' },
        { id: 'primecost', label: '💎 Prime Cost' },
        { id: 'variance', label: '📊 Variance' },
        { id: 'forecast', label: '🔮 Forecast' },
        { id: 'supplier-spend', label: '🏷️ Supplier Spend' }
    ];
    const tabBar = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">' +
        tabs.map(t => '<span class="tag-pill ' + (tab === t.id ? 'active' : '') + '" onclick="window._analyticsTab=\'' + t.id + '\';window.showView(\'sales\');">' + t.label + '</span>').join('') +
    '</div>';
    let content = '';
    if (tab === 'takings') content = window.renderSalesView ? window.renderSalesView() : '';
    else if (tab === 'primecost') content = window.renderPrimeCostView ? window.renderPrimeCostView() : '';
    else if (tab === 'variance') content = window.renderVarianceReport ? window.renderVarianceReport() : '';
    else if (tab === 'forecast') content = window.renderForecastView ? window.renderForecastView() : '';
    else if (tab === 'supplier-spend') content = window.renderSupplierSpendView ? window.renderSupplierSpendView() : '';
    return '<div style="max-width:1200px;margin:auto;">' + tabBar + '</div>' + content;
};

window.renderSalesView = () => {
    // Parse BWI date format DD/MM/YYYY into JS Date
    const parseDate = (str) => {
        if (!str) return null;
        // DD/MM/YYYY format (our standard)
        const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m) {
            const day = parseInt(m[1]), month = parseInt(m[2]), year = parseInt(m[3]);
            // Detect US format (MM/DD/YYYY) — if "day" > 12 it must be DD/MM
            // If month > 12 it's been stored as US format, swap them
            if (month > 12) return new Date(year, day-1, month); // m[2]>12 → MM/DD format, swap
            return new Date(year, month-1, day);
        }
        // YYYY-MM-DD format
        const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2])-1, parseInt(iso[3]));
        return null; // reject ambiguous formats
    };

    // Fix US-format dates (MM/DD/YYYY) → DD/MM/YYYY
    // US format: 03/15/2026 → m[1]=03, m[2]=15. m[2]>12 means it's a day, so MM/DD
    let _datesFixed = false;
    (window.salesData||[]).forEach(s => {
        if (!s.date) return;
        const m = s.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (m && parseInt(m[2]) > 12) {
            // m[2] > 12 means it's a day → currently stored as MM/DD/YYYY → swap to DD/MM/YYYY
            s.date = m[2].padStart(2,'0') + '/' + m[1].padStart(2,'0') + '/' + m[3];
            _datesFixed = true;
        }
    });
    if (_datesFixed) window.saveToDisk();

    const allSales = (window.salesData || []).slice().sort((a, b) => {
        const da = parseDate(a.date), db = parseDate(b.date);
        return (da||0) - (db||0);
    });
    const today = new Date();

    // Build list of available months from data
    const availableMonths = [...new Set(allSales.map(s => {
        const d = parseDate(s.date);
        if (!d) return null;
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    }).filter(Boolean))].sort().reverse();

    // Date range helpers
    const getWeekStart = (offset = 0) => {
        const d = new Date(today);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) - (offset * 7);
        d.setDate(diff); d.setHours(0,0,0,0); return d;
    };

    const thisWeekStart = getWeekStart(0);
    const lastWeekStart = getWeekStart(1);
    const last7Start = new Date(today); last7Start.setDate(today.getDate() - 6); last7Start.setHours(0,0,0,0);
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const filterByRange = (start, end) => allSales.filter(s => {
        const d = parseDate(s.date);
        if (!d) return false;
        return d >= start && d <= (end || today);
    });

    const tab = window._salesTab || 'week';
    let periodData, periodLabel, compareData, compareLabel;

    if (tab === 'month-pick') {
        // Pick a month view
        const selMonth = window._salesMonth || (availableMonths[0] || '');
        if (selMonth) {
            const [yr, mo] = selMonth.split('-').map(Number);
            const mStart = new Date(yr, mo-1, 1);
            const mEnd = new Date(yr, mo, 0, 23, 59, 59);
            periodData = filterByRange(mStart, mEnd);
            periodLabel = mStart.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
            // Compare to same month last year if available
            const lastYrStart = new Date(yr-1, mo-1, 1);
            const lastYrEnd = new Date(yr-1, mo, 0, 23, 59, 59);
            compareData = filterByRange(lastYrStart, lastYrEnd);
            compareLabel = lastYrStart.toLocaleString('en-AU', { month: 'long', year: 'numeric' });
        } else {
            periodData = []; periodLabel = 'No data'; compareData = []; compareLabel = '';
        }
    } else if (tab === 'week') {
        periodData = filterByRange(thisWeekStart);
        periodLabel = 'This Week';
        compareData = filterByRange(lastWeekStart, new Date(thisWeekStart - 1));
        compareLabel = 'Last Week';
    } else if (tab === 'lastweek') {
        periodData = filterByRange(lastWeekStart, new Date(thisWeekStart - 1));
        periodLabel = 'Last Week';
        compareData = filterByRange(getWeekStart(2), new Date(lastWeekStart - 1));
        compareLabel = 'Week Before';
    } else if (tab === 'days7') {
        periodData = filterByRange(last7Start);
        periodLabel = 'Last 7 Days';
        compareData = filterByRange(new Date(last7Start.getTime() - 7*24*3600*1000), new Date(last7Start - 1));
        compareLabel = 'Prior 7 Days';
    } else {
        periodData = filterByRange(thisMonthStart);
        periodLabel = new Date().toLocaleString('en-AU', { month: 'long' });
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        compareData = filterByRange(lastMonthStart, new Date(thisMonthStart - 1));
        compareLabel = new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleString('en-AU', { month: 'long' });
    }

    const sum = arr => arr.reduce((s, d) => s + Number(d.total || 0), 0);
    const avg = arr => arr.length > 0 ? sum(arr) / arr.length : 0;
    const best = arr => arr.length > 0 ? arr.reduce((b, d) => Number(d.total) > Number(b.total) ? d : b) : null;
    const worst = arr => arr.length > 0 ? arr.reduce((w, d) => Number(d.total) < Number(w.total) ? d : w) : null;

    const totalRev = sum(periodData);
    const avgDaily = avg(periodData);
    const bestDay = best(periodData);
    const worstDay = worst(periodData);
    const prevTotal = sum(compareData);
    const revChange = prevTotal > 0 ? (((totalRev - prevTotal) / prevTotal) * 100).toFixed(1) : null;
    const revChangeHtml = revChange !== null
        ? '<span style="font-size:12px;color:' + (revChange >= 0 ? 'var(--green)' : 'var(--red)') + ';margin-left:6px;">' + (revChange >= 0 ? '▲' : '▼') + ' ' + Math.abs(revChange) + '% vs ' + compareLabel + '</span>'
        : '';

    // Wage cost %
    const wageTarget = Number((window.salesTargets || {}).wageTarget || 30);
    // Food cost % estimate — use wastage logs value as proxy if no better data
    const wastageValue = (window.wastageLogs || []).reduce((s, w) => s + Number(w.value || 0), 0);
    const foodCostPct = totalRev > 0 ? ((wastageValue / totalRev) * 100).toFixed(1) : 0;

    // Actual wages from CSV data for the period
    const totalActualWages = periodData.reduce((s, d) => s + (Number(d.wages) || 0), 0);
    const actualWagePct = totalRev > 0 && totalActualWages > 0 ? ((totalActualWages / totalRev) * 100).toFixed(1) : null;

    // Tab pills + month picker
    const tabs = [
        { id: 'week', label: 'This Week' },
        { id: 'lastweek', label: 'Last Week' },
        { id: 'days7', label: 'Last 7 Days' },
        { id: 'month', label: 'This Month' },
        { id: 'month-pick', label: '📅 Pick Month' }
    ];
    const tabHtml = tabs.map(t =>
        '<button onclick="window._salesTab=\'' + t.id + '\'; window.showView(\'sales\')" class="btn ' + (tab === t.id ? 'btn-dark' : 'btn-outline') + '" style="font-size:12px;padding:7px 14px;">' + t.label + '</button>'
    ).join('') + (tab === 'month-pick' && availableMonths.length > 0 ?
        '<select onchange="window._salesMonth=this.value; window.showView(\'sales\')" class="input-box" style="margin:0;padding:7px 12px;font-size:12px;width:auto;display:inline-block;">' +
        availableMonths.map(m => {
            const [yr, mo] = m.split('-').map(Number);
            const label = new Date(yr, mo-1, 1).toLocaleString('en-AU', {month:'long', year:'numeric'});
            return '<option value="' + m + '" ' + (window._salesMonth === m ? 'selected' : '') + '>' + label + '</option>';
        }).join('') + '</select>' : 
        (tab === 'month-pick' && availableMonths.length === 0 ? '<span style="font-size:12px;color:var(--text-muted);align-self:center;">No data uploaded yet</span>' : '')
    );

    // KPI cards
    const kpiCardsHtml =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:15px;margin-bottom:20px;">' +
            // Revenue
            '<div class="card" style="text-align:center;border-top:4px solid var(--green);padding:20px 15px;">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Total Revenue</div>' +
                '<div style="font-size:26px;font-weight:bold;color:var(--green);">$' + totalRev.toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) + '</div>' +
                '<div style="font-size:11px;margin-top:4px;color:var(--text-muted);">' + periodData.length + ' days' + (revChange !== null ? ' · <span style="color:' + (revChange >= 0 ? 'var(--green)' : 'var(--red)') + ';">' + (revChange >= 0 ? '▲' : '▼') + Math.abs(revChange) + '%</span>' : '') + '</div>' +
            '</div>' +
            // Avg Daily
            '<div class="card" style="text-align:center;border-top:4px solid var(--blue);padding:20px 15px;">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Avg Daily</div>' +
                '<div style="font-size:26px;font-weight:bold;color:var(--blue);">$' + avgDaily.toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) + '</div>' +
                '<div style="font-size:11px;margin-top:4px;color:var(--text-muted);">' + periodLabel + '</div>' +
            '</div>' +
            // Best Day
            '<div class="card" style="text-align:center;border-top:4px solid var(--green);padding:20px 15px;">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Best Day</div>' +
                '<div style="font-size:26px;font-weight:bold;color:var(--green);">' + (bestDay ? '$' + Number(bestDay.total).toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) : '—') + '</div>' +
                '<div style="font-size:11px;margin-top:4px;color:var(--text-muted);">' + (bestDay ? bestDay.date : 'No data') + '</div>' +
            '</div>' +
            // Worst Day
            '<div class="card" style="text-align:center;border-top:4px solid var(--orange);padding:20px 15px;">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Worst Day</div>' +
                '<div style="font-size:26px;font-weight:bold;color:var(--orange);">' + (worstDay ? '$' + Number(worstDay.total).toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) : '—') + '</div>' +
                '<div style="font-size:11px;margin-top:4px;color:var(--text-muted);">' + (worstDay ? worstDay.date : 'No data') + '</div>' +
            '</div>' +
            // Wage Cost % — actual from CSV if available, otherwise target
            (actualWagePct !== null ?
                '<div class="card" style="text-align:center;border-top:4px solid ' + (parseFloat(actualWagePct) <= wageTarget ? 'var(--green)' : 'var(--red)') + ';padding:20px 15px;">' +
                    '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Actual Wages</div>' +
                    '<div style="font-size:26px;font-weight:bold;color:' + (parseFloat(actualWagePct) <= wageTarget ? 'var(--green)' : 'var(--red)') + ';">' + actualWagePct + '%</div>' +
                    '<div style="font-size:11px;margin-top:4px;color:var(--text-muted);">$' + totalActualWages.toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) + ' · target ' + wageTarget + '%</div>' +
                '</div>'
            :
                '<div class="card" style="text-align:center;border-top:4px solid var(--orange);padding:20px 15px;">' +
                    '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Wage Target</div>' +
                    '<div style="font-size:26px;font-weight:bold;color:var(--orange);">' + wageTarget + '%</div>' +
                    '<div style="font-size:11px;margin-top:4px;color:var(--text-muted);">Budget $' + (totalRev * wageTarget / 100).toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) + '</div>' +
                '</div>'
            ) +
            // Food Cost %
            '<div class="card" style="text-align:center;border-top:4px solid var(--purple);padding:20px 15px;">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Food Cost %</div>' +
                '<div style="font-size:26px;font-weight:bold;color:var(--purple);">' + foodCostPct + '%</div>' +
                '<div style="font-size:11px;margin-top:4px;color:var(--text-muted);">Est. from wastage logs</div>' +
            '</div>' +
        '</div>';

    // Revenue bar chart — inline SVG
    const chartData = periodData.slice(-14); // last 14 days max
    let chartHtml = '';
    if (chartData.length > 0) {
        const maxVal = Math.max(...chartData.map(d => Number(d.total)));
        const chartW = 100; // percentage width per bar slot
        const barW = Math.max(10, Math.floor(600 / chartData.length) - 4);
        const svgH = 120;
        const bars = chartData.map((d, i) => {
            const barH = maxVal > 0 ? Math.max(4, Math.round((Number(d.total) / maxVal) * svgH)) : 4;
            const x = i * (barW + 4);
            const isToday = d.date === today.toLocaleDateString('en-AU');
            const color = isToday ? '#3b82f6' : '#10b981';
            return '<rect x="' + x + '" y="' + (svgH - barH) + '" width="' + barW + '" height="' + barH + '" fill="' + color + '" rx="2" opacity="0.85">' +
                '<title>' + d.date + ': $' + Number(d.total).toFixed(0) + '</title></rect>';
        }).join('');
        const totalW = chartData.length * (barW + 4);
        chartHtml = '<div class="card" style="margin-bottom:20px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
                '<h3 style="margin:0;font-size:15px;">Revenue Trend</h3>' +
                '<span style="font-size:11px;color:var(--text-muted);">' + chartData.length + ' days · hover bars for detail</span>' +
            '</div>' +
            '<div style="overflow-x:auto;">' +
                '<svg width="' + totalW + '" height="' + (svgH + 20) + '" xmlns="http://www.w3.org/2000/svg">' + bars + '</svg>' +
            '</div>' +
            '<div style="display:flex;gap:15px;margin-top:8px;font-size:11px;color:var(--text-muted);">' +
                '<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#10b981;border-radius:2px;display:inline-block;"></span> Revenue</span>' +
                '<span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;background:#3b82f6;border-radius:2px;display:inline-block;"></span> Today</span>' +
            '</div>' +
        '</div>';
    } else {
        chartHtml = '<div class="card" style="text-align:center;padding:30px;margin-bottom:20px;"><p style="color:var(--text-muted);margin:0;">No sales data for this period. Upload a takings CSV to see trends.</p></div>';
    }

    // Daily trade table — includes wages and notes from new CSV format
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const tableRows = periodData.slice().reverse().map(s => {
        const d = parseDate(s.date);
        const dayLabel = d ? dayNames[d.getDay()] : '';
        const wageAmt = Number(s.wages || 0);
        const wagePctDay = Number(s.total || 0) > 0 && wageAmt > 0 ? ' (' + ((wageAmt / Number(s.total)) * 100).toFixed(0) + '%)' : '';

        // Tanda wage lookup: convert DD/MM/YYYY to YYYY-MM-DD
        var tandaWageCell = '—';
        var tandaData = window._tandaData || {};
        var weeklyActual = tandaData.weeklyActual || {};
        if (d) {
            var isoDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            var tandaDay = weeklyActual[isoDate];
            if (tandaDay && tandaDay.cost > 0) {
                var tandaPct = Number(s.total || 0) > 0 ? ' (' + ((tandaDay.cost / Number(s.total)) * 100).toFixed(0) + '%)' : '';
                tandaWageCell = '<span style="color:var(--blue);">$' + Math.round(tandaDay.cost).toLocaleString('en-AU') + tandaPct + '</span>' +
                    '<br><small style="color:var(--text-muted);">' + tandaDay.hours.toFixed(1) + 'h · ' + tandaDay.count + ' staff</small>';
            }
        }

        return '<tr style="border-bottom:1px solid var(--bg-main);cursor:pointer;transition:background 0.15s;" onclick="window.manualTakingsForm(\''+s.date+'\')" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'\'">' +
            '<td style="padding:7px 8px;font-size:12px;">' + s.date + '</td>' +
            '<td style="padding:10px;color:var(--text-muted);">' + dayLabel + '</td>' +
            '<td style="padding:10px;">$' + Number(s.eftpos||0).toFixed(2) + '</td>' +
            '<td style="padding:10px;">$' + Number(s.cash||0).toFixed(2) + '</td>' +
            '<td style="padding:6px 8px;font-size:13px;">' + (Number(s.meandu||0) > 0 ? '$' + Number(s.meandu).toFixed(2) : '—') + '</td>' +
            '<td style="padding:10px;font-weight:bold;color:var(--green);">$' + Number(s.total||0).toFixed(2) + '</td>' +
            '<td style="padding:10px;font-size:12px;">' + tandaWageCell + '</td>' +
            '<td style="padding:10px;color:' + (wageAmt > 0 ? 'var(--orange)' : 'var(--red)') + ';font-size:12px;">' + (wageAmt > 0 ? '$' + wageAmt.toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) + wagePctDay : '✏️ Add wages') + '</td>' +
            '<td style="padding:10px;color:var(--text-muted);font-size:12px;">' + esc(s.notes || '') + '</td>' +
        '</tr>';
    }).join('');

    // EOD depletion log
    const recentDepletions = (window.depletionLogs || []).slice(-10).reverse();
    const depletionHtml = '<div class="card" style="border-top:5px solid var(--purple);margin-top:20px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">' +
            '<h3 style="margin:0;">EOD Depletion Log</h3>' +
            '<span style="font-size:12px;color:var(--text-muted);">' + recentDepletions.length + ' recent runs</span>' +
        '</div>' +
        (recentDepletions.length === 0
            ? '<p style="color:var(--text-muted);font-size:13px;margin:0;">No depletions run yet.</p>'
            : recentDepletions.map(d =>
                '<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:10px;overflow:hidden;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 15px;background:var(--bg-main);cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'">' +
                        '<div><strong style="font-size:14px;">' + d.date + ' <span style="color:var(--text-muted);font-weight:normal;font-size:12px;">at ' + d.time + '</span></strong>' +
                        '<span style="margin-left:12px;font-size:12px;color:var(--purple);">' + d.totalLines + ' stock lines · ' + (d.itemsSold||[]).length + ' recipes</span>' +
                        ((d.skippedUnmapped||0) > 0 ? '<span style="margin-left:8px;font-size:11px;color:var(--orange);">⚠️ ' + d.skippedUnmapped + ' unmapped</span>' : '') + '</div>' +
                        '<span style="color:var(--text-muted);font-size:12px;">▼ Details</span>' +
                    '</div>' +
                    '<div style="display:none;padding:15px;font-size:12px;">' +
                        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;">' +
                            '<div><strong style="color:var(--brand-accent);display:block;margin-bottom:6px;">Recipes Sold</strong>' +
                            (d.itemsSold||[]).map(l => '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--border);"><span>' + esc(l.recipeName) + '</span><strong style="color:var(--green);">' + l.qtySold + '</strong></div>').join('') + '</div>' +
                            '<div><strong style="color:var(--brand-accent);display:block;margin-bottom:6px;">Stock Deducted</strong>' +
                            (d.stockChanges||[]).map(s => '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--border);"><span style="color:var(--text-muted);">' + esc(s.name) + '</span><span><span style="color:var(--red);">' + s.before + '</span> → <strong>' + s.after + '</strong> <small>' + esc(s.unit) + '</small></span></div>').join('') + '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            ).join('')) +
    '</div>';

    return '<div style="max-width:1050px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<h2 style="margin:0;">Takings & KPIs</h2>' +
            '<button onclick="window.showFoodBevSplit()" class="btn btn-outline" style="font-size:12px;">🍱🍶 Food vs Bev Split</button>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                '<button onclick="window.openAiDepletion()" class="btn btn-purple">✨ EOD Depletion</button>' +
                '<button onclick="window.showView(\'depletion-history\')" class="btn btn-outline" style="font-size:12px;">📉 History</button>' +
                '<button onclick="document.getElementById(\'csv-upload\').click()" class="btn btn-blue">📈 Upload CSV</button>' +
                '<input type="file" id="csv-upload" accept=".csv" style="display:none;" onchange="window.handleSalesCSV(event)">' +
                '<button onclick="window.manualTakingsForm()" class="btn btn-green" style="font-size:12px;">+ Manual Entry</button>' +
                '<button onclick="window.showView(\'lightspeed-import\')" class="btn btn-outline" style="font-size:12px;">📥 Lightspeed</button>' +
                '<button onclick="window.confirmClearTakings()" class="btn btn-outline" style="color:var(--red);border-color:var(--red);font-size:12px;">🗑️ Clear Takings</button>' +
            '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;">' + tabHtml + '</div>' +
        kpiCardsHtml +
        chartHtml +
        '<div class="card" style="padding:0;overflow:hidden;">' +
            '<div style="padding:12px 20px;background:#111;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">' +
                '<h3 style="margin:0;font-size:15px;">Daily Breakdown — ' + periodLabel + '</h3>' +
                '<span style="font-size:12px;color:var(--text-muted);">' + periodData.length + ' days</span>' +
            '</div>' +
            '<div style="max-height:300px;overflow-y:auto;">' +
                '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
                    '<thead><tr style="text-align:left;border-bottom:1px solid var(--border);background:#0a0a0c;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
                        '<th style="padding:6px 8px;">Date</th><th style="padding:6px 8px;">Day</th><th style="padding:6px 8px;">EFTPOS</th><th style="padding:6px 8px;">Cash</th><th style="padding:6px 8px;">Me&u</th><th style="padding:6px 8px;color:var(--green);">Total</th><th style="padding:6px 8px;color:var(--blue);">Tanda</th><th style="padding:6px 8px;color:var(--orange);">Wages</th><th style="padding:6px 8px;">Notes</th>' +
                    '</tr></thead>' +
                    '<tbody>' + (tableRows || '<tr><td colspan="9" style="padding:15px;color:var(--text-muted);text-align:center;">No data for this period.</td></tr>') + '</tbody>' +
                '</table>' +
            '</div>' +
        '</div>' +
        '<div class="card" style="margin-top:20px;border-left:4px solid var(--blue);padding:12px 18px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
                '<div><label style="font-size:12px;color:var(--text-muted);">Wage Target %</label>' +
                '<input type="number" id="wage-target" class="input-box" value="' + wageTarget + '" onchange="window.updateWageTarget(this.value)" style="width:80px;display:inline-block;margin:0 0 0 10px;padding:6px 10px;"></div>' +
                '<span style="font-size:12px;color:var(--text-muted);">Wage budget this period: <strong style="color:var(--green);">$' + (totalRev * wageTarget / 100).toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) + '</strong></span>' +
            '</div>' +
        '</div>' +
        depletionHtml +
    '</div>';
};

window.updateWageTarget = (val) => { window.salesTargets.wageTarget = val; window.saveToDisk(); window.showToast("Wage Target Saved"); };
window.confirmClearTakings = () => {
    const html = '<p style="color:var(--red);font-weight:bold;margin-top:0;">This will permanently delete ALL takings data.</p>' +
        '<p style="color:var(--text-muted);font-size:13px;">Make sure you have your CSV files ready to re-upload.</p>' +
        '<label style="font-size:12px;color:var(--text-muted);">Type <strong>CLEAR</strong> to confirm:</label>' +
        '<input type="text" id="clear-confirm-input" class="input-box" placeholder="Type CLEAR here" style="margin-bottom:15px;">' +
        '<button onclick="window.clearTakingsData()" class="btn btn-red" style="width:100%;">🗑️ Delete All Takings</button>';
    window.openModal('⚠️ Clear Takings Data', html);
};
window.clearTakingsData = () => {
    const input = document.getElementById('clear-confirm-input');
    if (input && input.value.trim() !== 'CLEAR') return window.showToast('Type CLEAR to confirm.', 'error');
    window.salesData = [];
    window.saveToDisk();
    window.closeModal();
    window.showToast('Takings data cleared. Re-upload your CSVs.');
    window.showView('sales');
};

window.manualTakingsForm = (editDate) => {
    const existing = editDate ? (window.salesData || []).find(s => s.date === editDate) : null;
    const today = new Date();
    const dd = String(today.getDate()).padStart(2,'0');
    const mm = String(today.getMonth()+1).padStart(2,'0');
    const yyyy = today.getFullYear();
    const todayStr = dd + '/' + mm + '/' + yyyy;
    const html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Date (DD/MM/YYYY)</label>' +
        '<input type="text" id="mt-date" class="input-box" value="' + (existing ? existing.date : todayStr) + '" placeholder="DD/MM/YYYY" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Day</label>' +
        '<input type="text" id="mt-day" class="input-box" value="' + (existing ? (existing.day||'') : '') + '" placeholder="e.g. Monday" style="margin:0;"></div></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:15px;">' +
        '<div><label style="font-size:11px;color:var(--text-muted);">EFTPOS ($)</label><input type="number" step="0.01" id="mt-eft" class="input-box" value="' + (existing ? existing.eftpos||'' : '') + '" placeholder="0.00" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Cash ($)</label><input type="number" step="0.01" id="mt-cash" class="input-box" value="' + (existing ? existing.cash||'' : '') + '" placeholder="0.00" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Me&u ($)</label><input type="number" step="0.01" id="mt-meandu" class="input-box" value="' + (existing ? existing.meandu||'' : '') + '" placeholder="0.00" style="margin:0;"></div></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Total ($)</label><input type="number" step="0.01" id="mt-total" class="input-box" value="' + (existing ? existing.total||'' : '') + '" placeholder="0.00" style="margin:0;border-color:var(--green);"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Wages ($)</label><input type="number" step="0.01" id="mt-wages" class="input-box" value="' + (existing ? existing.wages||'' : '') + '" placeholder="0.00" style="margin:0;"></div></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Notes</label>' +
        '<input type="text" id="mt-notes" class="input-box" value="' + esc(existing ? existing.notes||'' : '') + '" placeholder="e.g. Public holiday, private event..." style="margin-bottom:20px;"></div>' +
        '<button onclick="window.saveManualTakings(window._mtEditDate)" class="btn btn-green" style="width:100%;font-size:15px;">Save Takings Entry</button>';
    window._mtEditDate = editDate || null;
    window.openModal(editDate ? 'Edit Takings — ' + editDate : '+ Manual Takings Entry', html);
};

window.saveManualTakings = (editDate) => {
    const date = document.getElementById('mt-date').value.trim();
    const total = parseFloat(document.getElementById('mt-total').value) || 0;
    if (!date) return window.showToast('Date is required.', 'error');
    if (!total) return window.showToast('Total is required.', 'error');
    const entry = {
        date, day: document.getElementById('mt-day').value.trim(),
        eftpos: parseFloat(document.getElementById('mt-eft').value) || 0,
        cash: parseFloat(document.getElementById('mt-cash').value) || 0,
        meandu: parseFloat(document.getElementById('mt-meandu').value) || 0,
        total, wages: parseFloat(document.getElementById('mt-wages').value) || 0,
        notes: document.getElementById('mt-notes').value.trim()
    };
    const idx = (window.salesData || []).findIndex(s => s.date === date);
    if (idx >= 0) { window.salesData[idx] = { ...window.salesData[idx], ...entry }; }
    else { window.salesData.push(entry); }
    window.saveToDisk(); window.closeModal(); window.showView('sales');
    window.showToast('Takings entry saved!');
};
window.handleSalesCSV = (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const lines = e.target.result.split('\n');
        let imported = 0, skipped = 0, updated = 0;

        // BWI format: rows 1-4 are metadata/headers, data starts row 6 (index 5)
        // Headers row (index 4): Date,Day,EFTPOS,Petty Cash,Charity,MEANDU,Gift cards,Cash,Total,,,,Notes,total day hours,total day wages,rostered diff,hour %,Wage %
        const dataRows = lines.slice(5); // skip first 5 rows

        dataRows.forEach(row => {
            if (!row.trim()) return;
            const cols = row.split(',');
            if (cols.length < 9) return;

            const rawDate = (cols[0] || '').trim();
            if (!rawDate || rawDate === 'Date') return;

            // Parse DD/MM/YYYY into a consistent stored format
            let dateStr = rawDate;
            const ddmmyyyy = rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (ddmmyyyy) {
                // Store as DD/MM/YYYY (consistent with en-AU locale)
                dateStr = ddmmyyyy[1].padStart(2,'0') + '/' + ddmmyyyy[2].padStart(2,'0') + '/' + ddmmyyyy[3];
            }

            const eftpos   = parseFloat(cols[2]) || 0;
            const petty    = parseFloat(cols[3]) || 0;
            const charity  = parseFloat(cols[4]) || 0;
            const meandu   = parseFloat(cols[5]) || 0;
            const giftcard = parseFloat(cols[6]) || 0;
            const cash     = parseFloat(cols[7]) || 0;
            const total    = parseFloat(cols[8]) || 0;
            const notes    = (cols[12] || '').trim();
            const wages    = parseFloat(cols[14]) || 0;
            const wagePct  = parseFloat(cols[17]) || 0;

            if (!total && !eftpos && !cash) return; // skip empty rows

            const existing = window.salesData.find(s => s.date === dateStr);
            const entry = { date: dateStr, eftpos, petty, charity, meandu, giftcard, cash, total, notes, wages, wagePct };

            if (existing) {
                Object.assign(existing, entry);
                updated++;
            } else {
                window.salesData.push(entry);
                imported++;
            }
        });

        window.saveToDisk();
        window.showToast('Imported ' + imported + ' new, ' + updated + ' updated.');
        window.showView('sales');
    };
    reader.readAsText(file);
};

// =============================================================================
// SUPPLIER SPEND DASHBOARD
// =============================================================================
window._spendPeriod = 90;

// Parse DD/MM/YYYY → Date (reuses logic from renderSalesView)
window._parseSpendDate = (str) => {
    if (!str) return null;
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        const day = parseInt(m[1]), month = parseInt(m[2]), year = parseInt(m[3]);
        if (month > 12) return new Date(year, day-1, month);
        return new Date(year, month-1, day);
    }
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2])-1, parseInt(iso[3]));
    return null;
};

window._aggregateSupplierSpend = (periodDays) => {
    const now = new Date();
    const cutoff = periodDays ? new Date(now.getTime() - periodDays * 86400000) : null;
    const bySupplier = {};
    const byItem = {};
    const byMonth = {};
    let totalSpend = 0;

    (window.inventoryItems||[]).forEach(inv => {
        if (inv.archived || !inv.history || inv.history.length === 0) return;
        const itemName = inv.recipeName || inv.name;
        inv.history.forEach(h => {
            if (!h.supplier || !h.price) return;
            const d = window._parseSpendDate(h.date);
            if (!d || isNaN(d)) return;
            if (cutoff && d < cutoff) return;
            const spend = (h.qty||1) * h.price;
            const monthKey = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');

            // By supplier
            if (!bySupplier[h.supplier]) bySupplier[h.supplier] = { totalSpend:0, entryCount:0, byMonth:{}, items:{} };
            const sup = bySupplier[h.supplier];
            sup.totalSpend += spend;
            sup.entryCount++;
            sup.byMonth[monthKey] = (sup.byMonth[monthKey]||0) + spend;
            if (!sup.items[itemName]) sup.items[itemName] = { totalSpend:0, qty:0, prices:[] };
            sup.items[itemName].totalSpend += spend;
            sup.items[itemName].qty += (h.qty||1);
            sup.items[itemName].prices.push(h.price);

            // By item
            if (!byItem[itemName]) byItem[itemName] = { totalSpend:0, qty:0, supplier: h.supplier, prices:[] };
            byItem[itemName].totalSpend += spend;
            byItem[itemName].qty += (h.qty||1);
            byItem[itemName].prices.push(h.price);
            byItem[itemName].supplier = h.supplier;

            // By month
            byMonth[monthKey] = (byMonth[monthKey]||0) + spend;
            totalSpend += spend;
        });
    });

    // Top items sorted by spend
    const topItems = Object.entries(byItem).map(([name, d]) => ({
        name, supplier: d.supplier, totalSpend: d.totalSpend, qty: d.qty,
        avgPrice: d.prices.reduce((s,p)=>s+p,0)/d.prices.length, prices: d.prices
    })).sort((a,b) => b.totalSpend - a.totalSpend);

    const months = Object.keys(byMonth).sort();
    const monthCount = months.length || 1;

    return { bySupplier, topItems, byMonth, totalSpend, monthCount, months };
};

// SVG sparkline from data points
window._spendSparkline = (points, w, h, color) => {
    if (!points || points.length < 2) return '';
    const max = Math.max(...points), min = Math.min(...points);
    const range = max - min || 1;
    const coords = points.map((v, i) => {
        const x = (i / (points.length-1)) * w;
        const y = h - ((v - min) / range) * (h - 4) - 2;
        return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg width="'+w+'" height="'+h+'" style="vertical-align:middle;"><polyline points="'+coords+'" fill="none" stroke="'+color+'" stroke-width="1.5" stroke-linecap="round"/></svg>';
};

window.renderSupplierSpendView = () => {
    const E = window.esc;
    const period = window._spendPeriod;
    const data = window._aggregateSupplierSpend(period);
    const periodLabel = period ? period + ' Days' : 'All Time';

    // Period pills
    const pills = [30, 60, 90, null].map(p => {
        const label = p ? p + 'd' : 'All';
        const active = p === period ? 'active' : '';
        return '<span class="tag-pill '+active+'" onclick="window._spendPeriod='+(p===null?'null':p)+';window.showView(\'sales\');">'+label+'</span>';
    }).join('');

    // KPIs
    const suppliers = Object.entries(data.bySupplier).sort((a,b) => b[1].totalSpend - a[1].totalSpend);
    const topSupplier = suppliers.length > 0 ? suppliers[0][0] : 'N/A';
    const avgMonthly = data.totalSpend / data.monthCount;

    let html = '<div style="max-width:1100px;margin:auto;">';

    // Period filter
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
        '<div><h2 style="margin:0;">🏷️ Supplier Spend Analysis</h2>' +
        '<small style="color:var(--text-muted);">'+periodLabel+' · '+suppliers.length+' suppliers · '+data.topItems.length+' items tracked</small></div>' +
        '<div style="display:flex;gap:6px;">'+pills+'</div></div>';

    if (data.totalSpend === 0) {
        html += '<div class="card" style="text-align:center;padding:40px;"><div style="font-size:48px;margin-bottom:10px;">📦</div>' +
            '<h3 style="color:var(--text-muted);">No invoice data for this period</h3>' +
            '<p style="color:var(--text-muted);font-size:13px;">Process invoices through the Invoice Ripper to build purchase history.</p>' +
            '<button onclick="window.showView(\'invoice\')" class="btn btn-purple" style="margin-top:10px;">🧾 Invoice Ripper</button></div></div>';
        return html;
    }

    // KPI cards
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px;">' +
        '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--green);"><div style="font-size:24px;font-weight:bold;color:var(--green);">$'+data.totalSpend.toLocaleString(undefined,{maximumFractionDigits:0})+'</div><div style="font-size:11px;color:var(--text-muted);">Total Spend</div></div>' +
        '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--blue);"><div style="font-size:24px;font-weight:bold;color:var(--blue);">$'+avgMonthly.toLocaleString(undefined,{maximumFractionDigits:0})+'</div><div style="font-size:11px;color:var(--text-muted);">Avg / Month</div></div>' +
        '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--purple);"><div style="font-size:18px;font-weight:bold;color:var(--purple);">'+E(topSupplier)+'</div><div style="font-size:11px;color:var(--text-muted);">Top Supplier</div></div>' +
        '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--orange);"><div style="font-size:24px;font-weight:bold;color:var(--orange);">'+suppliers.length+'</div><div style="font-size:11px;color:var(--text-muted);">Active Suppliers</div></div>' +
    '</div>';

    // Monthly spend trend chart
    if (data.months.length >= 2) {
        const monthVals = data.months.map(m => data.byMonth[m]||0);
        const maxMonth = Math.max(...monthVals);
        const barW = Math.max(20, Math.min(50, 500 / data.months.length));
        const chartH = 160;
        const bars = data.months.map((m, i) => {
            const val = data.byMonth[m]||0;
            const h = maxMonth > 0 ? (val / maxMonth) * (chartH - 25) : 0;
            const x = i * (barW + 4) + 40;
            const label = m.substring(5); // MM from YYYY-MM
            return '<rect x="'+x+'" y="'+(chartH - h - 20)+'" width="'+(barW-2)+'" height="'+h+'" fill="var(--purple)" rx="3" opacity="0.8">' +
                '<title>'+m+': $'+val.toLocaleString(undefined,{maximumFractionDigits:0})+'</title></rect>' +
                '<text x="'+(x+(barW-2)/2)+'" y="'+(chartH-5)+'" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="9">'+label+'</text>';
        }).join('');
        const svgW = data.months.length * (barW + 4) + 50;
        html += '<div class="card" style="padding:16px;margin-bottom:20px;">' +
            '<h3 style="margin:0 0 12px;font-size:14px;">Monthly Spend Trend</h3>' +
            '<div style="overflow-x:auto;"><svg viewBox="0 0 '+svgW+' '+chartH+'" style="width:100%;max-width:'+svgW+'px;height:'+chartH+'px;">'+bars+'</svg></div></div>';
    }

    // Supplier spend table (collapsible)
    html += '<div class="card" style="padding:0;overflow:hidden;margin-bottom:20px;">' +
        '<div style="padding:12px 16px;border-bottom:1px solid var(--border);"><h3 style="margin:0;font-size:14px;">Spend by Supplier</h3></div>';

    suppliers.forEach(([name, sup], idx) => {
        const pct = data.totalSpend > 0 ? (sup.totalSpend / data.totalSpend * 100).toFixed(0) : 0;
        const monthPoints = data.months.map(m => sup.byMonth[m]||0);
        const spark = window._spendSparkline(monthPoints, 80, 20, '#a78bfa');
        const topItemsList = Object.entries(sup.items).sort((a,b) => b[1].totalSpend - a[1].totalSpend).slice(0, 5);

        html += '<div style="border-bottom:1px solid var(--border);">' +
            '<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'" style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">' +
                '<div style="display:flex;align-items:center;gap:12px;">' +
                    '<strong style="font-size:13px;">'+E(name)+'</strong>' +
                    '<span style="font-size:11px;color:var(--text-muted);">'+sup.entryCount+' invoices</span>' +
                    spark +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:15px;">' +
                    '<span style="font-size:12px;color:var(--text-muted);">'+pct+'%</span>' +
                    '<strong style="font-size:14px;color:var(--green);">$'+sup.totalSpend.toLocaleString(undefined,{maximumFractionDigits:0})+'</strong>' +
                    '<span style="color:var(--text-muted);font-size:16px;">▾</span>' +
                '</div>' +
            '</div>' +
            '<div style="display:none;padding:0 16px 12px;border-top:1px solid var(--border);background:rgba(0,0,0,0.1);">' +
                '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px;">' +
                '<thead><tr style="color:var(--text-muted);text-transform:uppercase;font-size:10px;"><th style="padding:4px 8px;text-align:left;">Item</th><th style="padding:4px 8px;text-align:right;">Qty</th><th style="padding:4px 8px;text-align:right;">Avg Price</th><th style="padding:4px 8px;text-align:right;">Spend</th></tr></thead><tbody>' +
                topItemsList.map(([iName, d]) => {
                    const avg = d.prices.length > 0 ? d.prices.reduce((s,p)=>s+p,0)/d.prices.length : 0;
                    return '<tr style="border-top:1px solid var(--border);"><td style="padding:4px 8px;">'+E(iName)+'</td>' +
                        '<td style="padding:4px 8px;text-align:right;">'+d.qty.toFixed(1)+'</td>' +
                        '<td style="padding:4px 8px;text-align:right;">$'+avg.toFixed(2)+'</td>' +
                        '<td style="padding:4px 8px;text-align:right;font-weight:bold;">$'+d.totalSpend.toFixed(0)+'</td></tr>';
                }).join('') +
                '</tbody></table>' +
                (Object.keys(sup.items).length > 5 ? '<div style="font-size:11px;color:var(--text-muted);padding:6px 8px;">+ '+(Object.keys(sup.items).length-5)+' more items</div>' : '') +
            '</div></div>';
    });
    html += '</div>';

    // Top 10 items by spend
    const top10 = data.topItems.slice(0, 10);
    if (top10.length > 0) {
        html += '<div class="card" style="padding:0;overflow:hidden;margin-bottom:20px;">' +
            '<div style="padding:12px 16px;border-bottom:1px solid var(--border);"><h3 style="margin:0;font-size:14px;">Top 10 Items by Spend</h3></div>' +
            '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="font-size:10px;color:var(--text-muted);text-transform:uppercase;background:rgba(0,0,0,0.2);">' +
            '<th style="padding:8px 12px;text-align:left;">#</th><th style="padding:8px 12px;text-align:left;">Item</th><th style="padding:8px 12px;text-align:left;">Supplier</th>' +
            '<th style="padding:8px 12px;text-align:right;">Qty</th><th style="padding:8px 12px;text-align:right;">Avg Price</th><th style="padding:8px 12px;text-align:right;">Total Spend</th><th style="padding:8px 12px;">Trend</th></tr></thead><tbody>';

        top10.forEach((item, i) => {
            const spark = window._spendSparkline(item.prices.slice(-10), 60, 16, 'var(--blue)');
            html += '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:8px 12px;color:var(--text-muted);font-size:12px;">'+(i+1)+'</td>' +
                '<td style="padding:8px 12px;font-size:13px;font-weight:bold;">'+E(item.name)+'</td>' +
                '<td style="padding:8px 12px;font-size:12px;color:var(--text-muted);">'+E(item.supplier)+'</td>' +
                '<td style="padding:8px 12px;text-align:right;font-size:12px;">'+item.qty.toFixed(1)+'</td>' +
                '<td style="padding:8px 12px;text-align:right;font-size:12px;">$'+item.avgPrice.toFixed(2)+'</td>' +
                '<td style="padding:8px 12px;text-align:right;font-weight:bold;color:var(--green);">$'+item.totalSpend.toFixed(0)+'</td>' +
                '<td style="padding:8px 12px;text-align:center;">'+spark+'</td></tr>';
        });
        html += '</tbody></table></div></div>';
    }

    // Price volatility by supplier
    const volatility = suppliers.map(([name, sup]) => {
        const itemEntries = Object.entries(sup.items);
        let maxSwing = 0, maxSwingItem = '';
        itemEntries.forEach(([iName, d]) => {
            if (d.prices.length < 2) return;
            const mn = Math.min(...d.prices), mx = Math.max(...d.prices);
            const swing = mn > 0 ? ((mx - mn) / mn * 100) : 0;
            if (swing > maxSwing) { maxSwing = swing; maxSwingItem = iName; }
        });
        return { name, itemCount: itemEntries.length, maxSwing, maxSwingItem };
    }).filter(v => v.maxSwing > 0).sort((a,b) => b.maxSwing - a.maxSwing);

    if (volatility.length > 0) {
        html += '<div class="card" style="padding:0;overflow:hidden;margin-bottom:20px;">' +
            '<div style="padding:12px 16px;border-bottom:1px solid var(--border);"><h3 style="margin:0;font-size:14px;">Price Volatility by Supplier</h3>' +
            '<small style="color:var(--text-muted);">Largest price swing per supplier</small></div>' +
            '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="font-size:10px;color:var(--text-muted);text-transform:uppercase;background:rgba(0,0,0,0.2);">' +
            '<th style="padding:8px 12px;text-align:left;">Supplier</th><th style="padding:8px 12px;text-align:right;">Items</th>' +
            '<th style="padding:8px 12px;text-align:left;">Most Volatile Item</th><th style="padding:8px 12px;text-align:right;">Max Swing</th></tr></thead><tbody>';

        volatility.slice(0, 10).forEach(v => {
            const color = v.maxSwing > 20 ? 'var(--red)' : v.maxSwing > 10 ? 'var(--orange)' : 'var(--green)';
            html += '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:8px 12px;font-size:13px;font-weight:bold;">'+E(v.name)+'</td>' +
                '<td style="padding:8px 12px;text-align:right;font-size:12px;">'+v.itemCount+'</td>' +
                '<td style="padding:8px 12px;font-size:12px;color:var(--text-muted);">'+E(v.maxSwingItem)+'</td>' +
                '<td style="padding:8px 12px;text-align:right;font-weight:bold;font-size:13px;color:'+color+';">'+v.maxSwing.toFixed(1)+'%</td></tr>';
        });
        html += '</tbody></table></div></div>';
    }

    html += '</div>';
    return html;
};

