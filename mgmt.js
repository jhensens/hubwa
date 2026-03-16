// --- 1. TAKINGS & KPI DASHBOARD ---
window._salesTab = window._salesTab || 'week';

window.renderSalesView = () => {
    const allSales = (window.salesData || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const today = new Date();

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
        const d = new Date(s.date); return d >= start && d <= (end || today);
    });

    const tab = window._salesTab || 'week';
    let periodData, periodLabel, compareData, compareLabel;
    if (tab === 'week') {
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

    // Tab pills
    const tabs = [
        { id: 'week', label: 'This Week' },
        { id: 'lastweek', label: 'Last Week' },
        { id: 'days7', label: 'Last 7 Days' },
        { id: 'month', label: 'This Month' }
    ];
    const tabHtml = tabs.map(t =>
        '<button onclick="window._salesTab=\'' + t.id + '\'; window.showView(\'sales\')" class="btn ' + (tab === t.id ? 'btn-dark' : 'btn-outline') + '" style="font-size:12px;padding:7px 14px;">' + t.label + '</button>'
    ).join('');

    // KPI stat cards
    const statCard = (label, value, sub, color) =>
        '<div class="card" style="text-align:center;border-top:4px solid ' + color + ';padding:20px 15px;">' +
            '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">' + label + '</div>' +
            '<div style="font-size:28px;font-weight:bold;color:' + color + ';line-height:1.1;">' + value + '</div>' +
            (sub ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">' + sub + '</div>' : '') +
        '</div>';

    const statsHtml =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:15px;margin-bottom:20px;">' +
            statCard('Total Revenue', '$' + totalRev.toLocaleString('en-AU', {minimumFractionDigits:0, maximumFractionDigits:0}), periodData.length + ' days traded' + (revChangeHtml ? '' : ''), 'var(--green)') +
            '<div class="card" style="text-align:center;border-top:4px solid var(--green);padding:20px 15px;">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Total Revenue</div>' +
                '<div style="font-size:28px;font-weight:bold;color:var(--green);line-height:1.1;">$' + totalRev.toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) + '</div>' +
                '<div style="font-size:11px;margin-top:4px;">' + periodData.length + ' days ' + revChangeHtml + '</div>' +
            '</div>' +
            statCard('Avg Daily', '$' + avgDaily.toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}), periodLabel, 'var(--blue)') +
            statCard('Best Day', bestDay ? '$' + Number(bestDay.total).toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) : '—', bestDay ? bestDay.date : 'No data', 'var(--green)') +
            statCard('Worst Day', worstDay ? '$' + Number(worstDay.total).toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) : '—', worstDay ? worstDay.date : 'No data', 'var(--orange)') +
        '</div>';

    // Remove the duplicate statCard from above — rewrite stats properly
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
            // Wage Cost %
            '<div class="card" style="text-align:center;border-top:4px solid ' + (wageTarget <= 30 ? 'var(--green)' : 'var(--orange)') + ';padding:20px 15px;">' +
                '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Wage Target</div>' +
                '<div style="font-size:26px;font-weight:bold;color:' + (wageTarget <= 30 ? 'var(--green)' : 'var(--orange)') + ';">' + wageTarget + '%</div>' +
                '<div style="font-size:11px;margin-top:4px;color:var(--text-muted);">Wage budget of $' + (totalRev * wageTarget / 100).toLocaleString('en-AU', {minimumFractionDigits:0,maximumFractionDigits:0}) + '</div>' +
            '</div>' +
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

    // Recent daily trade table
    const tableRows = periodData.slice().reverse().map(s =>
        '<tr style="border-bottom:1px solid var(--bg-main);">' +
            '<td style="padding:10px;">' + s.date + '</td>' +
            '<td style="padding:10px;">$' + Number(s.eftpos||0).toFixed(2) + '</td>' +
            '<td style="padding:10px;">$' + Number(s.cash||0).toFixed(2) + '</td>' +
            '<td style="padding:10px;">' + (s.meandu > 0 ? '$' + Number(s.meandu).toFixed(2) : '—') + '</td>' +
            '<td style="padding:10px;font-weight:bold;color:var(--green);">$' + Number(s.total||0).toFixed(2) + '</td>' +
        '</tr>'
    ).join('');

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
                            (d.itemsSold||[]).map(l => '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--border);"><span>' + l.recipeName + '</span><strong style="color:var(--green);">' + l.qtySold + '</strong></div>').join('') + '</div>' +
                            '<div><strong style="color:var(--brand-accent);display:block;margin-bottom:6px;">Stock Deducted</strong>' +
                            (d.stockChanges||[]).map(s => '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--border);"><span style="color:var(--text-muted);">' + s.name + '</span><span><span style="color:var(--red);">' + s.before + '</span> → <strong>' + s.after + '</strong> <small>' + s.unit + '</small></span></div>').join('') + '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            ).join('')) +
    '</div>';

    return '<div style="max-width:1100px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<h2 style="margin:0;">Takings & KPIs</h2>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                '<button onclick="window.openAiDepletion()" class="btn btn-purple">✨ EOD Depletion</button>' +
                '<button onclick="document.getElementById(\'csv-upload\').click()" class="btn btn-blue">📈 Upload CSV</button>' +
                '<input type="file" id="csv-upload" accept=".csv" style="display:none;" onchange="window.handleSalesCSV(event)">' +
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
                        '<th style="padding:10px;">Date</th><th style="padding:10px;">EFTPOS</th><th style="padding:10px;">Cash</th><th style="padding:10px;">Me&u</th><th style="padding:10px;">Total</th>' +
                    '</tr></thead>' +
                    '<tbody>' + (tableRows || '<tr><td colspan="5" style="padding:15px;color:var(--text-muted);text-align:center;">No data for this period.</td></tr>') + '</tbody>' +
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
window.handleSalesCSV = (event) => {
    const file = event.target.files[0]; const reader = new FileReader();
    reader.onload = (e) => {
        e.target.result.split('\\n').slice(1).forEach(row => {
            const cols = row.split(',');
            if(cols.length > 8) {
                const date = cols[0]; const eftpos = parseFloat(cols[2]) || 0; const meandu = parseFloat(cols[5]) || 0; const cash = parseFloat(cols[7]) || 0; const total = parseFloat(cols[8]) || 0;
                if(!window.salesData.find(s => s.date === date) && date) window.salesData.push({ date, eftpos, meandu, cash, total });
            }
        });
        window.saveToDisk(); window.showToast("Takings Imported Successfully!"); window.showView('sales');
    };
    reader.readAsText(file);
};


