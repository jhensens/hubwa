// --- HOBART HUB: Depletion Module ---
// Wastage Tracker, Wastage Report, AI POS Depletion, Depletion Confirmation, Unified Execution, Reversal, Depletion History

// =============================================================================
// 6. WASTAGE TRACKER
// =============================================================================

window._buildWasteChart = () => {
    const logs = window.wastageLogs || [];
    const now = new Date();
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    // Find Monday of current week
    const monday = new Date(now);
    monday.setHours(0,0,0,0);
    const dow = monday.getDay();
    monday.setDate(monday.getDate() - ((dow + 6) % 7));

    const daily = [0,0,0,0,0,0,0]; // Mon-Sun
    logs.forEach(w => {
        const d = new Date(w.time);
        if (isNaN(d)) return;
        const diff = Math.floor((d - monday) / 86400000);
        if (diff >= 0 && diff < 7) daily[diff] += Number(w.value || 0);
    });

    const maxVal = Math.max(...daily, 1);
    const W = 100, H = 150, pad = 30, barGap = 4;
    const barW = (W - pad - 5) / 7 - barGap;
    const chartH = H - pad - 10;

    const bars = daily.map((v, i) => {
        const x = pad + i * (barW + barGap) + barGap / 2;
        const bH = (v / maxVal) * chartH;
        const y = H - pad - bH;
        const col = v === 0 ? 'rgba(255,255,255,0.08)' : v < 20 ? '#22c55e' : v <= 50 ? '#f59e0b' : '#ef4444';
        const dayIdx = (1 + i) % 7; // Mon=1..Sun=0
        const label = dayNames[dayIdx];
        const isToday = i === ((now.getDay() + 6) % 7);
        return `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(bH, 1)}" rx="2" fill="${col}" opacity="${v === 0 ? 0.3 : 0.85}"/>` +
            (v > 0 ? `<text x="${x + barW/2}" y="${y - 3}" text-anchor="middle" fill="var(--text-muted)" font-size="3.5">$${v.toFixed(0)}</text>` : '') +
            `<text x="${x + barW/2}" y="${H - pad + 9}" text-anchor="middle" fill="${isToday ? '#fff' : 'var(--text-muted)'}" font-size="3.5" font-weight="${isToday ? '700' : '400'}">${label}</text>`;
    }).join('');

    // Y-axis labels
    const yLabels = [0, Math.round(maxVal/2), Math.round(maxVal)].map((v, i) => {
        const y = H - pad - (v / maxVal) * chartH;
        return `<text x="${pad - 2}" y="${y + 1.5}" text-anchor="end" fill="var(--text-muted)" font-size="3.2">$${v}</text>` +
            `<line x1="${pad}" y1="${y}" x2="${W - 2}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="0.3"/>`;
    }).join('');

    const weekTotal = daily.reduce((s, v) => s + v, 0);
    return `<div class="card" style="padding:12px 10px 8px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">This Week's Waste</span>
            <span style="font-size:14px;font-weight:700;color:${weekTotal > 200 ? 'var(--red)' : weekTotal > 100 ? 'var(--orange)' : 'var(--green)'};">$${weekTotal.toFixed(2)}</span>
        </div>
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:150px;">
            ${yLabels}${bars}
        </svg>
        <div style="display:flex;gap:12px;justify-content:center;margin-top:4px;">
            <span style="font-size:10px;color:var(--text-muted);"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#22c55e;margin-right:3px;vertical-align:middle;"></span>&lt;$20</span>
            <span style="font-size:10px;color:var(--text-muted);"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#f59e0b;margin-right:3px;vertical-align:middle;"></span>$20-50</span>
            <span style="font-size:10px;color:var(--text-muted);"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#ef4444;margin-right:3px;vertical-align:middle;"></span>&gt;$50</span>
        </div>
    </div>`;
};

