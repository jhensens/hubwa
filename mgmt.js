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
    const maxForecast = Math.max(...next7.map(d=>d.high));
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
            '<td style="padding:12px 15px;color:var(--text-muted);">$' + Math.round(low).toLocaleString() + '</td>' +
            '<td style="padding:12px 15px;font-weight:bold;font-size:16px;color:var(--blue);">$' + Math.round(total).toLocaleString() + '</td>' +
            '<td style="padding:12px 15px;color:var(--text-muted);">$' + Math.round(high).toLocaleString() + '</td>' +
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
                '<div style="font-size:28px;font-weight:bold;color:var(--blue);">$' + Math.round(next7.reduce((a,d)=>a+d.forecast,0)).toLocaleString() + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">forecast</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--purple);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Next 30 Days</div>' +
                '<div style="font-size:28px;font-weight:bold;color:var(--purple);">$' + Math.round(totalForecast30).toLocaleString() + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">forecast</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--green);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Best Day (7d)</div>' +
                '<div style="font-size:28px;font-weight:bold;color:var(--green);">$' + Math.round(Math.max(...next7.map(d=>d.forecast))).toLocaleString() + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + (next7.reduce((best,d)=>d.forecast>best.forecast?d:best,next7[0])||{}).dayName + '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--orange);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Quietest Day (7d)</div>' +
                '<div style="font-size:28px;font-weight:bold;color:var(--orange);">$' + Math.round(Math.min(...next7.map(d=>d.forecast))).toLocaleString() + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + (next7.reduce((worst,d)=>d.forecast<worst.forecast?d:worst,next7[0])||{}).dayName + '</div>' +
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
                    '<td style="padding:12px 15px;color:var(--text-muted);">$' + Math.round(totalForecast30*0.85).toLocaleString() + '</td>' +
                    '<td style="padding:12px 15px;font-weight:bold;font-size:18px;color:var(--purple);">$' + Math.round(totalForecast30).toLocaleString() + '</td>' +
                    '<td style="padding:12px 15px;color:var(--text-muted);">$' + Math.round(totalForecast30*1.15).toLocaleString() + '</td>' +
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
        { id: 'forecast', label: '🔮 Forecast' }
    ];
    const tabBar = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">' +
        tabs.map(t => '<span class="tag-pill ' + (tab === t.id ? 'active' : '') + '" onclick="window._analyticsTab=\'' + t.id + '\';window.showView(\'sales\');">' + t.label + '</span>').join('') +
    '</div>';
    let content = '';
    if (tab === 'takings') content = window.renderSalesView ? window.renderSalesView() : '';
    else if (tab === 'primecost') content = window.renderPrimeCostView ? window.renderPrimeCostView() : '';
    else if (tab === 'variance') content = window.renderVarianceReport ? window.renderVarianceReport() : '';
    else if (tab === 'forecast') content = window.renderForecastView ? window.renderForecastView() : '';
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
        return '<tr style="border-bottom:1px solid var(--bg-main);cursor:pointer;transition:background 0.15s;" onclick="window.manualTakingsForm(\''+s.date+'\')" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'\'">' +
            '<td style="padding:7px 8px;font-size:12px;">' + s.date + '</td>' +
            '<td style="padding:10px;color:var(--text-muted);">' + dayLabel + '</td>' +
            '<td style="padding:10px;">$' + Number(s.eftpos||0).toFixed(2) + '</td>' +
            '<td style="padding:10px;">$' + Number(s.cash||0).toFixed(2) + '</td>' +
            '<td style="padding:6px 8px;font-size:13px;">' + (Number(s.meandu||0) > 0 ? '$' + Number(s.meandu).toFixed(2) : '—') + '</td>' +
            '<td style="padding:10px;font-weight:bold;color:var(--green);">$' + Number(s.total||0).toFixed(2) + '</td>' +
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
                        '<th style="padding:6px 8px;">Date</th><th style="padding:6px 8px;">Day</th><th style="padding:6px 8px;">EFTPOS</th><th style="padding:6px 8px;">Cash</th><th style="padding:6px 8px;">Me&u</th><th style="padding:6px 8px;color:var(--green);">Total</th><th style="padding:6px 8px;color:var(--orange);">Wages</th><th style="padding:6px 8px;">Notes</th>' +
                    '</tr></thead>' +
                    '<tbody>' + (tableRows || '<tr><td colspan="8" style="padding:15px;color:var(--text-muted);text-align:center;">No data for this period.</td></tr>') + '</tbody>' +
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


// --- 2. STAFF HUB (Directory + Onboarding + Phonebook) ---
window._staffHubTab = window._staffHubTab || 'directory';

window.renderStaffHubView = function() {
    const tab = window._staffHubTab;
    const tabs = [
        { id: 'directory', label: '👥 Directory' },
        { id: 'onboarding', label: '🤝 Onboarding' },
        { id: 'qualifications', label: '🎓 Qualifications' },
        { id: 'phonebook', label: '📞 Phonebook' }
    ];
    const tabBar = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;">' +
        tabs.map(t => `<span class="tag-pill ${tab===t.id?'active':''}" onclick="window._staffHubTab='${t.id}';window.showView('orientation');">${t.label}</span>`).join('') +
    '</div>';

    let content = '';
    if (tab === 'directory') content = window.renderStaffDirectoryView ? window.renderStaffDirectoryView() : '';
    else if (tab === 'onboarding') content = window.renderOrientationView ? window.renderOrientationView() : '';
    else if (tab === 'qualifications') content = window.renderQualificationsView ? window.renderQualificationsView() : '';
    else if (tab === 'phonebook') content = window.renderPhoneBookView ? window.renderPhoneBookView() : '';

    return `<div style="max-width:1100px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
            <div>
                <h2 style="margin:0;">👥 Staff Hub</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Team directory, onboarding, qualifications, and contacts</div>
            </div>
        </div>
        ${tabBar}
        ${content}
    </div>`;
};

// --- QUALIFICATIONS MATRIX VIEW ---
window.renderQualificationsView = function() {
    const staff = (window.staffDirectory||[]).filter(s => s.status !== 'Inactive');
    const quals = window.qualificationTypes || [];
    const now = new Date();

    const getStatus = (q, qt) => {
        if (!q) return { cls: 'qual-none', label: 'Not Set' };
        if (!qt.expiryRequired) return q.verified ? { cls: 'qual-valid', label: 'Verified' } : { cls: 'qual-expiring', label: 'Pending' };
        if (!q.expiry) return { cls: 'qual-none', label: 'No Date' };
        const days = (new Date(q.expiry) - now) / 86400000;
        if (days < 0) return { cls: 'qual-expired', label: 'Expired' };
        if (days <= 30) return { cls: 'qual-expiring', label: Math.ceil(days) + 'd left' };
        return { cls: 'qual-valid', label: q.expiry };
    };

    if (staff.length === 0) {
        return '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);">' +
            '<div style="font-size:36px;margin-bottom:12px;">🎓</div>' +
            '<div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main);">No active staff</div>' +
            '<div style="font-size:13px;">Add staff in the Directory tab first.</div></div>';
    }

    // Summary stats
    let totalExpired = 0, totalExpiring = 0, totalOk = 0;
    staff.forEach(s => {
        quals.forEach(qt => {
            const q = (s.qualifications||{})[qt.id];
            const st = getStatus(q, qt);
            if (st.cls === 'qual-expired') totalExpired++;
            else if (st.cls === 'qual-expiring') totalExpiring++;
            else if (st.cls === 'qual-valid') totalOk++;
        });
    });

    const summary = '<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;">' +
        '<div class="card" style="flex:1;min-width:120px;padding:12px;text-align:center;border-left:3px solid var(--green);"><div style="font-size:24px;font-weight:700;color:var(--green);">' + totalOk + '</div><div style="font-size:11px;color:var(--text-muted);">Valid</div></div>' +
        '<div class="card" style="flex:1;min-width:120px;padding:12px;text-align:center;border-left:3px solid var(--orange);"><div style="font-size:24px;font-weight:700;color:var(--orange);">' + totalExpiring + '</div><div style="font-size:11px;color:var(--text-muted);">Expiring Soon</div></div>' +
        '<div class="card" style="flex:1;min-width:120px;padding:12px;text-align:center;border-left:3px solid var(--red);"><div style="font-size:24px;font-weight:700;color:var(--red);">' + totalExpired + '</div><div style="font-size:11px;color:var(--text-muted);">Expired</div></div>' +
    '</div>';

    // Matrix table
    const thead = '<th style="padding:8px 12px;text-align:left;">Staff</th>' +
        quals.map(qt => '<th style="padding:8px 12px;text-align:center;font-size:11px;">' + esc(qt.name) + '</th>').join('') +
        '<th style="padding:8px 12px;"></th>';

    const tbody = staff.map((s, i) => {
        const cells = quals.map(qt => {
            const q = (s.qualifications||{})[qt.id];
            const st = getStatus(q, qt);
            return '<td style="padding:8px 12px;text-align:center;"><span class="' + st.cls + '">' + st.label + '</span></td>';
        }).join('');
        return '<tr style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:8px 12px;"><strong style="font-size:13px;">' + esc(s.name) + '</strong><br><small style="color:var(--text-muted);">' + esc(s.role||'') + '</small></td>' +
            cells +
            '<td style="padding:8px 12px;text-align:right;"><button onclick="window.editStaffForm(' + i + ')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">✏️ Edit</button></td>' +
        '</tr>';
    }).join('');

    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">' +
        '<div style="font-size:14px;font-weight:600;">Qualification Status Matrix</div>' +
        '<button onclick="window.editQualTypes()" class="btn btn-outline" style="font-size:12px;">⚙️ Edit Qualification Types</button>' +
    '</div>' +
    summary +
    '<div class="card" style="overflow-x:auto;padding:0;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' + thead + '</tr></thead>' +
        '<tbody>' + tbody + '</tbody>' +
        '</table>' +
    '</div>';
};

// --- EDIT QUALIFICATION TYPES ---
window.editQualTypes = () => {
    const quals = window.qualificationTypes || [];
    const rows = quals.map((qt, i) =>
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:var(--bg-main);border-radius:6px;">' +
            '<input type="text" id="qt-name-' + i + '" class="input-box" value="' + esc(qt.name) + '" style="flex:2;margin:0;font-size:13px;">' +
            '<label style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px;white-space:nowrap;"><input type="checkbox" id="qt-exp-' + i + '" ' + (qt.expiryRequired?'checked':'') + '> Expiry Date</label>' +
            '<button onclick="window.delQualType(' + i + ')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;">&times;</button>' +
        '</div>'
    ).join('');

    const html = rows +
        '<div style="display:flex;gap:8px;margin-top:12px;">' +
            '<input type="text" id="qt-new-name" class="input-box" placeholder="New qualification name..." style="flex:2;margin:0;">' +
            '<label style="font-size:11px;color:var(--text-muted);display:flex;align-items:center;gap:4px;white-space:nowrap;"><input type="checkbox" id="qt-new-exp" checked> Expiry Date</label>' +
            '<button onclick="window.addQualType()" class="btn btn-blue" style="padding:6px 14px;">+ Add</button>' +
        '</div>' +
        '<button onclick="window.saveQualTypes()" class="btn btn-green" style="width:100%;margin-top:15px;">Save Qualification Types</button>';
    window.openModal('⚙️ Edit Qualification Types', html);
};

window.addQualType = () => {
    const name = document.getElementById('qt-new-name').value.trim();
    if (!name) return window.showToast('Name required.','error');
    const exp = document.getElementById('qt-new-exp').checked;
    const id = 'q_' + Date.now();
    window.qualificationTypes.push({ id: id, name: name, expiryRequired: exp });
    window.saveToDisk();
    window.editQualTypes(); // Refresh the modal
};

window.delQualType = (i) => {
    window.qualificationTypes.splice(i, 1);
    window.saveToDisk();
    window.editQualTypes();
};

window.saveQualTypes = () => {
    const quals = window.qualificationTypes || [];
    quals.forEach((qt, i) => {
        const nameEl = document.getElementById('qt-name-' + i);
        const expEl = document.getElementById('qt-exp-' + i);
        if (nameEl) qt.name = nameEl.value.trim() || qt.name;
        if (expEl) qt.expiryRequired = expEl.checked;
    });
    window.saveToDisk();
    window.closeModal();
    window.showView('orientation');
    window.showToast('Qualification types saved!');
};