// --- 2. ORIENTATION & TRAINING ---
window.renderOrientationView = function(showCompleted = false) {
    const filtered = (window.orientationLogs || []).map((o, i) => ({...o, originalIndex: i})).filter(o => (o.status === 'Completed') === showCompleted);
    return `<div style="max-width: 900px; margin: auto;">
        <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
            <div>
                <button onclick="window.showView('orientation')" class="btn ${!showCompleted ? 'btn-dark' : 'btn-outline'}">Active Training</button>
                <button onclick="window.renderCompletedOrientations()" class="btn ${showCompleted ? 'btn-dark' : 'btn-outline'}" style="margin-left:10px;">Fully Trained</button>
            </div>
            <div>
                <button onclick="window.editOnbTemplates()" class="btn btn-outline" style="margin-right:10px;">⚙️ Edit Templates</button>
                <button onclick="window.addOrientationForm()" class="btn btn-blue">+ New Hire</button>
            </div>
        </div>
        <div id="orientationContent">${filtered.length === 0 ? '<div class="card"><p style="color:var(--text-muted); margin:0;">No staff in this view.</p></div>' : filtered.map(o => {
        const template = window.onboardingTemplates[o.role] || window.onboardingTemplates['FOH (Front of House)'];
        let totalTasks = 0; let completedTasks = 0;
        let phasesHtml = Object.keys(template).map(phase => {
            let phaseTasksHtml = template[phase].map(t => {
                totalTasks++; if (o.tasks && o.tasks[t.id]) completedTasks++;
                let isDone = o.tasks && o.tasks[t.id];
                let actionHtml = (t.isUpload && !isDone && o.status !== 'Completed') ? `<input type="file" id="up-${o.originalIndex}-${t.id}" accept="application/pdf,image/*" style="display:none;" onchange="window.handleStaffUpload(${o.originalIndex}, '${t.id}', '${t.cat}', this)"><button onclick="document.getElementById('up-${o.originalIndex}-${t.id}').click()" class="btn btn-blue" style="font-size:10px; padding:3px 8px; margin-left:10px;">Upload File</button>` : '';
                return `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);"><label style="font-size:13px; display:flex; align-items:center; gap:10px; cursor:pointer;"><input type="checkbox" style="transform: scale(1.2);" ${isDone ? 'checked' : ''} ${o.status === 'Completed' || t.isUpload ? 'disabled' : `onchange="window.toggleOrientationTask(${o.originalIndex}, '${t.id}', this.checked)"`}><span style="${isDone ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${t.label}</span></label>${actionHtml}</div>`;
            }).join('');
            return `<div style="margin-bottom:15px;"><h5 style="margin:0 0 5px 0; color:var(--brand-accent); border-bottom:1px solid var(--border); padding-bottom:5px;">${phase}</h5>${phaseTasksHtml}</div>`;
        }).join('');
        const pct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
        return `<div class="card" style="border-left:6px solid ${pct === 100 ? 'var(--green)' : 'var(--purple)'}; margin-bottom:15px;"><div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;"><div><h3 style="margin:0;">${o.name}</h3><span class="tag-pill" style="margin-top:5px;">${o.role}</span><small style="color:var(--text-muted); display:block; margin-top:5px;">Started: ${o.startDate}</small></div><div style="text-align:right;"><strong style="color:${pct === 100 ? 'var(--green)' : 'var(--purple)'}; font-size:24px;">${pct}%</strong>${o.status !== 'Completed' ? `<br><button onclick="window.deleteOrientation(${o.originalIndex})" style="color:var(--red); background:none; border:none; cursor:pointer; font-size:11px; margin-top:5px; padding:0; text-decoration:underline;">Remove Staff</button>` : ''}</div></div>${phasesHtml}<div style="margin-top:20px; background:var(--bg-main); padding:15px; border-radius:6px; border:1px solid var(--border);"><h5 style="margin:0 0 10px 0; color:var(--brand-dark);">Staff Acknowledgment</h5><p style="font-size:12px; margin:0 0 10px 0; color:var(--text-muted);">I confirm I have read the venue Handbooks, SOPs, and completed the training checklist above.</p>${o.signature ? `<div style="color:var(--green); font-family:monospace; font-size:14px; padding:10px; border:1px dashed var(--green); background:rgba(16, 185, 129, 0.1);">Signed: ${o.signature} <br><small>${o.signDate}</small></div>` : `<div style="display:flex; gap:10px;"><input type="text" id="sig-${o.originalIndex}" class="input-box" placeholder="Type name to sign..." style="margin:0; flex:1;"><button onclick="window.signOrientation(${o.originalIndex})" class="btn btn-dark">Sign</button></div>`}</div>${pct === 100 && o.signature && o.status !== 'Completed' ? `<button onclick="window.completeOrientation(${o.originalIndex})" class="btn btn-green" style="width:100%; margin-top:20px; font-size:16px;">Approve & Mark as Fully Trained</button>` : ''}</div>`; 
    }).join('')}</div></div>`;
}

window.renderCompletedOrientations = () => { document.getElementById('mainContent').innerHTML = window.renderOrientationView(true); };

window.editOnbTemplates = () => {
    let html = ``;
    Object.keys(window.onboardingTemplates).forEach(role => {
        html += `<div style="margin-bottom:20px;"><h3 style="color:var(--brand-dark); border-bottom:2px solid var(--border); padding-bottom:5px;">${role}</h3>`;
        Object.keys(window.onboardingTemplates[role]).forEach(phase => {
            html += `<h5 style="margin-top:15px; color:var(--brand-accent);">${phase}</h5>`;
            window.onboardingTemplates[role][phase].forEach((task, tIdx) => { html += `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--bg-main); font-size:13px;"><span>${task.label} ${task.isUpload ? '<span style="color:var(--blue); font-size:10px; border:1px solid var(--blue); padding:2px 4px; border-radius:4px; margin-left:5px;">Upload Required</span>' : ''}</span><button onclick="window.delOnbTask('${role}', '${phase}', ${tIdx})" style="color:var(--red); background:none; border:none; cursor:pointer; font-weight:bold;">&times;</button></div>`; });
            html += `<div style="display:flex; gap:10px; margin-top:10px;"><input type="text" id="nt-${role.replace(/\s/g,'')}-${phase.replace(/\s/g,'')}" class="input-box" placeholder="Add new task..." style="flex:1; margin:0;"><button onclick="window.addOnbTask('${role}', '${phase}')" class="btn btn-green">Add Task</button></div>`;
        });
        html += `</div>`;
    });
    window.openModal("⚙️ Edit Training Templates", html + `<button onclick="window.closeModal(); window.showView('orientation')" class="btn btn-blue" style="width:100%; margin-top:15px;">Done</button>`);
};
window.addOnbTask = (role, phase) => { const val = document.getElementById(`nt-${role.replace(/\s/g,'')}-${phase.replace(/\s/g,'')}`).value; if(val) { window.onboardingTemplates[role][phase].push({id: 't_' + Date.now(), label: val}); window.saveToDisk(); window.editOnbTemplates(); } };
window.delOnbTask = (role, phase, idx) => { if(confirm("Delete this training task?")) { window.onboardingTemplates[role][phase].splice(idx, 1); window.saveToDisk(); window.editOnbTemplates(); } };

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
window.deleteOrientation = (index) => { if(confirm("Remove this staff member's training record?")) { window.orientationLogs.splice(index, 1); window.saveToDisk(); window.showView('orientation'); } };