window.renderWastageView = () => {
    const invOpts = (window.inventoryItems || []).filter(i => !i.archived).map(i =>
        `<option value="${esc(i.id)}">${esc(i.name)} (Buy: ${esc(i.buyUnit)} / Use: ${esc(i.useUnit)})</option>`
    ).join('');
    const logs = window.wastageLogs || [];
    const recentLogs = logs.slice().reverse().slice(0, 50);
    return `
    <div style="max-width: 800px; margin: auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">🗑️ Wastage Tracker</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Log spoilage, breakage, and expired stock to track and reduce waste</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button onclick="window.exportWastageCSV()" class="btn btn-outline" style="font-size:12px;">📥 Export CSV</button>
                <button onclick="window.showWastageReport()" class="btn btn-outline" style="font-size:12px;">📊 Wastage Report</button>
            </div>
        </div>
        ${window._buildWasteChart()}
        <div class="card" style="border-top:5px solid var(--orange);">
            <div style="margin-bottom:15px;">
                <label style="font-size:11px; color:var(--text-muted);">Select Live Inventory Item</label>
                <select id="w-item" class="input-box" style="margin:0;"><option value="">-- Choose Item --</option>${invOpts}</select>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px; background:var(--bg-main); padding:15px; border-radius:6px; border:1px solid var(--border);">
                <div>
                    <label style="font-size:11px; color:var(--text-muted);">Quantity Wasted</label>
                    <input type="number" step="0.01" id="w-qty" class="input-box" placeholder="e.g. 1.5" style="margin:0;">
                </div>
                <div style="display:flex; flex-direction:column; justify-content:center;">
                    <label style="font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px;">
                        <input type="radio" name="w-unit-type" id="w-buy" value="buy" checked style="transform:scale(1.2);">
                        Buy Units <small style="color:var(--text-muted); font-weight:normal;">(Bottles, Kegs etc)</small>
                    </label>
                    <label style="font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:8px; margin-top:10px;">
                        <input type="radio" name="w-unit-type" id="w-use" value="use" style="transform:scale(1.2);">
                        Use Units <small style="color:var(--text-muted); font-weight:normal;">(ml, kg, shots)</small>
                    </label>
                </div>
            </div>
            <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px;">
                <div><label style="font-size:11px; color:var(--text-muted);">Reason</label><input type="text" id="w-rsn" class="input-box" placeholder="Dropped, Expired, Spilled..."></div>
                <div><label style="font-size:11px; color:var(--text-muted);">Staff Name</label><input type="text" id="w-staff" class="input-box" placeholder="Initials"></div>
            </div>
            <button onclick="window.logWastage()" class="btn btn-orange" style="width:100%; margin-top:10px; font-size:14px;">Log Waste & Deduct Stock</button>
        </div>
        ${recentLogs.length === 0 ? '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">🗑️</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No wastage logged</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Log spoilage, breakage, or expired stock to track and reduce waste</div></div>' :
        '<h3 style="margin-top:30px; border-bottom:1px solid var(--border); padding-bottom:10px;">Recent Logs</h3>' +
        recentLogs.map(w =>
            `<div class="card" style="margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; align-items:center;">
                <div><strong>${esc(w.itemName)}</strong> <span style="color:var(--orange); font-size:13px;">(${esc(String(w.logQty))} ${esc(w.unitLog)})</span><br><small style="color:var(--text-muted);">${esc(w.staff)} - ${esc(w.reason)}</small></div>
                <div style="text-align:right;"><strong style="color:var(--red);">$${Number(w.value).toFixed(2)} Lost</strong><br><small style="color:var(--text-muted);">${esc(w.time)}</small></div>
            </div>`
        ).join('')}
    </div>`;
};