window.renderOrientationView = function(showCompleted = false) {
    const filtered = (window.orientationLogs || []).map((o, i) => ({...o, originalIndex: i})).filter(o => (o.status === 'Completed') === showCompleted);
    return `<div style="max-width: 900px; margin: auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">🤝 Staff Onboarding</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Track new hire training progress, certifications, and acknowledgments</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button onclick="window.showView('orientation')" class="btn ${!showCompleted ? 'btn-dark' : 'btn-outline'}">Active Training</button>
                <button onclick="window.renderCompletedOrientations()" class="btn ${showCompleted ? 'btn-dark' : 'btn-outline'}">Fully Trained</button>
                <button onclick="window.editOnbTemplates()" class="btn btn-outline">⚙️ Templates</button>
                <button onclick="window.addOrientationForm()" class="btn btn-blue">+ New Hire</button>
            </div>
        </div>
        <div id="orientationContent">${filtered.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">🤝</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No staff in this view</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Add a new hire to start tracking their onboarding progress</div></div>' : filtered.map(o => {
        const template = window.onboardingTemplates[o.role] || window.onboardingTemplates['FOH (Front of House)'];
        let totalTasks = 0; let completedTasks = 0;
        let phasesHtml = Object.keys(template).map(phase => {
            let phaseTasksHtml = template[phase].map(t => {
                totalTasks++; if (o.tasks && o.tasks[t.id]) completedTasks++;
                let isDone = o.tasks && o.tasks[t.id];
                let actionHtml = (t.isUpload && !isDone && o.status !== 'Completed') ? `<input type="file" id="up-${o.originalIndex}-${t.id}" accept="application/pdf,image/*" style="display:none;" onchange="window.handleStaffUpload(${o.originalIndex}, '${t.id}', '${t.cat}', this)"><button onclick="document.getElementById('up-${o.originalIndex}-${t.id}').click()" class="btn btn-blue" style="font-size:10px; padding:3px 8px; margin-left:10px;">Upload File</button>` : '';
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);"><label style="font-size:13px; display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" style="transform: scale(1.2);" ${isDone ? 'checked' : ''} ${o.status === 'Completed' || t.isUpload ? 'disabled' : `onchange="window.toggleOrientationTask(${o.originalIndex}, '${t.id}', this.checked)"`}><span style="${isDone ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${esc(t.label)}</span></label>${actionHtml}</div>`;
            }).join('');
            return `<div style="margin-bottom:15px;"><h5 style="margin:0 0 5px 0; color:var(--brand-accent); border-bottom:1px solid var(--border); padding-bottom:5px;">${esc(phase)}</h5>${phaseTasksHtml}</div>`;
        }).join('');
        const pct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
        return `<div class="card" style="border-left:6px solid ${pct === 100 ? 'var(--green)' : 'var(--purple)'}; margin-bottom:15px;"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;"><div><h3 style="margin:0;">${esc(o.name)}</h3><span class="tag-pill" style="margin-top:5px;">${esc(o.role)}</span><small style="color:var(--text-muted); display:block; margin-top:5px;">Started: ${o.startDate}</small></div><div style="text-align:right;"><strong style="color:${pct === 100 ? 'var(--green)' : 'var(--purple)'}; font-size:24px;">${pct}%</strong>${o.status !== 'Completed' ? `<br><button onclick="window.deleteOrientation(${o.originalIndex})" style="color:var(--red); background:none; border:none; cursor:pointer; font-size:11px; margin-top:5px; padding:0; text-decoration:underline;">Remove Staff</button>` : ''}</div></div>${phasesHtml}<div style="margin-top:20px; background:var(--bg-main); padding:15px; border-radius:6px; border:1px solid var(--border);"><h5 style="margin:0 0 10px 0; color:var(--brand-dark);">Staff Acknowledgment</h5><p style="font-size:12px; margin:0 0 10px 0; color:var(--text-muted);">I confirm I have read the venue Handbooks, SOPs, and completed the training checklist above.</p>${o.signature ? `<div style="color:var(--green); font-family:monospace; font-size:14px; padding:10px; border:1px dashed var(--green); background:rgba(16, 185, 129, 0.1);">Signed: ${esc(o.signature)} <br><small>${esc(o.signDate)}</small></div>` : `<div style="display:flex; gap:10px;"><input type="text" id="sig-${o.originalIndex}" class="input-box" placeholder="Type name to sign..." style="margin:0; flex:1;"><button onclick="window.signOrientation(${o.originalIndex})" class="btn btn-dark">Sign</button></div>`}</div>${pct === 100 && o.signature && o.status !== 'Completed' ? `<button onclick="window.completeOrientation(${o.originalIndex})" class="btn btn-green" style="width:100%; margin-top:20px; font-size:16px;">Approve & Mark as Fully Trained</button>` : ''}</div>`; 
    }).join('')}</div></div>`;
}

window.renderCompletedOrientations = () => { document.getElementById('mainContent').innerHTML = window.renderOrientationView(true); };

window.editOnbTemplates = () => {
    let html = ``;
    Object.keys(window.onboardingTemplates).forEach(role => {
        html += `<div style="margin-bottom:20px;"><h3 style="color:var(--brand-dark); border-bottom:2px solid var(--border); padding-bottom:5px;">${esc(role)}</h3>`;
        Object.keys(window.onboardingTemplates[role]).forEach(phase => {
            html += `<h5 style="margin-top:15px; color:var(--brand-accent);">${esc(phase)}</h5>`;
            window.onboardingTemplates[role][phase].forEach((task, tIdx) => { html += `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--bg-main); font-size:13px;"><span>${esc(task.label)} ${task.isUpload ? '<span style="color:var(--blue); font-size:10px; border:1px solid var(--blue); padding:2px 4px; border-radius:4px; margin-left:5px;">Upload Required</span>' : ''}</span><button onclick="window.delOnbTask('${escAttr(role)}', '${escAttr(phase)}', ${tIdx})" style="color:var(--red); background:none; border:none; cursor:pointer; font-weight:bold;">&times;</button></div>`; });
            html += `<div style="display:flex; gap:10px; margin-top:10px;"><input type="text" id="nt-${role.replace(/\s/g,'')}-${phase.replace(/\s/g,'')}" class="input-box" placeholder="Add new task..." style="flex:1; margin:0;"><button onclick="window.addOnbTask('${escAttr(role)}', '${escAttr(phase)}')" class="btn btn-green">Add Task</button></div>`;
        });
        html += `</div>`;
    });
    window.openModal("⚙️ Edit Training Templates", html + `<button onclick="window.closeModal(); window.showView('orientation')" class="btn btn-blue" style="width:100%; margin-top:15px;">Done</button>`);
};
window.addOnbTask = (role, phase) => { const val = document.getElementById(`nt-${role.replace(/\s/g,'')}-${phase.replace(/\s/g,'')}`).value; if(val) { window.onboardingTemplates[role][phase].push({id: 't_' + Date.now(), label: val}); window.saveToDisk(); window.editOnbTemplates(); } };
window.delOnbTask = (role, phase, idx) => { window.confirmAction({ title:'Delete Training Task', message:'Remove this task from the template?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.onboardingTemplates[role][phase].splice(idx, 1); window.saveToDisk(); window.editOnbTemplates(); } }); };

window.addOrientationForm = () => { 
    let html = `<input type="text" id="o-name" class="input-box" placeholder="Staff Name" style="margin-bottom:15px;"><label style="font-size:11px; color:var(--text-muted);">Role / Department</label><select id="o-role" class="input-box" style="margin-bottom:15px;"><option>FOH (Front of House)</option><option>BOH (Back of House)</option></select><label style="font-size:11px; color:var(--text-muted);">Start Date</label><input type="date" id="o-date" value="${new Date().toISOString().split('T')[0]}" class="input-box" style="margin-bottom:20px;"><button onclick="window.submitOrientation()" class="btn btn-green" style="width:100%;">Create Training Profile</button>`;
    window.openModal("👋 Start New Hire Orientation", html); 
};
window.submitOrientation = () => { const name = document.getElementById('o-name').value; const role = document.getElementById('o-role').value; if(!name) return window.showToast("Staff Name is required.", "error"); window.orientationLogs.push({ name, role, startDate: document.getElementById('o-date').value, status: 'Active', tasks: {}, signature: null, signDate: null }); window.saveToDisk(); window.closeModal(); window.showView('orientation'); window.showToast("Profile Created!"); };
window.toggleOrientationTask = (index, taskId, isChecked) => { if(!window.orientationLogs[index].tasks) window.orientationLogs[index].tasks = {}; window.orientationLogs[index].tasks[taskId] = isChecked; window.saveToDisk(); window.showView('orientation'); };
window.handleStaffUpload = async (index, taskId, category, inputElem) => {
    if (!inputElem.files.length) return;
    const file = inputElem.files[0]; const btn = inputElem.nextElementSibling; const originalText = btn.innerText; btn.innerText = "Uploading... ⏳"; btn.disabled = true;
    try {
        const fileRef = storage.ref().child(`staff_onboarding/${Date.now()}_${file.name}`);
        await fileRef.put(file);
        const downloadURL = await fileRef.getDownloadURL();
        window.digitalSafe.push({ name: `${window.orientationLogs[index].name} - Document`, category: category, expiry: '', type: file.type.includes('pdf') ? 'pdf' : 'image', data: downloadURL });
        if(!window.orientationLogs[index].tasks) window.orientationLogs[index].tasks = {};
        window.orientationLogs[index].tasks[taskId] = true; window.saveToDisk(); window.showView('orientation'); window.showToast("Document Uploaded & Saved to Safe!");
    } catch (error) { window.showToast("Upload failed.", "error"); btn.innerText = originalText; btn.disabled = false; }
};
window.signOrientation = (index) => { const sigName = document.getElementById(`sig-${index}`).value; if(!sigName) return window.showToast("Please type your name.", "error"); window.orientationLogs[index].signature = sigName; window.orientationLogs[index].signDate = new Date().toLocaleString(); window.saveToDisk(); window.showView('orientation'); };
window.completeOrientation = (index) => { window.orientationLogs[index].status = 'Completed'; window.saveToDisk(); window.showView('orientation'); window.showToast("Staff Fully Trained!"); };
window.deleteOrientation = (index) => { window.confirmAction({ title:'Remove Training Record', message:'Remove this staff member\'s training record? This cannot be undone.', confirmLabel:'Remove', tier:'standard', onConfirm:() => { window.orientationLogs.splice(index, 1); window.saveToDisk(); window.showView('orientation'); } }); };

// --- 3. ROTATIONAL TASKS ---
window.renderTaskView = function() {
    return `<div style="max-width: 900px; margin: auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">🔄 Rotational Tasks</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Recurring tasks like deep cleans, filter changes, and stocktakes</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button onclick="window.renderTaskList()" class="btn btn-dark">Active Tasks</button>
                <button onclick="window.renderTaskHistory()" class="btn btn-outline">Audit History</button>
                <button onclick="window.addTaskForm()" class="btn btn-blue">+ Add Task</button>
            </div>
        </div>
        <div id="taskSubContent">${window.renderTaskListTemplate()}</div>
    </div>`;
};

window.renderTaskListTemplate = function() {
    const freqMap = { 'Weekly': 7, 'Fortnightly': 14, 'Monthly': 30, 'Quarterly': 90 };
    const tasks = window.rotationalTasks || [];
    if (tasks.length === 0) return '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">🔄</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No rotational tasks</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Add recurring tasks like deep cleans, filter changes, or stocktakes</div></div>';

    return '<div id="activeTasks">' + tasks.map((t, i) => {
        // Determine due status — supports both recurring freq and specific due date
        let isDue = true, daysLeftText = 'DUE NOW', nextDueStr = '';

        if (t.dueDateMode === 'specific' && t.specificDueDate) {
            const dueDate = new Date(t.specificDueDate);
            const today = new Date(); today.setHours(0,0,0,0);
            const daysUntil = Math.round((dueDate - today) / (1000*3600*24));
            isDue = daysUntil <= 0;
            daysLeftText = isDue ? (daysUntil < 0 ? Math.abs(daysUntil) + (Math.abs(daysUntil)===1?' day':' days') + ' overdue' : 'DUE TODAY') : 'Due in ' + daysUntil + (daysUntil===1?' day':' days');
            nextDueStr = 'Due: ' + dueDate.toLocaleDateString('en-AU', {day:'numeric',month:'short',year:'numeric'});
        } else if (t.lastLogIso) {
            const daysSince = (new Date() - new Date(t.lastLogIso)) / (1000*3600*24);
            const interval = freqMap[t.freq] || 7;
            isDue = daysSince >= interval;
            { const dl = Math.ceil(interval - daysSince); if (!isDue) daysLeftText = 'Due in ' + dl + (dl===1?' day':' days'); }
            nextDueStr = t.freq + ' | Last: ' + (t.lastDate || 'Never');
        } else if (t.anchorDate) {
            // Has anchor date but never done — check if anchor + interval has passed
            const anchorD = new Date(t.anchorDate);
            const today2 = new Date(); today2.setHours(0,0,0,0);
            const interval = freqMap[t.freq] || 7;
            if (anchorD > today2) {
                isDue = false;
                const daysUntilAnchor = Math.round((anchorD - today2) / (1000*3600*24));
                daysLeftText = 'Due in ' + daysUntilAnchor + (daysUntilAnchor===1?' day':' days');
            } else {
                const daysSinceAnchor = (today2 - anchorD) / 86400000;
                const intervalsPassed = Math.floor(daysSinceAnchor / interval);
                const nextDueDate = new Date(anchorD.getTime() + intervalsPassed * interval * 86400000);
                const daysUntilNext = Math.round((nextDueDate - today2) / 86400000);
                isDue = daysUntilNext <= 0;
                daysLeftText = isDue ? 'DUE NOW' : 'Due in ' + daysUntilNext + (daysUntilNext===1?' day':' days');
            }
            nextDueStr = t.freq + ' | First due: ' + anchorD.toLocaleDateString('en-AU', {day:'numeric',month:'short'});
        } else {
            nextDueStr = (t.dueDateMode === 'specific' ? 'Due: ' + (t.specificDueDate || 'Not set') : (t.freq || 'Weekly')) + ' | Never done';
        }

        const borderColor = isDue ? 'var(--red)' : (daysLeftText.match(/Due in [12] day/) ? 'var(--orange)' : 'var(--green)');
        return '<div class="card" style="border-left:3px solid ' + borderColor + ';padding:12px;margin-bottom:8px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">' +
                '<div style="flex:1;">' +
                    '<strong style="font-size:14px;">' + esc(t.name) + '</strong>' +
                    (t.notes ? '<br><small style="color:var(--text-muted);font-size:12px;">' + esc(t.notes) + '</small>' : '') +
                    '<br><small style="color:var(--text-muted);">' + nextDueStr + '</small>' +
                    '<br><strong style="font-size:12px;display:inline-block;margin-top:4px;color:' + (isDue?'var(--red)':'var(--green)') + ';">' + daysLeftText + '</strong>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
                    '<input type="text" id="staff-' + i + '" placeholder="Staff Initials" class="input-box" style="width:110px;margin:0;">' +
                    '<button onclick="window.logTaskCompletion(' + i + ')" class="btn btn-green">Log Done</button>' +
                    '<button onclick="window.editTaskForm(' + i + ')" class="btn btn-outline" style="font-size:12px;padding:6px 10px;">✏️ Edit</button>' +
                    '<button onclick="window.delTask(' + i + ')" style="color:var(--red);background:none;border:none;cursor:pointer;font-size:18px;">&times;</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('') + '</div>';
};

window.renderTaskList = () => { document.getElementById('taskSubContent').innerHTML = window.renderTaskListTemplate(); };
window.renderTaskHistory = () => {
    const rows = (window.taskHistory||[]).slice().reverse().map(h =>
        '<tr style="border-bottom:1px solid var(--bg-main);"><td style="padding:12px 15px;font-size:13px;color:var(--text-muted);">' + esc(h.date) + '</td><td style="padding:12px 15px;">' + esc(h.name) + '</td><td style="padding:12px 15px;"><strong>' + esc(h.staff) + '</strong></td></tr>'
    ).join('');
    document.getElementById('taskSubContent').innerHTML = '<table style="width:100%;background:var(--card-bg);border-radius:8px;border-collapse:collapse;">' +
        '<thead><tr style="text-align:left;background:#111;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
        '<th style="padding:12px 15px;">Date</th><th style="padding:12px 15px;">Task</th><th style="padding:12px 15px;">Staff</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="3" style="padding:15px;color:var(--text-muted);text-align:center;">No history yet.</td></tr>') + '</tbody></table>';
};

window.addTaskForm = (editIdx) => {
    const t = editIdx !== undefined ? window.rotationalTasks[editIdx] : { name:'', freq:'Weekly', dueDateMode:'recurring', specificDueDate:'', notes:'' };
    const isEdit = editIdx !== undefined;
    const today = new Date().toISOString().split('T')[0];
    const html = '<label style="font-size:11px;color:var(--text-muted);">Task Name</label>' +
        '<input type="text" id="t-n" class="input-box" value="' + esc(t.name||'') + '" placeholder="e.g. Grease Trap Clean">' +
        '<label style="font-size:11px;color:var(--text-muted);">Notes (optional)</label>' +
        '<input type="text" id="t-notes" class="input-box" value="' + esc(t.notes||'') + '" placeholder="e.g. Check gasket seal">' +
        '<label style="font-size:11px;color:var(--text-muted);">Schedule Type</label>' +
        '<select id="t-mode" class="input-box" onchange="document.getElementById(\'t-recurring\').style.display=this.value===\'recurring\'?\'block\':\'none\';document.getElementById(\'t-specific\').style.display=this.value===\'specific\'?\'block\':\'none\'">' +
            '<option value="recurring" ' + ((t.dueDateMode||'recurring')==='recurring'?'selected':'') + '>Recurring (Weekly/Monthly etc)</option>' +
            '<option value="specific" ' + (t.dueDateMode==='specific'?'selected':'') + '>Specific Due Date</option>' +
        '</select>' +
        '<div id="t-recurring" style="display:' + ((t.dueDateMode||'recurring')==='recurring'?'block':'none') + ';">' +
            '<label style="font-size:11px;color:var(--text-muted);">Frequency</label>' +
            '<select id="t-f" class="input-box">' +
                ['Weekly','Fortnightly','Monthly','Quarterly'].map(f => '<option ' + (t.freq===f?'selected':'') + '>' + f + '</option>').join('') +
            '</select>' +
            '<label style="font-size:11px;color:var(--text-muted);">First Due Date (when should this first be done?)</label>' +
            '<input type="date" id="t-anchor" class="input-box" value="' + (t.anchorDate || '') + '" placeholder="Leave blank for immediately">' +
            '<p style="font-size:11px;color:var(--text-muted);margin:0;">After completion, next due = completion date + frequency interval.</p>' +
        '</div>' +
        '<div id="t-specific" style="display:' + (t.dueDateMode==='specific'?'block':'none') + ';">' +
            '<label style="font-size:11px;color:var(--text-muted);">Due Date</label>' +
            '<input type="date" id="t-date" class="input-box" value="' + (t.specificDueDate||today) + '">' +
        '</div>' +
        '<button onclick="window.subTask(' + (isEdit?editIdx:'undefined') + ')" class="btn btn-green" style="width:100%;margin-top:5px;">' + (isEdit?'Save Changes':'Add Task') + '</button>';
    window.openModal(isEdit ? '✏️ Edit Task' : '🔄 New Task', html);
};

window.editTaskForm = (i) => { window.addTaskForm(i); };

window.subTask = (editIdx) => {
    const name = document.getElementById('t-n').value.trim();
    if (!name) return window.showToast('Task name required.', 'error');
    const mode = document.getElementById('t-mode').value;
    const freq = mode === 'recurring' ? document.getElementById('t-f').value : 'Once';
    const specificDueDate = mode === 'specific' ? document.getElementById('t-date').value : '';
    const notes = document.getElementById('t-notes').value.trim();
    const anchorDate = mode === 'recurring' && document.getElementById('t-anchor') ? document.getElementById('t-anchor').value : '';
    const obj = { name, freq, dueDateMode: mode, specificDueDate, notes, anchorDate, lastLogIso: null, lastDate: 'Never' };
    if (editIdx !== undefined && editIdx !== 'undefined') {
        // Preserve completion history when editing
        obj.lastLogIso = window.rotationalTasks[editIdx].lastLogIso;
        obj.lastDate = window.rotationalTasks[editIdx].lastDate;
        if (!obj.anchorDate) obj.anchorDate = window.rotationalTasks[editIdx].anchorDate;
        window.rotationalTasks[editIdx] = obj;
        window.showToast('Task updated!');
    } else {
        window.rotationalTasks.push(obj);
        window.showToast('Task created!');
    }
    window.saveToDisk(); window.closeModal(); window.showView('tasks');
};

window.logTaskCompletion = (i) => {
    const s = document.getElementById('staff-' + i).value;
    if (!s) return window.showToast('Enter staff initials.', 'error');
    const today = new Date().toISOString().split('T')[0];
    window._taskLogStaff = s;
    const html = '<p style="font-size:13px;color:var(--text-muted);margin-top:0;">Logging: <strong>' + esc(window.rotationalTasks[i].name) + '</strong></p>' +
        '<label style="font-size:11px;color:var(--text-muted);">Completion Date</label>' +
        '<div style="display:flex;gap:8px;margin-bottom:15px;">' +
            '<button onclick="window._confirmTaskLog(' + i + ',window._taskLogStaff,\'today\')" class="btn btn-green" style="flex:1;">✓ Today</button>' +
            '<button onclick="document.getElementById(\'t-custom-date\').style.display=\'block\'" class="btn btn-outline" style="flex:1;">📅 Pick Date</button>' +
        '</div>' +
        '<div id="t-custom-date" style="display:none;">' +
            '<input type="date" id="t-log-date" class="input-box" value="' + today + '">' +
            '<button onclick="window._confirmTaskLog(' + i + ',window._taskLogStaff,\'custom\')" class="btn btn-green" style="width:100%;">Confirm Date</button>' +
        '</div>';
    window.openModal('✓ Log Task Completion', html);
};

window._confirmTaskLog = (i, staff, mode) => {
    let logDate;
    if (mode === 'custom') {
        const d = document.getElementById('t-log-date').value;
        if (!d) return window.showToast('Select a date.', 'error');
        logDate = new Date(d);
    } else {
        logDate = new Date();
    }
    const dateStr = logDate.toLocaleDateString('en-AU');
    window.taskHistory.push({ name: window.rotationalTasks[i].name, staff, date: dateStr });
    window.rotationalTasks[i].lastLogIso = logDate.toISOString();
    window.rotationalTasks[i].lastDate = dateStr;
    // If specific due date mode — clear the due date after completion (task done)
    if (window.rotationalTasks[i].dueDateMode === 'specific') {
        window.rotationalTasks[i].specificDueDate = '';
    }
    window.saveToDisk(); window.closeModal(); window.showView('tasks'); window.showToast('Task logged!');
};

window.delTask = (i) => { window.confirmAction({ title:'🔄 Delete Task', message:'Delete this rotational task?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.rotationalTasks.splice(i,1); window.saveToDisk(); window.showView('tasks'); } }); };

// --- 4. COMPLIANCE ---

// =============================================================================
// SHIFT CHECKLISTS — Opening / Pre-Service / Closing
// =============================================================================
window.renderShiftChecklists = () => {
    const hour = new Date().getHours();
    const shiftType = hour < 14 ? 'opening' : hour < 20 ? 'preservice' : 'closing';
    const shiftLabel = { opening:'Opening', preservice:'Pre-Service', closing:'Closing' }[shiftType];
    const shiftColor = { opening:'var(--blue)', preservice:'var(--orange)', closing:'var(--purple)' }[shiftType];

    const defaultLists = {
        opening: [
            'Check & sign fridge/freezer temps',
            'Check all equipment is operational',
            'Check bar stock levels against PAR',
            'Float count and till setup',
            'Check reservations and covers for service',
            'Brief FOH team on specials and 86s',
            'Check cleanliness of all areas',
            'Check toilets and restock supplies'
        ],
        preservice: [
            'Final mise en place check',
            'Candles and music levels set',
            'POS system tested and ready',
            'Staff briefed on allergens for tonight',
            'Ice bins filled',
            'Fridges and speed rails stocked',
            'Garnishes prepped',
            'Communication with kitchen confirmed'
        ],
        closing: [
            'All food stored correctly — FIFO checked',
            'Fridge and freezer temps logged',
            'Bar cleaned down and restocked',
            'Till counted and reconciled with takings',
            'Wastage logged',
            'All equipment turned off / secured',
            'Doors and windows locked',
            'Handover notes completed'
        ]
    };

    const allLists = window.shiftChecklistItems || defaultLists;
    if (!window.shiftChecklistItems) window.shiftChecklistItems = defaultLists;

    const activeList = allLists[shiftType] || [];
    const stateKey = 'shiftCheck_' + new Date().toLocaleDateString() + '_' + shiftType;
    window._scStateKey = stateKey;
    window._scType = shiftType;
    window._scLabel = shiftLabel;
    const saved = JSON.parse(localStorage.getItem(stateKey) || '[]');

    const items = activeList.map((item, i) => {
        const checked = saved.includes(i);
        return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px dashed var(--border);">' +
            '<input type="checkbox" id="sc-' + i + '" ' + (checked?'checked':'') + ' onchange="window.saveShiftCheckItem(' + i + ',window._scStateKey)" style="transform:scale(1.3);flex-shrink:0;">' +
            '<label for="sc-' + i + '" style="cursor:pointer;font-size:13px;' + (checked?'text-decoration:line-through;color:var(--text-muted);':'') + '">' + esc(item) + '</label>' +
        '</div>';
    }).join('');

    const doneCount = saved.length;
    const pct = activeList.length > 0 ? Math.round(doneCount/activeList.length*100) : 0;

    return '<div class="card" style="border-top:5px solid ' + shiftColor + ';margin-top:30px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">' +
            '<h3 style="margin:0;color:' + shiftColor + ';">' + shiftLabel + ' Checklist</h3>' +
            '<div style="text-align:right;">' +
                '<div style="font-size:16px;font-weight:bold;color:' + (pct===100?'var(--green)':shiftColor) + ';">' + pct + '%</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' + doneCount + ' / ' + activeList.length + ' done</div>' +
            '</div>' +
        '</div>' +
        '<div style="background:var(--bg-main);border-radius:6px;height:6px;margin-bottom:15px;">' +
            '<div style="background:' + (pct===100?'var(--green)':shiftColor) + ';height:100%;border-radius:6px;width:' + pct + '%;transition:width 0.3s;"></div>' +
        '</div>' +
        items +
        '<div style="margin-top:15px;display:flex;gap:8px;">' +
            '<input type="text" id="sc-staff" class="input-box" placeholder="Staff initial to sign off..." style="margin:0;flex:1;">' +
            '<button onclick="window.signOffShiftCheck(window._scType,window._scLabel,window._scStateKey)" class="btn btn-dark" style="flex-shrink:0;">Sign Off</button>' +
        '</div>' +
        '<div style="margin-top:8px;display:flex;gap:8px;">' +
            '<button onclick="window.showView(\'compliance\')" class="btn btn-outline" style="font-size:11px;flex:1;">↻ Refresh</button>' +
            '<button onclick="window.editShiftChecklist(window._scType)" class="btn btn-outline" style="font-size:11px;flex:1;">⚙️ Edit List</button>' +
        '</div>' +
    '</div>';
};

window.saveShiftCheckItem = (i, key) => {
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = saved.indexOf(i);
    if (idx >= 0) saved.splice(idx,1); else saved.push(i);
    localStorage.setItem(key, JSON.stringify(saved));
};

window.signOffShiftCheck = (type, label, stateKey) => {
    const staff = document.getElementById('sc-staff') ? document.getElementById('sc-staff').value.trim() : '';
    if (!staff) return window.showToast('Enter staff initial to sign off.','error');
    const saved = JSON.parse(localStorage.getItem(stateKey) || '[]');
    const total = (window.shiftChecklistItems || {})[type] ? window.shiftChecklistItems[type].length : 0;
    window.complianceLogs.push({ type: label + ' Checklist', staff, time: new Date().toLocaleString(), pct: total > 0 ? Math.round(saved.length/total*100) : 0 });
    window.saveToDisk();
    window.showToast(label + ' checklist signed off!');
    window.showView('compliance');
};

window.editShiftChecklist = (type) => {
    if (!window.shiftChecklistItems) window.shiftChecklistItems = {};
    const items = window.shiftChecklistItems[type] || [];
    const label = { opening:'Opening', preservice:'Pre-Service', closing:'Closing' }[type];
    const rows = items.map((item, i) =>
        '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border);">' +
        '<span style="font-size:13px;flex:1;">' + esc(item) + '</span>' +
        '<button onclick="window.removeShiftItem(window._scType,' + i + ')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;">&times;</button>' +
        '</div>'
    ).join('');
    const html = '<div style="max-height:40vh;overflow-y:auto;margin-bottom:15px;">' + (rows||'<p style="color:var(--text-muted);font-size:13px;">No items yet.</p>') + '</div>' +
        '<div style="display:flex;gap:8px;">' +
        '<input type="text" id="sc-new-item" class="input-box" placeholder="New checklist item..." style="margin:0;flex:1;">' +
        '<button onclick="window.addShiftItem(window._scType)" class="btn btn-green">Add</button>' +
        '</div>';
    window.openModal('⚙️ Edit ' + label + ' Checklist', html);
};

window.addShiftItem = (type) => {
    const val = document.getElementById('sc-new-item').value.trim();
    if (!val) return;
    if (!window.shiftChecklistItems) window.shiftChecklistItems = {};
    if (!window.shiftChecklistItems[type]) window.shiftChecklistItems[type] = [];
    window.shiftChecklistItems[type].push(val);
    window.saveToDisk(); window.editShiftChecklist(type);
};

window.removeShiftItem = (type, i) => {
    window.shiftChecklistItems[type].splice(i,1);
    window.saveToDisk(); window.editShiftChecklist(type);
};

window._complianceTab = window._complianceTab || 'temps';
window.exportTempLogCSV = () => {
    const logs = window.tempLogs || [];
    if (!logs.length) return window.showToast('No temperature logs to export.', 'error');
    const headers = ['Date/Time','Unit','Temperature (°C)','Staff','Corrective Action','Status'];
    const rows = logs.map(t => [
        t.time||'', t.unit||'', t.value||'', t.staff||'', t.action||'',
        (Number(t.value) > 5 || Number(t.value) < -25) ? 'FAIL' : 'PASS'
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'temp-logs-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    window.showToast(logs.length + ' temp logs exported.');
};

window.renderComplianceView = function() {
    const E = window.esc;
    const tab = window._complianceTab || 'temps';
    const tabPills = ['temps','shift','custom','haccp'].map(t => {
        const labels = { temps:'🌡️ Temperatures', shift:'✅ Shift Checklist', custom:'📋 Custom Checklists', haccp:'📋 HACCP History' };
        return `<span class="tag-pill ${tab===t?'active':''}" onclick="window._complianceTab='${t}';window.showView('compliance');">${labels[t]}</span>`;
    }).join('');

    let content = '';

    if (tab === 'temps') {
        const recentTemps = (window.tempLogs || []).slice(-8).reverse();
        content = `<div class="card" style="border-top:5px solid var(--blue);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h3 style="margin:0;">Fridge/Freezer Temp Log</h3>
                <div style="display:flex;gap:6px;">
                    <button onclick="window.exportTempLogCSV()" class="btn btn-outline" style="padding:6px 12px;font-size:11px;">📥 Export CSV</button>
                    <button onclick="window.print()" class="btn btn-outline" style="padding:6px 12px;font-size:11px;">🖨️ Print</button>
                    <button onclick="window.editFridges()" class="btn btn-outline" style="padding:6px 12px;font-size:11px;">⚙️ Setup Units</button>
                </div>
            </div>
            ${(window.fridgeUnits||[]).length === 0 ? '<div style="text-align:center;padding:30px;color:var(--text-muted);"><div style="font-size:28px;margin-bottom:8px;">🌡️</div><div style="font-size:13px;">No fridge units configured. Click Setup Units to add your coolrooms and fridges.</div></div>' : `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:15px;">
                ${(window.fridgeUnits||[]).map((f,i) => `<div style="background:var(--bg-main);padding:10px;border-radius:6px;border:1px solid var(--border);">
                    <strong style="font-size:12px;display:block;margin-bottom:8px;color:var(--brand-dark);">${E(f)}</strong>
                    <input type="number" step="0.1" id="t-val-${i}" oninput="window.checkT(${i})" class="input-box" placeholder="Temp °C" style="margin:0;width:100%;">
                    <div id="t-warn-${i}" style="display:none;margin-top:10px;">
                        <small style="color:var(--red);font-weight:bold;display:block;margin-bottom:4px;">⚠️ High Temp Alert</small>
                        <input type="text" id="t-action-${i}" class="input-box" placeholder="Corrective Action" style="margin:0;border-color:var(--red);font-size:12px;padding:6px;">
                    </div>
                </div>`).join('')}
            </div>
            <div style="display:flex;gap:10px;border-top:1px solid var(--border);padding-top:20px;">
                <input type="text" id="t-staff" class="input-box" placeholder="Staff Name Signing Off" style="flex:1;margin:0;">
                <button onclick="window.logAllTemps()" class="btn btn-blue" style="width:200px;">Log All Temps</button>
            </div>`}
            ${recentTemps.length > 0 ? `<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:15px;">
                <h4 style="margin:0 0 10px 0;font-size:13px;color:var(--text-muted);text-transform:uppercase;">Recent Logs</h4>
                <table style="width:100%;font-size:13px;text-align:left;border-collapse:collapse;"><tbody>
                    ${recentTemps.map(t => `<tr style="border-bottom:1px dashed var(--border);"><td style="padding:5px 0;font-size:12px;">${E(t.unit)}</td><td style="color:${t.value>5?'var(--red)':'var(--green)'};font-weight:bold;">${t.value}°C</td><td style="color:var(--text-muted);">${E(t.staff)}</td><td>${t.action?`<span style="color:var(--red);font-size:11px;">Action: ${E(t.action)}</span><br>`:''}<span style="color:var(--text-muted);font-size:11px;">${t.time}</span></td></tr>`).join('')}
                </tbody></table>
                <button onclick="window.showTempHistory()" class="btn btn-outline" style="width:100%;margin-top:12px;font-size:12px;">📋 View Full History</button>
            </div>` : ''}
        </div>`;
    }

    if (tab === 'shift') {
        content = window.renderShiftChecklists();
    }

    if (tab === 'haccp') {
        content = window.renderHACCPHistory ? window.renderHACCPHistory() : '<p style="color:var(--text-muted);">HACCP History not available.</p>';
    }

    if (tab === 'custom') {
        const checklists = window.masterChecklists || {};
        const keys = Object.keys(checklists);
        content = `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:15px;">
            <button onclick="window.renderChecklistHistory()" class="btn btn-outline" style="font-size:12px;">📋 History</button>
            <button onclick="window.editChecklists()" class="btn btn-outline" style="font-size:12px;">⚙️ Edit Lists</button>
        </div>` + (keys.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px;">📋</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main);">No custom checklists yet</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5;">Create audit checklists for weekly deep cleans, monthly inspections, or any recurring checks your venue needs.</div></div>' :
        `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:20px;">
            ${keys.map(l => `<div class="card" style="padding:14px;"><h4 style="margin:0 0 15px 0;color:var(--brand-accent);">${E(l)}</h4>${(checklists[l]||[]).map(item => `<div style="font-size:13px;margin:8px 0;"><label style="cursor:pointer;display:flex;gap:10px;align-items:center;"><input type="checkbox" style="transform:scale(1.2);"> <span>${E(item)}</span></label></div>`).join('')}<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:15px;display:flex;gap:10px;"><input type="text" id="s-${l.replace(/\s/g,'')}" class="input-box" placeholder="Staff Initial" style="margin:0;"><button onclick="window.signCheck('${l}')" class="btn btn-dark">Sign Off</button></div></div>`).join('')}
        </div>`);
    }

    return `<div style="max-width:900px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
            <div>
                <h2 style="margin:0;">Compliance</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Temperature logs, shift checklists, and custom audits</div>
            </div>
        </div>
        <div style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:6px;">${tabPills}</div>
        ${content}
    </div>`;
}

window.checkT = (i) => { document.getElementById(`t-warn-${i}`).style.display = parseFloat(document.getElementById(`t-val-${i}`).value) > 5 ? 'block' : 'none'; };
window.logAllTemps = () => { 
    const staff = document.getElementById('t-staff').value;
    if(!staff) return window.showToast("Please enter your name.", "error"); 
    let logsToAdd = []; const timeNow = new Date().toLocaleString();
    for(let i = 0; i < (window.fridgeUnits || []).length; i++) {
        const valStr = document.getElementById(`t-val-${i}`).value;
        if(!valStr) continue; 
        const val = parseFloat(valStr); let action = "";
        if(val > 5) { action = document.getElementById(`t-action-${i}`).value; if(!action) return window.showToast(`High temp requires Action!`, "error"); }
        logsToAdd.push({ unit: window.fridgeUnits[i], value: val, staff: staff, action: action, time: timeNow });
    }
    if(logsToAdd.length === 0) return window.showToast("Enter at least one temp.", "error");
    window.tempLogs.push(...logsToAdd); window.saveToDisk(); window.showToast("Temps Logged!"); window.showView('compliance'); 
};
window.signCheck = (l) => {
    const staffEl = document.getElementById('s-' + l.replace(/\s/g,''));
    if (!staffEl || !staffEl.value) return window.showToast('Please sign name', 'error');
    window.complianceLogs.push({ type: l, staff: staffEl.value, time: new Date().toLocaleString() });
    window.saveToDisk(); window.showToast(l + ' Signed Off'); window.showView('compliance');
};

window.renderChecklistHistory = () => {
    const logs = (window.complianceLogs || []).slice().reverse();
    const types = [...new Set((window.complianceLogs||[]).map(l=>l.type))].sort();
    const filterType = window._checkHistFilter || '';
    const filtered = filterType ? logs.filter(l=>l.type===filterType) : logs;
    const typeOpts = '<option value="">All Checklists</option>' + types.map(t=>'<option value="'+esc(t)+'" '+(filterType===t?'selected':'')+'>'+esc(t)+'</option>').join('');
    const rows = filtered.map(l =>
        '<tr style="border-bottom:1px solid var(--border);">'+
        '<td style="padding:6px 8px;font-size:11px;color:var(--text-muted);">'+l.time+'</td>'+
        '<td style="padding:6px 8px;font-weight:bold;font-size:13px;">'+esc(l.type)+'</td>'+
        '<td style="padding:6px 8px;font-size:13px;">'+esc(l.staff)+'</td>'+
        '</tr>'
    ).join('');
    const html = '<div style="margin-bottom:15px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
        '<select class="input-box" style="margin:0;flex:1;" onchange="window._checkHistFilter=this.value;window.renderChecklistHistory()">'+typeOpts+'</select>' +
        '<button onclick="window.exportChecklistHistory()" class="btn btn-outline" style="font-size:12px;">📊 Export CSV</button>' +
        '<span style="font-size:12px;color:var(--text-muted);">'+filtered.length+' sign-offs</span>' +
        '</div>' +
        '<div style="max-height:55vh;overflow-y:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;position:sticky;top:0;">' +
        '<th style="padding:10px;text-align:left;">Time</th><th style="padding:10px;text-align:left;">Checklist</th><th style="padding:10px;text-align:left;">Staff</th>' +
        '</tr></thead><tbody>'+(rows||'<tr><td colspan="3" style="padding:20px;text-align:center;color:var(--text-muted);">No sign-offs yet.</td></tr>')+'</tbody></table></div>';
    window.openModal('📋 Checklist Sign-Off History ('+logs.length+' total)', html);
};

window.exportChecklistHistory = () => {
    const logs = (window.complianceLogs||[]).slice().reverse();
    const rows = logs.map(l => ['"'+l.time+'"','"'+l.type+'"','"'+l.staff+'"'].join(','));
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('Time,Checklist,Staff\n' + rows.join('\n'));
    a.download = 'ChecklistHistory_BWI_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    window.showToast('Checklist history exported!');
};

window.editFridges = () => { 
    let html = `<div style="margin-bottom:20px;">${(window.fridgeUnits || []).map((f, i) => `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border); align-items:center;"><span style="font-size:14px;">${esc(f)}</span> <button onclick="window.delFridge(${i})" style="color:var(--red); background:none; border:none; cursor:pointer; font-size:18px;">&times;</button></div>`).join('')}</div><div style="display:flex; gap:10px;"><input type="text" id="new-fridge" class="input-box" placeholder="New Unit Name" style="margin:0;"><button onclick="window.addFridge()" class="btn btn-green">Add Unit</button></div>`;
    window.openModal("⚙️ Setup Fridges/Freezers", html);
};
window.addFridge = () => { const v = document.getElementById('new-fridge').value; if(v) { window.fridgeUnits.push(v); window.saveToDisk(); window.editFridges(); } };
window.delFridge = (i) => { window.fridgeUnits.splice(i,1); window.saveToDisk(); window.editFridges(); };

window.editChecklists = () => {
    let html = `<div style="display:flex; gap:10px; margin-bottom:20px;"><input type="text" id="new-cat" class="input-box" placeholder="New Category (e.g. Weekly Deep Clean)" style="margin:0;"><button onclick="window.addChecklistCat()" class="btn btn-blue">Add Category</button></div><div style="max-height:60vh; overflow-y:auto; padding-right:10px;">`;
    Object.keys(window.masterChecklists || {}).forEach(cat => { html += `<div style="background:var(--bg-main); padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid var(--border);"><div style="display:flex; justify-content:space-between; margin-bottom:10px;"><h4 style="margin:0; color:var(--brand-accent);">${esc(cat)}</h4><button onclick="window.delChecklistCat('${escAttr(cat)}')" style="color:var(--red); background:none; border:none; cursor:pointer; font-size:11px; text-decoration:underline;">Delete Category</button></div>${(window.masterChecklists[cat] || []).map((item, idx) => `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border);"><span style="font-size:13px;">${esc(item)}</span><button onclick="window.delChecklistItem('${escAttr(cat)}', ${idx})" style="color:var(--red); background:none; border:none; cursor:pointer;">&times;</button></div>`).join('')}<div style="display:flex; gap:10px; margin-top:15px;"><input type="text" id="add-item-${cat.replace(/\s/g,'')}" class="input-box" placeholder="New task..." style="margin:0; font-size:12px; padding:6px;"><button onclick="window.addChecklistItem('${escAttr(cat)}')" class="btn btn-green" style="padding:6px 12px; font-size:11px;">Add Task</button></div></div>`; });
    html += `</div>`;
    window.openModal("⚙️ Edit Checklists", html);
};
window.addChecklistCat = () => { const v = document.getElementById('new-cat').value; if(v && !window.masterChecklists[v]) { window.masterChecklists[v] = []; window.saveToDisk(); window.editChecklists(); } };
window.delChecklistCat = (cat) => { window.confirmAction({ title:'Delete Checklist Category', message:'Delete the entire <strong>' + window.esc(cat) + '</strong> category? All items in it will be lost.', confirmLabel:'Delete Category', tier:'dangerous', onConfirm:() => { delete window.masterChecklists[cat]; window.saveToDisk(); window.editChecklists(); window.showView('compliance'); } }); };
window.addChecklistItem = (cat) => { const v = document.getElementById(`add-item-${cat.replace(/\s/g,'')}`).value; if(v) { window.masterChecklists[cat].push(v); window.saveToDisk(); window.editChecklists(); window.showView('compliance'); } };
window.delChecklistItem = (cat, idx) => { window.masterChecklists[cat].splice(idx, 1); window.saveToDisk(); window.editChecklists(); window.showView('compliance'); };

// --- 5. MAINTENANCE & ASSETS ---
window._maintTab = window._maintTab || 'fixit';
window.renderMaintenanceView = function(activeTab) {
    if (activeTab) window._maintTab = activeTab;
    const tab = window._maintTab || 'fixit';
    const E = window.esc;
    let content = '', actionBtn = '';

    if (tab === 'fixit') { content = window.renderFixItBoard(); actionBtn = `<button onclick="window.openFixItForm()" class="btn btn-orange">🔧 Report Issue</button>`; }
    else if (tab === 'assets') { content = window.renderAssetRegister(); actionBtn = `<button onclick="window.editEq()" class="btn btn-blue">+ Add Asset</button>`; }
    else if (tab === 'contractors') { content = window.renderContractorBoard(); actionBtn = `<button onclick="window.showContractorForm()" class="btn btn-green">+ Sign In Contractor</button>`; }
    else if (tab === 'calendar') { content = window.renderServiceCalendar(); }

    const tabs = ['fixit','assets','contractors','calendar'].map(t => {
        const labels = { fixit:'🛠️ Tickets', assets:'⚙️ Assets', contractors:'📋 Contractors', calendar:'📅 Service' };
        return `<span class="tag-pill ${tab===t?'active':''}" onclick="window._maintTab='${t}';document.getElementById('mainContent').innerHTML=window.renderMaintenanceView();">${labels[t]}</span>`;
    }).join('');

    return `<div style="max-width:900px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
            <div>
                <h2 style="margin:0;">Maintenance & Assets</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Fix-it tickets, equipment register, and contractor log</div>
            </div>
            <div style="display:flex;gap:8px;">${actionBtn}</div>
        </div>
        <div style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:6px;">${tabs}</div>
        <div id="maint-content">${content}</div>
    </div>`;
}

window.openFixItForm = () => {
    const E = window.esc;
    const tradies = (window.phoneBook || []).filter(c => c.category === 'Tradie' || c.category === 'Tradie / Maintenance');
    const tradieOptions = `<option value="">Leave Unassigned (Internal Fix)</option>` + tradies.map(t => `<option value="${E(t.name)}">${E(t.name)} - ${E(t.phone)}</option>`).join('');
    const html = `
        <input type="text" id="def-item" class="input-box" placeholder="Item (e.g. Table 12 / Coolroom Fan)">
        <textarea id="def-desc" class="input-box" placeholder="What is exactly wrong with it?" style="height:80px;"></textarea>
        <select id="def-tradie" class="input-box">${tradieOptions}</select>
        <label style="display:flex;align-items:center;color:var(--red);font-weight:bold;background:rgba(239,68,68,0.1);padding:10px 15px;border-radius:6px;border:1px solid rgba(239,68,68,0.2);cursor:pointer;margin-bottom:20px;">
            <input type="checkbox" id="def-urgent" style="margin-right:8px;transform:scale(1.2);"> URGENT
        </label>
        <button onclick="window.submitDefect()" class="btn btn-orange" style="width:100%;font-size:14px;">Submit Ticket</button>`;
    window.openModal('🔧 Report Maintenance Issue', html);
};

window.renderFixItBoard = () => {
    const E = window.esc;
    const openTickets = (window.defectLogs || []).filter(d => d.status === 'Open');
    const closedTickets = (window.defectLogs || []).filter(d => d.status === 'Resolved');

    if (openTickets.length === 0 && closedTickets.length === 0) {
        return `<div style="text-align:center;padding:48px 20px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px;">🛠️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main);">No open tickets</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5;">Report your first maintenance issue with the button above. Tickets stay here until resolved.</div></div>`;
    }

    return `<h3 style="margin-bottom:15px;border-bottom:1px solid var(--border);padding-bottom:5px;">Open Tickets (${openTickets.length})</h3>
    ${openTickets.length === 0 ? '<div class="card"><p style="color:var(--green);font-weight:bold;margin:0;">No open issues! Venue is looking good.</p></div>' : openTickets.map((d) => `
        <div class="card" style="border-left:4px solid ${d.urgent?'var(--red)':'var(--orange)'};padding:14px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px;"><strong style="font-size:14px;">${E(d.item)} ${d.urgent?'<span style="color:var(--red);font-size:12px;margin-left:10px;border:1px solid var(--red);padding:2px 6px;border-radius:4px;">URGENT</span>':''}</strong><small style="color:var(--text-muted);">Reported: ${d.date}</small></div>
            <p style="margin:6px 0;color:var(--text-main);font-size:13px;background:var(--bg-main);padding:8px;border-radius:5px;">${E(d.desc)}</p>
            ${d.tradie?`<div style="font-size:13px;margin-bottom:15px;color:var(--blue);font-weight:bold;">🛠️ Assigned to: ${E(d.tradie)}</div>`:'<div style="margin-bottom:15px;"></div>'}
            <div style="display:flex;justify-content:flex-end;align-items:center;border-top:1px dashed var(--border);padding-top:10px;flex-wrap:wrap;gap:8px;"><input type="number" step="0.01" id="def-cost-${d.originalIndex}" class="input-box" placeholder="Repair Cost ($)" style="width:140px;display:inline;margin:0;"><button onclick="window.resolveDefect(${d.originalIndex})" class="btn btn-green">Mark Resolved</button></div>
        </div>`).join('')}

    ${closedTickets.length > 0 ? `<h3 style="margin-top:20px;margin-bottom:10px;color:var(--text-muted);font-size:12px;text-transform:uppercase;">Recently Resolved</h3>
    ${closedTickets.slice(-5).reverse().map(d => `<div style="background:var(--bg-main);padding:10px;border-radius:6px;margin-bottom:6px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><div><strong style="color:var(--green);">✓ ${E(d.item)}</strong> - <span style="font-size:13px;color:var(--text-muted);">${E(d.desc)}</span></div>${d.cost>0?`<strong style="color:var(--red);font-size:14px;">$${d.cost.toFixed(2)}</strong>`:''}</div>`).join('')}` : ''}`;
};
window.submitDefect = () => { const item = document.getElementById('def-item').value; const desc = document.getElementById('def-desc').value; if(!item || !desc) return window.showToast("Item and Description required.", "error"); window.defectLogs.push({ originalIndex: window.defectLogs.length, item, desc, tradie: document.getElementById('def-tradie').value, urgent: document.getElementById('def-urgent').checked, status: 'Open', date: new Date().toLocaleDateString() }); window.saveToDisk(); window.closeModal(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('fixit'); window.showToast("Ticket Submitted!"); };
window.resolveDefect = (index) => { const costInput = document.getElementById(`def-cost-${index}`).value; window.defectLogs[index].status = 'Resolved'; window.defectLogs[index].cost = costInput ? parseFloat(costInput) : 0; window.defectLogs[index].resolvedDate = new Date().toLocaleDateString(); window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('fixit'); window.showToast("Ticket Resolved!"); };

window.renderAssetRegister = () => { return (window.equipmentData || []).length === 0 ? '<p style="color:var(--text-muted);">No assets tracked yet.</p>' : window.equipmentData.map((e, idx) => `<div class="card" style="border-left:3px solid var(--blue); padding:12px; margin-bottom:8px;"><div style="display:flex; justify-content:space-between; align-items:center;flex-wrap:wrap;gap:8px;"><div><strong style="font-size:14px;">${esc(e.name)}</strong> <span style="color:var(--text-muted); font-size:13px; margin-left:10px;">[Code: ${esc(e.code)}]</span><br><small style="color:var(--brand-accent); display:block; margin-top:5px;">Service Interval: ${e.interval} months | Last Service: <strong style="color:white;">${e.lastService}</strong></small></div><div style="display:flex; gap:10px;"><button onclick="window.editEq(${idx})" class="btn btn-outline">Edit</button><button onclick="window.logEq(${idx})" class="btn btn-green">Log Service Today</button><button onclick="window.delEq(${idx})" style="background:none; color:var(--red); border:none; cursor:pointer; font-size:18px;">&times;</button></div></div></div>`).join(''); };

window.editEq = (i = null) => { 
    let e = i !== null ? window.equipmentData[i] : {name: '', code: '', interval: 6, lastService: new Date().toISOString().split('T')[0]}; 
    let html = `
        <label style="font-size:11px; color:var(--text-muted);">Equipment Name</label><input type="text" id="eq-n" class="input-box" value="${esc(e.name)}">
        <label style="font-size:11px; color:var(--text-muted);">Asset/Serial Code</label><input type="text" id="eq-c" class="input-box" value="${esc(e.code)}">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:20px;">
            <div><label style="font-size:11px; color:var(--text-muted);">Interval (Months)</label><input type="number" id="eq-i" class="input-box" value="${e.interval}"></div>
            <div><label style="font-size:11px; color:var(--text-muted);">Last Service Date</label><input type="date" id="eq-d" class="input-box" value="${e.lastService}"></div>
        </div>
        <button onclick="window.subEq(${i})" class="btn btn-blue" style="width:100%;">Save Asset</button>
    `;
    window.openModal(i !== null ? "⚙️ Edit Asset" : "⚙️ New Asset", html);
};
window.subEq = (i) => { let obj = { name: document.getElementById('eq-n').value, code: document.getElementById('eq-c').value, interval: document.getElementById('eq-i').value || 6, lastService: document.getElementById('eq-d').value || new Date().toISOString().split('T')[0] }; if (i !== null) window.equipmentData[i] = obj; else window.equipmentData.push(obj); window.saveToDisk(); window.closeModal(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('assets'); window.showToast("Asset Saved!"); };
window.logEq = (i) => { window.equipmentData[i].lastService = new Date().toISOString().split('T')[0]; window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('assets'); window.showToast("Service Logged!"); };
window.delEq = (i) => { window.confirmAction({ title:'🛠️ Remove Asset', message:'Remove this asset from tracking?', confirmLabel:'Remove', tier:'standard', onConfirm:() => { window.equipmentData.splice(i,1); window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('assets'); } }); };

window.renderContractorBoard = () => {
    const active = (window.contractorLogs || []).map((c, i) => ({...c, originalIndex: i})).filter(c => !c.timeOut);
    const history = (window.contractorLogs || []).map((c, i) => ({...c, originalIndex: i})).filter(c => c.timeOut).slice(-10).reverse();
    return `<h3 style="margin-bottom:15px; color:var(--brand-dark); border-bottom:1px solid var(--border); padding-bottom:5px;">🟢 Currently On-Site</h3>${active.length === 0 ? '<div class="card"><p style="color:var(--green); margin:0; font-weight:bold;">No contractors currently signed in.</p></div>' : active.map(c => `<div class="card" style="border-left:3px solid var(--green); padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;flex-wrap:wrap;gap:8px;"><div><strong style="font-size:14px;">${esc(c.name)}</strong> <span style="color:var(--text-muted);">(${esc(c.company)})</span><br><small style="color:var(--brand-accent); display:block; margin-top:5px;">Reason: ${esc(c.reason)} | <strong>In:</strong> ${c.timeIn}</small></div><button onclick="window.signOutContractor(${c.originalIndex})" class="btn btn-red" style="font-size:12px;">Sign Out</button></div>`).join('')}<h3 style="margin-top:20px; margin-bottom:10px; color:var(--brand-dark); border-bottom:1px solid var(--border); padding-bottom:5px;">📋 Recent Visits</h3><table style="width:100%; background:var(--card-bg); border-radius:8px; overflow:hidden; border-collapse:collapse;"><thead><tr style="text-align:left; background:#111; border-bottom:1px solid var(--border);"><th style="padding:8px 12px;">Date</th><th style="padding:8px 12px;">Contractor</th><th style="padding:8px 12px;">Reason</th><th style="padding:8px 12px;">Time</th></tr></thead><tbody>${history.length === 0 ? '<tr><td colspan="4" style="padding:15px; color:var(--text-muted); text-align:center;">No recent logs.</td></tr>' : history.map(c => `<tr style="border-bottom:1px solid var(--bg-main);"><td style="padding:7px 10px; font-size:12px; color:var(--text-muted);">${c.date}</td><td style="padding:7px 12px;"><strong style="font-size:13px;">${esc(c.name)}</strong><br><small style="color:var(--text-muted);">${esc(c.company)}</small></td><td style="padding:7px 10px; font-size:12px; color:var(--brand-accent);">${esc(c.reason)}</td><td style="padding:7px 10px; font-size:12px;">In: <strong>${c.timeIn}</strong><br>Out: <strong>${c.timeOut}</strong></td></tr>`).join('')}</tbody></table>`;
}
window.showContractorForm = () => { 
    let html = `<input type="text" id="con-name" class="input-box" placeholder="Contractor Name (e.g., John Smith)" required><input type="text" id="con-company" class="input-box" placeholder="Company (e.g., Bob's Plumbing)" required><input type="text" id="con-reason" class="input-box" placeholder="Reason for visit (e.g., Fix grease trap)" style="margin-bottom:20px;" required><button onclick="window.submitContractor()" class="btn btn-green" style="width:100%;">Sign In</button>`;
    window.openModal("📋 Contractor Sign-In", html); 
}
window.submitContractor = () => { const name = document.getElementById('con-name').value; const company = document.getElementById('con-company').value; const reason = document.getElementById('con-reason').value; if(!name || !company) return window.showToast("Required details missing.", "error"); const now = new Date(); window.contractorLogs.push({ date: now.toLocaleDateString(), timeIn: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), timeOut: null, name, company, reason }); window.saveToDisk(); window.closeModal(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('contractors'); window.showToast("Contractor Signed In!"); }
window.signOutContractor = (index) => { window.contractorLogs[index].timeOut = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('contractors'); window.showToast("Contractor Signed Out!"); }


// --- 6. DIGITAL SAFE — Full Venue Document Hub ---
window._safeActiveTab = window._safeActiveTab || 'all';
window._safeViewMode = window._safeViewMode || (localStorage.getItem('safeViewMode') || 'grid');
window._safeSortCol = window._safeSortCol || 'expiry';
window._safeSortAsc = window._safeSortAsc !== undefined ? window._safeSortAsc : true;

window._safeGetStatus = function(d) {
    if (!d.expiry) return { label: 'No Expiry', color: 'var(--text-muted)' };
    const daysLeft = (new Date(d.expiry) - new Date()) / 86400000;
    if (daysLeft < 0) return { label: 'EXPIRED', color: 'var(--red)' };
    if (daysLeft <= 30) return { label: 'Expiring', color: 'var(--orange)' };
    if (daysLeft <= 90) return { label: 'Renew Soon', color: '#eab308' };
    return { label: 'OK', color: 'var(--green)' };
};

window._safeSortDocs = function(arr) {
    return arr.slice().sort((a, b) => {
        const now = new Date();
        const da = a.expiry ? new Date(a.expiry) : null;
        const db2 = b.expiry ? new Date(b.expiry) : null;
        const aExpired = da && da < now;
        const bExpired = db2 && db2 < now;
        if (aExpired && !bExpired) return -1;
        if (!aExpired && bExpired) return 1;
        if (da && db2) return da - db2;
        if (da && !db2) return -1;
        if (!da && db2) return 1;
        return (a.name||'').localeCompare(b.name||'');
    });
};

window.renderSafeView = function() {
    const E = window.esc;
    const cats = window.safeCategories || [];
    const docs = window.digitalSafe || [];
    const activeTab = window._safeActiveTab || 'all';
    const viewMode = window._safeViewMode || 'grid';
    const searchQ = (window._safeSearchQuery || '').toLowerCase();

    // Filter by tab + search
    let indexed = docs.map((d,i) => ({...d, originalIndex:i}));
    if (activeTab !== 'all') indexed = indexed.filter(d => (d.category || 'General / Other') === activeTab);
    if (searchQ.length >= 2) indexed = indexed.filter(d => (d.name||'').toLowerCase().includes(searchQ) || (d.notes||'').toLowerCase().includes(searchQ) || (d.category||'').toLowerCase().includes(searchQ));
    const filteredDocs = window._safeSortDocs(indexed);

    // Tab pills — only show categories that have docs (plus All)
    const tabPills = [`<span class="tag-pill ${activeTab === 'all' ? 'active' : ''}" onclick="window._safeActiveTab='all';window.showView('safe');">All (${docs.length})</span>`]
        .concat(cats.map(c => {
            const count = docs.filter(d => (d.category || 'General / Other') === c).length;
            if (count === 0 && activeTab !== c) return '';
            return `<span class="tag-pill ${activeTab === c ? 'active' : ''}" onclick="window._safeActiveTab='${E(c).replace(/'/g,"\\'")}';window.showView('safe');">${E(c)} (${count})</span>`;
        })).filter(Boolean).join('');

    // Expiry alerts
    const expiringSoon = docs.filter(d => d.expiry && ((new Date(d.expiry) - new Date()) / 86400000) <= 30 && new Date(d.expiry) > new Date());
    const expired = docs.filter(d => d.expiry && new Date(d.expiry) < new Date());
    let alertHtml = '';
    if (expired.length > 0) alertHtml += `<div class="card" style="border-left:4px solid var(--red);padding:10px 15px;margin-bottom:10px;font-size:13px;"><strong style="color:var(--red);">⚠️ ${expired.length} document${expired.length>1?'s':''} expired</strong> — <a href="#" onclick="window._safeActiveTab='all';window._safeSearchQuery='';window.showView('safe');return false;" style="color:var(--red);">View all</a></div>`;
    if (expiringSoon.length > 0) alertHtml += `<div class="card" style="border-left:4px solid var(--orange);padding:10px 15px;margin-bottom:10px;font-size:13px;"><strong style="color:var(--orange);">📅 ${expiringSoon.length} document${expiringSoon.length>1?'s':''} expiring within 30 days</strong></div>`;

    // Empty state
    const emptyHtml = docs.length === 0
        ? `<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px;">🔒</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main);">Your safe is empty</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5;">Upload venue documents — licenses, insurance, RSAs, food safety certs, leases, and more. Everything your venue needs, in one secure place.</div></div>`
        : (filteredDocs.length === 0 ? '<div class="card"><p style="color:var(--text-muted);margin:0;">No documents match your search.</p></div>' : '');

    // Grid view
    let docsHtml = '';
    if (filteredDocs.length > 0 && viewMode === 'grid') {
        docsHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">${filteredDocs.map(d => {
            const st = window._safeGetStatus(d);
            const borderColor = st.color;
            return `<div class="card" style="border-top:5px solid ${borderColor};margin-bottom:0;padding:20px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <div style="flex:1;padding-right:10px;">
                        <h4 style="margin:0 0 4px 0;font-size:15px;">${E(d.name)}</h4>
                        <span style="font-size:11px;color:var(--text-muted);background:var(--bg-main);padding:2px 8px;border-radius:8px;border:1px solid var(--border);">${E(d.category || 'General')}</span>
                    </div>
                    <div style="display:flex;gap:4px;flex-shrink:0;">
                        <button onclick="window.editDocForm(${d.originalIndex})" class="btn-touch" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;" title="Edit">✏️</button>
                        <button onclick="window.delDoc(${d.originalIndex})" class="btn-touch" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;" title="Delete">&times;</button>
                    </div>
                </div>
                ${d.notes ? `<p style="margin:4px 0 8px 0;font-size:12px;color:var(--text-muted);line-height:1.4;">${E(d.notes)}</p>` : ''}
                <p style="margin:4px 0 12px 0;font-size:12px;color:${st.color};">
                    ${d.expiry ? (st.label === 'EXPIRED' ? '⚠️ Expired: ' : st.label === 'Expiring' ? '📅 Expires: ' : 'Expires: ') + d.expiry : 'No expiry set'}
                    <span style="background:${st.color};color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:6px;">${st.label}</span>
                </p>
                ${d.data ? `<a href="${window.safeUrl(d.data)}" target="_blank" class="btn btn-outline" style="display:block;text-align:center;text-decoration:none;font-size:12px;">📄 View / Download</a>` : d.link ? `<a href="${window.safeUrl(d.link)}" target="_blank" class="btn btn-outline" style="display:block;text-align:center;text-decoration:none;font-size:12px;">🔗 Open Link</a>` : ''}
            </div>`;
        }).join('')}</div>`;
    }

    // Table view
    if (filteredDocs.length > 0 && viewMode === 'table') {
        docsHtml = `<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;"><table style="width:100%;background:var(--card-bg);border-radius:8px;border-collapse:collapse;">
            <thead><tr style="text-align:left;background:#111;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-muted);text-transform:uppercase;">
                <th style="padding:10px 12px;cursor:pointer;" onclick="window._safeSortBy('name')">Name</th>
                <th style="padding:10px 12px;cursor:pointer;" onclick="window._safeSortBy('category')">Category</th>
                <th style="padding:10px 12px;cursor:pointer;" onclick="window._safeSortBy('expiry')">Expiry</th>
                <th style="padding:10px 12px;">Status</th>
                <th style="padding:10px 12px;text-align:right;">Actions</th>
            </tr></thead><tbody>${filteredDocs.map(d => {
                const st = window._safeGetStatus(d);
                return `<tr style="border-bottom:1px solid var(--bg-main);">
                    <td style="padding:10px 12px;"><strong style="font-size:13px;">${E(d.name)}</strong>${d.notes ? '<br><span style="font-size:11px;color:var(--text-muted);">'+E(d.notes).substring(0,60)+(d.notes.length>60?'...':'')+'</span>' : ''}</td>
                    <td style="padding:10px 12px;font-size:12px;color:var(--text-muted);">${E(d.category||'General')}</td>
                    <td style="padding:10px 12px;font-size:12px;color:${st.color};">${d.expiry || '—'}</td>
                    <td style="padding:10px 12px;"><span style="background:${st.color};color:#fff;font-size:10px;padding:2px 8px;border-radius:4px;">${st.label}</span></td>
                    <td style="padding:10px 12px;text-align:right;white-space:nowrap;">
                        ${d.data ? `<a href="${window.safeUrl(d.data)}" target="_blank" class="btn btn-outline" style="font-size:11px;padding:4px 8px;text-decoration:none;margin-right:4px;">📄 View</a>` : d.link ? `<a href="${window.safeUrl(d.link)}" target="_blank" class="btn btn-outline" style="font-size:11px;padding:4px 8px;text-decoration:none;margin-right:4px;">🔗 Open</a>` : ''}
                        <button onclick="window.editDocForm(${d.originalIndex})" class="btn btn-outline" style="font-size:11px;padding:4px 8px;margin-right:4px;">✏️</button>
                        <button onclick="window.delDoc(${d.originalIndex})" class="btn btn-outline" style="font-size:11px;padding:4px 8px;color:var(--red);">&times;</button>
                    </td>
                </tr>`;
            }).join('')}</tbody></table></div>`;
    }

    const viewToggle = `<div style="display:flex;gap:2px;border:1px solid var(--border);border-radius:6px;overflow:hidden;">
        <button onclick="window._safeViewMode='grid';localStorage.setItem('safeViewMode','grid');window.showView('safe');" style="padding:6px 10px;font-size:12px;border:none;cursor:pointer;background:${viewMode==='grid'?'var(--blue)':'var(--card-bg)'};color:${viewMode==='grid'?'#fff':'var(--text-muted)'};">Grid</button>
        <button onclick="window._safeViewMode='table';localStorage.setItem('safeViewMode','table');window.showView('safe');" style="padding:6px 10px;font-size:12px;border:none;cursor:pointer;background:${viewMode==='table'?'var(--blue)':'var(--card-bg)'};color:${viewMode==='table'?'#fff':'var(--text-muted)'};">Table</button>
    </div>`;

    return `<div style="max-width:1100px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
            <div>
                <h2 style="margin:0;">Digital Safe</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Secure document hub — licenses, insurance, certs, HR, and more</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                ${viewToggle}
                <button onclick="window.printDocRegister()" class="btn btn-outline" style="font-size:12px;">🖨️ Print Register</button>
                <button onclick="window.bulkUploadForm()" class="btn btn-blue">📂 Bulk Upload</button>
                <button onclick="window.addDocForm()" class="btn btn-green">+ Upload</button>
                <button onclick="window.editSafeCategories()" class="btn btn-outline" style="font-size:12px;">⚙️</button>
            </div>
        </div>
        ${alertHtml}
        <input type="text" class="search-bar" placeholder="🔍 Search documents and notes..." oninput="window._safeSearchQuery=this.value;window.showView('safe')" value="${window._safeSearchQuery||''}" style="margin-bottom:15px;">
        <div style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:6px;">${tabPills}</div>
        ${emptyHtml}${docsHtml}
    </div>`;
};

window._safeSortBy = function(col) {
    if (window._safeSortCol === col) window._safeSortAsc = !window._safeSortAsc;
    else { window._safeSortCol = col; window._safeSortAsc = true; }
    window.showView('safe');
};

window.printDocRegister = function() {
    const docs = window.digitalSafe || [];
    const E = window.esc;
    const rows = docs.slice().sort((a,b) => (a.category||'').localeCompare(b.category||'') || (a.name||'').localeCompare(b.name||'')).map(d => {
        const st = window._safeGetStatus(d);
        return `<tr><td style="padding:6px 10px;border:1px solid #ddd;">${E(d.name)}</td><td style="padding:6px 10px;border:1px solid #ddd;">${E(d.category||'General')}</td><td style="padding:6px 10px;border:1px solid #ddd;">${d.expiry||'N/A'}</td><td style="padding:6px 10px;border:1px solid #ddd;color:${st.label==='EXPIRED'?'red':st.label==='Expiring'?'orange':'green'}">${st.label}</td><td style="padding:6px 10px;border:1px solid #ddd;font-size:11px;">${E(d.notes||'')}</td></tr>`;
    }).join('');
    const venueName = window.getCurrentVenue ? window.getCurrentVenue().name : 'Venue';
    const html = `<html><head><title>Document Register</title></head><body style="font-family:Arial,sans-serif;padding:30px;color:#000;">
        <h2 style="margin-bottom:4px;">${E(venueName)} — Document Register</h2>
        <p style="color:#666;font-size:12px;">Printed: ${new Date().toLocaleDateString('en-AU')} | ${docs.length} documents</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:15px;">
            <thead><tr style="background:#f0f0f0;"><th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Document</th><th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Category</th><th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Expiry</th><th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Status</th><th style="padding:8px 10px;border:1px solid #ddd;text-align:left;">Notes</th></tr></thead>
            <tbody>${rows}</tbody>
        </table></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
};

window.editSafeCategories = () => {
    const cats = window.safeCategories || [];
    const E = window.esc;
    let html = `<div style="margin-bottom:15px;max-height:400px;overflow-y:auto;">
        ${cats.map((c, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid var(--border);">
            <span style="font-size:13px;">${E(c)}</span>
            <button onclick="window.delSafeCat(${i})" style="color:var(--red);background:none;border:none;cursor:pointer;font-size:18px;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;">&times;</button>
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;">
        <input type="text" id="new-safe-cat" class="input-box" placeholder="New category name..." style="margin:0;flex:1;">
        <button onclick="window.addSafeCat()" class="btn btn-green">Add</button>
    </div>
    <button onclick="window.closeModal();window.showView('safe');" class="btn btn-blue" style="width:100%;margin-top:15px;">Done</button>`;
    window.openModal('⚙️ Manage Safe Categories', html);
};
window.addSafeCat = () => {
    const val = document.getElementById('new-safe-cat').value.trim();
    if (!val) return;
    if (!window.safeCategories.includes(val)) { window.safeCategories.push(val); window.saveToDisk(); }
    window.editSafeCategories();
};
window.delSafeCat = (i) => {
    window.confirmAction({
        title: '📁 Delete Category', message: 'Delete this category? Documents in it will move to <strong>General / Other</strong>.',
        confirmLabel: 'Delete Category', tier: 'standard',
        onConfirm: () => { const cat = window.safeCategories[i]; window.digitalSafe.forEach(d => { if (d.category === cat) d.category = 'General / Other'; }); window.safeCategories.splice(i, 1); window.saveToDisk(); window.editSafeCategories(); }
    });
};

window.bulkUploadForm = () => {
    const cats = (window.safeCategories || []);
    const catOpts = cats.map(c => `<option value="${window.esc(c)}">${window.esc(c)}</option>`).join('');
    const html = `
        <label style="font-size:11px;color:var(--text-muted);">Category for all files</label>
        <select id="bulk-cat" class="input-box">${catOpts}</select>
        <label style="font-size:11px;color:var(--text-muted);">Expiry Date (optional — applies to all)</label>
        <input type="date" id="bulk-expiry" class="input-box">
        <label style="font-size:11px;color:var(--text-muted);">Notes (optional — applies to all)</label>
        <input type="text" id="bulk-notes" class="input-box" placeholder="e.g. Renewed March 2026 via broker">
        <label style="font-size:11px;color:var(--text-muted);">Select Files (PDF, images, Word docs — multiple OK)</label>
        <input type="file" id="bulk-files" accept="application/pdf,image/*,.doc,.docx,.xlsx,.xls" multiple class="input-box" style="padding:12px;margin-bottom:20px;">
        <div id="bulk-status"></div>
        <button onclick="window.runBulkUpload()" class="btn btn-blue" style="width:100%;font-size:15px;" id="btn-bulk-upload">📂 Upload All Files</button>`;
    window.openModal('📂 Bulk Upload to Safe', html);
};

window.runBulkUpload = async () => {
    const fileInput = document.getElementById('bulk-files');
    const cat = document.getElementById('bulk-cat').value;
    const expiry = document.getElementById('bulk-expiry').value;
    const notes = (document.getElementById('bulk-notes') || {}).value || '';
    const statusDiv = document.getElementById('bulk-status');
    const btn = document.getElementById('btn-bulk-upload');
    if (!fileInput.files.length) return window.showToast('Select at least one file.', 'error');

    btn.disabled = true;
    const files = Array.from(fileInput.files);
    let uploaded = 0, failed = 0;

    for (const file of files) {
        statusDiv.innerHTML = `<p style="color:var(--blue);font-size:13px;">⏳ Uploading ${uploaded + 1} of ${files.length}: ${window.esc(file.name)}</p>`;
        try {
            const fileRef = storage.ref().child('safe_docs/' + Date.now() + '_' + file.name);
            await fileRef.put(file);
            const downloadURL = await fileRef.getDownloadURL();
            window.digitalSafe.push({
                name: file.name.replace(/\.[^.]+$/, ''),
                category: cat, expiry: expiry, notes: notes,
                type: file.type.includes('pdf') ? 'pdf' : 'image',
                data: downloadURL,
                uploadDate: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            });
            uploaded++;
        } catch(e) { failed++; console.error('Upload failed:', file.name, e); }
    }

    window.saveToDisk();
    statusDiv.innerHTML = `<p style="color:var(--green);font-size:13px;">✅ ${uploaded} uploaded${failed > 0 ? ', ' + failed + ' failed' : ''}.</p>`;
    btn.disabled = false;
    setTimeout(() => { window.closeModal(); window.showView('safe'); }, 1200);
};

window.addDocForm = () => {
    const cats = (window.safeCategories || []);
    const catOpts = cats.map(c => `<option value="${window.esc(c)}">${window.esc(c)}</option>`).join('');
    const html = `
        <label style="font-size:11px;color:var(--text-muted);">Category</label>
        <select id="d-cat" class="input-box">${catOpts}</select>
        <label style="font-size:11px;color:var(--text-muted);">Document Name</label>
        <input type="text" id="d-name" class="input-box" placeholder="e.g. Liquor License 2026">
        <label style="font-size:11px;color:var(--text-muted);">Expiry Date (Optional)</label>
        <input type="date" id="d-expiry" class="input-box">
        <label style="font-size:11px;color:var(--text-muted);">Notes (Optional)</label>
        <input type="text" id="d-notes" class="input-box" placeholder="e.g. Policy #12345, renewed via ABC Insurance">
        <label style="font-size:11px;color:var(--text-muted);">Upload File <em>or</em> paste an external link</label>
        <input type="file" id="d-file" accept="application/pdf,image/*,.doc,.docx,.xlsx,.xls" class="input-box" style="padding:12px;">
        <input type="text" id="d-link" class="input-box" placeholder="Or paste URL (e.g. Google Drive link)" style="margin-top:6px;margin-bottom:20px;">
        <button onclick="window.subDoc()" class="btn btn-green" style="width:100%;" id="btn-doc-save">Save to Safe</button>`;
    window.openModal('🔒 Upload to Safe', html);
};

window.subDoc = async () => {
    const name = document.getElementById('d-name').value.trim();
    const category = document.getElementById('d-cat').value;
    const expiry = document.getElementById('d-expiry').value;
    const notes = (document.getElementById('d-notes') || {}).value || '';
    const fileInput = document.getElementById('d-file');
    const linkInput = document.getElementById('d-link');
    const link = linkInput ? linkInput.value.trim() : '';
    if (!name) return window.showToast('Name required.', 'error');
    if (!fileInput.files.length && !link) return window.showToast('Upload a file or paste a link.', 'error');

    const btn = document.getElementById('btn-doc-save');
    btn.innerText = 'Saving... ⏳'; btn.disabled = true;

    if (fileInput.files.length) {
        try {
            const file = fileInput.files[0];
            const fileRef = storage.ref().child('safe_docs/' + Date.now() + '_' + file.name);
            await fileRef.put(file);
            const downloadURL = await fileRef.getDownloadURL();
            window.digitalSafe.push({ name, category, expiry, notes, type: file.type.includes('pdf') ? 'pdf' : 'image', data: downloadURL, uploadDate: new Date().toISOString(), lastUpdated: new Date().toISOString() });
            window.saveToDisk(); window.closeModal(); window.showView('safe'); window.showToast('Document Secured!');
        } catch (error) { window.showToast('Upload failed.', 'error'); btn.innerText = 'Save to Safe'; btn.disabled = false; }
    } else {
        window.digitalSafe.push({ name, category, expiry, notes, type: 'link', link: link, uploadDate: new Date().toISOString(), lastUpdated: new Date().toISOString() });
        window.saveToDisk(); window.closeModal(); window.showView('safe'); window.showToast('Document Secured!');
    }
};
window.delDoc = (i) => {
    window.confirmAction({ title:'🔒 Delete Document', message:'Permanently delete this document from the Digital Safe?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.digitalSafe.splice(i, 1); window.saveToDisk(); window.showView('safe'); } });
};

window.editDocForm = (i) => {
    const doc = window.digitalSafe[i];
    if (!doc) return;
    const E = window.esc;
    const cats = (window.safeCategories || []);
    const catOpts = cats.map(c => '<option value="' + E(c) + '" ' + (c === doc.category ? 'selected' : '') + '>' + E(c) + '</option>').join('');
    const html = '<label style="font-size:11px;color:var(--text-muted);">Document Name</label>' +
        '<input type="text" id="edit-doc-name" class="input-box" value="' + E(doc.name||'') + '" placeholder="e.g. Liquor License 2026">' +
        '<label style="font-size:11px;color:var(--text-muted);">Category</label>' +
        '<select id="edit-doc-cat" class="input-box"><option value="">-- Select Category --</option>' + catOpts + '</select>' +
        '<label style="font-size:11px;color:var(--text-muted);">Expiry Date (optional)</label>' +
        '<input type="date" id="edit-doc-expiry" class="input-box" value="' + (doc.expiry||'') + '">' +
        '<label style="font-size:11px;color:var(--text-muted);">Notes</label>' +
        '<input type="text" id="edit-doc-notes" class="input-box" value="' + E(doc.notes||'') + '" placeholder="e.g. Policy details, renewal info">' +
        '<label style="font-size:11px;color:var(--text-muted);">Replace File (optional — leave empty to keep current)</label>' +
        '<input type="file" id="edit-doc-file" accept="application/pdf,image/*,.doc,.docx,.xlsx,.xls" class="input-box" style="padding:12px;margin-bottom:20px;">' +
        '<button onclick="window.saveDocEdit(' + i + ')" class="btn btn-green" style="width:100%;" id="btn-edit-doc-save">Save Changes</button>';
    window.openModal('✏️ Edit — ' + E(doc.name||'Untitled'), html);
};

window.saveDocEdit = async (i) => {
    const name = document.getElementById('edit-doc-name').value.trim();
    if (!name) return window.showToast('Name is required.', 'error');
    window.digitalSafe[i].name = name;
    window.digitalSafe[i].category = document.getElementById('edit-doc-cat').value;
    window.digitalSafe[i].expiry = document.getElementById('edit-doc-expiry').value;
    window.digitalSafe[i].notes = (document.getElementById('edit-doc-notes') || {}).value || '';
    window.digitalSafe[i].lastUpdated = new Date().toISOString();

    // Handle file replacement
    const fileInput = document.getElementById('edit-doc-file');
    if (fileInput && fileInput.files.length) {
        const btn = document.getElementById('btn-edit-doc-save');
        if (btn) { btn.innerText = 'Uploading... ⏳'; btn.disabled = true; }
        try {
            const file = fileInput.files[0];
            const fileRef = storage.ref().child('safe_docs/' + Date.now() + '_' + file.name);
            await fileRef.put(file);
            const downloadURL = await fileRef.getDownloadURL();
            window.digitalSafe[i].data = downloadURL;
            window.digitalSafe[i].type = file.type.includes('pdf') ? 'pdf' : 'image';
        } catch (err) {
            window.showToast('File replacement failed — other changes saved.', 'error');
        }
    }

    window.saveToDisk(); window.closeModal(); window.showView('safe');
    window.showToast('Document updated!');
};



// --- 7. PHONEBOOK ---



// =============================================================================
// HACCP BREACH HISTORY — Per fridge unit temp trend + breach log
// =============================================================================
window.renderHACCPHistory = () => {
    const tempLogs = window.tempLogs || [];
    const units = window.fridgeUnits || [];
    
    if (units.length === 0) {
        return '<div style="max-width:900px;margin:auto;"><div class="card" style="text-align:center;padding:40px;"><h3 style="color:var(--text-muted);">No fridge units configured.</h3><button onclick="window.showView(\'compliance\')"\ class="btn btn-blue" style="margin-top:10px;">Set Up Units</button></div></div>';
    }
    
    // Group logs by unit
    const byUnit = {};
    units.forEach(u => { byUnit[u] = []; });
    tempLogs.forEach(log => {
        if (byUnit[log.unit] !== undefined) byUnit[log.unit].push(log);
    });
    
    // Calculate stats per unit
    const unitCards = units.map(unit => {
        const logs = byUnit[unit] || [];
        const last30 = logs.filter(l => {
            const d = new Date(l.time);
            return (new Date() - d) < 30 * 24 * 3600 * 1000;
        });
        
        const breaches = last30.filter(l => l.value > 5);
        const totalLogs = last30.length;
        const avgTemp = totalLogs > 0 ? (last30.reduce((s, l) => s + Number(l.value), 0) / totalLogs).toFixed(1) : 'N/A';
        const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
        const statusColor = breaches.length === 0 ? 'var(--green)' : breaches.length <= 2 ? 'var(--orange)' : 'var(--red)';
        const statusLabel = breaches.length === 0 ? 'Compliant' : breaches.length + (breaches.length === 1 ? ' breach' : ' breaches');
        
        // Mini sparkline of last 14 readings
        const recent14 = last30.slice(-14);
        let sparkHtml = '';
        if (recent14.length > 1) {
            const maxT = Math.max(...recent14.map(l => l.value), 6);
            const minT = Math.min(...recent14.map(l => l.value), -2);
            const range = maxT - minT || 1;
            const sparkW = 200, sparkH = 40;
            const points = recent14.map((l, i) => {
                const x = (i / (recent14.length - 1)) * sparkW;
                const y = sparkH - ((l.value - minT) / range) * sparkH;
                return x.toFixed(1) + ',' + y.toFixed(1);
            }).join(' ');
            const dangerY = sparkH - ((5 - minT) / range) * sparkH;
            sparkHtml = '<svg width="' + sparkW + '" height="' + (sparkH + 5) + '" style="display:block;margin:10px 0;">' +
                '<line x1="0" y1="' + dangerY.toFixed(1) + '" x2="' + sparkW + '" y2="' + dangerY.toFixed(1) + '" stroke="var(--red)" stroke-width="1" stroke-dasharray="4"/>' +
                '<polyline points="' + points + '" fill="none" stroke="' + statusColor + '" stroke-width="2"/>' +
                recent14.map((l, i) => {
                    const x = (i / (recent14.length - 1)) * sparkW;
                    const y = sparkH - ((l.value - minT) / range) * sparkH;
                    const color = l.value > 5 ? 'var(--red)' : 'var(--green)';
                    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="' + color + '"><title>' + l.value + '°C — ' + l.time + '</title></circle>';
                }).join('') +
                '<text x="' + sparkW + '" y="' + (dangerY - 3).toFixed(1) + '" fill="var(--red)" font-size="9" text-anchor="end">5°C limit</text>' +
            '</svg>';
        }
        
        // Breach log
        const breachRows = breaches.slice().reverse().slice(0, 5).map(b =>
            '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--border);font-size:12px;">' +
                '<span style="color:var(--red);">' + b.value + '°C</span>' +
                '<span style="color:var(--text-muted);">' + esc(b.staff) + '</span>' +
                '<span style="color:var(--text-muted);font-size:11px;">' + esc(b.time) + '</span>' +
            '</div>' +
            (b.action ? '<div style="font-size:11px;color:var(--orange);padding:2px 0 6px 0;">Action: ' + esc(b.action) + '</div>' : '')
        ).join('');
        
        return '<div class="card" style="border-top:3px solid ' + statusColor + ';margin-bottom:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
                '<div><h3 style="margin:0;font-size:15px;">' + esc(unit) + '</h3>' +
                '<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">' + totalLogs + (totalLogs === 1 ? ' reading' : ' readings') + ' in 30 days</div></div>' +
                '<div style="text-align:right;"><span class="breach-indicator ' + (breaches.length === 0 ? 'ok' : breaches.length <= 2 ? 'warn' : 'breach') + '"></span>' +
                '<span style="font-weight:bold;color:' + statusColor + ';">' + statusLabel + '</span></div>' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">' +
                '<div style="background:var(--bg-main);padding:8px;border-radius:6px;text-align:center;">' +
                    '<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;">Avg Temp</div>' +
                    '<div style="font-size:16px;font-weight:bold;color:var(--blue);">' + avgTemp + '°C</div>' +
                '</div>' +
                '<div style="background:var(--bg-main);padding:8px;border-radius:6px;text-align:center;">' +
                    '<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;">Breaches</div>' +
                    '<div style="font-size:16px;font-weight:bold;color:' + (breaches.length > 0 ? 'var(--red)' : 'var(--green)') + ';">' + breaches.length + '</div>' +
                '</div>' +
                '<div style="background:var(--bg-main);padding:8px;border-radius:6px;text-align:center;">' +
                    '<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;">Last Reading</div>' +
                    '<div style="font-size:16px;font-weight:bold;color:' + (lastLog && lastLog.value > 5 ? 'var(--red)' : 'var(--green)') + ';">' + (lastLog ? lastLog.value + '°C' : '—') + '</div>' +
                '</div>' +
            '</div>' +
            sparkHtml +
            (breachRows ? '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;"><div style="font-size:11px;color:var(--red);font-weight:bold;margin-bottom:6px;text-transform:uppercase;">Breach Log</div>' + breachRows + '</div>' : '') +
        '</div>';
    }).join('');
    
    // Overall stats
    const totalBreaches30d = tempLogs.filter(l => l.value > 5 && (new Date() - new Date(l.time)) < 30*24*3600*1000).length;
    const totalLogs30d = tempLogs.filter(l => (new Date() - new Date(l.time)) < 30*24*3600*1000).length;
    const compliancePct = totalLogs30d > 0 ? ((1 - totalBreaches30d / totalLogs30d) * 100).toFixed(1) : 'N/A';
    
    return '<div style="max-width:1000px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0;">HACCP Temperature History</h2>' +
            '<small style="color:var(--text-muted);">30-day compliance overview per unit · Breach threshold: 5°C</small></div>' +
            '<div style="display:flex;gap:8px;">' +
                '<button onclick="window.showView(\'compliance\')"\ class="btn btn-outline" style="font-size:12px;">← Temp Logging</button>' +
            '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:15px;">' +
            '<div class="card" style="text-align:center;border-top:4px solid ' + (compliancePct >= 95 ? 'var(--green)' : 'var(--orange)') + ';">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Compliance Rate</div>' +
                '<div style="font-size:32px;font-weight:bold;color:' + (compliancePct >= 95 ? 'var(--green)' : 'var(--orange)') + ';">' + compliancePct + '%</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--red);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Breaches (30d)</div>' +
                '<div style="font-size:32px;font-weight:bold;color:' + (totalBreaches30d > 0 ? 'var(--red)' : 'var(--green)') + ';">' + totalBreaches30d + '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--blue);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Total Readings</div>' +
                '<div style="font-size:32px;font-weight:bold;color:var(--blue);">' + totalLogs30d + '</div>' +
            '</div>' +
        '</div>' +
        unitCards +
    '</div>';
};

// =============================================================================
// STAFF DIRECTORY
// =============================================================================
window.renderStaffDirectoryView = () => {
    const staff = window.staffDirectory || [];
    return '<div style="max-width:900px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">' +
            '<div><h2 style="margin:0">👥 Staff Directory</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Team contact details, roles, and emergency info</div></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            (window.getTandaToken && window.getTandaToken() ? '<button onclick="window.showLoadingOverlay(\'Syncing from Tanda...\');window.loadTandaData().then(()=>{window.hideLoadingOverlay();window.syncTandaStaff();})" class="btn btn-outline" style="font-size:12px;border-color:var(--purple);color:var(--purple);">🔄 Sync from Tanda</button>' : '') +
            '<button onclick="window.editStaffForm()" class="btn btn-blue">+ Add Staff Member</button></div>' +
        '</div>' +
        (staff.length === 0 ?
            '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">👥</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No staff added</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Add team members with their contact details and emergency info</div></div>' :
            '<div class="card" style="padding:0;overflow:hidden;">' +
            '<table style="width:100%;border-collapse:collapse;">' +
            '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
            '<th style="padding:8px 12px;text-align:left;">Name</th>' +
            '<th style="padding:8px 12px;text-align:left;">Role</th>' +
            '<th style="padding:8px 12px;text-align:left;">Contact</th>' +
            '<th style="padding:8px 12px;text-align:left;">Status</th>' +
            '<th style="padding:8px 12px;"></th>' +
            '</tr></thead><tbody>' +
            staff.map((s, i) =>
                '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:8px 12px;"><strong style="font-size:13px;">' + esc(s.name) + '</strong>' + (s.emergency ? '<br><small style="color:var(--red);font-size:11px;">Emergency: ' + esc(s.emergency) + '</small>' : '') + '</td>' +
                '<td style="padding:12px 15px;font-size:13px;"><span style="background:var(--bg-main);padding:2px 8px;border-radius:8px;border:1px solid var(--border);">' + esc(s.role||'Staff') + '</span></td>' +
                '<td style="padding:12px 15px;font-size:13px;"><a href="tel:' + esc(s.phone||'') + '" style="color:var(--blue);">' + esc(s.phone||'No phone') + '</a>' + (s.email ? '<br><a href="mailto:' + esc(s.email) + '" style="color:var(--text-muted);font-size:12px;">' + esc(s.email) + '</a>' : '') + '</td>' +
                '<td style="padding:8px 12px;"><span style="font-size:11px;color:' + (s.status==='Active'?'var(--green)':'var(--text-muted)') + ';font-weight:bold;">' + (s.status||'Active') + '</span>' + (s.startDate ? '<br><small style="color:var(--text-muted);font-size:11px;">Since ' + s.startDate + '</small>' : '') + '</td>' +
                '<td style="padding:8px 12px;text-align:right;">' +
                    '<button onclick="window.editStaffForm(' + i + ')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;margin-right:4px;">✏️ Edit</button>' +
                    '<button onclick="window.delStaff(' + i + ')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;">&times;</button>' +
                '</td>' +
                '</tr>'
            ).join('') +
            '</tbody></table></div>'
        ) +
    '</div>';
};

window.editStaffForm = (idx) => {
    const s = idx !== undefined ? (window.staffDirectory||[])[idx] : { name:'', role:'FOH', phone:'', email:'', emergency:'', status:'Active', startDate:'', notes:'' };
    const isEdit = idx !== undefined;
    const html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Full Name</label><input type="text" id="sd-name" class="input-box" value="' + esc(s.name||'') + '" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Role</label><select id="sd-role" class="input-box" style="margin:0;"><option ' + (s.role==='FOH'?'selected':'') + '>FOH</option><option ' + (s.role==='BOH'?'selected':'') + '>BOH</option><option ' + (s.role==='Bar'?'selected':'') + '>Bar</option><option ' + (s.role==='Manager'?'selected':'') + '>Manager</option><option ' + (s.role==='Kitchen Hand'?'selected':'') + '>Kitchen Hand</option></select></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Phone</label><input type="text" id="sd-phone" class="input-box" value="' + esc(s.phone||'') + '" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Email</label><input type="text" id="sd-email" class="input-box" value="' + esc(s.email||'') + '" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Emergency Contact</label><input type="text" id="sd-emerg" class="input-box" value="' + esc(s.emergency||'') + '" placeholder="Name & number" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Start Date</label><input type="date" id="sd-start" class="input-box" value="' + (s.startDate||'') + '" style="margin:0;"></div>' +
        '</div>' +
        '<label style="font-size:11px;color:var(--text-muted);">Status</label>' +
        '<select id="sd-status" class="input-box"><option ' + (s.status==='Active'?'selected':'') + '>Active</option><option ' + (s.status==='Inactive'?'selected':'') + '>Inactive</option><option ' + (s.status==='Casual'?'selected':'') + '>Casual</option></select>' +
        '<label style="font-size:11px;color:var(--text-muted);">Notes</label>' +
        '<textarea id="sd-notes" class="input-box" style="height:60px;margin-bottom:15px;">' + esc(s.notes||'') + '</textarea>' +
        // Qualification expiry fields
        '<div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:15px;">' +
        '<label style="font-size:12px;font-weight:600;color:var(--text-main);margin-bottom:8px;display:block;">🎓 Qualifications</label>' +
        (window.qualificationTypes||[]).map(qt => {
            const q = (s.qualifications||{})[qt.id] || {};
            return '<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;">' +
                '<label style="font-size:12px;color:var(--text-muted);width:160px;flex-shrink:0;">' + esc(qt.name) + '</label>' +
                (qt.expiryRequired
                    ? '<input type="date" id="sq-' + qt.id + '" class="input-box" value="' + (q.expiry||'') + '" style="margin:0;flex:1;">'
                    : '<select id="sq-' + qt.id + '" class="input-box" style="margin:0;flex:1;"><option value="">Not provided</option><option value="yes" ' + (q.verified?'selected':'') + '>Verified</option><option value="pending">Pending</option></select>'
                ) +
                '</div>';
        }).join('') +
        '</div>' +
        // Staff PIN section
        '<div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:15px;">' +
        '<label style="font-size:12px;font-weight:600;color:var(--text-main);margin-bottom:8px;display:block;">🔑 Staff PIN</label>' +
        '<div style="display:flex;gap:10px;align-items:center;">' +
        (s.pin ? '<span style="font-size:12px;color:var(--green);">✅ PIN set</span>' : '<span style="font-size:12px;color:var(--text-muted);">No PIN set</span>') +
        '<button onclick="window.setStaffPin(' + (isEdit?idx:'undefined') + ')" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">' + (s.pin ? '🔄 Reset PIN' : '🔑 Set PIN') + '</button>' +
        '</div></div>' +
        // Birthday + custom fields
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Birthday</label><input type="date" id="sd-birthday" class="input-box" value="' + (s.birthday||'') + '" style="margin:0;"></div>' +
        '<div><label style="font-size:11px;color:var(--text-muted);">Custom (key=value, one per line)</label><textarea id="sd-custom" class="input-box" style="margin:0;height:40px;" placeholder="e.g. tshirt=Medium">' + Object.entries(s.customFields||{}).map(([k,v])=>k+'='+v).join('\n') + '</textarea></div>' +
        '</div>' +
        '<button onclick="window.saveStaff(' + (isEdit?idx:'undefined') + ')" class="btn btn-green" style="width:100%;">' + (isEdit?'Save Changes':'Add Staff Member') + '</button>';
    window.openModal(isEdit ? '✏️ Edit — ' + esc(s.name) : '+ New Staff Member', html);
};

window.setStaffPin = (idx) => {
    window._showPinModal('🔑 Set Staff PIN', 'Choose a 4-digit PIN for this staff member', async (newPin) => {
        if (newPin.length >= 4) {
            const hashed = await window._hashPin(newPin);
            // Check for collision with manager PIN
            const mgrPin = localStorage.getItem('venuePin');
            if (mgrPin && hashed === mgrPin) {
                window.showToast('This PIN matches the manager PIN. Choose a different one.', 'error');
                window._pinBuffer = '';
                const dots = document.querySelectorAll('.pin-dot');
                dots.forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
                return;
            }
            // Check for collision with other staff PINs
            const collision = (window.staffDirectory||[]).find((s, i) => i !== idx && s.pin === hashed);
            if (collision) {
                window.showToast('This PIN is already used by ' + collision.name + '. Choose a different one.', 'error');
                window._pinBuffer = '';
                const dots = document.querySelectorAll('.pin-dot');
                dots.forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
                return;
            }
            if (idx !== undefined && (window.staffDirectory||[])[idx]) {
                window.staffDirectory[idx].pin = hashed;
                window.saveToDisk();
                window.closeModal();
                window.showToast('PIN set for ' + window.staffDirectory[idx].name + '!');
                window.editStaffForm(idx); // Re-open form to show updated state
            }
        }
    });
};

window.saveStaff = (idx) => {
    // Collect qualification data
    const quals = {};
    (window.qualificationTypes||[]).forEach(qt => {
        const el = document.getElementById('sq-' + qt.id);
        if (!el) return;
        if (qt.expiryRequired) {
            if (el.value) quals[qt.id] = { expiry: el.value, verified: true };
        } else {
            if (el.value === 'yes') quals[qt.id] = { verified: true };
            else if (el.value === 'pending') quals[qt.id] = { verified: false };
        }
    });
    const existing = (idx !== undefined && idx !== 'undefined') ? (window.staffDirectory||[])[idx] : {};
    // Parse custom fields
    const customEl = document.getElementById('sd-custom');
    const customFields = {};
    if (customEl && customEl.value.trim()) {
        customEl.value.trim().split('\n').forEach(line => {
            const parts = line.split('='); if (parts.length >= 2) customFields[parts[0].trim()] = parts.slice(1).join('=').trim();
        });
    }
    const obj = {
        name: document.getElementById('sd-name').value.trim(),
        role: document.getElementById('sd-role').value,
        phone: document.getElementById('sd-phone').value.trim(),
        email: document.getElementById('sd-email').value.trim(),
        emergency: document.getElementById('sd-emerg').value.trim(),
        startDate: document.getElementById('sd-start').value,
        status: document.getElementById('sd-status').value,
        notes: document.getElementById('sd-notes').value.trim(),
        qualifications: quals,
        birthday: document.getElementById('sd-birthday') ? document.getElementById('sd-birthday').value : (existing.birthday || ''),
        customFields: customFields,
        // Preserve existing fields that aren't in this form
        pin: existing.pin || undefined,
        achievements: existing.achievements || [],
        shiftFeedback: existing.shiftFeedback || [],
        profileConfig: existing.profileConfig || {}
    };
    if (!obj.name) return window.showToast('Name required.','error');
    if (!window.staffDirectory) window.staffDirectory = [];
    if (idx !== undefined && idx !== 'undefined') window.staffDirectory[idx] = obj;
    else window.staffDirectory.push(obj);
    window.logAudit('staffDirectory', idx !== undefined ? 'edit' : 'create', obj.name, obj.role);
    window.saveToDisk(); window.closeModal(); window.showView('staff-directory');
    window.showToast('Staff member saved!');
};

window.delStaff = (i) => {
    window.confirmAction({ title:'👥 Remove Staff', message:'Remove this staff member from the directory?', confirmLabel:'Remove', tier:'standard',
        onConfirm:() => { window.staffDirectory.splice(i,1); window.saveToDisk(); window.showView('staff-directory'); }
    });
};

window.renderPhoneBookView = function() { 
    const mergedContacts = [...(window.phoneBook || []).map((c, i) => ({ ...c, originalIndex: i, isSupplier: false })), ...(window.suppliers || []).map(s => ({ name: s.name, category: 'Supplier', phone: s.contact || 'No email/phone', notes: `Order Cutoff: ${s.cutoff}`, isSupplier: true }))].sort((a, b) => a.name.localeCompare(b.name));
    return `<div style="max-width: 900px; margin: auto;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px"><div><h2 style="margin:0">📞 Phonebook</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Tradies, suppliers, and service providers your team calls regularly</div></div><button onclick="window.addContact()" class="btn btn-blue">+ Add Contact</button></div>${mergedContacts.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">📞</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No contacts yet</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Add tradies, suppliers, and service providers your team calls regularly</div></div>' : '<table style="width:100%; background:var(--card-bg); border-radius:8px; border-collapse: collapse; overflow:hidden;"><thead><tr style="text-align:left; border-bottom:1px solid var(--border); background:#111;"><th style="padding:8px 12px;">Name</th><th style="padding:8px 12px;">Contact</th><th style="padding:8px 12px;">Notes</th><th style="text-align:right; padding:8px 12px;">Action</th></tr></thead><tbody>' + mergedContacts.map(c => `<tr style="border-bottom:1px solid var(--bg-main);"><td style="padding:7px 12px;"><strong style="font-size:13px;">${esc(c.name)}</strong><br><small style="color:var(--text-muted);">${esc(c.category)}</small></td><td style="padding:7px 12px;font-size:13px;">${c.phone.includes('@') ? `<a href="mailto:${esc(c.phone)}" style="color:var(--blue); font-weight:bold;">${esc(c.phone)}</a>` : `<a href="tel:${esc(c.phone)}" style="color:var(--blue); font-weight:bold;">${esc(c.phone)}</a>`}</td><td style="padding:7px 12px; color:var(--brand-accent); font-size:12px; white-space:pre-wrap;">${esc(c.notes) || ''}</td><td style="text-align:right; padding:7px 12px;">${c.isSupplier ? `<button onclick="window.showView('suppliers')" class="btn btn-outline" style="font-size:11px; padding:6px 10px;">Edit in Suppliers</button>` : `<button onclick="window.delContact(${c.originalIndex})" style="color:var(--red); background:none; border:none; cursor:pointer; font-weight:bold; font-size:20px; line-height:1;">&times;</button>`}</td></tr>`).join('') + '</tbody></table>'}</div>`; 
}
window.addContact = () => { 
    let html = `<input type="text" id="c-n" class="input-box" placeholder="Name"><select id="c-c" class="input-box"><option>Staff</option><option>Tradie / Maintenance</option><option>Service Provider</option><option>Other</option></select><input type="text" id="c-p" class="input-box" placeholder="Phone or Email"><textarea id="c-notes" class="input-box" placeholder="Notes..." style="height:80px; margin-bottom:20px;"></textarea><button onclick="window.subContact()" class="btn btn-green" style="width:100%;">Save Contact</button>`;
    window.openModal("📞 New Contact", html);
};
window.subContact = () => { const name = document.getElementById('c-n').value.trim(); if (!name) return window.showToast('Contact name is required.','error'); window.phoneBook.push({ name: name, category: document.getElementById('c-c').value.trim(), phone: document.getElementById('c-p').value.trim(), notes: document.getElementById('c-notes').value.trim() }); window.saveToDisk(); window.closeModal(); window.showView('phonebook'); window.showToast("Contact Saved!"); };
window.delContact = (i) => { window.confirmAction({ title:'📞 Delete Contact', message:'Remove this contact from the phonebook?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.phoneBook.splice(i,1); window.saveToDisk(); window.showView('phonebook'); } }); };

// --- 8. INCIDENT LOG ---
window.renderIncidentView = function() {
    const logs = (window.incidentLogs || []).slice().reverse();
    return '<div style="max-width:800px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0">⚠️ Incident Log</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Record workplace incidents for compliance and safety tracking</div></div>' +
            '<button onclick="window.exportIncidentLog()" class="btn btn-outline" style="font-size:12px;">🖨️ Export / Print</button>' +
        '</div>' +
        '<div class="card" style="border-top:4px solid var(--red);margin-bottom:15px;">' +
            '<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:10px;">' +
                '<textarea id="inc-desc" class="input-box" style="height:90px;margin:0;" placeholder="Describe the incident in detail..."></textarea>' +
                '<div style="display:flex;flex-direction:column;gap:8px;">' +
                    '<input type="text" id="inc-staff" class="input-box" placeholder="Staff Name" style="margin:0;">' +
                    '<input type="text" id="inc-type" class="input-box" placeholder="Type (e.g. Injury, Spill)" style="margin:0;">' +
                '</div>' +
            '</div>' +
            '<button onclick="window.saveIncident()" class="btn btn-red" style="width:100%;font-size:15px;">Log Incident to Permanent Record</button>' +
        '</div>' +
        (logs.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">⚠️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No incidents logged</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Record workplace incidents here for compliance and safety tracking</div></div>' :
        logs.map(l => '<div class="card" style="margin-bottom:10px;padding:14px;border-left:3px solid var(--red);">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
                '<div><strong style="font-size:15px;">' + esc(l.staff) + '</strong>' + (l.type ? ' <span style="font-size:11px;color:var(--red);background:rgba(239,68,68,0.1);padding:2px 8px;border-radius:8px;margin-left:8px;">' + esc(l.type) + '</span>' : '') + '</div>' +
                '<span style="color:var(--text-muted);font-size:12px;">' + esc(l.time) + '</span>' +
            '</div>' +
            '<p style="margin:0;font-size:14px;white-space:pre-wrap;">' + esc(l.desc) + '</p>' +
        '</div>').join('')) +
    '</div>';
};
window.saveIncident = function() {
    const staff = document.getElementById('inc-staff').value;
    const desc = document.getElementById('inc-desc').value;
    const type = document.getElementById('inc-type') ? document.getElementById('inc-type').value : '';
    if (!staff || !desc) return window.showToast('Staff name and description required.', 'error');
    window.incidentLogs.push({ staff, desc, type, time: new Date().toLocaleString() });
    window.saveToDisk(); window.showToast('Incident Logged', 'error'); window.showView('incidents');
};

window.exportIncidentLog = () => {
    const allLogs = (window.incidentLogs || []).slice().reverse();
    const html = '<p style="font-size:13px;color:var(--text-muted);margin-top:0;">Select a date range or leave blank to export all (' + allLogs.length + ' total).</p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;">' +
            '<div><label style="font-size:11px;color:var(--text-muted);">From</label><input type="date" id="inc-from" class="input-box" style="margin:0;"></div>' +
            '<div><label style="font-size:11px;color:var(--text-muted);">To</label><input type="date" id="inc-to" class="input-box" style="margin:0;"></div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;">' +
            '<button onclick="window.runIncidentExport(\'print\')" class="btn btn-blue" style="flex:1;">🖨️ Print / PDF</button>' +
            '<button onclick="window.runIncidentExport(\'csv\')" class="btn btn-outline" style="flex:1;">📊 CSV</button>' +
        '</div>';
    window.openModal('🖨️ Export Incident Log', html);
};

window.runIncidentExport = (format) => {
    const fromVal = document.getElementById('inc-from') ? document.getElementById('inc-from').value : '';
    const toVal = document.getElementById('inc-to') ? document.getElementById('inc-to').value : '';
    const from = fromVal ? new Date(fromVal) : null;
    const to = toVal ? new Date(toVal + 'T23:59:59') : null;
    let logs = (window.incidentLogs || []).slice().reverse();
    if (from || to) logs = logs.filter(l => { const d = new Date(l.time); return (!from||d>=from) && (!to||d<=to); });
    const periodLabel = (from||to) ? ((from?from.toLocaleDateString('en-AU'):'All') + ' to ' + (to?to.toLocaleDateString('en-AU'):'Present')) : 'Full History';
    if (format === 'csv') {
        const rows = logs.map(l => ['"'+l.time+'"','"'+(l.staff||'')+'"','"'+(l.type||'')+'"','"'+(l.desc||'').replace(/"/g,"''")+'"'].join(','));
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('Date/Time,Staff,Type,Description\n' + rows.join('\n'));
        a.download = 'IncidentLog_BWI_' + new Date().toISOString().split('T')[0] + '.csv';
        document.body.appendChild(a); a.click(); a.remove();
        window.closeModal(); window.showToast(logs.length + ' incidents exported.');
        return;
    }
    const win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><title>Incident Log</title><style>body{font-family:sans-serif;font-size:13px;max-width:750px;margin:30px auto;}.h{font-size:20px;font-weight:bold;border-bottom:3px solid #dc2626;padding-bottom:8px;margin-bottom:5px;}.meta{color:#888;font-size:12px;margin-bottom:20px;}.inc{border-left:4px solid #dc2626;padding:12px 15px;margin-bottom:12px;background:#fff5f5;border-radius:0 6px 6px 0;}.row{display:flex;justify-content:space-between;margin-bottom:6px;}.name{font-weight:bold;}.time{color:#888;font-size:11px;}.type{font-size:11px;background:#fca5a5;color:#dc2626;padding:2px 8px;border-radius:8px;margin-left:8px;}.desc{white-space:pre-wrap;line-height:1.6;}@media print{body{margin:15px;}}</style></head><body>');
    win.document.write('<div class="h">⚠️ Incident Log — ' + (window.getCurrentVenue ? window.getCurrentVenue().name : 'Bar Wa Izakaya') + '</div><div class="meta">Period: ' + periodLabel + ' · ' + logs.length + ' incident(s) · Printed ' + new Date().toLocaleDateString('en-AU') + '</div>');
    logs.forEach(l => { win.document.write('<div class="inc"><div class="row"><span><span class="name">' + esc(l.staff) + '</span>' + (l.type ? '<span class="type">' + esc(l.type) + '</span>' : '') + '</span><span class="time">' + esc(l.time) + '</span></div><div class="desc">' + esc(l.desc) + '</div></div>'); });
    win.document.write('<script>window.onload=()=>{window.print();}<\/script></body></html>');
    win.document.close(); window.closeModal();
};

// --- 9. COMMAND CENTER (DASHBOARD) ---

window.generateWeeklySummary = () => {
    const today = new Date();
    const weekStart = new Date(today);
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1));
    weekStart.setHours(0,0,0,0);
    const parseDate = (str) => {
        const m = str && str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        return m ? new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1])) : new Date(str);
    };
    const weekSales = (window.salesData||[]).filter(s => { const d = parseDate(s.date); return d >= weekStart && d <= today; });
    const totalRev = weekSales.reduce((s,d) => s + Number(d.total||0), 0);
    const totalWages = weekSales.reduce((s,d) => s + Number(d.wages||0), 0);
    const wagePct = totalRev > 0 && totalWages > 0 ? ((totalWages/totalRev)*100).toFixed(1) : null;
    const avgDaily = weekSales.length > 0 ? (totalRev/weekSales.length).toFixed(0) : 0;
    const bestDay = weekSales.length > 0 ? weekSales.reduce((b,d) => Number(d.total)>Number(b.total)?d:b) : null;
    const isWeekend = [0,5,6].includes(today.getDay());
    const lowStock = (window.inventoryItems||[]).filter(i => { if(i.archived) return false; const par = isWeekend?(i.parWeekend||i.par||0):(i.parWeekday||i.par||0); return i.stock < par; });
    const openTickets = (window.defectLogs||[]).filter(d => d.status === 'Open');
    const weekWastage = (window.wastageLogs||[]).filter(w => { const d = new Date(w.time); return d >= weekStart && d <= today; });
    const wastageVal = weekWastage.reduce((s,w) => s + Number(w.value||0), 0);
    const weekIncidents = (window.incidentLogs||[]).filter(i => { const d = new Date(i.time); return d >= weekStart && d <= today; });
    const freqMap = {'Weekly':7,'Fortnightly':14,'Monthly':30,'Quarterly':90};
    const overdueTasks = (window.rotationalTasks||[]).filter(t => {
        if (t.dueDateMode === 'specific') return t.specificDueDate && new Date(t.specificDueDate) <= today;
        if (t.lastLogIso) return ((today - new Date(t.lastLogIso)) / 86400000) >= (freqMap[t.freq] || 7);
        if (t.anchorDate) { const ad = new Date(t.anchorDate); if (ad > today) return false; const ds = (today - ad) / 86400000; const iv = freqMap[t.freq] || 7; return (ds - Math.floor(ds / iv) * iv) < 1 || ds >= iv; }
        return true;
    });
    const weekLabel = weekStart.toLocaleDateString('en-AU',{day:'numeric',month:'short'}) + ' – ' + today.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
    const fmt = (n) => Number(n).toLocaleString('en-AU',{minimumFractionDigits:0,maximumFractionDigits:0});
    const lines = [
        (window.getCurrentVenue ? window.getCurrentVenue().name.toUpperCase() : 'BAR WA IZAKAYA') + ' — WEEKLY SUMMARY',
        weekLabel,
        '─────────────────────────────',
        '',
        '💰 REVENUE',
        'Total: $' + fmt(totalRev),
        'Avg Daily: $' + fmt(avgDaily),
        bestDay ? 'Best Day: ' + bestDay.date + ' ($' + fmt(bestDay.total) + ')' : '',
        '',
        '💼 WAGES',
        totalWages > 0 ? 'Total: $' + fmt(totalWages) + (wagePct ? ' (' + wagePct + '%)' : '') : 'No wages data',
        '',
        '🗑️ WASTAGE',
        weekWastage.length > 0 ? weekWastage.length + ' items · $' + wastageVal.toFixed(2) + ' lost' : 'None logged',
        '',
        '📦 INVENTORY',
        lowStock.length > 0 ? lowStock.length + ' below PAR: ' + lowStock.slice(0,5).map(i=>i.name).join(', ') + (lowStock.length>5?'...':'') : 'All at or above PAR',
        '',
        '🛠️ MAINTENANCE',
        openTickets.length > 0 ? openTickets.length + ' open: ' + openTickets.map(t=>t.item).join(', ') : 'No open tickets',
        '',
        '⚠️ INCIDENTS',
        weekIncidents.length > 0 ? weekIncidents.length + ' incident(s) this week' : 'None',
        '',
        '🔄 OVERDUE TASKS',
        overdueTasks.length > 0 ? overdueTasks.map(t => '• ' + t.name + ' (' + t.freq + ')').join('\n') : 'All current',
        '',
        '─────────────────────────────',
        'Generated by Hobart Hub · ' + today.toLocaleDateString('en-AU')
    ];
    window._weeklySummaryText = lines.filter(l => l !== null).join('\n');
    const html = '<div style="background:var(--bg-main);padding:15px;border-radius:8px;margin-bottom:15px;font-family:monospace;font-size:12px;white-space:pre-wrap;max-height:50vh;overflow-y:auto;line-height:1.7;">' + window._weeklySummaryText + '</div>' +
        '<div style="display:flex;gap:10px;">' +
            '<button onclick="navigator.clipboard.writeText(window._weeklySummaryText).then(()=>window.showToast(\'Copied!\'))" class="btn btn-blue" style="flex:1;">📋 Copy</button>' +
            '<button onclick="window.printWeeklySummary()" class="btn btn-outline" style="flex:1;">🖨️ Print</button>' +
        '</div>';
    window.openModal('📊 Weekly Summary — ' + weekLabel, html);
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
        const incidents = (data.incidentLogs||[]).filter(i=>i.time&&i.time.includes(todayStr));
        const freqMap = {'Weekly':7,'Fortnightly':14,'Monthly':30,'Quarterly':90};
        const overdueTasks = (data.rotationalTasks||[]).filter(t=>{
            if(!t.lastLogIso) return true;
            return ((today-new Date(t.lastLogIso))/(1000*3600*24))>=(freqMap[t.freq]||7);
        });
        const tempLogs = (data.tempLogs||[]).filter(t=>t.time&&t.time.includes(today.toLocaleDateString()));
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
                '<div style="margin-top:8px;font-size:13px;color:var(--text-muted);">This week: <strong style="color:var(--blue);">$' + Math.round(s.weekRevenue).toLocaleString() + '</strong></div>' +
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
                '<div style="font-size:30px;font-weight:bold;color:var(--blue);">$' + Math.round(totalWeekRevenue).toLocaleString() + '</div>' +
            '</div>' +
            '<div class="card" style="text-align:center;border-top:4px solid var(--orange);">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Venues Active</div>' +
                '<div style="font-size:30px;font-weight:bold;color:var(--orange);">' + venues.length + '</div>' +
            '</div>' +
        '</div>' +
        // Venue cards side by side
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:20px;">' +
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
        '<td style="padding:7px 12px;font-weight:bold;font-size:13px;">$' + Math.round(w.revenue).toLocaleString() + '</td>' +
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
            '<button onclick="window.openTandaSettings()" class="btn btn-outline" style="font-size:12px;">⏱️ ' + (window.getTandaToken?.()?'Tanda Connected':'Connect Tanda') + '</button>' +
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
    const todayStr = today.toLocaleDateString();
    const isWeekend = [0, 5, 6].includes(today.getDay());
    const hour = today.getHours();
    const E = window.esc;

    // --- DATE HELPERS ---
    const fmtDate = (d) => d.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    const parseDate = (str) => { const m = str && str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? new Date(parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1])) : null; };
    const getSalesForDate = (d) => (window.salesData||[]).find(s => s.date === fmtDate(d));

    // --- TODAY'S DATA ---
    const todaySales = getSalesForDate(today);
    const todayRev = todaySales ? Number(todaySales.total||0) : 0;
    const todayCovers = todaySales ? Number(todaySales.covers||0) : 0;
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
    const todayTemps = (window.tempLogs||[]).filter(t => t.time && t.time.includes(todayStr));
    const breaches = todayTemps.filter(t => parseFloat(t.value) > 5);
    const shiftType = hour < 14 ? 'opening' : hour < 20 ? 'preservice' : 'closing';
    const activeList = ((window.shiftChecklistItems||{})[shiftType]) || [];
    const checkSaved = JSON.parse(localStorage.getItem('shiftCheck_' + todayStr + '_' + shiftType) || '[]');
    const checkPct = activeList.length > 0 ? Math.round(checkSaved.length / activeList.length * 100) : 100;

    // --- TASKS ---
    const freqMap = { 'Weekly':7, 'Fortnightly':14, 'Monthly':30, 'Quarterly':90 };
    const overdueTasks = (window.rotationalTasks||[]).filter(t => {
        if (t.dueDateMode === 'specific') return t.specificDueDate && new Date(t.specificDueDate) <= today;
        if (t.lastLogIso) return ((today - new Date(t.lastLogIso)) / 86400000) >= (freqMap[t.freq]||7);
        if (t.anchorDate) { const ad = new Date(t.anchorDate); if (ad > today) return false; const ds = (today-ad)/86400000; const iv = freqMap[t.freq]||7; return today >= new Date(ad.getTime()+Math.floor(ds/iv)*iv*86400000); }
        return true;
    });
    const openTickets = (window.defectLogs||[]).filter(d => d.status !== 'Resolved');

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

    // --- COGS (from today's wastage + depletion) ---
    const todayWastage = (window.wastageLogs||[]).filter(w => w.time && w.time.includes(todayStr)).reduce((s,w)=>s+(w.value||0), 0);

    // --- LABOR % ---
    const laborPct = hasTodayData && todayWages > 0 ? (todayWages / todayRev * 100) : null;
    const wageTarget = (window.salesTargets||{}).wageTarget || 30;

    // --- HEALTH SCORE (0-100) ---
    let healthScore = 100;
    // Revenue: -20 if no data today
    if (!hasTodayData) healthScore -= 15;
    // Labor: -15 if over target
    if (laborPct && laborPct > wageTarget) healthScore -= Math.min(15, Math.round((laborPct - wageTarget) / 2));
    // Stock: -20 max based on % below par
    healthScore -= Math.round((1 - stockHealthPct/100) * 20);
    // Compliance: -15 for breaches, -10 for incomplete checklist
    if (breaches.length > 0) healthScore -= Math.min(15, breaches.length * 5);
    if (checkPct < 100) healthScore -= Math.round((1 - checkPct/100) * 10);
    // Tasks: -3 per overdue
    healthScore -= Math.min(15, overdueTasks.length * 3);
    // Tickets: -2 per open
    healthScore -= Math.min(10, openTickets.length * 2);
    healthScore = Math.max(0, Math.min(100, healthScore));
    const scoreColor = healthScore >= 80 ? 'var(--green)' : healthScore >= 50 ? 'var(--orange)' : 'var(--red)';
    const scoreLabel = healthScore >= 80 ? 'Running Smoothly' : healthScore >= 50 ? 'Needs Attention' : 'Issues Detected';

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
    overdueTasks.forEach(t => focusItems.push({pri:1, icon:'🔄', color:'var(--red)', text:E(t.name)+' is overdue', view:'tasks'}));
    expiringDocs.filter(d => (new Date(d.expiry)-today)/86400000 <= 7).forEach(d => {
        const dl = (new Date(d.expiry)-today)/86400000;
        focusItems.push({pri:2, icon:'📄', color:dl<0?'var(--red)':'var(--orange)', text:E(d.name)+' — '+(dl<0?'EXPIRED':'Expires in '+Math.ceil(dl)+'d'), view:'safe'});
    });
    lowStock.slice(0,4).forEach(i => focusItems.push({pri:3, icon:'📦', color:'var(--orange)', text:E(i.name)+' below par', view:'inventory'}));
    if (lowStock.length > 4) focusItems.push({pri:3, icon:'📦', color:'var(--orange)', text:'+'+(lowStock.length-4)+' more below par', view:'inventory'});
    openTickets.slice(0,2).forEach(t => focusItems.push({pri:4, icon:'🛠️', color:'var(--orange)', text:E(t.item)+' — open ticket', view:'maintenance'}));
    expiringQuals.slice(0,2).forEach(q => focusItems.push({pri:5, icon:'🎓', color:q.status==='expired'?'var(--red)':'var(--orange)', text:E(q.staff)+' — '+E(q.qual)+(q.status==='expired'?' EXPIRED':' expires in '+q.days+'d'), view:'orientation'}));
    marginAlerts.slice(0,2).forEach(a => focusItems.push({pri:6, icon:'📉', color:'var(--red)', text:E(a.name)+' margin: '+a.currentGp+'%', view:'margins'}));
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
    html += '</div></div>';
    // Right: health score ring
    html += '<div style="text-align:center;position:relative;width:110px;height:110px;flex-shrink:0;">';
    html += scoreRing(healthScore, 110, 8, scoreColor);
    html += '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(0deg);text-align:center;">';
    html += '<div style="font-size:28px;font-weight:800;color:'+scoreColor+';line-height:1;">'+healthScore+'</div>';
    html += '<div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-top:2px;">'+scoreLabel+'</div>';
    html += '</div></div>';
    html += '</div>';

    // --- FINANCIAL ROW (3 cards) ---
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-bottom:14px;">';

    // Card 1: Today's Revenue
    html += '<div class="card" style="padding:20px;border-top:3px solid var(--green);">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
    html += '<div>';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Today\'s Revenue</div>';
    html += '<div style="font-size:32px;font-weight:800;color:' + (hasTodayData?'var(--green)':'var(--text-muted)') + ';margin:4px 0;">' + (hasTodayData ? '$'+todayRev.toLocaleString('en-AU',{maximumFractionDigits:0}) : '—') + '</div>';
    if (hasTodayData && todaySales) {
        html += '<div style="font-size:11px;color:var(--text-muted);">EFT $'+(todaySales.eftpos||0)+' · Cash $'+(todaySales.cash||0)+(todaySales.meandu?' · Me&u $'+todaySales.meandu:'')+'</div>';
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
    // Tanda data — rostered vs actual
    if (window._tandaData) {
        const td = window._tandaData;
        html += '<div style="border-top:1px solid var(--border);margin-top:10px;padding-top:8px;font-size:11px;">';
        html += '<div style="color:var(--purple);font-weight:600;margin-bottom:4px;">⏱️ Tanda Live</div>';
        html += '<div style="color:var(--text-muted);">Rostered: ' + td.staffCount + ' staff · ' + td.rosteredHours + 'h · $' + td.estimatedWageCost + '</div>';
        if (Number(td.actualHours) > 0) {
            const variance = Number(td.actualWageCost) - Number(td.estimatedWageCost);
            const varColor = variance <= 0 ? 'var(--green)' : 'var(--red)';
            const varLabel = variance <= 0 ? ('$' + Math.abs(variance).toFixed(0) + ' under') : ('$' + variance.toFixed(0) + ' over');
            html += '<div style="color:var(--text-muted);">Actual: ' + td.actualStaffCount + ' staff · ' + td.actualHours + 'h · <strong style="color:' + varColor + ';">$' + td.actualWageCost + '</strong></div>';
            html += '<div style="color:' + varColor + ';font-weight:600;">' + varLabel + ' budget</div>';
        }
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
        if (todayCovers > 0) html += '<div style="font-size:11px;color:var(--blue);margin-top:4px;">👥 '+todayCovers+' covers · $'+(todayRev/todayCovers).toFixed(0)+' avg spend</div>';
    } else {
        html += '<div style="font-size:32px;font-weight:800;color:var(--text-muted);margin:4px 0;">—</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);">Revenue data needed for P&L</div>';
    }
    html += '</div>';
    html += '</div>';

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
    html += '</div>';

    // Tasks
    const taskColor = overdueTasks.length === 0 ? 'var(--green)' : 'var(--red)';
    html += '<div class="card" style="padding:14px;cursor:pointer;" onclick="window.showView(\'tasks\')">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">🔄 Tasks</div>';
    html += '<div style="font-size:22px;font-weight:800;color:'+taskColor+';">'+overdueTasks.length+'</div>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;">'+(overdueTasks.length === 0 ? 'All current' : overdueTasks.length+' overdue')+'</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">'+(window.rotationalTasks||[]).length+' total tasks tracked</div>';
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

    // --- 7-DAY REVENUE CHART ---
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

    // --- TODAY'S FOCUS + QUICK ACTIONS (2-column) ---
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;margin-bottom:14px;">';

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
        {label:'Handover', icon:'📝', onclick:'window.newHandoverForm()', color:'var(--purple)'},
        {label:'Incident', icon:'⚠️', view:'incidents', color:'var(--red)'},
        {label:'Covers', icon:'👥', onclick:'window.logCoversForm()', color:'var(--blue)'},
        {label:'EOD Summary', icon:'📊', onclick:'window.generateEodSummary()', color:'var(--purple)'},
        {label:'Ask Hub', icon:'🤖', onclick:"window.showView('ask-hub')", color:'var(--blue)'},
        {label:'EOD Run', icon:'✨', onclick:'window.openAiDepletion()', color:'var(--purple)'},
        {label:'All Venues', icon:'🏢', onclick:'window.renderCrossVenueDashboard()', color:'var(--green)'}
    ];
    actions.forEach(a => {
        const click = a.onclick || "window.showView('"+a.view+"')";
        html += '<button onclick="'+click+'" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-main);border:1px solid var(--border);border-radius:8px;color:'+a.color+';cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s;" onmouseover="this.style.borderColor=\''+a.color+'\'" onmouseout="this.style.borderColor=\'var(--border)\'">';
        html += '<span style="font-size:16px;">'+a.icon+'</span>'+a.label+'</button>';
    });
    html += '</div></div>';
    html += '</div>';

    // --- RECENT HANDOVER ---
    if (recentHandover) {
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

    // --- MARGIN ALERTS ---
    if (marginAlerts.length > 0) {
        html += '<div class="card" style="padding:16px;margin-bottom:14px;border-left:3px solid var(--purple);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
        html += '<div style="font-size:13px;font-weight:700;">📉 Margin Alerts <span style="font-size:11px;background:var(--purple);color:#fff;padding:1px 8px;border-radius:10px;margin-left:6px;">'+marginAlerts.length+'</span></div>';
        html += '<button onclick="window.showView(\'margins\')" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">View All →</button></div>';
        marginAlerts.slice(0,4).forEach(a => {
            html += '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px;"><span style="color:var(--red);">'+E(a.name)+'</span><span><strong>'+a.currentGp+'%</strong> GP</span></div>';
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

    const sections = (window.handoverTemplateConfig || {}).sections || ['Service Summary', "What's 86'd", 'Stock Alerts', 'Issues / Follow-ups', 'Opening Notes for Tomorrow'];

    const sectionFields = sections.map((sec, i) => {
        let placeholder = 'Notes...';
        const prefill = prefills[sec] || '';
        if (sec.toLowerCase().includes('86')) placeholder = "List any items 86'd during service...";
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
    const sections = (window.handoverTemplateConfig || {}).sections || ['Service Summary', "What's 86'd", 'Stock Alerts', 'Issues / Follow-ups', 'Opening Notes for Tomorrow'];
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
    const todayWasteLogs = (window.wastageLogs||[]).filter(l=>l.time&&l.time.includes(today.toLocaleDateString()));
    const wasteTotal = todayWasteLogs.reduce((s,w) => s + Number(w.value||0), 0);
    const todayIncidents = (window.incidentLogs||[]).filter(i=>i.time&&i.time.includes(today.toLocaleDateString()));
    const isWeekend = [0,5,6].includes(today.getDay());
    const belowPar = (window.inventoryItems||[]).filter(i => {
        if (i.archived) return false;
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return i.stock < par;
    });
    const topBelowPar = belowPar.slice(0,5).map(i=>i.name).join(', ');
    const todayTemps = (window.tempLogs||[]).filter(t=>t.time&&t.time.includes(today.toLocaleDateString()));
    const tempBreaches = todayTemps.filter(t=>parseFloat(t.value) > 5);
    const newTicketsToday = openTickets.filter(t=>t.date&&t.date.includes(today.toLocaleDateString()));

    const prompt = `You are writing an end-of-shift debrief for a hospitality venue called ${window.getCurrentVenue ? window.getCurrentVenue().name : 'the venue'}.

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
    const venueName = window.getCurrentVenue ? window.getCurrentVenue().name : 'Venue';
    const text = `${venueName} — Shift Debrief\n${h.shift} · ${h.date} · ${h.manager}\n\n${h.debrief||h.notes}${h.urgent ? '\n\n⚠️ URGENT: ' + h.urgent : ''}\n\nClosed: ${h.closeTime||'—'} · Out: ${h.outTime||'—'} · KH: ${h.khTime||'—'}`;
    navigator.clipboard.writeText(text).then(() => window.showToast('Copied to clipboard!')).catch(() => window.showToast('Copy failed — try manually.', 'error'));
};


// --- 11. KNOWLEDGE BASE ---
window._kbActiveTab = window._kbActiveTab || 'all';

window._kbSearch = window._kbSearch || '';
window._kbPinned = window._kbPinned || [];

window.toggleKBPin = (i) => {
    if (!window._kbPinned) window._kbPinned = [];
    const idx = window._kbPinned.indexOf(i);
    if (idx >= 0) window._kbPinned.splice(idx, 1);
    else window._kbPinned.push(i);
    window.showView('knowledge');
};

window.renderKnowledgeView = () => {
    const kb = window.knowledgeBase || [];
    const cats = window.kbCategories || [...new Set(kb.map(k => k.category).filter(Boolean))];
    const activeTab = window._kbActiveTab || 'all';

    const filtered = activeTab === 'all' ? kb.map((k,i) => ({...k, idx:i}))
        : kb.map((k,i) => ({...k, idx:i})).filter(k => k.category === activeTab);

    const tabPills = [
        `<span class="tag-pill ${activeTab==='all'?'active':''}" onclick="window._kbActiveTab='all';window.showView('knowledge');">All (${kb.length})</span>`
    ].concat(cats.map(c => {
        const count = kb.filter(k => k.category === c).length;
        return `<span class="tag-pill ${activeTab===c?'active':''}" onclick="window._kbActiveTab='${c.replace(/'/g,"\\'")}';window.showView('knowledge');">${esc(c)} (${count})</span>`;
    })).join('');

    const cardsHtml = filtered.length === 0
        ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">📚</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No SOPs added</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Create standard operating procedures so everyone knows the playbook</div></div>'
        : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">${filtered.map(k =>
            `<div class="card" style="margin:0;padding:20px;cursor:pointer;transition:transform 0.2s;border-top:4px solid var(--blue);" onclick="window.viewSOP(${k.idx})" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <h4 style="margin:0;font-size:15px;flex:1;padding-right:8px;">${esc(k.title)}</h4>
                    ${k.fileUrl ? '<span style="font-size:18px;flex-shrink:0;" title="Has attachment">📎</span>' : ''}
                </div>
                <span style="font-size:11px;color:var(--text-muted);background:var(--bg-main);padding:2px 8px;border-radius:8px;border:1px solid var(--border);display:inline-block;margin-bottom:10px;">${esc(k.category || 'General')}</span>
                ${k.content ? `<p style="color:var(--text-muted);font-size:13px;margin:0;line-height:1.4;">${esc(k.content.substring(0,80))}${k.content.length>80?'...':''}</p>` : '<p style="color:var(--text-muted);font-size:13px;margin:0;font-style:italic;">File attachment only</p>'}
            </div>`
        ).join('')}</div>`;

    return `<div style="max-width:1000px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">
            <div><h2 style="margin:0">📚 Knowledge Base</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">SOPs, training manuals, and operational procedures</div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button onclick="window.newSOPForm()" class="btn btn-blue">+ New SOP</button>
                <button onclick="window.editKbCategories()" class="btn btn-outline" style="font-size:12px;">⚙️ Categories</button>
            </div>
        </div>
        <div style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:6px;">${tabPills}</div>
        ${cardsHtml}
    </div>`;
};

window.editKbCategories = () => {
    const cats = window.kbCategories || [];
    let html = `<div style="margin-bottom:15px;">
        ${cats.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">No categories yet.</p>' : cats.map((c, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid var(--border);">
                <span style="font-size:14px;">${esc(c)}</span>
                <button onclick="window.delKbCat(${i})" style="color:var(--red);background:none;border:none;cursor:pointer;font-size:18px;">&times;</button>
            </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;">
        <input type="text" id="new-kb-cat" class="input-box" placeholder="New category name..." style="margin:0;flex:1;">
        <button onclick="window.addKbCat()" class="btn btn-green">Add</button>
    </div>
    <button onclick="window.closeModal();window.showView('knowledge');" class="btn btn-blue" style="width:100%;margin-top:15px;">Done</button>`;
    window.openModal('⚙️ Manage KB Categories', html);
};
window.addKbCat = () => {
    const val = document.getElementById('new-kb-cat').value.trim();
    if (!val) return;
    if (!window.kbCategories) window.kbCategories = [];
    if (!window.kbCategories.includes(val)) { window.kbCategories.push(val); window.saveToDisk(); }
    window.editKbCategories();
};
window.delKbCat = (i) => {
    window.confirmAction({
        title: '📚 Delete Category', message: 'Delete this category? SOPs in it will move to <strong>General</strong>.',
        confirmLabel: 'Delete Category', tier: 'standard',
        onConfirm: () => { const cat = window.kbCategories[i]; (window.knowledgeBase || []).forEach(k => { if (k.category === cat) k.category = 'General'; }); window.kbCategories.splice(i, 1); window.saveToDisk(); window.editKbCategories(); }
    });
};

window.newSOPForm = () => {
    const cats = window.kbCategories || [];
    const catOpts = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    const html = `
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:15px;">
            <div><label style="font-size:11px;color:var(--text-muted);">SOP Title</label>
            <input type="text" id="k-title" class="input-box" placeholder="e.g. Opening Procedure" style="margin:0;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Category</label>
            <input type="text" id="k-cat" class="input-box" placeholder="e.g. FOH" list="kb-cat-list" style="margin:0;">
            <datalist id="kb-cat-list">${catOpts}</datalist></div>
        </div>
        <label style="font-size:11px;color:var(--text-muted);">Content (optional if uploading a file)</label>
        <textarea id="k-content" class="input-box" placeholder="Write SOP content here..." style="height:200px;margin-bottom:15px;line-height:1.6;"></textarea>
        <label style="font-size:11px;color:var(--text-muted);">Attach File — PDF or image (optional)</label>
        <input type="file" id="k-file" accept="application/pdf,image/*" class="input-box" style="padding:12px;margin-bottom:20px;">
        <button onclick="window.saveSOP()" class="btn btn-green" style="width:100%;font-size:15px;" id="btn-sop-save">Save SOP</button>`;
    window.openModal('📚 New SOP / Document', html);
};

window.saveSOP = async () => {
    const title = document.getElementById('k-title').value.trim();
    const content = document.getElementById('k-content').value.trim();
    const cat = document.getElementById('k-cat').value.trim() || 'General';
    const fileInput = document.getElementById('k-file');
    if (!title) return window.showToast('Title is required.', 'error');
    if (!content && !fileInput.files.length) return window.showToast('Add content or attach a file.', 'error');

    const btn = document.getElementById('btn-sop-save');
    btn.innerText = 'Saving...'; btn.disabled = true;

    let fileUrl = null;
    if (fileInput.files.length) {
        try {
            const file = fileInput.files[0];
            const ref = storage.ref().child('knowledge/' + Date.now() + '_' + file.name);
            await ref.put(file);
            fileUrl = await ref.getDownloadURL();
        } catch(e) { window.showToast('File upload failed: ' + e.message, 'error'); btn.innerText = 'Save SOP'; btn.disabled = false; return; }
    }

    // Auto-add new category if not in list
    if (!window.kbCategories) window.kbCategories = [];
    if (cat && cat !== 'General' && !window.kbCategories.includes(cat)) window.kbCategories.push(cat);

    window.knowledgeBase.push({ title, category: cat, content, fileUrl, lastModified: new Date().toLocaleDateString('en-AU') });
    window.saveToDisk();
    window.closeModal();
    window.showView('knowledge');
    window.showToast('SOP Saved!');
};

window.viewSOP = (i) => {
    const k = window.knowledgeBase[i];
    if (!k) return;
    document.getElementById('mainContent').innerHTML = `
    <div class="card" style="max-width:800px;margin:auto;padding:40px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <button onclick="window.showView('knowledge')" class="btn btn-outline" style="font-size:12px;">← Back</button>
            <div style="display:flex;gap:8px;">
                <button onclick="window.editSOPForm(${i})" class="btn btn-blue" style="font-size:12px;">✏️ Edit</button>
                <button onclick="window.deleteSOP(${i})" class="btn btn-red" style="font-size:12px;">🗑️ Delete</button>
            </div>
        </div>
        <h2 style="margin:0 0 8px 0;">${esc(k.title)}</h2>
        <div style="display:flex;gap:8px;margin-bottom:15px;flex-wrap:wrap;">
            <span class="tag-pill" style="margin:0;">${esc(k.category || 'General')}</span>
            ${k.lastModified ? `<span style="font-size:12px;color:var(--text-muted);align-self:center;">Last updated: ${k.lastModified}</span>` : ''}
        </div>
        ${k.fileUrl ? `<div style="margin-bottom:20px;padding:15px;background:var(--bg-main);border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:13px;color:var(--text-muted);">📎 Attached file</span>
            <a href="${k.fileUrl}" target="_blank" download class="btn btn-outline" style="text-decoration:none;font-size:12px;">Download / View</a>
        </div>` : ''}
        ${k.content ? `<div style="white-space:pre-wrap;line-height:1.8;font-size:15px;color:var(--text-main);">${esc(k.content)}</div>` : '<p style="color:var(--text-muted);font-style:italic;">No written content — see attached file above.</p>'}
    </div>`;
};

window.editSOPForm = (i) => {
    const k = window.knowledgeBase[i];
    const cats = window.kbCategories || [];
    const catOpts = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    const html = `
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:15px;">
            <div><label style="font-size:11px;color:var(--text-muted);">Title</label>
            <input type="text" id="k-edit-title" class="input-box" value="${esc(k.title)}" style="margin:0;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Category</label>
            <input type="text" id="k-edit-cat" class="input-box" value="${esc(k.category||'')}" list="kb-edit-cats" style="margin:0;">
            <datalist id="kb-edit-cats">${catOpts}</datalist></div>
        </div>
        <label style="font-size:11px;color:var(--text-muted);">Content</label>
        <textarea id="k-edit-content" class="input-box" style="height:200px;margin-bottom:15px;line-height:1.6;">${esc(k.content||'')}</textarea>
        ${k.fileUrl ? `<div style="margin-bottom:15px;padding:10px;background:var(--bg-main);border-radius:6px;font-size:13px;display:flex;justify-content:space-between;">
            <span>📎 Existing file attached</span>
            <a href="${k.fileUrl}" target="_blank" style="color:var(--blue);text-decoration:none;">View</a>
        </div>` : ''}
        <label style="font-size:11px;color:var(--text-muted);">${k.fileUrl ? 'Replace file (optional)' : 'Attach file (optional)'}</label>
        <input type="file" id="k-edit-file" accept="application/pdf,image/*" class="input-box" style="padding:12px;margin-bottom:20px;">
        <button onclick="window.updateSOP(${i})" class="btn btn-green" style="width:100%;" id="btn-sop-edit">Save Changes</button>`;
    window.openModal('✏️ Edit SOP', html);
};

window.updateSOP = async (i) => {
    const title = document.getElementById('k-edit-title').value.trim();
    const cat = document.getElementById('k-edit-cat').value.trim() || 'General';
    const content = document.getElementById('k-edit-content').value.trim();
    const fileInput = document.getElementById('k-edit-file');
    if (!title) return window.showToast('Title required.', 'error');
    const btn = document.getElementById('btn-sop-edit');
    btn.innerText = 'Saving...'; btn.disabled = true;
    let fileUrl = window.knowledgeBase[i].fileUrl || null;
    if (fileInput.files.length) {
        try {
            const file = fileInput.files[0];
            const ref = storage.ref().child('knowledge/' + Date.now() + '_' + file.name);
            await ref.put(file); fileUrl = await ref.getDownloadURL();
        } catch(e) { window.showToast('File upload failed.', 'error'); btn.innerText = 'Save Changes'; btn.disabled = false; return; }
    }
    if (!window.kbCategories) window.kbCategories = [];
    if (cat && cat !== 'General' && !window.kbCategories.includes(cat)) window.kbCategories.push(cat);
    window.knowledgeBase[i] = { ...window.knowledgeBase[i], title, category: cat, content, fileUrl, lastModified: new Date().toLocaleDateString('en-AU') };
    window.saveToDisk(); window.closeModal(); window.viewSOP(i); window.showToast('SOP Updated!');
};

window.deleteSOP = (i) => {
    window.confirmAction({ title:'📚 Delete SOP', message:'Permanently delete this SOP?', confirmLabel:'Delete', tier:'standard',
        onConfirm:() => { window.knowledgeBase.splice(i, 1); window.saveToDisk(); window.showView('knowledge'); window.showToast('SOP Deleted.'); }
    });
};



// --- 12. ROSTERS ---
window._rosterTab = window._rosterTab || 'tanda';

window._renderTandaRoster = (tabPills) => {
    const E = window.esc;
    const td = window._tandaData;
    if (!td || !td.weeklyRoster) {
        const noConn = !window.getTandaToken || !window.getTandaToken();
        return '<div style="max-width:900px;margin:auto;"><div style="margin-bottom:12px;">' + tabPills + '</div>' +
            '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px;">⏱️</div>' +
            '<div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main);">' + (noConn ? 'Tanda Not Connected' : 'Loading Roster...') + '</div>' +
            '<div style="font-size:13px;max-width:320px;margin:0 auto 16px;line-height:1.5;">' + (noConn ? 'Connect Tanda in Settings to see your live weekly roster here.' : 'Tanda data is loading. Try refreshing.') + '</div>' +
            (noConn ? '<button onclick="window.openTandaSettings()" class="btn btn-purple">⏱️ Connect Tanda</button>' : '<button onclick="window.loadTandaData()" class="btn btn-outline">🔄 Refresh</button>') +
            '</div></div>';
    }

    const days = Object.keys(td.weeklyRoster).sort();
    const todayStr = td.date;
    const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    // Collect unique staff across the week, grouped by department
    const allStaff = new Map();
    days.forEach(d => {
        (td.weeklyRoster[d] || []).forEach(s => {
            if (!allStaff.has(s.name)) allStaff.set(s.name, { shifts: {}, dept: s.dept || 'Other' });
            allStaff.get(s.name).shifts[d] = s;
            if (s.dept && allStaff.get(s.name).dept === 'Other') allStaff.get(s.name).dept = s.dept;
        });
    });
    const staffNames = [...allStaff.keys()].sort();
    // Group by department
    const deptGroups = {};
    staffNames.forEach(name => {
        const dept = allStaff.get(name).dept || 'Other';
        if (!deptGroups[dept]) deptGroups[dept] = [];
        deptGroups[dept].push(name);
    });
    const deptOrder = Object.keys(deptGroups).sort((a, b) => a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b));

    // Weekly totals
    let weekHours = 0, weekCost = 0;
    days.forEach(d => {
        const actual = td.weeklyActual && td.weeklyActual[d];
        if (actual) { weekHours += actual.hours; weekCost += actual.cost; }
        else { (td.weeklyRoster[d] || []).forEach(s => { weekHours += Number(s.hours) || 0; }); }
    });

    let html = '<div style="max-width:1100px;margin:auto;">';
    html += '<div style="margin-bottom:12px;">' + tabPills + '</div>';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">';
    html += '<div><h2 style="margin:0;">⏱️ Live Roster</h2><div style="font-size:13px;color:var(--text-muted);margin-top:2px;">Week of ' + days[0] + ' to ' + days[6] + ' · ' + staffNames.length + ' staff · ' + weekHours.toFixed(0) + 'h' + (weekCost > 0 ? ' · $' + weekCost.toFixed(0) : '') + '</div></div>';
    html += '<div style="display:flex;gap:8px;"><button onclick="window.showLoadingOverlay(\'Refreshing Tanda...\');window.loadTandaData().then(()=>window.hideLoadingOverlay())" class="btn btn-outline" style="font-size:12px;">🔄 Refresh</button></div>';
    html += '</div>';

    // Leave & unavailability alerts
    if ((td.upcomingLeave || []).length > 0 || (td.unavailability || []).length > 0) {
        html += '<div class="card" style="padding:12px;margin-bottom:12px;border-left:4px solid var(--orange);">';
        (td.upcomingLeave || []).slice(0, 4).forEach(function(l) { html += '<div style="font-size:12px;color:var(--orange);margin-bottom:3px;">🏖️ ' + E(l.name) + ' — ' + E(l.type) + ' (' + l.from + ' to ' + l.to + ') <span style="color:var(--text-muted);">' + E(l.status) + '</span></div>'; });
        (td.unavailability || []).slice(0, 4).forEach(function(u) { html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:3px;">🚫 ' + E(u.name) + ' unavailable ' + u.from + ' to ' + u.to + (u.reason ? ' — ' + E(u.reason) : '') + '</div>'; });
        html += '</div>';
    }

    // Weekly grid table
    html += '<div class="card" style="padding:0;overflow-x:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px;">';
    html += '<thead><tr style="background:#0a0a0c;"><th style="padding:8px 10px;text-align:left;color:var(--text-muted);font-size:11px;width:120px;border-bottom:1px solid var(--border);">STAFF</th>';
    days.forEach(function(d, i) {
        var isToday = d === todayStr;
        var bg = isToday ? 'background:rgba(139,92,246,0.15);' : '';
        var dayCount = (td.weeklyRoster[d] || []).length;
        html += '<th style="padding:8px 6px;text-align:center;font-size:11px;color:' + (isToday ? 'var(--purple)' : 'var(--text-muted)') + ';border-bottom:1px solid var(--border);' + bg + '">' + dayNames[i] + '<br><span style="font-size:10px;font-weight:normal;">' + d.slice(5) + '</span><br><span style="font-size:10px;font-weight:normal;color:var(--text-muted);">' + dayCount + ' staff</span></th>';
    });
    html += '</tr></thead><tbody>';

    var deptColors = { 'FOH': 'var(--blue)', 'BOH': 'var(--orange)', 'Kitchen': 'var(--orange)', 'Kitchen Hand': 'var(--orange)', 'Bar': 'var(--purple)', 'Management': 'var(--green)' };
    deptOrder.forEach(function(dept) {
        var deptColor = deptColors[dept] || 'var(--text-muted)';
        // Department header row
        html += '<tr><td colspan="' + (days.length + 1) + '" style="padding:8px 10px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:' + deptColor + ';background:rgba(255,255,255,0.03);border-bottom:2px solid ' + deptColor + ';">' + E(dept) + ' <span style="font-weight:normal;font-size:11px;color:var(--text-muted);">(' + deptGroups[dept].length + ')</span></td></tr>';
        deptGroups[dept].forEach(function(name) {
            var staffData = allStaff.get(name);
            var shifts = staffData.shifts;
            html += '<tr style="border-bottom:1px solid var(--border);">';
            html += '<td style="padding:6px 10px;font-weight:600;white-space:nowrap;">' + E(name) + '</td>';
            days.forEach(function(d) {
                var isToday = d === todayStr;
                var bg = isToday ? 'background:rgba(139,92,246,0.08);' : '';
                var s = shifts[d];
                if (s) {
                    html += '<td style="padding:4px 6px;text-align:center;' + bg + '"><div style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);border-radius:4px;padding:3px 4px;font-size:11px;"><div style="font-weight:600;">' + s.start + '-' + s.finish + '</div><div style="font-size:10px;color:var(--text-muted);">' + s.hours + 'h</div></div></td>';
                } else {
                    html += '<td style="padding:4px 6px;text-align:center;' + bg + '"><span style="color:var(--border);">—</span></td>';
                }
            });
            html += '</tr>';
        });
    });

    html += '</tbody></table></div>';

    // Clocked in now
    if ((td.clockedIn || []).length > 0) {
        html += '<div class="card" style="padding:14px;margin-top:12px;border-left:4px solid var(--green);">';
        html += '<div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:8px;">🟢 Currently On Floor (' + td.clockedIn.length + ')</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;">';
        td.clockedIn.forEach(function(c) { html += '<span style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);padding:4px 10px;border-radius:20px;font-size:12px;">' + E(c.name) + (c.since ? ' <span style="color:var(--text-muted);font-size:10px;">since ' + c.since + '</span>' : '') + '</span>'; });
        html += '</div></div>';
    }

    html += '</div>';
    return html;
};

window.renderRosterView = () => {
    const tab = window._rosterTab || 'tanda';
    const tabPills = ['tanda', 'uploads'].map(t => {
        const labels = { tanda: '⏱️ Tanda Live Roster', uploads: '📄 Uploaded Rosters' };
        return '<span class="tag-pill ' + (tab === t ? 'active' : '') + '" onclick="window._rosterTab=\'' + t + '\';window.showView(\'rosters\');">' + labels[t] + '</span>';
    }).join('');

    if (tab === 'tanda') return window._renderTandaRoster(tabPills);

    return `<div style="max-width: 900px; margin: auto;"><div style="margin-bottom:12px;">${tabPills}</div><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px"><div><h2 style="margin:0">📄 Uploaded Rosters</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">Upload weekly roster PDFs or images for staff to view</div></div><label class="btn btn-blue" style="cursor:pointer;">+ Upload Roster PDF/Image<input type="file" id="roster-upload" accept="application/pdf,image/*" style="display:none;" onchange="window.handleRosterUpload(event)"></label></div>${(window.shiftRosters || []).length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">🗓️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No rosters uploaded</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Upload your weekly roster PDF or image for staff to view here</div></div>' : window.shiftRosters.slice().reverse().map((r, i) => {
        let actualIndex = window.shiftRosters.length - 1 - i;
        let displayHtml = '';
        if (r.data) {
            if (r.data.includes('.jpg') || r.data.includes('.png') || r.data.includes('.jpeg') || r.data.includes('image')) { displayHtml = `<img src="${window.safeUrl(r.data)}" style="max-width:100%; border-radius:8px; margin-bottom:10px; border:1px solid var(--border);">`; }
            else { displayHtml = `<iframe src="${window.safeUrl(r.data)}" style="width:100%; height:600px; border:none; border-radius:8px; margin-bottom:10px; border:1px solid var(--border);"></iframe>`; }
        }
        return `<div class="card" style="margin-bottom:14px; border-top: 4px solid var(--blue); padding:18px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><div><strong style="font-size:22px; color:var(--brand-dark);">${esc(r.name)}</strong><br><small style="color:var(--text-muted); margin-top:5px; display:block;">Uploaded: ${r.date}</small></div><div style="display:flex; gap:10px;">${r.data ? `<a href="${r.data}" target="_blank" download="${esc(r.name)}" class="btn btn-outline" style="text-decoration:none;">Download / Fullscreen</a>` : ''}<button onclick="window.deleteRoster(${actualIndex})" class="btn btn-red">Delete</button></div></div>${displayHtml}</div>`;
    }).join('')}</div>`;
};
window.handleRosterUpload = async (e) => {
    if(!e.target.files.length) return;
    const file = e.target.files[0];
    const defaultName = file.name.split('.')[0];
    window._pendingRosterFile = file;
    window.openModal('🗓️ Name This Roster', `
        <p style="margin:0 0 12px;color:var(--text-muted);font-size:13px;">Give this roster week a name (e.g. "Week 12 March")</p>
        <input type="text" id="_roster-name" class="input-box" value="${window.escAttr(defaultName)}" style="font-size:14px;padding:10px;margin:0 0 16px;">
        <div style="display:flex;gap:10px;">
            <button onclick="window._commitRosterUpload()" class="btn btn-green" style="flex:1;padding:10px;">Upload</button>
            <button onclick="window.closeModal();window._pendingRosterFile=null;" class="btn" style="flex:1;padding:10px;">Cancel</button>
        </div>`);
};
window._commitRosterUpload = async () => {
    const weekName = document.getElementById('_roster-name').value.trim();
    if (!weekName) return window.showToast('Name is required.', 'error');
    const file = window._pendingRosterFile; if (!file) return;
    window._pendingRosterFile = null;
    window.closeModal();
    window.showToast("Uploading roster, please wait... ⏳");
    try {
        const fileRef = storage.ref().child('rosters/' + Date.now() + '_' + file.name); await fileRef.put(file); const downloadURL = await fileRef.getDownloadURL();
        window.shiftRosters.push({ name: weekName, date: new Date().toLocaleDateString(), data: downloadURL }); window.saveToDisk(); window.showView('rosters'); window.showToast("Roster uploaded!");
    } catch(err) { window.showToast("Upload failed.", "error"); }
};
window.deleteRoster = (i) => { window.confirmAction({ title:'🗓️ Delete Roster', message:'Delete this roster?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.shiftRosters.splice(i,1); window.saveToDisk(); window.showView('rosters'); } }); };

// =============================================================================
// NOTICEBOARD / ANNOUNCEMENTS
// =============================================================================
window.renderNoticeboardView = () => {
    const E = window.esc;
    const now = new Date();
    const all = (window.announcements || []).slice().sort((a, b) => {
        const pa = {urgent:0,warning:1,info:2}; return (pa[a.priority]||2) - (pa[b.priority]||2) || new Date(b.date) - new Date(a.date);
    });
    const active = all.filter(a => !a.expiry || new Date(a.expiry) >= now);
    const expired = all.filter(a => a.expiry && new Date(a.expiry) < now);

    const priorityStyle = { urgent:'background:rgba(239,68,68,0.1);border-left:4px solid var(--red);', warning:'background:rgba(245,158,11,0.1);border-left:4px solid var(--orange);', info:'background:rgba(59,130,246,0.06);border-left:4px solid var(--blue);' };
    const priorityLabel = { urgent:'🔴 Urgent', warning:'🟠 Important', info:'🔵 Info' };

    const renderCard = (a, idx) => {
        const ackCount = (a.acknowledged || []).length;
        const staffCount = (window.staffDirectory || []).filter(s => s.status !== 'Inactive').length || 1;
        return `<div class="card" style="margin-bottom:12px;padding:16px;${priorityStyle[a.priority]||priorityStyle.info}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
                <div style="flex:1;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                        <span style="font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,0.08);font-weight:600;">${priorityLabel[a.priority]||'Info'}</span>
                        <span style="font-size:11px;color:var(--text-muted);">${E(a.date || '')}</span>
                        ${a.expiry ? '<span style="font-size:11px;color:var(--text-muted);">Expires: '+E(a.expiry)+'</span>' : ''}
                    </div>
                    <h3 style="margin:0 0 6px;font-size:16px;">${E(a.title)}</h3>
                    <p style="margin:0;font-size:14px;color:var(--text-muted);line-height:1.6;white-space:pre-wrap;">${E(a.body || '')}</p>
                    <div style="margin-top:8px;font-size:11px;color:var(--text-muted);">Posted by ${E(a.author||'Manager')} · ${ackCount}/${staffCount} acknowledged</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button onclick="window.acknowledgeAnnouncement('${E(a.id)}')" class="btn btn-outline" style="font-size:11px;padding:5px 10px;">✅ Ack</button>
                    <button onclick="window.editAnnouncement('${E(a.id)}')" class="btn btn-outline" style="font-size:11px;padding:5px 10px;">✏️</button>
                    <button onclick="window.deleteAnnouncement('${E(a.id)}')" class="btn btn-outline" style="font-size:11px;padding:5px 10px;color:var(--red);">✕</button>
                </div>
            </div>
        </div>`;
    };

    const activeHtml = active.length > 0 ? active.map(renderCard).join('') : '<div style="text-align:center;padding:48px;color:var(--text-muted);"><div style="font-size:36px;margin-bottom:12px;">📢</div><p style="font-size:15px;font-weight:600;color:var(--text-main);">No active announcements</p><p style="font-size:13px;">Post a notice for your team — menu changes, reminders, important updates.</p></div>';

    const expiredHtml = expired.length > 0 ? '<details style="margin-top:20px;"><summary style="cursor:pointer;color:var(--text-muted);font-size:13px;font-weight:600;">Expired Notices (' + expired.length + ')</summary><div style="margin-top:10px;">' + expired.map(renderCard).join('') + '</div></details>' : '';

    return `<div style="max-width:800px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
            <div>
                <h2 style="margin:0;">📢 Noticeboard</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Team announcements, updates & reminders</div>
            </div>
            <button onclick="window.newAnnouncementForm()" class="btn btn-purple" style="padding:10px 20px;">+ Post Notice</button>
        </div>
        ${activeHtml}${expiredHtml}
    </div>`;
};

window.newAnnouncementForm = () => {
    const html = `
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">Title</label>
            <input type="text" id="ann-title" class="input-box" placeholder="e.g. New cocktail menu launching Friday" style="margin:0;">
        </div>
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">Message</label>
            <textarea id="ann-body" class="input-box" placeholder="Details for the team..." style="margin:0;height:100px;"></textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div>
                <label style="font-size:11px;color:var(--text-muted);">Priority</label>
                <select id="ann-priority" class="input-box" style="margin:0;">
                    <option value="info">🔵 Info</option>
                    <option value="warning">🟠 Important</option>
                    <option value="urgent">🔴 Urgent</option>
                </select>
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-muted);">Expires (optional)</label>
                <input type="date" id="ann-expiry" class="input-box" style="margin:0;">
            </div>
        </div>
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">Posted By</label>
            <input type="text" id="ann-author" class="input-box" placeholder="Your name" style="margin:0;">
        </div>
        <button onclick="window.saveAnnouncement()" class="btn btn-green" style="width:100%;padding:12px;">Post Notice</button>`;
    window.openModal('📢 New Announcement', html);
};

window.saveAnnouncement = (editId) => {
    const title = document.getElementById('ann-title').value.trim();
    const body = document.getElementById('ann-body').value.trim();
    const priority = document.getElementById('ann-priority').value;
    const expiry = document.getElementById('ann-expiry').value;
    const author = document.getElementById('ann-author').value.trim();
    if (!title) return window.showToast('Title is required.', 'error');
    if (!window.announcements) window.announcements = [];

    if (editId) {
        const existing = window.announcements.find(a => a.id === editId);
        if (existing) { existing.title = title; existing.body = body; existing.priority = priority; existing.expiry = expiry; existing.author = author || existing.author; }
    } else {
        window.announcements.unshift({
            id: window.generateId('ann'),
            title, body, priority, expiry, author: author || 'Manager',
            date: new Date().toLocaleDateString('en-AU'),
            acknowledged: []
        });
    }
    window.logAudit('announcements', editId ? 'edit' : 'create', editId || '', title);
    window.saveToDisk(); window.closeModal(); window.showView('noticeboard');
    window.showToast(editId ? 'Notice updated.' : 'Notice posted!');
};

window.editAnnouncement = (id) => {
    const a = (window.announcements || []).find(x => x.id === id);
    if (!a) return;
    window.newAnnouncementForm();
    setTimeout(() => {
        document.getElementById('ann-title').value = a.title || '';
        document.getElementById('ann-body').value = a.body || '';
        document.getElementById('ann-priority').value = a.priority || 'info';
        document.getElementById('ann-expiry').value = a.expiry || '';
        document.getElementById('ann-author').value = a.author || '';
        const btn = document.querySelector('#global-modal-content button.btn-green');
        if (btn) { btn.textContent = 'Update Notice'; btn.setAttribute('onclick', "window.saveAnnouncement('" + window.escAttr(id) + "')"); }
    }, 50);
};

window.acknowledgeAnnouncement = (id) => {
    const a = (window.announcements || []).find(x => x.id === id);
    if (!a) return;
    if (!a.acknowledged) a.acknowledged = [];
    const name = prompt('Your name:');
    if (!name) return;
    if (!a.acknowledged.includes(name)) {
        a.acknowledged.push(name);
        window.saveToDisk(); window.showView('noticeboard');
        window.showToast('Acknowledged!');
    } else {
        window.showToast('Already acknowledged.', 'error');
    }
};

window.deleteAnnouncement = (id) => {
    window.confirmAction({ title:'📢 Delete Notice', message:'Remove this announcement?', confirmLabel:'Delete', tier:'standard', onConfirm:() => {
        window.announcements = (window.announcements || []).filter(a => a.id !== id);
        window.logAudit('announcements', 'delete', id, '');
        window.saveToDisk(); window.showView('noticeboard');
    }});
};

// =============================================================================
// KUDOS / RECOGNITION BOARD
// =============================================================================
window.renderKudosCard = () => {
    const E = window.esc;
    const recent = (window.kudos || []).slice(0, 5);
    if (recent.length === 0) return '';
    const items = recent.map(k => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
        <span style="color:var(--purple);font-weight:600;">${E(k.to)}</span> <span style="color:var(--text-muted);">— "${E(k.message)}"</span>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">From ${E(k.from)} · ${E(k.date||'')}</div>
    </div>`).join('');
    return `<div class="card" style="border-top:3px solid var(--purple);padding:16px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <h3 style="margin:0;font-size:15px;">⭐ Team Kudos</h3>
            <button onclick="window.giveKudosForm()" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">+ Give Kudos</button>
        </div>
        ${items}
    </div>`;
};

window.giveKudosForm = () => {
    const staffOpts = (window.staffDirectory || []).filter(s => s.status !== 'Inactive').map(s =>
        '<option value="' + window.escAttr(s.name) + '">' + window.esc(s.name) + '</option>'
    ).join('');
    const html = `
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">Who deserves a shout-out?</label>
            <select id="kudos-to" class="input-box" style="margin:0;">
                <option value="">Select team member...</option>
                ${staffOpts}
            </select>
        </div>
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">What did they do?</label>
            <input type="text" id="kudos-msg" class="input-box" placeholder="e.g. Stayed late to help with deep clean" style="margin:0;">
        </div>
        <div style="margin-bottom:12px;">
            <label style="font-size:11px;color:var(--text-muted);">Your Name</label>
            <input type="text" id="kudos-from" class="input-box" placeholder="Your name" style="margin:0;">
        </div>
        <button onclick="window.saveKudos()" class="btn btn-purple" style="width:100%;padding:12px;">⭐ Send Kudos</button>`;
    window.openModal('⭐ Give Kudos', html);
};

window.saveKudos = () => {
    const to = document.getElementById('kudos-to').value;
    const msg = document.getElementById('kudos-msg').value.trim();
    const from = document.getElementById('kudos-from').value.trim();
    if (!to || !msg || !from) return window.showToast('All fields required.', 'error');
    if (!window.kudos) window.kudos = [];
    window.kudos.unshift({ id: window.generateId('kud'), to, from, message: msg, date: new Date().toLocaleDateString('en-AU') });
    if (window.kudos.length > 100) window.kudos = window.kudos.slice(0, 100);
    window.saveToDisk(); window.closeModal(); window.showView('dashboard');
    window.showToast('Kudos sent to ' + to + '!');
};

// =============================================================================
// AUDIT LOG VIEW
// =============================================================================
window.renderAuditLogView = () => {
    const E = window.esc;
    const logs = (window.auditLog || []).slice(0, 200);
    if (logs.length === 0) {
        return '<div style="max-width:800px;margin:auto;"><h2 style="margin:0 0 16px;">📋 Audit Trail</h2><div class="card" style="text-align:center;padding:48px;"><div style="font-size:36px;margin-bottom:12px;">📋</div><p style="color:var(--text-muted);">No audit entries yet. Changes will be logged automatically.</p></div></div>';
    }
    const actionColors = { create:'var(--green)', edit:'var(--blue)', delete:'var(--red)' };
    const rows = logs.map(l => {
        const d = l.timestamp ? new Date(l.timestamp) : null;
        const timeStr = d ? d.toLocaleDateString('en-AU') + ' ' + d.toLocaleTimeString('en-AU', {hour:'2-digit',minute:'2-digit'}) : '';
        return `<tr style="border-bottom:1px solid var(--border);font-size:13px;">
            <td style="padding:8px 10px;white-space:nowrap;color:var(--text-muted);">${E(timeStr)}</td>
            <td style="padding:8px 10px;"><span style="color:${actionColors[l.action]||'var(--text-main)'};font-weight:600;text-transform:uppercase;font-size:11px;">${E(l.action||'')}</span></td>
            <td style="padding:8px 10px;">${E(l.collection||'')}</td>
            <td style="padding:8px 10px;color:var(--text-muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;">${E(l.details||'')}</td>
        </tr>`;
    }).join('');
    return `<div style="max-width:900px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div><h2 style="margin:0;">📋 Audit Trail</h2><div style="font-size:13px;color:var(--text-muted);margin-top:2px;">All changes tracked automatically</div></div>
            <span style="font-size:13px;color:var(--text-muted);">${logs.length} entries</span>
        </div>
        <div style="overflow-x:auto;"><table style="width:100%;background:var(--card-bg);border-radius:8px;border-collapse:collapse;">
            <thead><tr style="text-align:left;background:#111;border-bottom:1px solid var(--border);font-size:11px;color:var(--text-muted);text-transform:uppercase;">
                <th style="padding:10px;">Time</th><th style="padding:10px;">Action</th><th style="padding:10px;">Area</th><th style="padding:10px;">Details</th>
            </tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
};

// =============================================================================
// ENHANCED HANDOVER PRE-POPULATION
// =============================================================================
window._generateHandoverPrefill = () => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const isWeekend = [0,5,6].includes(now.getDay());
    const sections = (window.handoverTemplateConfig || {}).sections || [];
    const prefills = {};

    sections.forEach(sec => {
        const lower = sec.toLowerCase();

        if (lower.includes('86')) {
            const items86 = (window.inventoryItems || []).filter(i => !i.archived && (i.stock <= 0)).map(i => i.name);
            const recipes86 = (window.recipes || []).filter(r => r.status === "86'd" && !r.archived).map(r => r.name);
            const all86 = [...new Set([...items86, ...recipes86])];
            prefills[sec] = all86.length > 0 ? all86.join(', ') : 'Nothing 86\'d';
        }

        if (lower.includes('stock')) {
            const belowPar = (window.inventoryItems || []).filter(i => {
                if (i.archived) return false;
                const par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
                return par > 0 && i.stock < par;
            }).slice(0, 10).map(i => {
                const par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
                return i.name + ' (' + Number(i.stock || 0).toFixed(1) + '/' + par + ')';
            });
            prefills[sec] = belowPar.length > 0 ? 'Below PAR: ' + belowPar.join(', ') : 'All stock at or above PAR levels.';
        }

        if (lower.includes('issue') || lower.includes('follow')) {
            const parts = [];
            // Open maintenance tickets
            const openTickets = (window.defectLogs || []).filter(d => d.status !== 'Resolved');
            if (openTickets.length > 0) parts.push('Open maintenance: ' + openTickets.map(d => d.item || d.description || 'Ticket').join(', '));
            // Today's incidents
            const todayIncidents = (window.incidentLogs || []).filter(i => i.time && i.time.includes(todayStr));
            if (todayIncidents.length > 0) parts.push('Incidents today: ' + todayIncidents.length);
            // Temp breaches
            const breaches = (window.tempLogs || []).filter(t => t.time && t.time.includes(todayStr) && parseFloat(t.value) > 5);
            if (breaches.length > 0) parts.push('Temp breaches: ' + breaches.map(t => (t.unit || 'Unit') + ' ' + t.value + '°C').join(', '));
            prefills[sec] = parts.length > 0 ? parts.join('\n') : '';
        }

        if (lower.includes('service summary')) {
            const parts = [];
            const todaySales = (window.salesData || []).find(s => s.date === now.toLocaleDateString('en-AU'));
            if (todaySales) {
                parts.push('Revenue: $' + Number(todaySales.total || 0).toLocaleString());
                if (todaySales.covers) parts.push('Covers: ' + todaySales.covers);
            }
            // Today's wastage
            const todayWaste = (window.wastageLogs || []).filter(w => w.time && w.time.includes(todayStr));
            const wasteTotal = todayWaste.reduce((s, w) => s + Number(w.value || 0), 0);
            if (wasteTotal > 0) parts.push('Wastage: $' + wasteTotal.toFixed(2));
            prefills[sec] = parts.length > 0 ? parts.join(' · ') : '';
        }

        if (lower.includes('opening') || lower.includes('tomorrow')) {
            // Check for upcoming tasks due
            const overdue = (window.rotationalTasks || []).filter(t => {
                if (t.dueDateMode === 'specific' && t.specificDueDate) return new Date(t.specificDueDate) <= new Date(now.getTime() + 86400000);
                return false;
            }).map(t => t.name);
            if (overdue.length > 0) prefills[sec] = 'Tasks due: ' + overdue.join(', ');
        }
    });
    return prefills;
};

// =============================================================================
// AI MORNING BRIEFING
// =============================================================================
window._renderBriefingCard = (briefing) => {
    const E = window.esc;
    const htmlText = E(briefing.text || '').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    return `<div class="card" style="border-top:3px solid var(--purple);padding:20px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:13px;font-weight:700;">🌅 Today's Briefing</div>
            <div style="display:flex;gap:6px;">
                <button onclick="window.generateMorningBriefing()" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">🔄 Refresh</button>
                <button onclick="document.getElementById('ai-briefing-container').innerHTML=''" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">Dismiss</button>
            </div>
        </div>
        <div style="font-size:13px;line-height:1.8;color:var(--text-main);">${htmlText}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:10px;">Generated ${E(briefing.time || '')}</div>
    </div>`;
};

window._collectBriefingContext = () => {
    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const fmtDate = (d) => d.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    const isWeekend = [0,5,6].includes(now.getDay());
    const dayName = now.toLocaleDateString('en-AU',{weekday:'long'});
    const venue = window.getCurrentVenue ? window.getCurrentVenue().name : 'the venue';

    // Yesterday's sales
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const ySales = (window.salesData||[]).find(s => s.date === fmtDate(yesterday));
    const yRev = ySales ? Number(ySales.total||0) : null;
    const yCovers = ySales ? Number(ySales.covers||0) : null;

    // Last week same day
    const lwDate = new Date(now); lwDate.setDate(lwDate.getDate() - 7);
    const lwSales = (window.salesData||[]).find(s => s.date === fmtDate(lwDate));
    const lwRev = lwSales ? Number(lwSales.total||0) : null;

    // Stock health
    const activeItems = (window.inventoryItems||[]).filter(i => !i.archived);
    const lowStock = activeItems.filter(i => {
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return par > 0 && i.stock < par;
    }).slice(0,10);
    const zeroStock = activeItems.filter(i => (i.stock||0) <= 0);

    // Overdue tasks
    const overdueTasks = (window.rotationalTasks||[]).filter(t => {
        if (t.dueDateMode === 'specific' && t.specificDueDate) return new Date(t.specificDueDate) <= now;
        if (t.lastLogIso) { const days = (now - new Date(t.lastLogIso))/86400000; const freq = {Weekly:7,Fortnightly:14,Monthly:30,Quarterly:90}; return days >= (freq[t.freq]||7); }
        return false;
    });

    // Expiring docs
    const expiringDocs = (window.digitalSafe||[]).filter(d => {
        if (!d.expiry) return false; const dl = (new Date(d.expiry)-now)/86400000; return dl <= 14;
    });

    // Open maintenance
    const openTickets = (window.defectLogs||[]).filter(d => d.status !== 'Resolved');

    // Today's roster from Tanda
    const tandaInfo = window._tandaData ? `Rostered: ${window._tandaData.staffCount} staff, ${window._tandaData.rosteredHours}h, est wages $${window._tandaData.estimatedWageCost}` : 'No Tanda data';

    // Suppliers delivering today
    const todayDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()];
    const deliveringToday = (window.suppliers||[]).filter(s => s.deliveryDays && s.deliveryDays.includes(todayDay));

    // Recent wastage
    const recentWaste = (window.wastageLogs||[]).filter(w => {
        if (!w.time) return false;
        const d = new Date(w.time); return (now - d) < 86400000*2;
    });
    const wasteTotal = recentWaste.reduce((s,w) => s + Number(w.value||0), 0);

    // Latest handover
    const lastHandover = (window.handoverLogs||[]).slice(-1)[0];
    const handoverSummary = lastHandover ? `Last handover (${lastHandover.date||'?'} ${lastHandover.shift||''}): ${(lastHandover.debrief||lastHandover.notes||'').substring(0,150)}` : 'No recent handover';

    // Upcoming leave from Tanda
    const leaveInfo = window._tandaLeave ? window._tandaLeave.slice(0,3).map(l => `${l.name}: ${l.type} (${l.startDate})`).join('; ') : '';

    return { venue, dayName, isWeekend, yRev, yCovers, lwRev, lowStock, zeroStock, overdueTasks, expiringDocs, openTickets, tandaInfo, deliveringToday, wasteTotal, handoverSummary, leaveInfo };
};

window.generateMorningBriefing = async () => {
    const apiKey = window.getApiKey();
    if (!apiKey) return;

    const container = document.getElementById('ai-briefing-container');
    if (container) container.innerHTML = '<div class="card" style="border-top:3px solid var(--purple);padding:20px;margin-bottom:16px;"><div style="display:flex;align-items:center;gap:10px;"><div class="loading-spinner" style="width:20px;height:20px;border:2px solid var(--border);border-top-color:var(--purple);border-radius:50%;animation:spin 0.8s linear infinite;"></div><span style="color:var(--purple);font-weight:600;">Generating your morning briefing...</span></div></div>';

    const ctx = window._collectBriefingContext();

    const prompt = `You are the AI assistant for ${ctx.venue}, a hospitality venue in Hobart, Tasmania. Write a concise, actionable morning briefing for the manager opening today (${ctx.dayName}, ${ctx.isWeekend ? 'weekend' : 'weekday'}).

DATA:
- Yesterday's revenue: ${ctx.yRev !== null ? '$'+ctx.yRev.toLocaleString() : 'Not recorded'}
- Yesterday's covers: ${ctx.yCovers || 'Not recorded'}
- Same day last week revenue: ${ctx.lwRev !== null ? '$'+ctx.lwRev.toLocaleString() : 'Not recorded'}
- Items at zero stock: ${ctx.zeroStock.length > 0 ? ctx.zeroStock.map(i=>i.name).join(', ') : 'None'}
- Items below PAR (${ctx.lowStock.length}): ${ctx.lowStock.map(i=>i.name+' ('+Number(i.stock).toFixed(1)+')').join(', ') || 'All good'}
- Overdue tasks (${ctx.overdueTasks.length}): ${ctx.overdueTasks.map(t=>t.name).join(', ') || 'None'}
- Expiring documents (${ctx.expiringDocs.length}): ${ctx.expiringDocs.map(d=>d.name).join(', ') || 'None'}
- Open maintenance tickets (${ctx.openTickets.length}): ${ctx.openTickets.map(d=>d.item||d.description||'Ticket').join(', ') || 'None'}
- Roster: ${ctx.tandaInfo}
- Suppliers delivering today: ${ctx.deliveringToday.map(s=>s.name + ' (cutoff '+s.cutoff+')').join(', ') || 'None'}
- Recent wastage (48h): $${ctx.wasteTotal.toFixed(2)}
- ${ctx.handoverSummary}
${ctx.leaveInfo ? '- Upcoming leave: ' + ctx.leaveInfo : ''}

INSTRUCTIONS:
1. Start with a one-line greeting based on time of day and day of week
2. Give 3-5 bullet points covering the most important things to focus on today
3. Flag any urgent items (zero stock, overdue tasks, expired docs, maintenance)
4. If revenue data exists, compare yesterday vs last week and note the trend
5. Mention supplier cutoff times if deliveries are today
6. Keep it under 200 words, punchy and practical
7. End with a motivational one-liner for the day ahead`;

    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate briefing.';

        const briefing = {
            id: window.generateId('brief'),
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('en-AU', {hour:'2-digit',minute:'2-digit'}),
            text: text,
            venue: window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'
        };

        if (!window.dailyBriefings) window.dailyBriefings = [];
        // Replace today's existing briefing or add new
        window.dailyBriefings = window.dailyBriefings.filter(b => b.date !== briefing.date);
        window.dailyBriefings.unshift(briefing);
        if (window.dailyBriefings.length > 14) window.dailyBriefings = window.dailyBriefings.slice(0, 14);
        window.saveToDisk();

        if (container) container.innerHTML = window._renderBriefingCard(briefing);
    } catch (err) {
        if (container) container.innerHTML = '<div class="card" style="border-left:4px solid var(--red);padding:12px;color:var(--red);margin-bottom:16px;">Briefing failed: ' + window.esc(err.message) + '</div>';
    }
};

// =============================================================================
// END-OF-DAY SUMMARY
// =============================================================================
window.generateEodSummary = async () => {
    const apiKey = window.getApiKey();
    if (!apiKey) return;

    window.showLoadingOverlay('Compiling end-of-day summary...');

    const now = new Date();
    const todayStr = now.toLocaleDateString();
    const fmtDate = (d) => d.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    const isWeekend = [0,5,6].includes(now.getDay());
    const venue = window.getCurrentVenue ? window.getCurrentVenue().name : 'the venue';

    // Today's data
    const todaySales = (window.salesData||[]).find(s => s.date === fmtDate(now));
    const todayRev = todaySales ? Number(todaySales.total||0) : 0;
    const todayCovers = todaySales ? Number(todaySales.covers||0) : 0;
    const todayWages = todaySales ? Number(todaySales.wages||0) : 0;
    const laborPct = todayRev > 0 ? ((todayWages/todayRev)*100).toFixed(1) : '—';

    // Wastage
    const todayWaste = (window.wastageLogs||[]).filter(w => w.time && w.time.includes(todayStr));
    const wasteTotal = todayWaste.reduce((s,w) => s + Number(w.value||0), 0);

    // Compliance
    const todayTemps = (window.tempLogs||[]).filter(t => t.time && t.time.includes(todayStr));
    const breaches = todayTemps.filter(t => parseFloat(t.value) > 5);

    // Incidents
    const todayIncidents = (window.incidentLogs||[]).filter(i => i.time && i.time.includes(todayStr));

    // Stock status
    const lowStock = (window.inventoryItems||[]).filter(i => {
        if (i.archived) return false;
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return par > 0 && i.stock < par;
    });
    const zeroItems = (window.inventoryItems||[]).filter(i => !i.archived && (i.stock||0) <= 0);

    // Tanda actuals
    const tandaInfo = window._tandaData || {};

    // Last week comparison
    const lwDate = new Date(now); lwDate.setDate(lwDate.getDate() - 7);
    const lwSales = (window.salesData||[]).find(s => s.date === fmtDate(lwDate));
    const lwRev = lwSales ? Number(lwSales.total||0) : 0;
    const revDelta = lwRev > 0 && todayRev > 0 ? ((todayRev - lwRev)/lwRev*100).toFixed(1) : null;

    const context = `Venue: ${venue}
Date: ${fmtDate(now)} (${now.toLocaleDateString('en-AU',{weekday:'long'})})
Revenue: $${todayRev.toLocaleString()} ${revDelta ? '('+( Number(revDelta)>=0?'+':'')+revDelta+'% vs last week)' : ''}
Covers: ${todayCovers || 'Not recorded'}
Labor cost: $${todayWages.toLocaleString()} (${laborPct}%)
${tandaInfo.actualHours ? 'Actual hours: '+tandaInfo.actualHours+'h ('+tandaInfo.actualStaffCount+' staff)' : ''}
Wastage: $${wasteTotal.toFixed(2)} (${todayWaste.length} items)
Temp logs: ${todayTemps.length} recorded, ${breaches.length} breaches
Incidents: ${todayIncidents.length}
Stock: ${lowStock.length} below PAR, ${zeroItems.length} at zero
86'd items: ${zeroItems.slice(0,5).map(i=>i.name).join(', ') || 'None'}`;

    const prompt = `You are writing a concise end-of-day summary for ${venue}.

DATA:
${context}

Write a structured EOD summary with these sections:
1. 📊 Revenue & Performance (compare to last week if data available)
2. 👥 Labor (hours, cost, percentage)
3. 📦 Stock Status (items at zero, below PAR count)
4. ⚠️ Issues (breaches, incidents, wastage)
5. ✅ Action Items for Tomorrow (3-5 bullet points based on the data)

Keep it factual, concise, under 250 words. Use numbers throughout. This will be shared with the ownership team.`;

    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Could not generate summary.';
        window.hideLoadingOverlay();

        const htmlText = window.esc(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        const modalHtml = `
            <div style="max-height:60vh;overflow-y:auto;margin-bottom:16px;">
                <div style="font-size:13px;line-height:1.8;color:var(--text-main);">${htmlText}</div>
            </div>
            <div style="display:flex;gap:8px;">
                <button onclick="window._copyEodSummary()" class="btn btn-green" style="flex:1;padding:10px;">📋 Copy to Clipboard</button>
                <button onclick="window._saveEodToHandover()" class="btn btn-purple" style="flex:1;padding:10px;">📝 Save as Handover</button>
                <button onclick="window.closeModal()" class="btn" style="flex:1;padding:10px;">Close</button>
            </div>`;
        window._lastEodText = text;
        window.openModal('📊 End-of-Day Summary — ' + fmtDate(now), modalHtml);
    } catch (err) {
        window.hideLoadingOverlay();
        window.showToast('EOD summary failed: ' + err.message, 'error');
    }
};

window._copyEodSummary = () => {
    if (window._lastEodText) {
        navigator.clipboard.writeText(window._lastEodText).then(() => {
            window.showToast('Summary copied to clipboard!');
        }).catch(() => {
            // Fallback for iPad
            const ta = document.createElement('textarea');
            ta.value = window._lastEodText;
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy'); ta.remove();
            window.showToast('Summary copied!');
        });
    }
};

window._saveEodToHandover = () => {
    const now = new Date();
    if (!window._lastEodText) return;
    window.handoverLogs.push({
        date: now.toLocaleDateString('en-AU'),
        shift: 'PM Shift',
        manager: 'AI Summary',
        debrief: window._lastEodText,
        closeTime: String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0'),
        notes: 'Auto-generated EOD summary'
    });
    window.saveToDisk();
    window.closeModal();
    window.showToast('EOD summary saved to handover log!');
};

// =============================================================================
// ANOMALY DETECTION ENGINE
// =============================================================================
window.runAnomalyDetection = async () => {
    const apiKey = window.getApiKey();
    if (!apiKey) return;

    window.showLoadingOverlay('Scanning for anomalies...');

    const now = new Date();
    const fmtDate = (d) => d.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    const venue = window.getCurrentVenue ? window.getCurrentVenue().name : 'the venue';

    // Collect 14 days of sales
    const salesHistory = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const s = (window.salesData||[]).find(x => x.date === fmtDate(d));
        salesHistory.push({
            date: fmtDate(d),
            day: d.toLocaleDateString('en-AU',{weekday:'short'}),
            revenue: s ? Number(s.total||0) : null,
            covers: s ? Number(s.covers||0) : null,
            wages: s ? Number(s.wages||0) : null,
            laborPct: s && Number(s.total||0) > 0 ? ((Number(s.wages||0)/Number(s.total||0))*100).toFixed(1)+'%' : null
        });
    }

    // Wastage by day (last 14 days)
    const wasteByDay = {};
    (window.wastageLogs||[]).forEach(w => {
        if (!w.time) return;
        const d = new Date(w.time);
        if ((now - d) > 86400000*14) return;
        const key = d.toLocaleDateString('en-AU');
        wasteByDay[key] = (wasteByDay[key]||0) + Number(w.value||0);
    });

    // Stock movement patterns
    const bigMovements = (window.stockMovements||[]).slice(0,50).map(m => `${m.item||'?'}: ${m.source||'?'} (${Number(m.delta||0).toFixed(1)}) on ${m.date||'?'}`);

    // Temperature anomalies
    const tempData = (window.tempLogs||[]).slice(-50).map(t => `${t.unit||'Unit'}: ${t.value}°C at ${t.time||'?'}`);
    const breachCount = (window.tempLogs||[]).filter(t => {
        if (!t.time) return false;
        const d = new Date(t.time); return (now - d) < 86400000*7 && parseFloat(t.value) > 5;
    }).length;

    // Depletion patterns
    const recentDepletions = (window.depletionLogs||[]).slice(0,10).map(d => `${d.date||'?'}: ${(d.changes||[]).length} items depleted, source: ${d.source||'?'}`);

    const prompt = `You are an operations analyst for ${venue}. Analyse the following 14 days of data and identify anomalies, unusual patterns, or concerns.

SALES DATA (last 14 days, newest first):
${salesHistory.map(s => `${s.date} (${s.day}): ${s.revenue !== null ? '$'+s.revenue : 'NO DATA'} rev, ${s.covers||'?'} covers, ${s.wages !== null ? '$'+s.wages : '?'} wages ${s.laborPct ? '('+s.laborPct+' labor)' : ''}`).join('\n')}

WASTAGE BY DAY:
${Object.entries(wasteByDay).map(([k,v]) => `${k}: $${v.toFixed(2)}`).join('\n') || 'No wastage data'}

TEMPERATURE BREACHES (7 days): ${breachCount}

RECENT STOCK MOVEMENTS:
${bigMovements.slice(0,10).join('\n') || 'None'}

INSTRUCTIONS:
1. Identify 3-5 specific anomalies or patterns
2. For each, explain what you found and why it matters
3. Rate each as 🔴 Critical, 🟠 Warning, or 🔵 Info
4. Suggest a specific action for each
5. Look for: revenue drops, labor cost spikes, wastage patterns, missing data days, temperature issues, unusual stock movements
6. Be specific with numbers and dates
7. Keep under 300 words total`;

    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No anomalies detected.';
        window.hideLoadingOverlay();

        const htmlText = window.esc(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        window.openModal('🔍 Anomaly Detection Report', `
            <div style="max-height:60vh;overflow-y:auto;margin-bottom:16px;">
                <div style="font-size:13px;line-height:1.8;color:var(--text-main);">${htmlText}</div>
            </div>
            <div style="display:flex;gap:8px;">
                <button onclick="navigator.clipboard.writeText(window._lastAnomalyText||'');window.showToast('Copied!')" class="btn btn-outline" style="flex:1;padding:10px;">📋 Copy</button>
                <button onclick="window.closeModal()" class="btn btn-purple" style="flex:1;padding:10px;">Close</button>
            </div>`);
        window._lastAnomalyText = text;
    } catch (err) {
        window.hideLoadingOverlay();
        window.showToast('Anomaly scan failed: ' + err.message, 'error');
    }
};

// =============================================================================
// ASK HUB — NATURAL LANGUAGE QUERY INTERFACE
// =============================================================================
window.renderAskHubView = () => {
    const history = window._askHubHistory || [];
    const historyHtml = history.length > 0 ? history.map(h => `
        <div style="margin-bottom:16px;">
            <div style="padding:10px 14px;background:rgba(139,92,246,0.08);border-radius:10px 10px 10px 2px;margin-bottom:6px;font-size:13px;color:var(--purple);font-weight:500;">💬 ${window.esc(h.q)}</div>
            <div style="padding:12px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px 10px 2px 10px;font-size:13px;line-height:1.7;color:var(--text-main);">${window.esc(h.a).replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>
        </div>`).join('') : '<div style="text-align:center;padding:48px 20px;color:var(--text-muted);"><div style="font-size:48px;margin-bottom:12px;">🤖</div><h3 style="color:var(--text-main);margin:0 0 8px;">Ask Hub Anything</h3><p style="font-size:13px;max-width:400px;margin:0 auto;line-height:1.6;">Ask questions about your business in plain English. Hub will search your data and respond with specific answers.</p><div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">' +
        ['What was our busiest day this week?','Which items have the lowest margin?','How much wastage this week?','Who is rostered tomorrow?','What stock needs ordering?','Any compliance issues?'].map(q =>
            '<button onclick="document.getElementById(\'ask-hub-input\').value=\'' + window.escAttr(q) + '\';window.askHub();" class="btn btn-outline" style="font-size:11px;padding:6px 12px;">' + q + '</button>'
        ).join('') + '</div></div>';

    return `<div style="max-width:700px;margin:auto;">
        <div style="margin-bottom:16px;">
            <h2 style="margin:0;">🤖 Ask Hub</h2>
            <div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Ask questions about your venue data in plain English</div>
        </div>
        <div id="ask-hub-history" style="margin-bottom:16px;max-height:55vh;overflow-y:auto;">${historyHtml}</div>
        <div style="display:flex;gap:8px;position:sticky;bottom:0;background:var(--bg-main);padding:10px 0;">
            <input type="text" id="ask-hub-input" class="input-box" placeholder="Ask a question... e.g. What items are below par?" style="margin:0;flex:1;font-size:14px;padding:12px 16px;" onkeydown="if(event.key==='Enter')window.askHub()">
            <button onclick="window.askHub()" class="btn btn-purple" style="padding:12px 20px;white-space:nowrap;">Ask ✨</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px;">
            <button onclick="window.runAnomalyDetection()" class="btn btn-outline" style="font-size:11px;padding:6px 12px;">🔍 Run Anomaly Scan</button>
            <button onclick="window._askHubHistory=[];window.showView('ask-hub');" class="btn btn-outline" style="font-size:11px;padding:6px 12px;">🗑️ Clear History</button>
        </div>
    </div>`;
};

window._askHubHistory = [];

window.askHub = async () => {
    const input = document.getElementById('ask-hub-input');
    if (!input) return;
    const question = input.value.trim();
    if (!question) return;

    const apiKey = window.getApiKey();
    if (!apiKey) return;

    input.value = '';
    input.disabled = true;

    // Add loading state to history
    const historyDiv = document.getElementById('ask-hub-history');
    if (historyDiv) {
        historyDiv.innerHTML += `<div style="margin-bottom:16px;">
            <div style="padding:10px 14px;background:rgba(139,92,246,0.08);border-radius:10px 10px 10px 2px;margin-bottom:6px;font-size:13px;color:var(--purple);font-weight:500;">💬 ${window.esc(question)}</div>
            <div id="ask-hub-loading" style="padding:12px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;font-size:13px;color:var(--text-muted);display:flex;align-items:center;gap:8px;"><div class="loading-spinner" style="width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--purple);border-radius:50%;animation:spin 0.8s linear infinite;"></div> Thinking...</div>
        </div>`;
        historyDiv.scrollTop = historyDiv.scrollHeight;
    }

    // Build data snapshot for context
    const now = new Date();
    const fmtDate = (d) => d.toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'});
    const isWeekend = [0,5,6].includes(now.getDay());
    const venue = window.getCurrentVenue ? window.getCurrentVenue().name : 'the venue';

    // Sales (last 7 days)
    const salesSnap = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const s = (window.salesData||[]).find(x => x.date === fmtDate(d));
        if (s) salesSnap.push(`${fmtDate(d)} (${d.toLocaleDateString('en-AU',{weekday:'short'})}): $${Number(s.total||0)} rev, ${s.covers||0} covers, $${Number(s.wages||0)} wages`);
    }

    // Stock below PAR
    const lowStock = (window.inventoryItems||[]).filter(i => {
        if (i.archived) return false;
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return par > 0 && i.stock < par;
    }).map(i => {
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return `${i.name}: stock ${Number(i.stock||0).toFixed(1)}/${par} (${i.supplier||'no supplier'})`;
    });

    // Recipe margins
    const recipeSnap = (window.recipes||[]).filter(r => r.type==='Menu' && !r.archived && r.price > 0).map(r => `${r.name}: sell $${Number(r.price).toFixed(2)}, cost $${Number(r.cost||0).toFixed(2)}, GP ${r.gp||0}%, ${r.coversPerWeek||0}/wk`);

    // Staff
    const staffSnap = (window.staffDirectory||[]).filter(s => s.status !== 'Inactive').map(s => `${s.name} (${s.role||'Staff'})`);

    // Wastage recent
    const recentWaste = (window.wastageLogs||[]).filter(w => {
        if (!w.time) return false; return (now - new Date(w.time)) < 86400000*7;
    }).map(w => `${w.item||'?'}: $${Number(w.value||0).toFixed(2)} (${w.reason||'no reason'})`);

    // Tasks
    const overdueTasks = (window.rotationalTasks||[]).filter(t => {
        if (t.dueDateMode === 'specific' && t.specificDueDate) return new Date(t.specificDueDate) <= now;
        if (t.lastLogIso) { const days = (now - new Date(t.lastLogIso))/86400000; return days >= ({Weekly:7,Fortnightly:14,Monthly:30,Quarterly:90}[t.freq]||7); }
        return false;
    }).map(t => t.name);

    // Tanda
    const tandaSnap = window._tandaData ? `Rostered: ${window._tandaData.staffCount} staff, ${window._tandaData.rosteredHours}h, $${window._tandaData.estimatedWageCost} wages` : '';

    const prompt = `You are an AI assistant for ${venue} hospitality venue. Answer the following question using ONLY the data provided below. Be specific with numbers and dates. If the data doesn't contain enough info to answer, say so.

QUESTION: "${question}"

VENUE DATA SNAPSHOT:
Sales (last 7 days): ${salesSnap.join(' | ') || 'No sales data'}
Stock below PAR (${lowStock.length}): ${lowStock.slice(0,15).join(' | ') || 'All OK'}
Recipe margins: ${recipeSnap.slice(0,15).join(' | ') || 'No recipes'}
Active staff: ${staffSnap.join(', ') || 'No staff data'}
Recent wastage: ${recentWaste.slice(0,10).join(' | ') || 'None'}
Overdue tasks: ${overdueTasks.join(', ') || 'None'}
Open maintenance: ${(window.defectLogs||[]).filter(d=>d.status!=='Resolved').map(d=>d.item||d.description).join(', ') || 'None'}
Roster: ${tandaSnap || 'No Tanda data'}
Today: ${now.toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} (${isWeekend?'Weekend':'Weekday'})

INSTRUCTIONS: Answer concisely in 2-5 sentences. Use specific numbers. Format key figures in bold with **.`;

    try {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await res.json();
        const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I couldn\'t process that question.';

        window._askHubHistory.push({ q: question, a: answer });
        if (window._askHubHistory.length > 20) window._askHubHistory = window._askHubHistory.slice(-20);

        input.disabled = false;
        window.showView('ask-hub');
        // Scroll to bottom
        setTimeout(() => {
            const hd = document.getElementById('ask-hub-history');
            if (hd) hd.scrollTop = hd.scrollHeight;
            const inp = document.getElementById('ask-hub-input');
            if (inp) inp.focus();
        }, 100);
    } catch (err) {
        input.disabled = false;
        const loadEl = document.getElementById('ask-hub-loading');
        if (loadEl) loadEl.innerHTML = '<span style="color:var(--red);">Error: ' + window.esc(err.message) + '</span>';
    }
};

// =============================================================================
// MY HUB — STAFF SELF-SERVICE PORTAL
// =============================================================================
window.renderMyHubView = () => {
    const E = window.esc;
    const staff = window._activeStaffMember;
    if (!staff) return '<div class="card" style="text-align:center;padding:48px;"><h3>👤 Staff Hub</h3><p style="color:var(--text-muted);">No active staff session. <button onclick="window.showStaffPinEntry()" class="btn btn-purple" style="padding:8px 16px;">Enter PIN</button></p></div>';

    // Run achievement calculation
    window._calculateAchievements(staff);

    // Determine visible cards
    const role = staff.role || 'FOH';
    const config = (window.staffHubConfig||{}).roles || {};
    const roleConfig = config[role] || {};
    const visibleCards = (staff.profileConfig||{}).visibleCards || roleConfig.visibleCards || (window.staffHubConfig||{}).defaultCards || ['shifts','qualifications','announcements','kudos','achievements','feedback','actions'];
    const quickActions = roleConfig.quickActions || (window.staffHubConfig||{}).defaultActions || ['log-temps','wastage','maintenance','incident','sops'];

    // Birthday check
    const today = new Date();
    const bdayMsg = staff.birthday ? (() => {
        const bd = new Date(staff.birthday); const isBday = bd.getDate() === today.getDate() && bd.getMonth() === today.getMonth();
        return isBday ? '<div style="text-align:center;padding:12px;background:rgba(139,92,246,0.1);border-radius:10px;margin-bottom:14px;font-size:14px;">🎂 Happy Birthday, ' + E(staff.name.split(' ')[0]) + '! 🎉</div>' : '';
    })() : '';

    let html = '<div style="max-width:800px;margin:auto;">';
    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">';
    html += '<div>';
    html += '<h2 style="margin:0;">👤 ' + E(staff.name) + '</h2>';
    html += '<div style="font-size:13px;color:var(--text-muted);margin-top:2px;">' + E(role) + ' · ' + E(staff.status||'Active') + '</div>';
    html += '</div>';
    html += '<button onclick="window.lockStaffHub()" class="btn btn-outline" style="padding:8px 16px;font-size:12px;">🔒 Lock</button>';
    html += '</div>';
    html += bdayMsg;

    // Custom fields display
    const cf = staff.customFields || {};
    if (Object.keys(cf).length > 0) {
        html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">';
        Object.entries(cf).forEach(([k,v]) => { html += '<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(139,92,246,0.1);color:var(--purple);border:1px solid rgba(139,92,246,0.2);">' + E(k) + ': ' + E(v) + '</span>'; });
        html += '</div>';
    }

    // Render each visible card
    if (visibleCards.includes('shifts')) html += window._renderMyShiftsCard(staff);
    if (visibleCards.includes('actions')) html += window._renderStaffActionsCard(quickActions);
    if (visibleCards.includes('announcements')) html += window._renderStaffAnnouncementsCard(staff);
    if (visibleCards.includes('qualifications')) html += window._renderMyQualificationsCard(staff);
    if (visibleCards.includes('achievements')) html += window._renderMyAchievementsCard(staff);
    if (visibleCards.includes('kudos')) html += window._renderMyKudosCard(staff);
    if (visibleCards.includes('feedback')) html += window._renderShiftFeedbackCard(staff);
    if (visibleCards.includes('leaderboard')) html += window._renderLeaderboardCard();

    html += '</div>';
    return html;
};

// --- MY SHIFTS CARD ---
window._renderMyShiftsCard = (staff) => {
    const E = window.esc;
    const td = window._tandaData;
    if (!td || !td.weeklyRoster) {
        return '<div class="card" style="padding:16px;border-top:3px solid var(--blue);margin-bottom:14px;"><div style="font-size:13px;font-weight:700;">🗓️ My Shifts</div><p style="font-size:13px;color:var(--text-muted);margin:8px 0 0;">No roster data available. Connect Tanda in Settings.</p></div>';
    }
    const staffName = (staff.name || '').toLowerCase().trim();
    const todayStr = new Date().toISOString().split('T')[0];
    let shiftsHtml = '';
    const weekDays = Object.keys(td.weeklyRoster || {}).sort();
    let foundShifts = 0;
    weekDays.forEach(date => {
        const dayShifts = (td.weeklyRoster[date] || []).filter(s => (s.name || '').toLowerCase().trim() === staffName);
        dayShifts.forEach(s => {
            foundShifts++;
            const isToday = date === todayStr;
            const d = new Date(date);
            const dayLabel = d.toLocaleDateString('en-AU', {weekday:'short', day:'numeric', month:'short'});
            shiftsHtml += '<div style="padding:8px 12px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;' + (isToday?'background:rgba(139,92,246,0.08);border-left:3px solid var(--purple);':'') + '">';
            shiftsHtml += '<div><strong style="font-size:13px;">' + (isToday?'⭐ TODAY':'') + ' ' + dayLabel + '</strong>';
            shiftsHtml += '<div style="font-size:12px;color:var(--text-muted);">' + E(s.department || '') + '</div></div>';
            shiftsHtml += '<div style="text-align:right;font-size:13px;">' + E(s.start || '') + ' — ' + E(s.finish || '') + '<div style="font-size:11px;color:var(--text-muted);">' + (s.hours || '?') + 'h</div></div>';
            shiftsHtml += '</div>';
        });
    });
    // Clocked in status
    let clockedInHtml = '';
    if (td.clockedIn) {
        const ci = td.clockedIn.find(c => (c.name||'').toLowerCase().trim() === staffName);
        if (ci) clockedInHtml = '<div style="padding:8px 12px;background:rgba(16,185,129,0.1);border-radius:6px;font-size:12px;color:var(--green);font-weight:600;margin-top:8px;">✅ Clocked in since ' + E(ci.since || '?') + '</div>';
    }
    return '<div class="card" style="padding:0;overflow:hidden;border-top:3px solid var(--blue);margin-bottom:14px;"><div style="padding:14px 16px;border-bottom:1px solid var(--border);"><div style="font-size:13px;font-weight:700;">🗓️ My Shifts This Week</div></div>' +
        (foundShifts > 0 ? shiftsHtml : '<div style="padding:16px;color:var(--text-muted);font-size:13px;">No shifts rostered this week.</div>') +
        clockedInHtml + '</div>';
};

// --- STAFF QUICK ACTIONS ---
window._renderStaffActionsCard = (actions) => {
    const actionMap = {
        'log-temps': {label:'Log Temps', icon:'🌡️', view:'compliance', color:'var(--blue)'},
        'wastage': {label:'Log Wastage', icon:'🗑️', view:'wastage', color:'var(--orange)'},
        'maintenance': {label:'Report Issue', icon:'🛠️', view:'maintenance', color:'var(--red)'},
        'incident': {label:'Incident', icon:'⚠️', view:'incidents', color:'var(--red)'},
        'sops': {label:'View SOPs', icon:'📚', view:'knowledge', color:'var(--purple)'}
    };
    let html = '<div class="card" style="padding:16px;margin-bottom:14px;"><div style="font-size:13px;font-weight:700;margin-bottom:10px;">⚡ Quick Actions</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;">';
    (actions || []).forEach(key => {
        const a = actionMap[key]; if (!a) return;
        html += '<button onclick="window.showView(\'' + a.view + '\')" style="display:flex;align-items:center;gap:8px;padding:12px;background:var(--bg-main);border:1px solid var(--border);border-radius:8px;color:' + a.color + ';cursor:pointer;font-size:12px;font-weight:600;min-height:48px;" onmouseover="this.style.borderColor=\'' + a.color + '\'" onmouseout="this.style.borderColor=\'var(--border)\'">';
        html += '<span style="font-size:18px;">' + a.icon + '</span>' + a.label + '</button>';
    });
    html += '</div></div>';
    return html;
};

// --- STAFF ANNOUNCEMENTS CARD ---
window._renderStaffAnnouncementsCard = (staff) => {
    const E = window.esc;
    const now = new Date();
    const active = (window.announcements || []).filter(a => !a.expiry || new Date(a.expiry) >= now).slice(0, 5);
    if (active.length === 0) return '';
    const prioColors = {urgent:'var(--red)',warning:'var(--orange)',info:'var(--blue)'};
    let html = '<div class="card" style="padding:16px;border-top:3px solid var(--blue);margin-bottom:14px;"><div style="font-size:13px;font-weight:700;margin-bottom:10px;">📢 Announcements</div>';
    active.forEach(a => {
        const isAcked = (a.acknowledged||[]).includes(staff.name);
        html += '<div style="padding:8px 0;border-bottom:1px dashed var(--border);display:flex;justify-content:space-between;align-items:center;">';
        html += '<div style="display:flex;gap:8px;align-items:center;flex:1;"><span style="width:8px;height:8px;border-radius:50%;background:' + (prioColors[a.priority]||'var(--blue)') + ';flex-shrink:0;"></span>';
        html += '<div><div style="font-size:13px;font-weight:500;">' + E(a.title) + '</div>';
        if (a.body) html += '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + E(a.body.substring(0,80)) + '</div>';
        html += '</div></div>';
        html += isAcked ? '<span style="font-size:11px;color:var(--green);">✅</span>' : '<button onclick="window._staffAckAnnouncement(\'' + window.escAttr(a.id) + '\')" class="btn btn-outline" style="font-size:10px;padding:3px 8px;flex-shrink:0;">Ack</button>';
        html += '</div>';
    });
    html += '</div>';
    return html;
};

window._staffAckAnnouncement = (id) => {
    const a = (window.announcements || []).find(x => x.id === id);
    const staff = window._activeStaffMember;
    if (!a || !staff) return;
    if (!a.acknowledged) a.acknowledged = [];
    if (!a.acknowledged.includes(staff.name)) { a.acknowledged.push(staff.name); window.saveToDisk(); window.showView('my-hub'); window.showToast('Acknowledged!'); }
};

// --- MY QUALIFICATIONS CARD ---
window._renderMyQualificationsCard = (staff) => {
    const E = window.esc;
    const now = new Date();
    const quals = staff.qualifications || {};
    const types = window.qualificationTypes || [];
    if (types.length === 0) return '';
    let html = '<div class="card" style="padding:16px;border-top:3px solid var(--green);margin-bottom:14px;"><div style="font-size:13px;font-weight:700;margin-bottom:10px;">🎓 My Qualifications</div>';
    types.forEach(qt => {
        const q = quals[qt.id];
        let status = 'missing', statusColor = 'var(--text-muted)', statusText = 'Not provided', icon = '⬜';
        if (q) {
            if (qt.expiryRequired && q.expiry) {
                const daysLeft = (new Date(q.expiry) - now) / 86400000;
                if (daysLeft < 0) { status='expired'; statusColor='var(--red)'; statusText='EXPIRED'; icon='🔴'; }
                else if (daysLeft <= 30) { status='expiring'; statusColor='var(--orange)'; statusText='Expires in '+Math.ceil(daysLeft)+'d'; icon='🟠'; }
                else if (daysLeft <= 90) { status='soon'; statusColor='var(--orange)'; statusText='Expires in '+Math.ceil(daysLeft)+'d'; icon='🟡'; }
                else { status='current'; statusColor='var(--green)'; statusText='Valid until '+q.expiry; icon='🟢'; }
            } else if (q.verified) { status='verified'; statusColor='var(--green)'; statusText='Verified'; icon='🟢'; }
            else { status='pending'; statusColor='var(--orange)'; statusText='Pending'; icon='🟡'; }
        }
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed var(--border);">';
        html += '<span style="font-size:13px;">' + icon + ' ' + E(qt.name) + '</span>';
        html += '<span style="font-size:12px;color:' + statusColor + ';font-weight:600;">' + statusText + '</span>';
        html += '</div>';
    });
    html += '</div>';
    return html;
};

// --- MY KUDOS CARD ---
window._renderMyKudosCard = (staff) => {
    const E = window.esc;
    const received = (window.kudos || []).filter(k => (k.to||'').toLowerCase().trim() === (staff.name||'').toLowerCase().trim()).slice(0, 5);
    let html = '<div class="card" style="padding:16px;border-top:3px solid var(--purple);margin-bottom:14px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">';
    html += '<div style="font-size:13px;font-weight:700;">⭐ My Kudos (' + received.length + ')</div>';
    html += '<button onclick="window.giveKudosForm()" class="btn btn-outline" style="font-size:11px;padding:4px 12px;">+ Give Kudos</button>';
    html += '</div>';
    if (received.length === 0) { html += '<p style="font-size:13px;color:var(--text-muted);">No kudos received yet. Keep up the great work!</p>'; }
    else { received.forEach(k => {
        html += '<div style="padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px;">"' + E(k.message) + '" <span style="color:var(--text-muted);">— from ' + E(k.from) + ' · ' + E(k.date||'') + '</span></div>';
    }); }
    html += '</div>';
    return html;
};

// =============================================================================
// ACHIEVEMENT / AWARDS ENGINE
// =============================================================================
window._seedDefaultBadges = () => {
    if ((window.badgeDefinitions||[]).length > 0) return;
    window.badgeDefinitions = [
        { id:'temp-champion', name:'Temp Champion', icon:'🌡️', description:'Logging temperatures consistently', type:'auto', category:'Compliance', metric:'tempLogs', tiers:{bronze:{threshold:10},silver:{threshold:50},gold:{threshold:100}}, active:true },
        { id:'waste-warrior', name:'Waste Warrior', icon:'♻️', description:'Tracking wastage diligently', type:'auto', category:'Compliance', metric:'wastageLogs', tiers:{bronze:{threshold:5},silver:{threshold:25},gold:{threshold:50}}, active:true },
        { id:'kudos-collector', name:'Kudos Collector', icon:'⭐', description:'Recognised by peers', type:'auto', category:'Culture', metric:'kudosReceived', tiers:{bronze:{threshold:5},silver:{threshold:15},gold:{threshold:30}}, active:true },
        { id:'handover-hero', name:'Handover Hero', icon:'📝', description:'Consistent shift handovers', type:'auto', category:'Operations', metric:'handoverLogs', tiers:{bronze:{threshold:5},silver:{threshold:15},gold:{threshold:30}}, active:true },
        { id:'eagle-eye', name:'Eagle Eye', icon:'🛠️', description:'Spotting maintenance issues', type:'auto', category:'Venue', metric:'defectLogs', tiers:{bronze:{threshold:3},silver:{threshold:10},gold:{threshold:25}}, active:true },
        { id:'safety-first', name:'Safety First', icon:'⚠️', description:'Reporting incidents promptly', type:'auto', category:'Safety', metric:'incidentLogs', tiers:{bronze:{threshold:3},silver:{threshold:10},gold:{threshold:20}}, active:true },
        { id:'checklist-pro', name:'Checklist Pro', icon:'✅', description:'Completing compliance checks', type:'auto', category:'Compliance', metric:'complianceLogs', tiers:{bronze:{threshold:10},silver:{threshold:30},gold:{threshold:60}}, active:true }
    ];
    window.saveToDisk();
};

window._countMetricForStaff = (metric, staffName) => {
    const name = (staffName||'').toLowerCase().trim();
    const matchName = (field) => (field||'').toLowerCase().trim() === name;
    switch(metric) {
        case 'tempLogs': return (window.tempLogs||[]).filter(t => matchName(t.staff)).length;
        case 'wastageLogs': return (window.wastageLogs||[]).filter(w => matchName(w.staff)).length;
        case 'kudosReceived': return (window.kudos||[]).filter(k => matchName(k.to)).length;
        case 'handoverLogs': return (window.handoverLogs||[]).filter(h => matchName(h.manager)).length;
        case 'defectLogs': return (window.defectLogs||[]).filter(d => matchName(d.reportedBy || d.staff)).length;
        case 'incidentLogs': return (window.incidentLogs||[]).filter(i => matchName(i.staff || i.reportedBy)).length;
        case 'complianceLogs': return (window.complianceLogs||[]).filter(c => matchName(c.staff)).length;
        default: return 0;
    }
};

window._calculateAchievements = (staff) => {
    window._seedDefaultBadges();
    if (!staff.achievements) staff.achievements = [];
    const badges = (window.badgeDefinitions||[]).filter(b => b.active && b.type === 'auto');
    let newlyEarned = [];
    badges.forEach(badge => {
        const count = window._countMetricForStaff(badge.metric, staff.name);
        const tiers = badge.tiers || {};
        let earnedTier = null;
        if (tiers.gold && count >= tiers.gold.threshold) earnedTier = 'gold';
        else if (tiers.silver && count >= tiers.silver.threshold) earnedTier = 'silver';
        else if (tiers.bronze && count >= tiers.bronze.threshold) earnedTier = 'bronze';
        if (earnedTier) {
            const existing = staff.achievements.find(a => a.badgeId === badge.id);
            if (!existing) {
                staff.achievements.push({ badgeId: badge.id, tier: earnedTier, earnedDate: new Date().toISOString().split('T')[0] });
                newlyEarned.push(badge.icon + ' ' + badge.name + ' (' + earnedTier + ')');
            } else if (['bronze','silver','gold'].indexOf(earnedTier) > ['bronze','silver','gold'].indexOf(existing.tier)) {
                existing.tier = earnedTier; existing.earnedDate = new Date().toISOString().split('T')[0];
                newlyEarned.push(badge.icon + ' ' + badge.name + ' upgraded to ' + earnedTier + '!');
            }
        }
    });
    if (newlyEarned.length > 0) {
        // Update the staff record in directory
        const idx = (window.staffDirectory||[]).findIndex(s => s.name === staff.name);
        if (idx >= 0) { window.staffDirectory[idx].achievements = staff.achievements; window.saveToDisk(); }
        newlyEarned.forEach(msg => window.showToast('🏆 Badge earned: ' + msg));
    }
};

// --- MY ACHIEVEMENTS CARD ---
window._renderMyAchievementsCard = (staff) => {
    const E = window.esc;
    const achievements = staff.achievements || [];
    const allBadges = window.badgeDefinitions || [];
    const tierColors = {bronze:'#CD7F32',silver:'#C0C0C0',gold:'#FFD700',awarded:'var(--purple)'};
    let html = '<div class="card" style="padding:16px;border-top:3px solid #FFD700;margin-bottom:14px;">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:12px;">🏆 Achievements (' + achievements.length + ')</div>';
    if (achievements.length === 0) {
        html += '<p style="font-size:13px;color:var(--text-muted);">No badges earned yet. Complete tasks to unlock achievements!</p>';
    } else {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;">';
        achievements.forEach(a => {
            const badge = allBadges.find(b => b.id === a.badgeId) || {name:a.badgeId, icon:'🏅', description:''};
            const tierColor = tierColors[a.tier] || tierColors.bronze;
            html += '<div style="text-align:center;padding:12px 8px;background:var(--bg-main);border-radius:10px;border:2px solid ' + tierColor + ';">';
            html += '<div style="font-size:28px;">' + badge.icon + '</div>';
            html += '<div style="font-size:11px;font-weight:600;margin-top:4px;">' + E(badge.name) + '</div>';
            html += '<div style="font-size:10px;color:' + tierColor + ';text-transform:uppercase;font-weight:700;">' + E(a.tier) + '</div>';
            html += '</div>';
        });
        html += '</div>';
    }
    // Show progress on unearned badges
    const unearnedBadges = allBadges.filter(b => b.active && b.type === 'auto' && !achievements.find(a => a.badgeId === b.id));
    if (unearnedBadges.length > 0) {
        html += '<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;"><div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Next to earn:</div>';
        unearnedBadges.slice(0, 3).forEach(badge => {
            const count = window._countMetricForStaff(badge.metric, staff.name);
            const target = badge.tiers.bronze ? badge.tiers.bronze.threshold : 10;
            const pct = Math.min(100, Math.round((count / target) * 100));
            html += '<div style="margin-bottom:6px;"><div style="font-size:12px;display:flex;justify-content:space-between;">';
            html += '<span>' + badge.icon + ' ' + E(badge.name) + '</span>';
            html += '<span style="color:var(--text-muted);">' + count + '/' + target + '</span></div>';
            html += '<div style="background:var(--bg-main);border-radius:4px;height:4px;margin-top:3px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:var(--purple);border-radius:4px;"></div></div></div>';
        });
        html += '</div>';
    }
    html += '</div>';
    return html;
};

// =============================================================================
// SHIFT FEEDBACK
// =============================================================================
window._renderShiftFeedbackCard = (staff) => {
    const E = window.esc;
    const today = new Date().toISOString().split('T')[0];
    const todayFeedback = (staff.shiftFeedback || []).find(f => f.date === today);
    let html = '<div class="card" style="padding:16px;border-top:3px solid var(--orange);margin-bottom:14px;">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:10px;">😊 Shift Feedback</div>';
    if (todayFeedback) {
        const emojis = ['😣','😕','😐','🙂','😄'];
        html += '<div style="text-align:center;padding:12px;"><div style="font-size:36px;">' + (emojis[todayFeedback.rating-1]||'😐') + '</div>';
        html += '<div style="font-size:13px;color:var(--text-muted);margin-top:6px;">You rated today\'s shift ' + todayFeedback.rating + '/5</div>';
        if (todayFeedback.tags && todayFeedback.tags.length > 0) html += '<div style="margin-top:6px;display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">' + todayFeedback.tags.map(t => '<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(139,92,246,0.1);color:var(--purple);">' + E(t) + '</span>').join('') + '</div>';
        html += '<div style="font-size:11px;color:var(--green);margin-top:8px;">✅ Feedback submitted — thanks!</div></div>';
    } else {
        html += '<div style="text-align:center;"><p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;">How was your shift today?</p>';
        html += '<div id="mood-btns" style="display:flex;justify-content:center;gap:12px;margin-bottom:12px;">';
        ['😣','😕','😐','🙂','😄'].forEach((emoji, i) => {
            html += '<button onclick="window._selectMood(' + (i+1) + ')" style="font-size:32px;padding:8px;background:var(--bg-main);border:2px solid var(--border);border-radius:12px;cursor:pointer;min-width:52px;min-height:52px;transition:all 0.15s;" onmouseover="this.style.borderColor=\'var(--purple)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' + emoji + '</button>';
        });
        html += '</div>';
        html += '<div id="mood-tags" style="display:none;margin-bottom:12px;">';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">What describes your shift? (optional)</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">';
        (window.shiftFeedbackTags || []).forEach(tag => {
            html += '<button onclick="this.classList.toggle(\'tag-selected\');this.style.background=this.classList.contains(\'tag-selected\')?\'var(--purple)\':\'var(--bg-main)\';this.style.color=this.classList.contains(\'tag-selected\')?\'#fff\':\'var(--text-muted)\';" class="mood-tag" data-tag="' + window.escAttr(tag) + '" style="font-size:11px;padding:5px 12px;border-radius:20px;background:var(--bg-main);border:1px solid var(--border);color:var(--text-muted);cursor:pointer;">' + E(tag) + '</button>';
        });
        html += '</div></div>';
        html += '<div id="mood-note" style="display:none;margin-bottom:12px;"><input type="text" id="mood-note-input" class="input-box" placeholder="Any notes? (optional)" style="margin:0;font-size:13px;"></div>';
        html += '<button id="mood-submit" onclick="window._submitShiftFeedback()" style="display:none;" class="btn btn-purple" style="padding:10px 20px;">Submit Feedback</button>';
        html += '</div>';
    }
    html += '</div>';
    return html;
};

window._selectedMood = 0;
window._selectMood = (rating) => {
    window._selectedMood = rating;
    const tagsEl = document.getElementById('mood-tags');
    const noteEl = document.getElementById('mood-note');
    const submitBtn = document.getElementById('mood-submit');
    if (tagsEl) tagsEl.style.display = 'block';
    if (noteEl) noteEl.style.display = 'block';
    if (submitBtn) { submitBtn.style.display = 'inline-block'; }
    // Highlight selected mood
    const btns = document.querySelectorAll('#mood-btns button');
    btns.forEach((btn, i) => {
        btn.style.borderColor = (i + 1) === rating ? 'var(--purple)' : 'var(--border)';
        btn.style.background = (i + 1) === rating ? 'rgba(139,92,246,0.15)' : 'var(--bg-main)';
    });
};

window._submitShiftFeedback = () => {
    const staff = window._activeStaffMember;
    if (!staff || !window._selectedMood) return;
    const today = new Date().toISOString().split('T')[0];
    const selectedTags = Array.from(document.querySelectorAll('.mood-tag.tag-selected')).map(el => el.dataset.tag);
    const noteInput = document.getElementById('mood-note-input');
    const note = noteInput ? noteInput.value.trim() : '';
    if (!staff.shiftFeedback) staff.shiftFeedback = [];
    staff.shiftFeedback.push({ date: today, rating: window._selectedMood, tags: selectedTags, note: note });
    if (staff.shiftFeedback.length > 90) staff.shiftFeedback = staff.shiftFeedback.slice(-90);
    // Update in staffDirectory
    const idx = (window.staffDirectory||[]).findIndex(s => s.name === staff.name);
    if (idx >= 0) { window.staffDirectory[idx].shiftFeedback = staff.shiftFeedback; window.saveToDisk(); }
    window._selectedMood = 0;
    window.showView('my-hub');
    window.showToast('Thanks for the feedback!');
};

// =============================================================================
// TEAM LEADERBOARD
// =============================================================================
window._renderLeaderboardCard = () => {
    const E = window.esc;
    const activeStaff = (window.staffDirectory || []).filter(s => s.status !== 'Inactive');
    const scores = activeStaff.map(s => ({
        name: s.name, role: s.role || 'Staff',
        badges: (s.achievements || []).length,
        kudos: (window.kudos||[]).filter(k => (k.to||'').toLowerCase().trim() === (s.name||'').toLowerCase().trim()).length
    })).filter(s => s.badges > 0 || s.kudos > 0).sort((a, b) => (b.badges + b.kudos) - (a.badges + a.kudos));
    if (scores.length === 0) return '';
    const medals = ['🥇','🥈','🥉'];
    let html = '<div class="card" style="padding:16px;border-top:3px solid #FFD700;margin-bottom:14px;">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:10px;">🏅 Team Leaderboard</div>';
    scores.slice(0, 8).forEach((s, i) => {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed var(--border);">';
        html += '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:16px;width:24px;text-align:center;">' + (medals[i]||'') + '</span>';
        html += '<div><span style="font-size:13px;font-weight:600;">' + E(s.name) + '</span>';
        html += '<span style="font-size:11px;color:var(--text-muted);margin-left:6px;">' + E(s.role) + '</span></div></div>';
        html += '<div style="display:flex;gap:10px;font-size:12px;"><span>🏆 ' + s.badges + '</span><span>⭐ ' + s.kudos + '</span></div>';
        html += '</div>';
    });
    html += '</div>';
    return html;
};

// =============================================================================
// BADGE MANAGEMENT (Manager View)
// =============================================================================
window.renderBadgeManagementView = () => {
    window._seedDefaultBadges();
    const E = window.esc;
    const badges = window.badgeDefinitions || [];
    let html = '<div style="max-width:900px;margin:auto;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<div><h2 style="margin:0;">🏆 Badge Management</h2><div style="font-size:13px;color:var(--text-muted);margin-top:2px;">Create, edit and award badges to your team</div></div>';
    html += '<div style="display:flex;gap:8px;"><button onclick="window._newBadgeForm(\'auto\')" class="btn btn-purple" style="padding:8px 16px;">+ Auto Badge</button>';
    html += '<button onclick="window._newBadgeForm(\'manual\')" class="btn btn-blue" style="padding:8px 16px;">+ Manual Badge</button></div>';
    html += '</div>';

    badges.forEach((b, i) => {
        const tierColors = {bronze:'#CD7F32',silver:'#C0C0C0',gold:'#FFD700'};
        html += '<div class="card" style="padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;opacity:' + (b.active?'1':'0.5') + ';">';
        html += '<div style="display:flex;gap:12px;align-items:center;flex:1;">';
        html += '<div style="font-size:32px;">' + b.icon + '</div>';
        html += '<div><div style="font-size:14px;font-weight:600;">' + E(b.name) + ' <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:' + (b.type==='auto'?'rgba(16,185,129,0.1)':'rgba(59,130,246,0.1)') + ';color:' + (b.type==='auto'?'var(--green)':'var(--blue)') + ';">' + b.type + '</span></div>';
        html += '<div style="font-size:12px;color:var(--text-muted);">' + E(b.description) + '</div>';
        if (b.type === 'auto' && b.tiers) {
            html += '<div style="display:flex;gap:8px;margin-top:4px;">';
            ['bronze','silver','gold'].forEach(t => {
                if (b.tiers[t]) html += '<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--bg-main);border:1px solid ' + tierColors[t] + ';color:' + tierColors[t] + ';">' + t + ': ' + b.tiers[t].threshold + '</span>';
            });
            html += '</div>';
        }
        html += '</div></div>';
        html += '<div style="display:flex;gap:6px;flex-shrink:0;">';
        if (b.type === 'manual') html += '<button onclick="window._awardBadgeForm(\'' + window.escAttr(b.id) + '\')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">🎁 Award</button>';
        html += '<button onclick="window._editBadgeForm(' + i + ')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">✏️</button>';
        html += '<button onclick="window._toggleBadge(' + i + ')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;">' + (b.active?'⏸️':'▶️') + '</button>';
        html += '<button onclick="window._deleteBadge(' + i + ')" class="btn btn-outline" style="font-size:11px;padding:4px 10px;color:var(--red);">✕</button>';
        html += '</div></div>';
    });
    html += '</div>';
    return html;
};

window._newBadgeForm = (type) => {
    const html = `
        <div style="display:grid;grid-template-columns:auto 1fr;gap:10px;margin-bottom:12px;">
            <div><label style="font-size:11px;color:var(--text-muted);">Icon</label><input type="text" id="badge-icon" class="input-box" value="🏅" style="margin:0;width:60px;font-size:24px;text-align:center;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Name</label><input type="text" id="badge-name" class="input-box" placeholder="e.g. Cocktail Master" style="margin:0;"></div>
        </div>
        <div style="margin-bottom:12px;"><label style="font-size:11px;color:var(--text-muted);">Description</label><input type="text" id="badge-desc" class="input-box" placeholder="What this badge represents" style="margin:0;"></div>
        <div style="margin-bottom:12px;"><label style="font-size:11px;color:var(--text-muted);">Category</label><input type="text" id="badge-cat" class="input-box" placeholder="e.g. Service, Compliance, Culture" style="margin:0;"></div>
        ${type === 'auto' ? `
        <div style="margin-bottom:12px;"><label style="font-size:11px;color:var(--text-muted);">Metric</label>
        <select id="badge-metric" class="input-box" style="margin:0;">
            <option value="tempLogs">Temp Logs</option><option value="wastageLogs">Wastage Logs</option>
            <option value="kudosReceived">Kudos Received</option><option value="handoverLogs">Handover Logs</option>
            <option value="defectLogs">Maintenance Reports</option><option value="incidentLogs">Incident Reports</option>
            <option value="complianceLogs">Compliance Logs</option>
        </select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
            <div><label style="font-size:11px;color:var(--text-muted);">Bronze</label><input type="number" id="badge-bronze" class="input-box" value="5" style="margin:0;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Silver</label><input type="number" id="badge-silver" class="input-box" value="15" style="margin:0;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Gold</label><input type="number" id="badge-gold" class="input-box" value="30" style="margin:0;"></div>
        </div>` : ''}
        <button onclick="window._saveBadge('${type}')" class="btn btn-green" style="width:100%;padding:12px;">Save Badge</button>`;
    window.openModal('🏆 New ' + (type==='auto'?'Auto':'Manual') + ' Badge', html);
};

window._saveBadge = (type, editIdx) => {
    const name = document.getElementById('badge-name').value.trim();
    const icon = document.getElementById('badge-icon').value.trim() || '🏅';
    const desc = document.getElementById('badge-desc').value.trim();
    const cat = document.getElementById('badge-cat').value.trim();
    if (!name) return window.showToast('Name required.', 'error');
    const badge = {
        id: editIdx !== undefined ? (window.badgeDefinitions[editIdx]||{}).id : window.generateId('badge'),
        name, icon, description: desc, category: cat, type, active: true
    };
    if (type === 'auto') {
        badge.metric = document.getElementById('badge-metric').value;
        badge.tiers = {
            bronze: { threshold: parseInt(document.getElementById('badge-bronze').value) || 5 },
            silver: { threshold: parseInt(document.getElementById('badge-silver').value) || 15 },
            gold: { threshold: parseInt(document.getElementById('badge-gold').value) || 30 }
        };
    }
    if (!window.badgeDefinitions) window.badgeDefinitions = [];
    if (editIdx !== undefined) window.badgeDefinitions[editIdx] = badge;
    else window.badgeDefinitions.push(badge);
    window.logAudit('badges', editIdx !== undefined ? 'edit' : 'create', badge.id, name);
    window.saveToDisk(); window.closeModal(); window.showView('badge-management');
    window.showToast('Badge saved!');
};

window._editBadgeForm = (idx) => {
    const b = (window.badgeDefinitions||[])[idx]; if (!b) return;
    window._newBadgeForm(b.type);
    setTimeout(() => {
        document.getElementById('badge-icon').value = b.icon || '🏅';
        document.getElementById('badge-name').value = b.name || '';
        document.getElementById('badge-desc').value = b.description || '';
        document.getElementById('badge-cat').value = b.category || '';
        if (b.type === 'auto' && b.tiers) {
            const metricEl = document.getElementById('badge-metric'); if (metricEl) metricEl.value = b.metric || 'tempLogs';
            const bronzeEl = document.getElementById('badge-bronze'); if (bronzeEl) bronzeEl.value = (b.tiers.bronze||{}).threshold || 5;
            const silverEl = document.getElementById('badge-silver'); if (silverEl) silverEl.value = (b.tiers.silver||{}).threshold || 15;
            const goldEl = document.getElementById('badge-gold'); if (goldEl) goldEl.value = (b.tiers.gold||{}).threshold || 30;
        }
        const btn = document.querySelector('#global-modal-content button.btn-green');
        if (btn) { btn.textContent = 'Update Badge'; btn.setAttribute('onclick', "window._saveBadge('" + b.type + "'," + idx + ")"); }
    }, 50);
};

window._toggleBadge = (idx) => { if (window.badgeDefinitions[idx]) { window.badgeDefinitions[idx].active = !window.badgeDefinitions[idx].active; window.saveToDisk(); window.showView('badge-management'); } };
window._deleteBadge = (idx) => { window.confirmAction({ title:'🏆 Delete Badge', message:'Remove this badge definition?', confirmLabel:'Delete', tier:'standard', onConfirm:() => { window.badgeDefinitions.splice(idx,1); window.saveToDisk(); window.showView('badge-management'); }}); };

window._awardBadgeForm = (badgeId) => {
    const badge = (window.badgeDefinitions||[]).find(b => b.id === badgeId); if (!badge) return;
    const staffOpts = (window.staffDirectory||[]).filter(s => s.status !== 'Inactive').map(s => '<option value="' + window.escAttr(s.name) + '">' + window.esc(s.name) + '</option>').join('');
    const html = `<div style="margin-bottom:12px;"><label style="font-size:11px;color:var(--text-muted);">Award ${window.esc(badge.icon)} ${window.esc(badge.name)} to:</label>
        <select id="award-to" class="input-box" style="margin:0;"><option value="">Select staff...</option>${staffOpts}</select></div>
        <div style="margin-bottom:12px;"><label style="font-size:11px;color:var(--text-muted);">Citation (optional)</label>
        <input type="text" id="award-citation" class="input-box" placeholder="Why they earned this badge" style="margin:0;"></div>
        <button onclick="window._submitAward('${window.escAttr(badgeId)}')" class="btn btn-purple" style="width:100%;padding:12px;">🎁 Award Badge</button>`;
    window.openModal('🎁 Award Badge', html);
};

window._submitAward = (badgeId) => {
    const to = document.getElementById('award-to').value;
    const citation = document.getElementById('award-citation').value.trim();
    if (!to) return window.showToast('Select a staff member.', 'error');
    const staff = (window.staffDirectory||[]).find(s => s.name === to);
    if (!staff) return;
    if (!staff.achievements) staff.achievements = [];
    staff.achievements.push({ badgeId, tier: 'awarded', earnedDate: new Date().toISOString().split('T')[0], citation });
    window.logAudit('badges', 'award', badgeId, 'Awarded to ' + to);
    window.saveToDisk(); window.closeModal(); window.showView('badge-management');
    window.showToast('Badge awarded to ' + to + '!');
};

// =============================================================================
// STAFF HUB CONFIG VIEW (Manager)
// =============================================================================
window.renderStaffHubConfigView = () => {
    const E = window.esc;
    const config = window.staffHubConfig || {};
    const roles = Object.keys(config.roles || {});
    const allCards = ['shifts','qualifications','announcements','kudos','achievements','feedback','actions','leaderboard'];
    const allActions = ['log-temps','wastage','maintenance','incident','sops'];
    const cardLabels = {shifts:'My Shifts',qualifications:'Qualifications',announcements:'Announcements',kudos:'Kudos',achievements:'Achievements',feedback:'Shift Feedback',actions:'Quick Actions',leaderboard:'Leaderboard'};
    const actionLabels = {'log-temps':'Log Temps',wastage:'Log Wastage',maintenance:'Report Issue',incident:'Incidents',sops:'View SOPs'};

    let html = '<div style="max-width:900px;margin:auto;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<div><h2 style="margin:0;">⚙️ Staff Hub Configuration</h2><div style="font-size:13px;color:var(--text-muted);margin-top:2px;">Configure what each role sees in My Hub</div></div>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button onclick="window.showView(\'badge-management\')" class="btn btn-outline" style="padding:8px 16px;">🏆 Badges</button>';
    html += '<button onclick="window._editFeedbackTags()" class="btn btn-outline" style="padding:8px 16px;">😊 Feedback Tags</button>';
    html += '</div></div>';

    roles.forEach(role => {
        const rc = (config.roles||{})[role] || {};
        const vc = rc.visibleCards || [];
        const qa = rc.quickActions || [];
        html += '<div class="card" style="padding:16px;margin-bottom:12px;">';
        html += '<h3 style="margin:0 0 10px;font-size:15px;">' + E(role) + '</h3>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Visible Cards:</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;">';
        allCards.forEach(card => {
            const isOn = vc.includes(card);
            html += '<button onclick="window._toggleRoleCard(\'' + window.escAttr(role) + '\',\'' + card + '\')" style="font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid ' + (isOn?'var(--purple)':'var(--border)') + ';background:' + (isOn?'rgba(139,92,246,0.15)':'var(--bg-main)') + ';color:' + (isOn?'var(--purple)':'var(--text-muted)') + ';cursor:pointer;">' + (cardLabels[card]||card) + '</button>';
        });
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Quick Actions:</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
        allActions.forEach(action => {
            const isOn = qa.includes(action);
            html += '<button onclick="window._toggleRoleAction(\'' + window.escAttr(role) + '\',\'' + action + '\')" style="font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid ' + (isOn?'var(--blue)':'var(--border)') + ';background:' + (isOn?'rgba(59,130,246,0.15)':'var(--bg-main)') + ';color:' + (isOn?'var(--blue)':'var(--text-muted)') + ';cursor:pointer;">' + (actionLabels[action]||action) + '</button>';
        });
        html += '</div></div>';
    });
    html += '</div>';
    return html;
};

window._toggleRoleCard = (role, card) => {
    const config = window.staffHubConfig || {};
    if (!config.roles) config.roles = {};
    if (!config.roles[role]) config.roles[role] = { visibleCards: [...(window.staffHubConfig.defaultCards||[])], quickActions: [...(window.staffHubConfig.defaultActions||[])] };
    const vc = config.roles[role].visibleCards;
    const idx = vc.indexOf(card);
    if (idx >= 0) vc.splice(idx, 1); else vc.push(card);
    window.staffHubConfig = config;
    window.saveToDisk(); window.showView('staff-hub-config');
};

window._toggleRoleAction = (role, action) => {
    const config = window.staffHubConfig || {};
    if (!config.roles) config.roles = {};
    if (!config.roles[role]) config.roles[role] = { visibleCards: [...(window.staffHubConfig.defaultCards||[])], quickActions: [...(window.staffHubConfig.defaultActions||[])] };
    const qa = config.roles[role].quickActions;
    const idx = qa.indexOf(action);
    if (idx >= 0) qa.splice(idx, 1); else qa.push(action);
    window.staffHubConfig = config;
    window.saveToDisk(); window.showView('staff-hub-config');
};

window._editFeedbackTags = () => {
    const tags = (window.shiftFeedbackTags || []).join('\n');
    const html = `<div style="margin-bottom:12px;">
        <label style="font-size:11px;color:var(--text-muted);">One tag per line</label>
        <textarea id="fb-tags" class="input-box" style="height:150px;margin:0;">${window.esc(tags)}</textarea>
    </div>
    <button onclick="window._saveFeedbackTags()" class="btn btn-green" style="width:100%;padding:12px;">Save Tags</button>`;
    window.openModal('😊 Edit Feedback Tags', html);
};

window._saveFeedbackTags = () => {
    const text = document.getElementById('fb-tags').value;
    window.shiftFeedbackTags = text.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    window.saveToDisk(); window.closeModal(); window.showView('staff-hub-config');
    window.showToast('Feedback tags updated!');
};

// =============================================================================
// SHIFT FEEDBACK TRENDS (Manager Dashboard Card)
// =============================================================================
window._renderFeedbackTrendsCard = () => {
    const now = new Date();
    const allFeedback = [];
    (window.staffDirectory || []).forEach(s => {
        (s.shiftFeedback || []).forEach(f => { allFeedback.push({ ...f, staff: s.name }); });
    });
    if (allFeedback.length === 0) return '';

    const last7 = allFeedback.filter(f => { const d = new Date(f.date); return (now - d) < 86400000*7; });
    const last30 = allFeedback.filter(f => { const d = new Date(f.date); return (now - d) < 86400000*30; });
    const avg7 = last7.length > 0 ? (last7.reduce((s,f)=>s+f.rating,0)/last7.length).toFixed(1) : '—';
    const avg30 = last30.length > 0 ? (last30.reduce((s,f)=>s+f.rating,0)/last30.length).toFixed(1) : '—';
    const trend = last7.length > 0 && last30.length > 0 ? (parseFloat(avg7) >= parseFloat(avg30) ? '📈' : '📉') : '';

    // Most common tags
    const tagCounts = {};
    last7.forEach(f => (f.tags||[]).forEach(t => { tagCounts[t] = (tagCounts[t]||0)+1; }));
    const topTags = Object.entries(tagCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);

    let html = '<div class="card" style="padding:16px;margin-bottom:14px;border-top:3px solid var(--orange);">';
    html += '<div style="font-size:13px;font-weight:700;margin-bottom:10px;">😊 Team Mood ' + trend + '</div>';
    html += '<div style="display:flex;gap:20px;margin-bottom:8px;">';
    html += '<div><span style="font-size:22px;font-weight:800;">' + avg7 + '</span><span style="font-size:11px;color:var(--text-muted);"> /5 (7d)</span></div>';
    html += '<div><span style="font-size:22px;font-weight:800;">' + avg30 + '</span><span style="font-size:11px;color:var(--text-muted);"> /5 (30d)</span></div>';
    html += '<div><span style="font-size:22px;font-weight:800;">' + last7.length + '</span><span style="font-size:11px;color:var(--text-muted);"> responses</span></div>';
    html += '</div>';
    if (topTags.length > 0) {
        html += '<div style="display:flex;gap:4px;flex-wrap:wrap;">';
        topTags.forEach(([tag,count]) => { html += '<span style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(245,158,11,0.1);color:var(--orange);">' + window.esc(tag) + ' (' + count + ')</span>'; });
        html += '</div>';
    }
    html += '</div>';
    return html;
};