// --- 3. ROTATIONAL TASKS ---
window.renderTaskView = function() { return `<div style="max-width: 900px; margin: auto;"><div style="display:flex; justify-content:space-between; margin-bottom:20px;"><div><button onclick="window.renderTaskList()" class="btn btn-dark">Active</button><button onclick="window.renderTaskHistory()" class="btn btn-outline" style="margin-left:10px;">Audit History</button></div><button onclick="window.addTaskForm()" class="btn btn-blue">+ Setup Task</button></div><div id="taskSubContent">${window.renderTaskListTemplate()}</div></div>`; }
window.renderTaskListTemplate = function() { 
    const freqMap = { 'Weekly': 7, 'Fortnightly': 14, 'Monthly': 30, 'Quarterly': 90 };
    return `<div id="activeTasks">${(window.rotationalTasks || []).map((t, i) => {
        let isDue = true; let daysLeftText = "DUE NOW";
        if (t.lastLogIso) {
            const daysSince = (new Date() - new Date(t.lastLogIso)) / (1000 * 3600 * 24);
            isDue = daysSince >= freqMap[t.freq];
            if (!isDue) daysLeftText = `Due in ${Math.ceil(freqMap[t.freq] - daysSince)} days`;
        }
        return `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left:6px solid ${isDue ? 'var(--red)' : 'var(--green)'}; padding:15px; margin-bottom:10px;"><div><strong style="font-size:16px;">${t.name}</strong><br><small style="color:var(--text-muted);">Freq: ${t.freq} | Last Done: ${t.lastDate || 'Never'}</small><br><strong style="font-size:12px; display:inline-block; margin-top:5px; color:${isDue ? 'var(--red)' : 'var(--green)'};">${daysLeftText}</strong></div><div style="display:flex; align-items:center; gap:10px;"><input type="text" id="staff-${i}" placeholder="Staff Initials" class="input-box" style="width:110px; margin:0;"><button onclick="window.logTaskCompletion(${i})" class="btn btn-green">Log Done</button><button onclick="window.delTask(${i})" style="color:var(--red); background:none; border:none; cursor:pointer; font-size:18px;">&times;</button></div></div>`;
    }).join('')}</div>`; 
}
window.renderTaskList = () => { document.getElementById('taskSubContent').innerHTML = window.renderTaskListTemplate(); };
window.renderTaskHistory = () => { document.getElementById('taskSubContent').innerHTML = `<table style="width:100%; background:var(--card-bg); border-radius:8px; border-collapse:collapse;"><thead><tr style="text-align:left; background:#111; border-bottom:1px solid var(--border);"><th style="padding:15px;">Date</th><th style="padding:15px;">Task</th><th style="padding:15px;">Staff</th></tr></thead><tbody>${(window.taskHistory || []).slice().reverse().map(h => `<tr style="border-bottom:1px solid var(--bg-main);"><td style="padding:15px; font-size:13px; color:var(--text-muted);">${h.date}</td><td style="padding:15px;">${h.name}</td><td style="padding:15px;"><strong>${h.staff}</strong></td></tr>`).join('')}</tbody></table>`; };

window.addTaskForm = () => { 
    let html = `<label style="font-size:11px; color:var(--text-muted);">Task Name</label><input type="text" id="t-n" class="input-box" placeholder="e.g. Grease Trap Clean"><label style="font-size:11px; color:var(--text-muted);">Frequency</label><select id="t-f" class="input-box" style="margin-bottom:20px;"><option>Weekly</option><option>Fortnightly</option><option>Monthly</option><option>Quarterly</option></select><button onclick="window.subTask()" class="btn btn-green" style="width:100%;">Save Task</button>`;
    window.openModal("🔄 New Recurring Task", html);
};
window.subTask = () => { window.rotationalTasks.push({ name: document.getElementById('t-n').value, freq: document.getElementById('t-f').value, lastLogIso: null, lastDate: 'Never' }); window.saveToDisk(); window.closeModal(); window.showView('tasks'); window.showToast("Task Created!"); };
window.logTaskCompletion = (i) => { const s = document.getElementById(`staff-${i}`).value; if(!s) return window.showToast("Enter Staff Initials", "error"); const now = new Date(); window.taskHistory.push({ name: window.rotationalTasks[i].name, staff: s, date: now.toLocaleDateString() }); window.rotationalTasks[i].lastLogIso = now.toISOString(); window.rotationalTasks[i].lastDate = now.toLocaleDateString(); window.saveToDisk(); window.showView('tasks'); window.showToast("Task Logged!"); };
window.delTask = (i) => { if(confirm("Delete Task?")) { window.rotationalTasks.splice(i,1); window.saveToDisk(); window.showView('tasks'); }};

// --- 4. COMPLIANCE ---
window.renderComplianceView = function() {
    const recentTemps = (window.tempLogs || []).slice(-8).reverse();
    return `<div style="max-width: 900px; margin: auto;">
        <div class="card" style="border-top:5px solid var(--blue);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;"><h3 style="margin:0;">Fridge/Freezer Temp Log</h3><button onclick="window.editFridges()" class="btn btn-outline" style="padding:6px 12px; font-size:11px;">⚙️ Setup Units</button></div>
            <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:15px; margin-bottom:20px;">
                ${(window.fridgeUnits || []).map((f, i) => `
                    <div style="background:var(--bg-main); padding:15px; border-radius:8px; border:1px solid var(--border);">
                        <strong style="font-size:13px; display:block; margin-bottom:8px; color:var(--brand-dark);">${f}</strong>
                        <input type="number" step="0.1" id="t-val-${i}" oninput="window.checkT(${i})" class="input-box" placeholder="Temp °C" style="margin:0; width:100%;">
                        <div id="t-warn-${i}" style="display:none; margin-top:10px;">
                            <small style="color:var(--red); font-weight:bold; display:block; margin-bottom:4px;">⚠️ High Temp Alert</small>
                            <input type="text" id="t-action-${i}" class="input-box" placeholder="Corrective Action" style="margin:0; border-color:var(--red); font-size:12px; padding:6px;">
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="display:flex; gap:10px; border-top:1px solid var(--border); padding-top:20px;">
                <input type="text" id="t-staff" class="input-box" placeholder="Staff Name Signing Off" style="flex:1; margin:0;">
                <button onclick="window.logAllTemps()" class="btn btn-blue" style="width:200px;">Log All Temps</button>
            </div>
            ${recentTemps.length > 0 ? `
            <div style="margin-top:20px; border-top:1px solid var(--border); padding-top:15px;">
                <h4 style="margin:0 0 10px 0; font-size:13px; color:var(--text-muted); text-transform:uppercase;">Recent Logs</h4>
                <table style="width:100%; font-size:13px; text-align:left; border-collapse:collapse;">
                    <tbody>
                        ${recentTemps.map(t => `<tr style="border-bottom:1px dashed var(--border);"><td style="padding:8px 0;">${t.unit}</td><td style="color:${t.value > 5 ? 'var(--red)' : 'var(--green)'}; font-weight:bold;">${t.value}°C</td><td style="color:var(--text-muted);">${t.staff}</td><td>${t.action ? `<span style="color:var(--red); font-size:11px;">Action: ${t.action}</span><br>` : ''}<span style="color:var(--text-muted); font-size:11px;">${t.time}</span></td></tr>`).join('')}
                    </tbody>
                </table>
            </div>` : ''}
        </div>
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; margin-top:30px;"><h3 style="margin:0;">Venue Checklists</h3><button onclick="window.editChecklists()" class="btn btn-outline" style="padding:6px 12px; font-size:11px;">⚙️ Edit Lists</button></div>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap:20px;">
            ${Object.keys(window.masterChecklists || {}).map(l => `<div class="card" style="padding:20px;"><h4 style="margin:0 0 15px 0; color:var(--brand-accent);">${l}</h4>${(window.masterChecklists[l] || []).map(item => `<div style="font-size:13px; margin:8px 0;"><label style="cursor:pointer; display:flex; gap:10px; align-items:center;"><input type="checkbox" style="transform:scale(1.2);"> <span>${item}</span></label></div>`).join('')}<div style="margin-top:20px; border-top:1px solid var(--border); padding-top:15px; display:flex; gap:10px;"><input type="text" id="s-${l.replace(/\s/g,'')}" class="input-box" placeholder="Staff Initial" style="margin:0;"><button onclick="window.signCheck('${l}')" class="btn btn-dark">Sign Off</button></div></div>`).join('')}
        </div>
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
window.signCheck = (l) => { if(!document.getElementById(`s-${l.replace(/\s/g,'')}`).value) return window.showToast("Please sign name", "error"); window.complianceLogs.push({ type: l, staff: document.getElementById(`s-${l.replace(/\s/g,'')}`).value, time: new Date().toLocaleString() }); window.saveToDisk(); window.showToast(l + " Signed Off"); window.showView('compliance'); };

window.editFridges = () => { 
    let html = `<div style="margin-bottom:20px;">${(window.fridgeUnits || []).map((f, i) => `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid var(--border); align-items:center;"><span style="font-size:14px;">${f}</span> <button onclick="window.delFridge(${i})" style="color:var(--red); background:none; border:none; cursor:pointer; font-size:18px;">&times;</button></div>`).join('')}</div><div style="display:flex; gap:10px;"><input type="text" id="new-fridge" class="input-box" placeholder="New Unit Name" style="margin:0;"><button onclick="window.addFridge()" class="btn btn-green">Add Unit</button></div>`;
    window.openModal("⚙️ Setup Fridges/Freezers", html);
};
window.addFridge = () => { const v = document.getElementById('new-fridge').value; if(v) { window.fridgeUnits.push(v); window.saveToDisk(); window.editFridges(); } };
window.delFridge = (i) => { window.fridgeUnits.splice(i,1); window.saveToDisk(); window.editFridges(); };

window.editChecklists = () => {
    let html = `<div style="display:flex; gap:10px; margin-bottom:20px;"><input type="text" id="new-cat" class="input-box" placeholder="New Category (e.g. Weekly Deep Clean)" style="margin:0;"><button onclick="window.addChecklistCat()" class="btn btn-blue">Add Category</button></div><div style="max-height:60vh; overflow-y:auto; padding-right:10px;">`;
    Object.keys(window.masterChecklists || {}).forEach(cat => { html += `<div style="background:var(--bg-main); padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid var(--border);"><div style="display:flex; justify-content:space-between; margin-bottom:10px;"><h4 style="margin:0; color:var(--brand-accent);">${cat}</h4><button onclick="window.delChecklistCat('${cat}')" style="color:var(--red); background:none; border:none; cursor:pointer; font-size:11px; text-decoration:underline;">Delete Category</button></div>${(window.masterChecklists[cat] || []).map((item, idx) => `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border);"><span style="font-size:13px;">${item}</span><button onclick="window.delChecklistItem('${cat}', ${idx})" style="color:var(--red); background:none; border:none; cursor:pointer;">&times;</button></div>`).join('')}<div style="display:flex; gap:10px; margin-top:15px;"><input type="text" id="add-item-${cat.replace(/\s/g,'')}" class="input-box" placeholder="New task..." style="margin:0; font-size:12px; padding:6px;"><button onclick="window.addChecklistItem('${cat}')" class="btn btn-green" style="padding:6px 12px; font-size:11px;">Add Task</button></div></div>`; });
    html += `</div>`;
    window.openModal("⚙️ Edit Checklists", html);
};
window.addChecklistCat = () => { const v = document.getElementById('new-cat').value; if(v && !window.masterChecklists[v]) { window.masterChecklists[v] = []; window.saveToDisk(); window.editChecklists(); } };
window.delChecklistCat = (cat) => { if(confirm("Delete entire category?")) { delete window.masterChecklists[cat]; window.saveToDisk(); window.editChecklists(); window.showView('compliance'); } };
window.addChecklistItem = (cat) => { const v = document.getElementById(`add-item-${cat.replace(/\s/g,'')}`).value; if(v) { window.masterChecklists[cat].push(v); window.saveToDisk(); window.editChecklists(); window.showView('compliance'); } };
window.delChecklistItem = (cat, idx) => { window.masterChecklists[cat].splice(idx, 1); window.saveToDisk(); window.editChecklists(); window.showView('compliance'); };

// --- 5. MAINTENANCE & ASSETS ---
window.renderMaintenanceView = function(activeTab = 'fixit') {
    let content = '', btnF = 'btn-outline', btnA = 'btn-outline', btnC = 'btn-outline', actionBtn = '';
    if (activeTab === 'fixit') { content = window.renderFixItBoard(); btnF = 'btn-dark'; } 
    else if (activeTab === 'assets') { content = window.renderAssetRegister(); btnA = 'btn-dark'; actionBtn = `<button onclick="window.editEq()" class="btn btn-blue">+ Add Asset</button>`; } 
    else if (activeTab === 'contractors') { content = window.renderContractorBoard(); btnC = 'btn-dark'; actionBtn = `<button onclick="window.showContractorForm()" class="btn btn-green">+ Sign In Contractor</button>`; }

    return `<div style="max-width: 900px; margin: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:15px;">
            <div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:5px;">
                <button onclick="document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('fixit')" class="btn ${btnF}">🛠️ Fix-It Board</button>
                <button onclick="document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('assets')" class="btn ${btnA}">⚙️ Asset Register</button>
                <button onclick="document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('contractors')" class="btn ${btnC}">📋 Contractor Log</button>
            </div>
            ${actionBtn}
        </div>
        <div id="maint-content">${content}</div>
    </div>`;
}

window.renderFixItBoard = () => {
    const openTickets = (window.defectLogs || []).filter(d => d.status === 'Open'); 
    const closedTickets = (window.defectLogs || []).filter(d => d.status === 'Resolved');
    const tradies = (window.phoneBook || []).filter(c => c.category === 'Tradie' || c.category === 'Tradie / Maintenance');
    const tradieOptions = `<option value="">Leave Unassigned (Internal Fix)</option>` + tradies.map(t => `<option value="${t.name}">${t.name} - ${t.phone}</option>`).join('');

    return `<div class="card" style="border-top:5px solid var(--orange);">
        <h3 style="margin-top:0;">Log a Broken Item</h3>
        <div style="display:flex; gap:10px; margin-bottom:15px;">
            <input type="text" id="def-item" class="input-box" placeholder="Item (e.g. Table 12 / Coolroom Fan)" style="flex-grow:1; margin:0;">
            <label style="display:flex; align-items:center; color:var(--red); font-weight:bold; background:rgba(239, 68, 68, 0.1); padding:0 15px; border-radius:6px; border:1px solid rgba(239, 68, 68, 0.2); cursor:pointer;"><input type="checkbox" id="def-urgent" style="margin-right:8px; transform:scale(1.2);"> URGENT</label>
        </div>
        <select id="def-tradie" class="input-box" style="margin-bottom:15px;">${tradieOptions}</select>
        <textarea id="def-desc" class="input-box" placeholder="What is exactly wrong with it?" style="height:60px; margin-bottom:15px;"></textarea>
        <button onclick="window.submitDefect()" class="btn btn-orange" style="width:100%; font-size:16px;">Submit Ticket</button>
    </div>
    
    <h3 style="margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:5px;">Open Tickets</h3>
    ${openTickets.length === 0 ? '<div class="card"><p style="color:var(--green); font-weight:bold; margin:0;">No open issues! Venue is looking good.</p></div>' : openTickets.map((d) => `
        <div class="card" style="border-left:6px solid ${d.urgent ? 'var(--red)' : 'var(--orange)'}; padding:20px; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;"><strong style="font-size:18px;">${d.item} ${d.urgent ? '<span style="color:var(--red); font-size:12px; margin-left:10px; border:1px solid var(--red); padding:2px 6px; border-radius:4px;">URGENT</span>' : ''}</strong><small style="color:var(--text-muted);">Reported: ${d.date}</small></div>
            <p style="margin:10px 0; color:var(--text-main); font-size:14px; background:var(--bg-main); padding:10px; border-radius:6px;">${d.desc}</p>
            ${d.tradie ? `<div style="font-size:13px; margin-bottom:15px; color:var(--blue); font-weight:bold;">🛠️ Assigned to: ${d.tradie}</div>` : '<div style="margin-bottom:15px;"></div>'}
            <div style="display:flex; justify-content:flex-end; align-items:center; border-top:1px dashed var(--border); padding-top:15px;"><input type="number" step="0.01" id="def-cost-${d.originalIndex}" class="input-box" placeholder="Repair Cost ($)" style="width:140px; display:inline; margin:0 10px 0 0;"><button onclick="window.resolveDefect(${d.originalIndex})" class="btn btn-green">Mark Resolved</button></div>
        </div>`).join('')}
        
    <h3 style="margin-top:40px; margin-bottom:15px; color:var(--text-muted); font-size:14px; text-transform:uppercase;">Recently Resolved</h3>
    ${closedTickets.slice(-5).reverse().map(d => `<div style="background:var(--bg-main); padding:15px; border-radius:8px; margin-bottom:10px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;"><div><strong style="color:var(--green);">✓ ${d.item}</strong> - <span style="font-size:13px; color:var(--text-muted);">${d.desc}</span></div>${d.cost > 0 ? `<strong style="color:var(--red); font-size:14px;">$${d.cost.toFixed(2)}</strong>` : ''}</div>`).join('')}`;
};
window.submitDefect = () => { const item = document.getElementById('def-item').value; const desc = document.getElementById('def-desc').value; if(!item || !desc) return window.showToast("Item and Description required.", "error"); window.defectLogs.push({ originalIndex: window.defectLogs.length, item, desc, tradie: document.getElementById('def-tradie').value, urgent: document.getElementById('def-urgent').checked, status: 'Open', date: new Date().toLocaleDateString() }); window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('fixit'); window.showToast("Ticket Submitted!"); };
window.resolveDefect = (index) => { const costInput = document.getElementById(`def-cost-${index}`).value; window.defectLogs[index].status = 'Resolved'; window.defectLogs[index].cost = costInput ? parseFloat(costInput) : 0; window.defectLogs[index].resolvedDate = new Date().toLocaleDateString(); window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('fixit'); window.showToast("Ticket Resolved!"); };

window.renderAssetRegister = () => { return (window.equipmentData || []).length === 0 ? '<p style="color:var(--text-muted);">No assets tracked yet.</p>' : window.equipmentData.map((e, idx) => `<div class="card" style="border-left:5px solid var(--blue); padding:20px; margin-bottom:15px;"><div style="display:flex; justify-content:space-between; align-items:center;"><div><strong style="font-size:18px;">${e.name}</strong> <span style="color:var(--text-muted); font-size:13px; margin-left:10px;">[Code: ${e.code}]</span><br><small style="color:var(--brand-accent); display:block; margin-top:5px;">Service Interval: ${e.interval} months | Last Service: <strong style="color:white;">${e.lastService}</strong></small></div><div style="display:flex; gap:10px;"><button onclick="window.editEq(${idx})" class="btn btn-outline">Edit</button><button onclick="window.logEq(${idx})" class="btn btn-green">Log Service Today</button><button onclick="window.delEq(${idx})" style="background:none; color:var(--red); border:none; cursor:pointer; font-size:18px;">&times;</button></div></div></div>`).join(''); };

window.editEq = (i = null) => { 
    let e = i !== null ? window.equipmentData[i] : {name: '', code: '', interval: 6, lastService: new Date().toISOString().split('T')[0]}; 
    let html = `
        <label style="font-size:11px; color:var(--text-muted);">Equipment Name</label><input type="text" id="eq-n" class="input-box" value="${e.name}">
        <label style="font-size:11px; color:var(--text-muted);">Asset/Serial Code</label><input type="text" id="eq-c" class="input-box" value="${e.code}">
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
window.delEq = (i) => { if(confirm("Remove this asset?")) { window.equipmentData.splice(i,1); window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('assets'); } };

window.renderContractorBoard = () => {
    const active = (window.contractorLogs || []).map((c, i) => ({...c, originalIndex: i})).filter(c => !c.timeOut);
    const history = (window.contractorLogs || []).map((c, i) => ({...c, originalIndex: i})).filter(c => c.timeOut).slice(-10).reverse();
    return `<h3 style="margin-bottom:15px; color:var(--brand-dark); border-bottom:1px solid var(--border); padding-bottom:5px;">🟢 Currently On-Site</h3>${active.length === 0 ? '<div class="card"><p style="color:var(--green); margin:0; font-weight:bold;">No contractors currently signed in.</p></div>' : active.map(c => `<div class="card" style="border-left:5px solid var(--green); padding:20px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;"><div><strong style="font-size:18px;">${c.name}</strong> <span style="color:var(--text-muted);">(${c.company})</span><br><small style="color:var(--brand-accent); display:block; margin-top:5px;">Reason: ${c.reason} | <strong>In:</strong> ${c.timeIn}</small></div><button onclick="window.signOutContractor(${c.originalIndex})" class="btn btn-red" style="font-size:16px;">Sign Out</button></div>`).join('')}<h3 style="margin-top:40px; margin-bottom:15px; color:var(--brand-dark); border-bottom:1px solid var(--border); padding-bottom:5px;">📋 Recent Visits</h3><table style="width:100%; background:var(--card-bg); border-radius:8px; overflow:hidden; border-collapse:collapse;"><thead><tr style="text-align:left; background:#111; border-bottom:1px solid var(--border);"><th style="padding:15px;">Date</th><th style="padding:15px;">Contractor</th><th style="padding:15px;">Reason</th><th style="padding:15px;">Time In/Out</th></tr></thead><tbody>${history.length === 0 ? '<tr><td colspan="4" style="padding:15px; color:var(--text-muted); text-align:center;">No recent logs.</td></tr>' : history.map(c => `<tr style="border-bottom:1px solid var(--bg-main);"><td style="padding:15px; font-size:13px; color:var(--text-muted);">${c.date}</td><td style="padding:15px;"><strong>${c.name}</strong><br><small style="color:var(--text-muted);">${c.company}</small></td><td style="padding:15px; font-size:13px; color:var(--brand-accent);">${c.reason}</td><td style="padding:15px; font-size:13px;">In: <strong>${c.timeIn}</strong><br>Out: <strong>${c.timeOut}</strong></td></tr>`).join('')}</tbody></table>`;
}
window.showContractorForm = () => { 
    let html = `<input type="text" id="con-name" class="input-box" placeholder="Contractor Name (e.g., John Smith)" required><input type="text" id="con-company" class="input-box" placeholder="Company (e.g., Bob's Plumbing)" required><input type="text" id="con-reason" class="input-box" placeholder="Reason for visit (e.g., Fix grease trap)" style="margin-bottom:20px;" required><button onclick="window.submitContractor()" class="btn btn-green" style="width:100%;">Sign In</button>`;
    window.openModal("📋 Contractor Sign-In", html); 
}
window.submitContractor = () => { const name = document.getElementById('con-name').value; const company = document.getElementById('con-company').value; const reason = document.getElementById('con-reason').value; if(!name || !company) return window.showToast("Required details missing.", "error"); const now = new Date(); window.contractorLogs.push({ date: now.toLocaleDateString(), timeIn: now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), timeOut: null, name, company, reason }); window.saveToDisk(); window.closeModal(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('contractors'); window.showToast("Contractor Signed In!"); }
window.signOutContractor = (index) => { window.contractorLogs[index].timeOut = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}); window.saveToDisk(); document.getElementById('mainContent').innerHTML = window.renderMaintenanceView('contractors'); window.showToast("Contractor Signed Out!"); }