// =============================================================================
// WASTAGE REPORT
// =============================================================================
window.showWastageReport = () => {
    const logs = window.wastageLogs || [];
    if (logs.length === 0) return window.showToast('No wastage logged yet.','error');

    // Last 30 days
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30);
    const recent = logs.filter(w => new Date(w.time) >= cutoff);
    const totalVal = recent.reduce((s,w) => s + Number(w.value||0), 0);

    // By item
    const byItem = {};
    recent.forEach(w => {
        if (!byItem[w.itemName]) byItem[w.itemName] = { count:0, value:0, category: w.category||'Uncategorised' };
        byItem[w.itemName].count++;
        byItem[w.itemName].value += Number(w.value||0);
    });
    const topItems = Object.entries(byItem).sort((a,b)=>b[1].value-a[1].value).slice(0,10);

    // By category (food vs bev)
    const byReason = {};
    recent.forEach(w => {
        const r = w.reason || 'Unknown';
        if (!byReason[r]) byReason[r] = 0;
        byReason[r] += Number(w.value||0);
    });
    const topReasons = Object.entries(byReason).sort((a,b)=>b[1]-a[1]).slice(0,5);

    const rows = topItems.map(([name, d]) =>
        '<tr style="border-bottom:1px solid var(--border);">' +
        '<td style="padding:8px 12px;">' + esc(name) + '</td>' +
        '<td style="padding:8px 12px;text-align:center;">' + d.count + '</td>' +
        '<td style="padding:8px 12px;text-align:right;color:var(--red);font-weight:bold;">$' + d.value.toFixed(2) + '</td>' +
        '<td style="padding:8px 12px;"><div style="background:var(--red);height:6px;border-radius:3px;width:' + Math.min(100,(d.value/totalVal*100)).toFixed(0) + '%;opacity:0.7;"></div></td>' +
        '</tr>'
    ).join('');

    const html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px;">' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--red);">' +
            '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Total Lost (30 days)</div>' +
            '<div style="font-size:24px;font-weight:bold;color:var(--red);">$' + totalVal.toFixed(2) + '</div>' +
        '</div>' +
        '<div class="card" style="text-align:center;border-top:4px solid var(--orange);">' +
            '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Incidents (30 days)</div>' +
            '<div style="font-size:24px;font-weight:bold;color:var(--orange);">' + recent.length + '</div>' +
        '</div>' +
    '</div>' +
    '<h4 style="margin:0 0 10px 0;color:var(--text-muted);font-size:12px;text-transform:uppercase;">Top Wasted Items</h4>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">' +
    '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
    '<th style="padding:8px 12px;text-align:left;">Item</th><th style="padding:8px 12px;text-align:center;">Count</th><th style="padding:8px 12px;text-align:right;">Value Lost</th><th style="padding:8px 12px;">Bar</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table>' +
    '<h4 style="margin:0 0 10px 0;color:var(--text-muted);font-size:12px;text-transform:uppercase;">Top Reasons</h4>' +
    topReasons.map(([r,v]) => '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--border);font-size:13px;"><span>' + esc(r) + '</span><span style="color:var(--red);font-weight:bold;">$' + v.toFixed(2) + '</span></div>').join('');

    window.openModal('🗑️ Wastage Report — Last 30 Days', html);
};