// --- 6. DIGITAL SAFE ---
window._safeActiveTab = window._safeActiveTab || 'all';

window.renderSafeView = function() {
    const cats = window.safeCategories || ['Licenses & Permits', 'Staff RSAs', 'Food Safety Certs', 'Maintenance Records', 'General / Other'];
    const docs = window.digitalSafe || [];
    const activeTab = window._safeActiveTab || 'all';

    const filteredDocs = activeTab === 'all' ? docs.map((d,i) => ({...d, originalIndex:i}))
        : docs.map((d,i) => ({...d, originalIndex:i})).filter(d => (d.category || 'General / Other') === activeTab);

    // Tab pills
    const tabPills = [
        `<span class="tag-pill ${activeTab === 'all' ? 'active' : ''}" onclick="window._safeActiveTab='all'; window.showView('safe');">All (${docs.length})</span>`
    ].concat(cats.map(c => {
        const count = docs.filter(d => (d.category || 'General / Other') === c).length;
        return `<span class="tag-pill ${activeTab === c ? 'active' : ''}" onclick="window._safeActiveTab='${c.replace(/'/g,"\\'")}'; window.showView('safe');">${c} (${count})</span>`;
    })).join('');

    // Expiry alerts
    const expiringSoon = docs.filter(d => d.expiry && ((new Date(d.expiry) - new Date()) / (1000*3600*24)) <= 30 && new Date(d.expiry) > new Date());
    const expired = docs.filter(d => d.expiry && new Date(d.expiry) < new Date());
    let alertHtml = '';
    if (expired.length > 0) alertHtml += `<div class="card" style="border-left:4px solid var(--red);padding:10px 15px;margin-bottom:10px;font-size:13px;"><strong style="color:var(--red);">⚠️ ${expired.length} document${expired.length>1?'s':''} expired</strong></div>`;
    if (expiringSoon.length > 0) alertHtml += `<div class="card" style="border-left:4px solid var(--orange);padding:10px 15px;margin-bottom:10px;font-size:13px;"><strong style="color:var(--orange);">📅 ${expiringSoon.length} document${expiringSoon.length>1?'s':''} expiring within 30 days</strong></div>`;

    // Doc cards
    const docsHtml = filteredDocs.length === 0
        ? '<div class="card"><p style="color:var(--text-muted);margin:0;">No documents in this category.</p></div>'
        : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">${filteredDocs.map(d => {
            const isExpired = d.expiry && new Date(d.expiry) < new Date();
            const isExpiringSoon = d.expiry && !isExpired && ((new Date(d.expiry) - new Date()) / (1000*3600*24)) <= 30;
            const borderColor = isExpired ? 'var(--red)' : isExpiringSoon ? 'var(--orange)' : 'var(--green)';
            return `<div class="card" style="border-top:5px solid ${borderColor};margin-bottom:0;padding:20px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <div style="flex:1;padding-right:10px;">
                        <h4 style="margin:0 0 4px 0;font-size:15px;">${d.name}</h4>
                        <span style="font-size:11px;color:var(--text-muted);background:var(--bg-main);padding:2px 8px;border-radius:8px;border:1px solid var(--border);">${d.category || 'General'}</span>
                    </div>
                    <button onclick="window.delDoc(${d.originalIndex})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;line-height:1;flex-shrink:0;">&times;</button>
                </div>
                <p style="margin:8px 0 15px 0;font-size:12px;color:${isExpired?'var(--red)':isExpiringSoon?'var(--orange)':'var(--text-muted)'};">
                    ${d.expiry ? (isExpired ? '⚠️ Expired: ' : isExpiringSoon ? '📅 Expires: ' : 'Expires: ') + d.expiry : 'No expiry set'}
                </p>
                ${d.data ? `<a href="${d.data}" target="_blank" class="btn btn-outline" style="display:block;text-align:center;text-decoration:none;font-size:12px;">📄 View / Download</a>` : d.link ? `<a href="${d.link}" target="_blank" class="btn btn-outline" style="display:block;text-align:center;text-decoration:none;font-size:12px;">🔗 Open Link</a>` : ''}
            </div>`;
        }).join('')}</div>`;

    return `<div style="max-width:1100px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">
            <h2 style="margin:0;">Digital Safe</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button onclick="window.bulkUploadForm()" class="btn btn-blue">📂 Bulk Upload</button>
                <button onclick="window.addDocForm()" class="btn btn-green">+ Single Upload</button>
                <button onclick="window.editSafeCategories()" class="btn btn-outline" style="font-size:12px;">⚙️ Categories</button>
            </div>
        </div>
        ${alertHtml}
        <div style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:6px;">${tabPills}</div>
        ${docsHtml}
    </div>`;
};

window.editSafeCategories = () => {
    const cats = window.safeCategories || [];
    let html = `<div style="margin-bottom:15px;">
        ${cats.map((c, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid var(--border);">
            <span style="font-size:14px;">${c}</span>
            <button onclick="window.delSafeCat(${i})" style="color:var(--red);background:none;border:none;cursor:pointer;font-size:18px;">&times;</button>
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
    if (confirm('Delete this category? Documents in it will move to General / Other.')) {
        const cat = window.safeCategories[i];
        window.digitalSafe.forEach(d => { if (d.category === cat) d.category = 'General / Other'; });
        window.safeCategories.splice(i, 1);
        window.saveToDisk(); window.editSafeCategories();
    }
};

window.bulkUploadForm = () => {
    const cats = (window.safeCategories || []);
    const catOpts = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    const html = `
        <label style="font-size:11px;color:var(--text-muted);">Category for all files</label>
        <select id="bulk-cat" class="input-box">${catOpts}</select>
        <label style="font-size:11px;color:var(--text-muted);">Expiry Date (optional — applies to all)</label>
        <input type="date" id="bulk-expiry" class="input-box">
        <label style="font-size:11px;color:var(--text-muted);">Select Files (PDF or images, multiple OK)</label>
        <input type="file" id="bulk-files" accept="application/pdf,image/*" multiple class="input-box" style="padding:12px;margin-bottom:20px;">
        <div id="bulk-status"></div>
        <button onclick="window.runBulkUpload()" class="btn btn-blue" style="width:100%;font-size:15px;" id="btn-bulk-upload">📂 Upload All Files</button>`;
    window.openModal('📂 Bulk Upload to Safe', html);
};

window.runBulkUpload = async () => {
    const fileInput = document.getElementById('bulk-files');
    const cat = document.getElementById('bulk-cat').value;
    const expiry = document.getElementById('bulk-expiry').value;
    const statusDiv = document.getElementById('bulk-status');
    const btn = document.getElementById('btn-bulk-upload');
    if (!fileInput.files.length) return window.showToast('Select at least one file.', 'error');

    btn.disabled = true;
    const files = Array.from(fileInput.files);
    let uploaded = 0, failed = 0;

    for (const file of files) {
        statusDiv.innerHTML = `<p style="color:var(--blue);font-size:13px;">⏳ Uploading ${uploaded + 1} of ${files.length}: ${file.name}</p>`;
        try {
            const fileRef = storage.ref().child('safe_docs/' + Date.now() + '_' + file.name);
            await fileRef.put(file);
            const downloadURL = await fileRef.getDownloadURL();
            window.digitalSafe.push({
                name: file.name.replace(/\.[^.]+$/, ''),
                category: cat, expiry: expiry,
                type: file.type.includes('pdf') ? 'pdf' : 'image',
                data: downloadURL
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
    const catOpts = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    const html = `
        <label style="font-size:11px;color:var(--text-muted);">Category</label>
        <select id="d-cat" class="input-box">${catOpts}</select>
        <label style="font-size:11px;color:var(--text-muted);">Document Name</label>
        <input type="text" id="d-name" class="input-box" placeholder="e.g. John Smith RSA">
        <label style="font-size:11px;color:var(--text-muted);">Expiry Date (Optional)</label>
        <input type="date" id="d-expiry" class="input-box">
        <label style="font-size:11px;color:var(--text-muted);">File (PDF/Image)</label>
        <input type="file" id="d-file" accept="application/pdf,image/*" class="input-box" style="padding:12px;margin-bottom:20px;">
        <button onclick="window.subDoc()" class="btn btn-green" style="width:100%;" id="btn-doc-save">Save to Safe</button>`;
    window.openModal('🔓 Upload to Safe', html);
};

window.subDoc = async () => {
    const name = document.getElementById('d-name').value;
    const category = document.getElementById('d-cat').value;
    const expiry = document.getElementById('d-expiry').value;
    const fileInput = document.getElementById('d-file');
    if (!name) return window.showToast('Name required.', 'error');
    if (!fileInput.files.length) return window.showToast('Select a file.', 'error');
    const file = fileInput.files[0];
    const btn = document.getElementById('btn-doc-save');
    btn.innerText = 'Uploading... ⏳'; btn.disabled = true;
    try {
        const fileRef = storage.ref().child('safe_docs/' + Date.now() + '_' + file.name);
        await fileRef.put(file);
        const downloadURL = await fileRef.getDownloadURL();
        window.digitalSafe.push({ name, category, expiry, type: file.type.includes('pdf') ? 'pdf' : 'image', data: downloadURL });
        window.saveToDisk(); window.closeModal(); window.showView('safe'); window.showToast('Document Secured!');
    } catch (error) { window.showToast('Upload failed.', 'error'); btn.innerText = 'Save to Safe'; btn.disabled = false; }
};
window.delDoc = (i) => {
    if (confirm('Delete this document?')) { window.digitalSafe.splice(i, 1); window.saveToDisk(); window.showView('safe'); }
};



// --- 7. PHONEBOOK ---
window.renderPhoneBookView = function() { 
    const mergedContacts = [...(window.phoneBook || []).map((c, i) => ({ ...c, originalIndex: i, isSupplier: false })), ...(window.suppliers || []).map(s => ({ name: s.name, category: 'Supplier', phone: s.contact || 'No email/phone', notes: `Order Cutoff: ${s.cutoff}`, isSupplier: true }))].sort((a, b) => a.name.localeCompare(b.name));
    return `<div style="max-width: 900px; margin: auto;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h2 style="margin:0;">Master Phone Book</h2><button onclick="window.addContact()" class="btn btn-blue">+ Add Contact</button></div><table style="width:100%; background:var(--card-bg); border-radius:8px; border-collapse: collapse; overflow:hidden;"><thead><tr style="text-align:left; border-bottom:1px solid var(--border); background:#111;"><th style="padding:15px;">Name & Category</th><th style="padding:15px;">Contact Detail</th><th style="padding:15px;">Notes</th><th style="text-align:right; padding-right:15px;">Action</th></tr></thead><tbody>${mergedContacts.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No contacts.</td></tr>' : mergedContacts.map(c => `<tr style="border-bottom:1px solid var(--bg-main);"><td style="padding:15px;"><strong>${c.name}</strong><br><small style="color:var(--text-muted);">${c.category}</small></td><td style="padding:15px;">${c.phone.includes('@') ? `<a href="mailto:${c.phone}" style="color:var(--blue); font-weight:bold;">${c.phone}</a>` : `<a href="tel:${c.phone}" style="color:var(--blue); font-weight:bold;">${c.phone}</a>`}</td><td style="padding:15px; color:var(--brand-accent); font-size:13px; white-space:pre-wrap;">${c.notes || ''}</td><td style="text-align:right; padding-right:15px;">${c.isSupplier ? `<button onclick="window.showView('suppliers')" class="btn btn-outline" style="font-size:11px; padding:6px 10px;">Edit in Suppliers</button>` : `<button onclick="window.delContact(${c.originalIndex})" style="color:var(--red); background:none; border:none; cursor:pointer; font-weight:bold; font-size:20px; line-height:1;">&times;</button>`}</td></tr>`).join('')}</tbody></table></div>`; 
}
window.addContact = () => { 
    let html = `<input type="text" id="c-n" class="input-box" placeholder="Name"><select id="c-c" class="input-box"><option>Staff</option><option>Tradie / Maintenance</option><option>Service Provider</option><option>Other</option></select><input type="text" id="c-p" class="input-box" placeholder="Phone or Email"><textarea id="c-notes" class="input-box" placeholder="Notes..." style="height:80px; margin-bottom:20px;"></textarea><button onclick="window.subContact()" class="btn btn-green" style="width:100%;">Save Contact</button>`;
    window.openModal("📞 New Contact", html);
};
window.subContact = () => { window.phoneBook.push({ name: document.getElementById('c-n').value, category: document.getElementById('c-c').value, phone: document.getElementById('c-p').value, notes: document.getElementById('c-notes').value }); window.saveToDisk(); window.closeModal(); window.showView('phonebook'); window.showToast("Contact Saved!"); };
window.delContact = (i) => { if(confirm("Delete this contact?")) { window.phoneBook.splice(i,1); window.saveToDisk(); window.showView('phonebook'); } };

// --- 8. INCIDENT LOG ---
window.renderIncidentView = function() { return `<div style="max-width: 800px; margin: auto;"><h2 style="margin-top:0; margin-bottom:20px;">Incident Log</h2><div class="card" style="border-top:5px solid var(--red);"><textarea id="inc-desc" class="input-box" style="height:100px;" placeholder="Describe the incident in detail..."></textarea><input type="text" id="inc-staff" class="input-box" placeholder="Staff Name Logging Incident" style="margin-bottom:20px;"><button onclick="window.saveIncident()" class="btn btn-red" style="width:100%; font-size:16px;">Log Incident to Permanent Record</button></div>${(window.incidentLogs || []).slice().reverse().map(l => `<div class="card" style="margin-top:15px; padding:20px; border-left:4px solid var(--red);"><div><strong style="font-size:16px;">${l.staff}</strong><span style="color:var(--text-muted); float:right; font-size:12px;">${l.time}</span></div><p style="margin:10px 0 0 0; color:var(--text-main); font-size:14px; white-space:pre-wrap;">${l.desc}</p></div>`).join('')}</div>`; }
window.saveIncident = function() { window.incidentLogs.push({ staff: document.getElementById('inc-staff').value, desc: document.getElementById('inc-desc').value, time: new Date().toLocaleString() }); window.saveToDisk(); window.showToast("Incident Logged Permanently", "error"); window.showView('incidents'); };

// --- 9. COMMAND CENTER (DASHBOARD) ---
window.renderManagerHub = () => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=-42.8794&longitude=147.3294&current=temperature_2m,weather_code')
        .then(res => res.json())
        .then(data => {
            if(document.getElementById('hobart-temp')) {
                document.getElementById('hobart-temp').innerText = `${Math.round(data.current.temperature_2m)}°C`;
                document.getElementById('hobart-desc').innerText = "Live from Hobart Satellite";
            }
        }).catch(e => console.log("Weather fetch failed"));

    const isWeekend = [0, 5, 6].includes(new Date().getDay());
    const lowStock = (window.inventoryItems || []).filter(i => {
        if(i.archived) return false;
        let parTarget = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
        return i.stock < parTarget;
    });
    let stockHtml = lowStock.length > 0 ? lowStock.map(i => `<div style="color:var(--red); font-size:13px; padding:8px 0; border-bottom:1px dashed var(--border); display:flex; justify-content:space-between;"><span>⚠️ <strong>${i.name}</strong></span> <span>(${Number(i.stock).toFixed(1)} / ${isWeekend ? i.parWeekend : i.parWeekday})</span></div>`).join('') : '<p style="color:var(--green); font-size:14px; font-weight:bold; margin:0;">All inventory is at or above PAR.</p>';

    const openTickets = (window.defectLogs || []).filter(d => d.status === 'Open');
    let ticketHtml = openTickets.length > 0 ? openTickets.map(t => `<div style="color:var(--orange); font-size:13px; padding:8px 0; border-bottom:1px dashed var(--border);">🛠️ <strong>${t.item}</strong>: ${t.desc}</div>`).join('') : '<p style="color:var(--green); font-size:14px; font-weight:bold; margin:0;">No open maintenance issues.</p>';

    const marginAlerts = typeof window.checkRecipeMargins === 'function' ? window.checkRecipeMargins() : [];
    let marginHtml = marginAlerts.length > 0 ? marginAlerts.map(a => `<div style="color:var(--red); font-size:13px; padding:8px 0; border-bottom:1px dashed var(--border); display:flex; justify-content:space-between;"><span>📉 <strong>${a.name}</strong></span> <span><strong>${a.currentGp}%</strong> <small>($${a.cost})</small></span></div>`).join('') : '<p style="color:var(--green); font-size:14px; font-weight:bold; margin:0;">Menu margins are healthy (>70%).</p>';

    const today = new Date();
    const todayStr = today.toLocaleDateString();
    
    const eqAlerts = (window.equipmentData || []).filter(e => {
        if(!e.lastService || !e.interval) return false;
        const nextService = new Date(e.lastService); nextService.setMonth(nextService.getMonth() + Number(e.interval));
        return ((nextService - today) / (1000 * 3600 * 24)) <= 14;
    });
    let eqHtml = eqAlerts.length > 0 ? eqAlerts.map(e => `<div style="color:var(--orange); font-size:13px; padding:8px 0; border-bottom:1px dashed var(--border);">⚙️ <strong>${e.name}</strong> is due for service soon.</div>`).join('') : '';

    const freqMap = { 'Weekly': 7, 'Fortnightly': 14, 'Monthly': 30, 'Quarterly': 90 };
    const overdueTasks = (window.rotationalTasks || []).filter(t => {
        if(!t.lastLogIso) return true;
        return ((today - new Date(t.lastLogIso)) / (1000 * 3600 * 24)) >= freqMap[t.freq];
    });
    let taskHtml = overdueTasks.length > 0 ? overdueTasks.map(t => `<div style="color:var(--red); font-size:13px; padding:8px 0; border-bottom:1px dashed var(--border);">🔄 <strong>${t.name}</strong> (${t.freq}) is DUE NOW.</div>`).join('') : '<p style="color:var(--text-muted); font-size:13px; margin:0;">All rotational tasks are current.</p>';

    const todayIncidents = (window.incidentLogs || []).filter(i => i.time.includes(todayStr));
    let incHtml = todayIncidents.length > 0 ? todayIncidents.map(i => `<div style="color:var(--red); font-size:13px; padding:8px 0; border-bottom:1px dashed var(--border);">⚠️ <strong>${i.staff}</strong>: ${i.desc}</div>`).join('') : '<p style="color:var(--text-muted); font-size:13px; margin:0;">No incidents logged today.</p>';

    // Simple COGS Estimate metric
    let totalInvValue = (window.inventoryItems||[]).reduce((sum, item) => sum + ((item.price||0) * (item.stock||0)), 0);

    return `<div style="max-width: 1100px; margin: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:25px;">
            <h2 style="margin:0; font-size:28px;">Command Center</h2>
            <div style="text-align:right;">
                <div style="color:var(--brand-dark); font-size:16px; font-weight:bold;">${today.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div style="color:var(--brand-accent); font-size:12px; text-transform:uppercase; letter-spacing:1px; margin-top:2px;">Targeting ${isWeekend ? 'WEEKEND' : 'WEEKDAY'} Pars</div>
            </div>
        </div>
    
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:20px;">
        <div class="card" style="background: linear-gradient(135deg, #1e3a8a, #3b82f6); color: white; border:none; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
            <h3 style="margin:0; font-size:14px; text-transform:uppercase; letter-spacing:1px; opacity:0.9;">🌤️ Hobart Weather</h3>
            <div id="hobart-temp" style="font-size:48px; font-weight:bold; margin:10px 0;">Loading...</div>
            <p id="hobart-desc" style="margin:0; opacity:0.8; font-size:13px;">Connecting to satellite...</p>
        </div>
        <div class="card" style="background: rgba(139, 92, 246, 0.1); border:1px solid rgba(139, 92, 246, 0.3);">
            <h3 style="margin-top:0; color:var(--purple); display:flex; justify-content:space-between;"><span>🚨 Margin Alerts</span> <span style="font-size:12px; background:var(--purple); color:white; padding:2px 8px; border-radius:10px;">${marginAlerts.length}</span></h3>
            <div style="max-height:120px; overflow-y:auto; padding-right:10px;">${marginHtml}</div>
        </div>
        <div class="card" style="border-top:5px solid var(--green); display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
            <h3 style="margin:0; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:var(--text-muted);">Est. Stock Value</h3>
            <div style="font-size:42px; font-weight:bold; color:var(--green); margin:10px 0;">$${totalInvValue.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}</div>
            <p style="margin:0; color:var(--text-muted); font-size:12px;">Based on Current Buy Units</p>
        </div>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:20px;">
        <div class="card" style="border-top:5px solid var(--blue);"><h3 style="margin-top:0; color:var(--brand-accent);">📦 Inventory Alerts <small style="color:var(--text-muted); font-weight:normal;">(${isWeekend?'Weekend':'Weekday'} PAR)</small></h3><div style="max-height:200px; overflow-y:auto; padding-right:10px;">${stockHtml}</div></div>
        <div class="card" style="border-top:5px solid var(--orange);"><h3 style="margin-top:0; color:var(--brand-accent);">🛠️ Maintenance Tickets</h3><div style="max-height:200px; overflow-y:auto; padding-right:10px;">${ticketHtml}${eqHtml}</div></div>
    </div>
    
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
        <div class="card" style="border-top:5px solid var(--red);"><h3 style="margin-top:0; color:var(--brand-accent);">🔄 Overdue Tasks</h3><div style="max-height:150px; overflow-y:auto; padding-right:10px;">${taskHtml}</div></div>
        <div class="card" style="border-top:5px solid var(--red);"><h3 style="margin-top:0; color:var(--brand-accent);">⚠️ Today's Incidents</h3><div style="max-height:150px; overflow-y:auto; padding-right:10px;">${incHtml}</div></div>
    </div>
    
    </div>`;
};

// --- 10. HANDOVER ---
window.renderHandoverView = () => {
    return `<div style="max-width: 900px; margin: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h2 style="margin:0;">Shift Handover</h2>
            <div>
                <button onclick="window.generateAIHandoverSummary()" class="btn btn-purple" style="margin-right:10px;">✨ AI Auto-Summary</button>
                <button onclick="window.newHandoverForm()" class="btn btn-blue">+ New Handover</button>
            </div>
        </div>
        <div id="ai-summary-box"></div>
        ${(window.handoverLogs || []).length === 0 ? '<div class="card"><p style="color:var(--text-muted); margin:0;">No handovers logged.</p></div>' : window.handoverLogs.slice().reverse().map(h => `<div class="card" style="border-left:5px solid var(--purple); margin-bottom:15px; padding:20px;"><div style="display:flex; justify-content:space-between; margin-bottom:15px;"><strong style="font-size:18px;">${h.shift} - ${h.date}</strong><span style="color:var(--brand-accent); background:var(--bg-main); padding:4px 10px; border-radius:15px; font-size:12px; border:1px solid var(--border);">Manager: ${h.manager}</span></div><p style="margin:0 0 15px 0; white-space:pre-wrap; font-size:15px; line-height:1.5;">${h.notes}</p>${h.urgent ? `<div style="color:var(--red); font-size:13px; font-weight:bold; background:rgba(239, 68, 68, 0.1); padding:10px; border-radius:6px; border:1px solid rgba(239, 68, 68, 0.2);">⚠️ URGENT PASSON: ${h.urgent}</div>` : ''}</div>`).join('')}
    </div>`;
};

window.generateAIHandoverSummary = async () => {
    const target = document.getElementById('ai-summary-box'); target.innerHTML = `<div class="card" style="text-align:center; border:1px solid var(--purple);"><p style="color:var(--purple); font-weight:bold; font-size:16px;">🤖 AI is analyzing today's logs for you...</p></div>`;
    const summaryData = { temps: (window.tempLogs || []).filter(l => l.time.includes(new Date().toLocaleDateString())), wastage: (window.wastageLogs || []).filter(l => l.time.includes(new Date().toLocaleDateString())), defects: (window.defectLogs || []).filter(l => l.status === 'Open'), trained: (window.orientationLogs || []).filter(l => l.status === 'Completed').length };
    const prompt = `Write a short 3-sentence end-of-shift manager summary. Mention today's fridge alerts: ${JSON.stringify(summaryData.temps)}, wastage logged: ${JSON.stringify(summaryData.wastage)}, and current open maintenance issues: ${JSON.stringify(summaryData.defects)}. Keep it professional.`;
    try {
        const apiKey = window.getApiKey(); if(!apiKey) return target.innerHTML = '';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json(); if (data.error) throw new Error(data.error.message);
        const text = data.candidates[0].content.parts[0].text;
        target.innerHTML = `<div class="card" style="border-left:5px solid var(--purple); background:rgba(139, 92, 246, 0.05);"><h4 style="margin:0 0 10px 0; color:var(--purple);">🤖 AI Suggested Handover Summary</h4><p style="font-size:15px; font-style:italic; line-height:1.5;">"${text}"</p><button onclick="window.copyToHandover('${text.replace(/'/g, "\\'")}')" class="btn btn-outline" style="font-size:12px; margin-top:10px;">Copy to New Handover</button></div>`;
    } catch (e) { target.innerHTML = `<div class="card"><p style="color:var(--red);">AI Summary failed. Check API key.</p></div>`; }
};
window.copyToHandover = (text) => { window.newHandoverForm(); setTimeout(() => { document.getElementById('h-notes').value = text; }, 100); };

window.newHandoverForm = () => { 
    let html = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;"><select id="h-shift" class="input-box" style="margin:0;"><option>AM Shift</option><option>PM Shift</option><option>Full Day</option></select><input type="text" id="h-mgr" class="input-box" placeholder="Manager Name" style="margin:0;"></div><label style="font-size:11px; color:var(--text-muted);">Shift Notes</label><textarea id="h-notes" class="input-box" placeholder="Shift notes, staff issues, 86'd items..." style="height:120px; margin-bottom:15px;"></textarea><label style="font-size:11px; color:var(--red); font-weight:bold;">Urgent Pass-on (Optional)</label><input type="text" id="h-urgent" class="input-box" placeholder="Critical info for next shift..." style="margin-bottom:20px; border-color:var(--red);"><button onclick="window.saveHandover()" class="btn btn-green" style="width:100%; font-size:16px;">Submit Handover</button>`;
    window.openModal("📝 New Shift Handover", html);
};
window.saveHandover = () => { const mgr = document.getElementById('h-mgr').value; const notes = document.getElementById('h-notes').value; if(!mgr || !notes) return window.showToast("Manager and Notes required.", "error"); window.handoverLogs.push({ date: new Date().toLocaleDateString(), shift: document.getElementById('h-shift').value, manager: mgr, notes: notes, urgent: document.getElementById('h-urgent').value }); window.saveToDisk(); window.closeModal(); window.showView('handover'); window.showToast("Handover Submitted!"); };


// --- 11. KNOWLEDGE BASE ---
window._kbActiveTab = window._kbActiveTab || 'all';

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
        return `<span class="tag-pill ${activeTab===c?'active':''}" onclick="window._kbActiveTab='${c.replace(/'/g,"\\'")}';window.showView('knowledge');">${c} (${count})</span>`;
    })).join('');

    const cardsHtml = filtered.length === 0
        ? '<div class="card"><p style="color:var(--text-muted);margin:0;">No SOPs in this category yet.</p></div>'
        : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">${filtered.map(k =>
            `<div class="card" style="margin:0;padding:20px;cursor:pointer;transition:transform 0.2s;border-top:4px solid var(--blue);" onclick="window.viewSOP(${k.idx})" onmouseover="this.style.transform='translateY(-3px)'" onmouseout="this.style.transform='translateY(0)'">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                    <h4 style="margin:0;font-size:15px;flex:1;padding-right:8px;">${k.title}</h4>
                    ${k.fileUrl ? '<span style="font-size:18px;flex-shrink:0;" title="Has attachment">📎</span>' : ''}
                </div>
                <span style="font-size:11px;color:var(--text-muted);background:var(--bg-main);padding:2px 8px;border-radius:8px;border:1px solid var(--border);display:inline-block;margin-bottom:10px;">${k.category || 'General'}</span>
                ${k.content ? `<p style="color:var(--text-muted);font-size:13px;margin:0;line-height:1.4;">${k.content.substring(0,80)}${k.content.length>80?'...':''}</p>` : '<p style="color:var(--text-muted);font-size:13px;margin:0;font-style:italic;">File attachment only</p>'}
            </div>`
        ).join('')}</div>`;

    return `<div style="max-width:1000px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">
            <h2 style="margin:0;">Knowledge Base</h2>
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
                <span style="font-size:14px;">${c}</span>
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
    if (confirm('Delete this category? SOPs in it will move to General.')) {
        const cat = window.kbCategories[i];
        (window.knowledgeBase || []).forEach(k => { if (k.category === cat) k.category = 'General'; });
        window.kbCategories.splice(i, 1);
        window.saveToDisk(); window.editKbCategories();
    }
};