window.exportWastageCSV = () => {
    const logs = window.wastageLogs || [];
    if (!logs.length) return window.showToast('No wastage logs to export.', 'error');
    const headers = ['Date/Time','Item','Quantity','Unit','Reason','Staff','Value ($)'];
    const rows = logs.map(w => [
        w.time || '', w.itemName || '', w.logQty || '', w.unitLog || '',
        w.reason || '', w.staff || '', Number(w.value || 0).toFixed(2)
    ].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'wastage-log-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    window.showToast(logs.length + ' wastage entries exported.');
};

window.logWastage = () => {
    const invId = document.getElementById('w-item').value;
    const qtyInput = parseFloat(document.getElementById('w-qty').value) || 0;
    if (!invId || !qtyInput) return window.showToast("Select item and enter quantity.", "error");
    const invMatch = window.inventoryItems.find(i => i.id === invId);
    if (!invMatch) return;
    const unitType = document.querySelector('input[name="w-unit-type"]:checked').value;
    let deductBuyUnits, dollarVal, displayUnit;
    if (unitType === 'use') {
        deductBuyUnits = qtyInput / (invMatch.yield || 1);
        dollarVal = deductBuyUnits * (invMatch.price || 0);
        displayUnit = invMatch.useUnit;
    } else {
        deductBuyUnits = qtyInput;
        dollarVal = qtyInput * (invMatch.price || 0);
        displayUnit = invMatch.buyUnit;
    }
    window.logStockMovement(invMatch.id, -deductBuyUnits, 'waste', { staff: document.getElementById('w-staff').value, notes: document.getElementById('w-rsn').value });
    invMatch.stock = Math.max(0, (invMatch.stock || 0) - deductBuyUnits);
    window.wastageLogs.push({
        itemName: invMatch.name, logQty: qtyInput, unitLog: displayUnit,
        deductedBuyUnits: deductBuyUnits, value: dollarVal,
        reason: document.getElementById('w-rsn').value,
        staff: document.getElementById('w-staff').value,
        time: new Date().toLocaleString()
    });
    window.saveToDisk();
    const remainStock = invMatch.stock;
    window.showToast(`Logged: ${qtyInput} ${displayUnit} wasted ($${dollarVal.toFixed(2)}). ${invMatch.name} stock now ${remainStock.toFixed(1)} ${invMatch.buyUnit}.`);
    window.showView('wastage');
};

// =============================================================================
// 7. MAP-ON-THE-FLY POS DEPLETION
// =============================================================================

window.pendingMap = { known: [], unknown: [] };

window.openAiDepletion = () => {
    document.getElementById('mainContent').innerHTML = `
    <div style="max-width:800px; margin:auto;">
        <h2 style="margin-top:0;">✨ AI EOD Stock Depletion</h2>
        <div class="card" style="border-top:5px solid var(--purple);">
            <p style="color:var(--text-muted); font-size:14px; margin-top:0;">Paste your end-of-day Product Mix text from Lightspeed. The AI will map sales to recipes and accurately deplete stock using strict yield logic.</p>
            <textarea id="ai-pos-text" class="input-box" style="height:250px; font-family:monospace; font-size:12px;" placeholder="Paste Lightspeed sales text here..."></textarea>
            <button onclick="window.runAiDepletion()" class="btn btn-purple" style="width:100%; font-size:16px; padding:12px; font-weight:bold;">Analyze & Deplete</button>
            <button onclick="window.showView('sales')" class="btn btn-outline" style="width:100%; margin-top:10px;">Cancel</button>
            <div id="ai-depletion-status" style="margin-top:15px; text-align:center;"></div>
        </div>
    </div>`;
};

window.runAiDepletion = async () => {
    const rawText = document.getElementById('ai-pos-text').value;
    const statusDiv = document.getElementById('ai-depletion-status');
    if (!rawText.trim()) return window.showToast("Please paste sales text.", "error");
    const menuItems = (window.recipes || []).filter(r => r.type === 'Menu');
    if (menuItems.length === 0) return statusDiv.innerHTML = `<p style="color:var(--orange);">⚠️ No Menu Recipes built in the Hub yet!</p>`;
    statusDiv.innerHTML = `<p style="color:var(--brand-accent); font-weight:bold;">🤖 AI is translating Lightspeed data...</p>`;
    window.showLoadingOverlay('🤖 AI is analyzing POS data...');
    const prompt = `Extract items and Quantity Sold from this POS table. Return ONLY JSON: { "results": [ { "rawName": "Exact POS Item Name", "qtySold": 42 } ] } Text: ${rawText}`;
    try {
        const apiKey = window.getApiKey(); if (!apiKey) { window.hideLoadingOverlay(); return; }
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json(); if (data.error) throw new Error(data.error.message);
        let rawJson = data.candidates[0].content.parts[0].text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        const aiResult = JSON.parse(rawJson);
        window.pendingMap = { known: [], unknown: [] };
        (aiResult.results || []).forEach(res => {
            let matchedRecipeId = window.posMappings[res.rawName];
            if (!matchedRecipeId) {
                let explicitMatch = menuItems.find(r => r.posAlias && r.posAlias.toLowerCase() === res.rawName.toLowerCase());
                if (explicitMatch) matchedRecipeId = explicitMatch.id;
            }
            if (matchedRecipeId && window.recipes.find(r => r.id === matchedRecipeId)) {
                window.pendingMap.known.push({ posName: res.rawName, recipeId: matchedRecipeId, qtySold: res.qtySold });
            } else {
                window.pendingMap.unknown.push({ posName: res.rawName, qtySold: res.qtySold });
            }
        });
        window.hideLoadingOverlay();
        // Build salesItems from AI results and route through unified confirmation
        const aiSalesItems = window.pendingMap.known.map(k => ({ rawName: k.posName, qtySold: k.qtySold }));
        window.pendingMap.unknown.forEach(u => aiSalesItems.push({ rawName: u.posName, qtySold: u.qtySold }));
        window.showDepletionConfirmation(aiSalesItems, 'ai-depletion');
    } catch (e) { window.hideLoadingOverlay(); statusDiv.innerHTML = `<p style="color:var(--red);">API Error: ${e.message}</p>`; }
};

// =============================================================================
// UNIFIED DEPLETION CONFIRMATION UI
// Both CSV and AI paths route through this confirmation before stock changes
// =============================================================================

window._pendingDepletionData = null; // holds { salesItems, source, preview }

window.showDepletionConfirmation = function(salesItems, source) {
    var preview = window.previewSalesDeductions(salesItems);
    window._pendingDepletionData = { salesItems: salesItems, source: source, preview: preview };

    // Check for same-day duplicate
    var today = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var existingRuns = (window.depletionLogs || []).filter(function(d) {
        return d.date === today && d.source === source && !d.reversed;
    });

    var recipeOpts = '<option value="">-- Select Hub Recipe --</option>' +
        (window.recipes || []).filter(function(r) { return r.type === 'Menu'; })
        .sort(function(a, b) { return a.name.localeCompare(b.name); })
        .map(function(r) { return '<option value="' + r.id + '">' + esc(r.name) + '</option>'; }).join('');

    var sourceLabel = source === 'csv-depletion' ? 'Lightspeed CSV' : 'AI POS Depletion';
    var sourceColor = source === 'csv-depletion' ? 'var(--blue)' : 'var(--purple)';

    var html = '<div style="max-width:850px; margin:auto; padding-bottom:90px;">' +
        '<h2 style="margin-top:0;">Confirm Stock Depletion</h2>' +
        '<p style="color:var(--text-muted); font-size:13px; margin-top:-10px;">Source: <span style="color:' + sourceColor + '; font-weight:bold;">' + sourceLabel + '</span> · ' + salesItems.length + ' POS items · ' + preview.matched.length + ' matched · ' + preview.unmatched.length + ' unmatched</p>';

    // Duplicate day warning
    if (existingRuns.length > 0) {
        var prevRun = existingRuns[existingRuns.length - 1];
        html += '<div style="background:rgba(245,158,11,0.1); border:1px solid var(--orange); padding:15px; border-radius:8px; margin-bottom:20px;">' +
            '<h4 style="color:var(--orange); margin:0 0 8px;">⚠️ Duplicate Run Detected</h4>' +
            '<p style="font-size:13px; margin:0 0 12px;">A ' + sourceLabel + ' depletion was already run today at ' + esc(prevRun.time) + ' (' + prevRun.totalLines + ' stock lines). Choose how to proceed:</p>' +
            '<div style="display:flex; gap:10px; flex-wrap:wrap;">' +
                '<label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; padding:8px 12px; background:var(--bg-main); border-radius:6px; border:1px solid var(--border);">' +
                    '<input type="radio" name="dup-action" value="add" checked> <strong>Add</strong> — run both (additive)</label>' +
                '<label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; padding:8px 12px; background:var(--bg-main); border-radius:6px; border:1px solid var(--border);">' +
                    '<input type="radio" name="dup-action" value="replace"> <strong>Replace</strong> — undo previous, apply this</label>' +
            '</div></div>';
    }

    // Unmatched items section (mapping UI)
    if (preview.unmatched.length > 0) {
        html += '<div class="card" style="border-top:3px solid var(--orange); margin-bottom:20px;">' +
            '<h4 style="color:var(--orange); margin-top:0;">⚠️ Unmatched Items (' + preview.unmatched.length + ')</h4>' +
            '<p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Map these to a recipe — the Hub remembers for next time. Leave blank to skip.</p>';
        preview.unmatched.forEach(function(u, i) {
            html += '<div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid var(--border); gap:10px;">' +
                '<div style="min-width:0; flex:1;"><strong style="color:var(--orange);">' + esc(u.rawName) + '</strong><br><small style="color:var(--text-muted);">Sold: ' + u.qtySold + '</small></div>' +
                '<select id="map-unknown-' + i + '" class="input-box" style="width:250px; margin:0; border-color:var(--orange); flex-shrink:0;">' + recipeOpts + '</select>' +
            '</div>';
        });
        html += '</div>';
    }

    // Matched items section
    if (preview.matched.length > 0) {
        html += '<div class="card" style="border-top:3px solid var(--green); margin-bottom:20px;">' +
            '<h4 style="color:var(--green); margin-top:0;">Matched Items (' + preview.matched.length + ')</h4>' +
            '<div style="max-height:250px; overflow-y:auto; -webkit-overflow-scrolling:touch; font-size:13px;">';
        preview.matched.forEach(function(m, i) {
            html += '<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px dashed var(--border);">' +
                '<label style="display:flex; align-items:center; gap:8px; cursor:pointer; min-width:0; flex:1;">' +
                    '<input type="checkbox" id="match-check-' + i + '" checked style="flex-shrink:0; width:18px; height:18px;">' +
                    '<span style="color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(m.rawName) + '</span>' +
                    '<span style="color:var(--text-muted);"> ➔ </span>' +
                    '<strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(m.matchName) + '</strong>' +
                '</label>' +
                '<span style="color:var(--green); font-weight:bold; flex-shrink:0; margin-left:10px;">' + m.qtySold + '</span>' +
            '</div>';
        });
        html += '</div></div>';
    }

    // Stock impact preview
    if (preview.stockChanges.length > 0) {
        html += '<div class="card" style="border-top:3px solid var(--red); margin-bottom:20px;">' +
            '<h4 style="color:var(--red); margin-top:0;">Stock Impact Preview (' + preview.stockChanges.length + ' items)</h4>' +
            '<div style="max-height:250px; overflow-y:auto; -webkit-overflow-scrolling:touch; font-size:13px;">' +
            '<div style="display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:4px 12px; padding:6px 0; border-bottom:2px solid var(--border); font-weight:bold; font-size:11px; color:var(--text-muted); text-transform:uppercase;">' +
                '<div>Item</div><div style="text-align:right;">Current</div><div style="text-align:right;">After</div><div style="text-align:right;">Change</div></div>';
        preview.stockChanges.forEach(function(sc) {
            var isZero = sc.after === 0;
            html += '<div style="display:grid; grid-template-columns:2fr 1fr 1fr 1fr; gap:4px 12px; padding:6px 0; border-bottom:1px dashed var(--border);' + (isZero ? ' background:rgba(239,68,68,0.08);' : '') + '">' +
                '<div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + esc(sc.name) + (isZero ? ' <span style="color:var(--red); font-size:11px;">⚠️ ZERO</span>' : '') + '</div>' +
                '<div style="text-align:right;">' + sc.before + ' <small style="color:var(--text-muted);">' + esc(sc.unit) + '</small></div>' +
                '<div style="text-align:right; font-weight:bold;' + (isZero ? ' color:var(--red);' : '') + '">' + sc.after + '</div>' +
                '<div style="text-align:right; color:var(--red);">' + sc.delta + '</div>' +
            '</div>';
        });
        html += '</div></div>';
    }

    // Sticky footer
    html += '<div class="sticky-footer">' +
        '<button onclick="window.executeUnifiedDepletion()" class="btn btn-red" style="flex:2; font-size:16px; padding:14px;">Confirm & Deplete Stock</button>' +
        '<button onclick="window.showView(\'sales\')" class="btn btn-outline" style="flex:1; padding:14px;">Cancel</button>' +
    '</div></div>';

    document.getElementById('mainContent').innerHTML = html;
};

// Execute the confirmed depletion — reads DOM state from confirmation UI
window.executeUnifiedDepletion = function() {
    var data = window._pendingDepletionData;
    if (!data) return window.showToast('No depletion data pending.', 'error');

    var preview = data.preview;
    var source = data.source;

    // Handle duplicate replacement
    var today = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    var existingRuns = (window.depletionLogs || []).filter(function(d) {
        return d.date === today && d.source === source && !d.reversed;
    });
    if (existingRuns.length > 0) {
        var dupRadio = document.querySelector('input[name="dup-action"]:checked');
        var dupAction = dupRadio ? dupRadio.value : 'add';
        if (dupAction === 'replace') {
            existingRuns.forEach(function(run) { window.reverseDepletionRun(run.id); });
        }
    }

    // Resolve unmatched mappings from dropdowns
    var newMappings = [];
    preview.unmatched.forEach(function(u, i) {
        var sel = document.getElementById('map-unknown-' + i);
        if (sel && sel.value) {
            if (!window.posMappings) window.posMappings = {};
            window.posMappings[u.rawName] = sel.value;
            newMappings.push({ rawName: u.rawName, recipeId: sel.value, qtySold: u.qtySold });
        }
    });

    // Build final salesItems: checked matched items + newly-mapped items
    var finalSalesItems = [];
    preview.matched.forEach(function(m, i) {
        var cb = document.getElementById('match-check-' + i);
        if (cb && cb.checked) {
            finalSalesItems.push({ rawName: m.rawName, qtySold: m.qtySold });
        }
    });
    newMappings.forEach(function(nm) {
        finalSalesItems.push({ rawName: nm.rawName, qtySold: nm.qtySold });
    });

    if (finalSalesItems.length === 0) {
        return window.showToast('No items selected for depletion.', 'error');
    }

    // Execute the actual cascade (modifies stock)
    var result = window.cascadeSalesDeductions(finalSalesItems, source);

    // Build stock changes snapshot for the depletion log
    var stockChanges = [];
    var inventory = window.inventoryItems || [];
    Object.keys(result.deductions).forEach(function(invId) {
        var inv = inventory.find(function(i) { return i.id === invId; });
        if (inv) {
            // Stock has already been decremented, so current stock IS the "after"
            var buyUnits = result.deductions[invId] / (inv.yield || 1);
            stockChanges.push({
                id: inv.id,
                name: inv.name,
                before: Math.round(((inv.stock || 0) + buyUnits) * 100) / 100,
                after: Math.round((inv.stock || 0) * 100) / 100,
                unit: inv.buyUnit || 'unit',
                delta: -Math.round(buyUnits * 100) / 100
            });
        }
    });

    // Build itemsSold for display (recipe-level summary)
    var itemsSold = result.matched.map(function(m) {
        return { recipeName: m.matchName, qtySold: m.qtySold };
    });

    // Build and save depletion log entry
    var now = new Date();
    var depletionRun = {
        id: window.generateId('dep'),
        date: today,
        time: now.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }),
        ts: now.toISOString(),
        source: source,
        salesItems: finalSalesItems,
        matched: result.matched,
        unmatched: result.unmatched,
        deductions: result.deductions,
        stockChanges: stockChanges,
        itemsSold: itemsSold,
        totalLines: result.deductedCount,
        skippedUnmapped: preview.unmatched.length - newMappings.length,
        reversed: false,
        reversedAt: null
    };

    window.depletionLogs = window.depletionLogs || [];
    window.depletionLogs.push(depletionRun);

    // Audit log
    var sourceLabel = source === 'csv-depletion' ? 'Lightspeed CSV' : 'AI POS Depletion';
    window.logAudit('depletionLogs', 'depletion-run', depletionRun.id,
        sourceLabel + ': ' + result.deductedCount + ' stock lines, ' + itemsSold.length + ' recipes, ' + depletionRun.skippedUnmapped + ' skipped');

    window._pendingDepletionData = null;
    window.saveToDisk();
    window.showToast('Depleted ' + result.deductedCount + ' stock lines from ' + itemsSold.length + ' recipes.');
    window.showView('inventory');
};