window.newSOPForm = () => {
    const cats = window.kbCategories || [];
    const catOpts = cats.map(c => `<option value="${c}">${c}</option>`).join('');
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
        <h2 style="margin:0 0 8px 0;">${k.title}</h2>
        <div style="display:flex;gap:8px;margin-bottom:25px;flex-wrap:wrap;">
            <span class="tag-pill" style="margin:0;">${k.category || 'General'}</span>
            ${k.lastModified ? `<span style="font-size:12px;color:var(--text-muted);align-self:center;">Last updated: ${k.lastModified}</span>` : ''}
        </div>
        ${k.fileUrl ? `<div style="margin-bottom:20px;padding:15px;background:var(--bg-main);border-radius:8px;border:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:13px;color:var(--text-muted);">📎 Attached file</span>
            <a href="${k.fileUrl}" target="_blank" download class="btn btn-outline" style="text-decoration:none;font-size:12px;">Download / View</a>
        </div>` : ''}
        ${k.content ? `<div style="white-space:pre-wrap;line-height:1.8;font-size:15px;color:var(--text-main);">${k.content}</div>` : '<p style="color:var(--text-muted);font-style:italic;">No written content — see attached file above.</p>'}
    </div>`;
};

window.editSOPForm = (i) => {
    const k = window.knowledgeBase[i];
    const cats = window.kbCategories || [];
    const catOpts = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    const html = `
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:15px;">
            <div><label style="font-size:11px;color:var(--text-muted);">Title</label>
            <input type="text" id="k-edit-title" class="input-box" value="${k.title.replace(/"/g,'&quot;')}" style="margin:0;"></div>
            <div><label style="font-size:11px;color:var(--text-muted);">Category</label>
            <input type="text" id="k-edit-cat" class="input-box" value="${k.category||''}" list="kb-edit-cats" style="margin:0;">
            <datalist id="kb-edit-cats">${catOpts}</datalist></div>
        </div>
        <label style="font-size:11px;color:var(--text-muted);">Content</label>
        <textarea id="k-edit-content" class="input-box" style="height:200px;margin-bottom:15px;line-height:1.6;">${k.content||''}</textarea>
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
    if (confirm('Delete this SOP?')) {
        window.knowledgeBase.splice(i, 1);
        window.saveToDisk(); window.showView('knowledge'); window.showToast('SOP Deleted.');
    }
};