// Reverse a depletion run — restores stock to pre-depletion levels
// Wrapper for undo button — avoids nested escaping in onclick attributes
window._undoDepletionRun = function(runId) {
    window.confirmAction({
        title: 'Undo Depletion',
        message: 'This will restore stock levels to before this depletion run. Continue?',
        tier: 'dangerous',
        onConfirm: function() {
            window.reverseDepletionRun(runId);
            window.showView('depletion-history');
        }
    });
};

window.reverseDepletionRun = function(runId) {
    var logs = window.depletionLogs || [];
    var run = logs.find(function(d) { return d.id === runId; });
    if (!run || run.reversed) return;

    var inventory = window.inventoryItems || [];
    (run.stockChanges || []).forEach(function(sc) {
        var inv = inventory.find(function(i) { return i.id === sc.id; });
        if (inv) {
            var restoreQty = Math.abs(sc.delta);
            window.logStockMovement(inv.id, restoreQty, 'depletion-reversal', {
                sourceRef: 'Undo run ' + runId
            });
            inv.stock = Math.round(((inv.stock || 0) + restoreQty) * 100) / 100;
        }
    });

    run.reversed = true;
    run.reversedAt = new Date().toISOString();
    window.logAudit('depletionLogs', 'reversal', runId, 'Reversed depletion: ' + (run.stockChanges || []).length + ' stock lines restored');
    window.saveToDisk();
};

// =============================================================================
// DEPLETION HISTORY VIEW
// =============================================================================

window.renderDepletionHistoryView = function() {
    var logs = (window.depletionLogs || []).slice().reverse();

    var html = '<div style="max-width:900px; margin:auto;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">' +
            '<div><h2 style="margin:0;">Stock Depletion History</h2>' +
            '<p style="margin:5px 0 0; color:var(--text-muted); font-size:13px;">' + logs.length + ' depletion runs recorded</p></div>' +
            '<div style="display:flex; gap:8px;">' +
                '<button onclick="window.showView(\'sales\')" class="btn btn-outline" style="font-size:12px;">Back to Takings</button>' +
                '<button onclick="window.openAiDepletion()" class="btn btn-purple" style="font-size:12px;">New AI Depletion</button>' +
                '<button onclick="window.showView(\'lightspeed-import\')" class="btn btn-blue" style="font-size:12px;">CSV Import</button>' +
            '</div>' +
        '</div>';

    if (logs.length === 0) {
        html += '<div class="card" style="text-align:center; padding:40px;">' +
            '<div style="font-size:48px; margin-bottom:10px;">📉</div>' +
            '<p style="color:var(--text-muted);">No depletion runs yet. Use AI Depletion or Lightspeed CSV import to run your first stock depletion.</p>' +
        '</div>';
    } else {
        logs.forEach(function(d) {
            var sourceColor = d.source === 'csv-depletion' ? 'var(--blue)' : 'var(--purple)';
            var sourceLabel = d.source === 'csv-depletion' ? 'CSV' : 'AI';
            var reversedBadge = d.reversed ? '<span style="background:var(--red); color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; margin-left:8px;">REVERSED</span>' : '';

            html += '<div class="card" style="margin-bottom:12px; border-left:4px solid ' + sourceColor + ';' + (d.reversed ? ' opacity:0.6;' : '') + '">' +
                '<div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="var det=this.nextElementSibling; det.style.display=det.style.display===\'none\'?\'block\':\'none\';">' +
                    '<div>' +
                        '<strong>' + esc(d.date || '') + ' <span style="color:var(--text-muted); font-weight:normal; font-size:12px;">at ' + esc(d.time || '') + '</span></strong>' +
                        '<span style="background:' + sourceColor + '; color:#fff; padding:2px 8px; border-radius:4px; font-size:11px; margin-left:10px;">' + sourceLabel + '</span>' +
                        reversedBadge +
                        '<br><span style="font-size:12px; color:var(--text-muted);">' + (d.totalLines || 0) + ' stock lines · ' + (d.itemsSold || []).length + ' recipes' +
                        ((d.skippedUnmapped || 0) > 0 ? ' · <span style="color:var(--orange);">' + d.skippedUnmapped + ' skipped</span>' : '') + '</span>' +
                    '</div>' +
                    '<span style="color:var(--text-muted); font-size:20px;">▾</span>' +
                '</div>' +
                '<div style="display:none; margin-top:15px; padding-top:15px; border-top:1px solid var(--border);">' +
                    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; font-size:12px;">' +
                        '<div><strong style="color:var(--brand-accent); display:block; margin-bottom:6px;">Recipes Sold</strong>' +
                        (d.itemsSold || []).map(function(l) {
                            return '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed var(--border);"><span>' + esc(l.recipeName) + '</span><strong style="color:var(--green);">' + l.qtySold + '</strong></div>';
                        }).join('') + '</div>' +
                        '<div><strong style="color:var(--brand-accent); display:block; margin-bottom:6px;">Stock Deducted</strong>' +
                        (d.stockChanges || []).map(function(s) {
                            return '<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed var(--border);"><span style="color:var(--text-muted);">' + esc(s.name) + '</span><span><span style="color:var(--red);">' + s.before + '</span> → <strong>' + s.after + '</strong> <small>' + esc(s.unit) + '</small></span></div>';
                        }).join('') + '</div>' +
                    '</div>';

            // Undo button (only for non-reversed runs)
            if (!d.reversed) {
                html += '<div style="margin-top:15px; text-align:right;">' +
                    '<button onclick="window._undoDepletionRun(\'' + d.id + '\')" class="btn btn-outline" style="color:var(--red); border-color:var(--red); font-size:12px;">Undo This Run</button>' +
                '</div>';
            } else {
                html += '<div style="margin-top:15px; text-align:right; font-size:12px; color:var(--text-muted);">Reversed at ' + (d.reversedAt ? new Date(d.reversedAt).toLocaleString() : '?') + '</div>';
            }

            html += '</div></div>';
        });
    }

    html += '</div>';
    return html;
};