// --- 12. ROSTERS ---
window.renderRosterView = () => {
    return `<div style="max-width: 900px; margin: auto;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h2 style="margin:0;">Shift Rosters</h2><label class="btn btn-blue" style="cursor:pointer;">+ Upload Roster PDF/Image<input type="file" id="roster-upload" accept="application/pdf,image/*" style="display:none;" onchange="window.handleRosterUpload(event)"></label></div>${(window.shiftRosters || []).length === 0 ? '<div class="card"><p style="color:var(--text-muted); margin:0;">No rosters uploaded.</p></div>' : window.shiftRosters.slice().reverse().map((r, i) => {
        let actualIndex = window.shiftRosters.length - 1 - i;
        let displayHtml = '';
        if (r.data) {
            if (r.data.includes('.jpg') || r.data.includes('.png') || r.data.includes('.jpeg') || r.data.includes('image')) { displayHtml = `<img src="${r.data}" style="max-width:100%; border-radius:8px; margin-bottom:10px; border:1px solid var(--border);">`; } 
            else { displayHtml = `<iframe src="${r.data}" style="width:100%; height:600px; border:none; border-radius:8px; margin-bottom:10px; border:1px solid var(--border);"></iframe>`; }
        }
        return `<div class="card" style="margin-bottom:20px; border-top: 5px solid var(--blue); padding:30px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><div><strong style="font-size:22px; color:var(--brand-dark);">${r.name}</strong><br><small style="color:var(--text-muted); margin-top:5px; display:block;">Uploaded: ${r.date}</small></div><div style="display:flex; gap:10px;">${r.data ? `<a href="${r.data}" target="_blank" download="${r.name}" class="btn btn-outline" style="text-decoration:none;">Download / Fullscreen</a>` : ''}<button onclick="window.deleteRoster(${actualIndex})" class="btn btn-red">Delete</button></div></div>${displayHtml}</div>`;
    }).join('')}</div>`;
};
window.handleRosterUpload = async (e) => {
    if(!e.target.files.length) return;
    const file = e.target.files[0]; let weekName = prompt("Enter Roster Week Name:", file.name.split('.')[0]); if(!weekName) return;
    window.showToast("Uploading roster, please wait... ⏳");
    try {
        const fileRef = storage.ref().child(`rosters/${Date.now()}_${file.name}`); await fileRef.put(file); const downloadURL = await fileRef.getDownloadURL();
        window.shiftRosters.push({ name: weekName, date: new Date().toLocaleDateString(), data: downloadURL }); window.saveToDisk(); window.showView('rosters'); window.showToast("Roster Uploaded successfully!");
    } catch(err) { console.error("Upload failed", err); window.showToast("Upload failed.", "error"); }
};
window.deleteRoster = (i) => { if(confirm("Delete roster?")) { window.shiftRosters.splice(i,1); window.saveToDisk(); window.showView('rosters'); } };
