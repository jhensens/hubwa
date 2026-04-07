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
        time: window._isoNow()
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
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Empty API response');
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
    var today = window._isoDate();
    var existingRuns = (window.depletionLogs || []).filter(function(d) {
        return d.date === today && d.source === source && !d.reversed;
    });

    var recipeOpts = '<option value="">-- Select Hub Recipe --</option>' +
        (window.recipes || []).filter(function(r) { return r.type === 'Menu'; })
        .sort(function(a, b) { return a.name.localeCompare(b.name); })
        .map(function(r) { return '<option value="' + r.id + '">' + esc(r.name) + '</option>'; }).join('');

    var sourceLabel = window._sourceLabel(source);
    var sourceColor = window._sourceColor(source);

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
    var today = window._isoDate();
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
    window.logAudit('depletionLogs', 'depletion-run', depletionRun.id,
        window._sourceLabel(source) + ': ' + result.deductedCount + ' stock lines, ' + itemsSold.length + ' recipes, ' + depletionRun.skippedUnmapped + ' skipped');

    window._pendingDepletionData = null;
    window.saveToDisk();
    window.showToast('Depleted ' + result.deductedCount + ' stock lines from ' + itemsSold.length + ' recipes.');

    // Auto-generate order drafts after depletion (stock levels just changed)
    if (window._generateOrderDrafts) {
        setTimeout(() => window._generateOrderDrafts(), 500);
    }

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
                '<button onclick="window.showView(\'depletion-match-rate\')" class="btn btn-outline" style="border-color:var(--purple);color:var(--purple);font-size:12px;">📊 Match Rate</button>' +
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
            var sourceColor = window._sourceColor(d.source);
            var sourceLabel = window._sourceLabel(d.source, true);
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
                html += '<div style="margin-top:15px; text-align:right; font-size:12px; color:var(--text-muted);">Reversed at ' + (d.reversedAt ? window._fmtDateTime(d.reversedAt) : '?') + '</div>';
            }

            html += '</div></div>';
        });
    }

    html += '</div>';
    return html;
};

// =============================================================================
// POS AUTO-LINKER — Import Lightspeed product CSV, match to recipes & inventory
// =============================================================================

window.renderPOSLinkerView = function() {
    var mappings = window.posMappings || {};
    var mapCount = Object.keys(mappings).length;
    var recipes = (window.recipes || []).filter(function(r) { return !r.archived; });
    var aliasCount = recipes.filter(function(r) { return r.posAlias; }).length;

    return '<div style="max-width:900px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">' +
            '<div>' +
                '<h2 style="margin:0;">🔗 POS Auto-Linker</h2>' +
                '<div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Import Lightspeed product CSV and auto-match to recipes & inventory</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                '<button onclick="window.viewCurrentMappings()" class="btn btn-outline">📋 View Mappings (' + mapCount + ')</button>' +
                '<button onclick="window.clearPOSMappings()" class="btn btn-outline" style="color:var(--red);">Clear All</button>' +
            '</div>' +
        '</div>' +

        // Stats cards
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:20px;">' +
            '<div class="card" style="padding:14px;text-align:center;"><div style="font-size:24px;font-weight:700;color:var(--green);">' + mapCount + '</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-top:4px;">POS Mappings</div></div>' +
            '<div class="card" style="padding:14px;text-align:center;"><div style="font-size:24px;font-weight:700;color:var(--blue);">' + aliasCount + '</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-top:4px;">Recipe Aliases</div></div>' +
            '<div class="card" style="padding:14px;text-align:center;"><div style="font-size:24px;font-weight:700;color:var(--brand-accent);">' + recipes.length + '</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-top:4px;">Active Recipes</div></div>' +
        '</div>' +

        // Import section
        '<div class="card" style="border-top:5px solid var(--blue);padding:20px;">' +
            '<h3 style="margin:0 0 8px 0;">📂 Import Lightspeed Product CSV</h3>' +
            '<p style="color:var(--text-muted);font-size:13px;margin:0 0 15px 0;">Export your product list from Lightspeed/Kounta and upload it here. Items without a category will be ignored (modifiers/deleted items).</p>' +
            '<input type="file" id="pos-csv-file" accept=".csv" style="display:none;" onchange="window._handlePOSCSV(this)">' +
            '<button onclick="document.getElementById(\'pos-csv-file\').click()" class="btn btn-blue" style="width:100%;font-size:14px;padding:14px;">📤 Select Product CSV File</button>' +
        '</div>' +

        // Smart match info
        '<div class="card" style="margin-top:16px;border-top:5px solid var(--green);padding:20px;">' +
            '<h3 style="margin:0 0 8px 0;">🎯 BWI Smart Matcher</h3>' +
            '<p style="color:var(--text-muted);font-size:13px;margin:0 0 12px 0;">Enhanced matching with BWI-specific intelligence: strips venue tags (" wa"), portion counts, size markers, and uses a curated alias map from your actual menus (Izakaya, Ramen, Drinks).</p>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                '<div style="flex:1;min-width:150px;background:var(--bg-main);padding:10px;border-radius:6px;font-size:12px;">' +
                    '<strong style="color:var(--green);">POS Cleaning</strong><br>' +
                    '<span style="color:var(--text-muted);">Strips "wa" suffix, "(5)" counts, "425ml SCH" sizes</span></div>' +
                '<div style="flex:1;min-width:150px;background:var(--bg-main);padding:10px;border-radius:6px;font-size:12px;">' +
                    '<strong style="color:var(--blue);">Alias Map</strong><br>' +
                    '<span style="color:var(--text-muted);">' + Object.keys(window._bwiAliasMap || {}).length + ' curated aliases from BWI menus</span></div>' +
            '</div>' +
        '</div>' +

        // Instructions
        '<div class="card" style="margin-top:16px;padding:16px;">' +
            '<h4 style="margin:0 0 8px 0;color:var(--brand-accent);">How it works</h4>' +
            '<ol style="color:var(--text-muted);font-size:13px;margin:0;padding-left:20px;line-height:1.8;">' +
                '<li>Upload your Lightspeed product CSV export</li>' +
                '<li>Items without categories are automatically filtered out (modifiers/deleted)</li>' +
                '<li>BWI Smart Matcher cleans POS names and checks the curated alias map first</li>' +
                '<li>Remaining items get fuzzy-matched against your recipes and inventory</li>' +
                '<li>Review auto-matches, fix any mismatches, then confirm</li>' +
                '<li>Confirmed mappings are saved to <code>posMappings</code> for daily sales depletion</li>' +
            '</ol>' +
        '</div>' +
    '</div>';
};

// --- CSV Parser (handles quoted fields with commas) ---
window._parseCSVRow = function(line) {
    var result = [], current = '', inQuotes = false;
    for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (inQuotes) {
            if (ch === '"' && i + 1 < line.length && line[i + 1] === '"') {
                current += '"'; i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { result.push(current); current = ''; }
            else { current += ch; }
        }
    }
    result.push(current);
    return result;
};

// --- Handle CSV file upload ---
window._handlePOSCSV = function(input) {
    var file = input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var text = e.target.result;
        var lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
        if (lines.length < 2) return window.showToast('CSV appears empty.', 'error');

        // Parse header to find column indices
        var header = window._parseCSVRow(lines[0]);
        var colMap = {};
        header.forEach(function(h, i) { colMap[h.trim()] = i; });

        var nameIdx = colMap['ProductName'] !== undefined ? colMap['ProductName'] : 2;
        var catIdx = colMap['CategoryNames'] !== undefined ? colMap['CategoryNames'] : 15;
        var priceIdx = colMap['SellPriceIncTax'] !== undefined ? colMap['SellPriceIncTax'] : 8;
        var tagIdx = colMap['Tags'] !== undefined ? colMap['Tags'] : 14;
        var modIdx = colMap['IsModifier'] !== undefined ? colMap['IsModifier'] : 12;
        var groupIdx = colMap['ReportingGroup'] !== undefined ? colMap['ReportingGroup'] : 20;

        var products = [];
        for (var i = 1; i < lines.length; i++) {
            var cols = window._parseCSVRow(lines[i]);
            var name = (cols[nameIdx] || '').trim();
            var cats = (cols[catIdx] || '').trim();
            var isModifier = (cols[modIdx] || '').trim();
            if (!name || !cats || isModifier === '1') continue;
            products.push({
                name: name,
                categories: cats,
                price: parseFloat(cols[priceIdx] || '0') || 0,
                tags: (cols[tagIdx] || '').trim(),
                group: (cols[groupIdx] || '').trim()
            });
        }

        if (products.length === 0) return window.showToast('No valid products found (all filtered out).', 'error');

        // De-duplicate by product name (some POS items appear in multiple categories)
        var seen = {};
        var unique = [];
        products.forEach(function(p) {
            var key = p.name.toLowerCase();
            if (!seen[key]) { seen[key] = true; unique.push(p); }
        });

        window.showToast(unique.length + ' products parsed from ' + (lines.length - 1) + ' rows. Running auto-matcher...');
        if (typeof input.value !== 'undefined') input.value = '';

        // Run matching engine in async chunks to avoid blocking UI
        setTimeout(function() { window._runPOSAutoMatchAsync(unique); }, 200);
    };
    reader.readAsText(file);
};

// --- Fuzzy string matching utilities ---
window._normalise = function(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
};

// BWI-specific POS name cleaner — strips venue noise before matching
window._bwiPOSClean = function(name) {
    var s = (name || '');
    // Strip trailing " wa" / " Wa" (BWI venue tag on food items)
    s = s.replace(/\s+wa$/i, '');
    // Strip parenthetical portion counts: (5), (3), (serve of 3), (Serve of 5)
    s = s.replace(/\s*\((?:serve\s+of\s+)?\d+\)\s*/gi, ' ');
    // Strip size markers: 425ml, 500ml, 700ml, 1L, 1.5L, 80ml, 300ml
    s = s.replace(/\b\d+(?:\.\d+)?(?:ml|l)\b/gi, ' ');
    // Strip serve-type suffixes: SCH (schooner), POT, BTL (bottle), GLS (glass)
    s = s.replace(/\b(?:SCH|POT|BTL|GLS)\b/gi, ' ');
    // Strip trailing price remnants if any
    s = s.replace(/\$\d+(?:\.\d+)?/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
};

// BWI curated alias map: normalised POS name → normalised target name
// These handle cases where POS naming diverges from recipe/inventory names
window._bwiAliasMap = {
    // --- FOOD: Izakaya menu items ---
    'edamame': 'edamame',
    'yakisoba': 'yakisoba fried noodles',
    'yakisoba fried noodles': 'yakisoba fried noodles',
    'house made gyoza': 'house made pork gyoza',
    'house made pork gyoza': 'house made pork gyoza',
    'scottsdale chashu pork jowl': 'chashu scottsdale pork jowl',
    'chashu scottsdale pork jowl': 'chashu scottsdale pork jowl',
    'chashu pork jowl': 'chashu scottsdale pork jowl',
    'chicken karaage': 'chicken karaage',
    'karaage chicken': 'chicken karaage',
    'karaage': 'chicken karaage',
    'agedashi tofu': 'agedashi tofu',
    'cape grim beef tataki': 'cape grim beef tataki',
    'beef tataki': 'cape grim beef tataki',
    'yellowtail kingfish sashimi': 'yellowtail kingfish sashimi',
    'kingfish sashimi': 'yellowtail kingfish sashimi',
    'o toro tuna uni sashimi': 'o toro tuna uni sashimi',
    'tuna uni sashimi': 'o toro tuna uni sashimi',
    'tempura gummy shark': 'tempura gummy shark',
    'charred corn with nori butter': 'charred corn with nori butter',
    'charred corn nori butter': 'charred corn with nori butter',
    'harusame sesame noodle salad': 'harusame sesame noodle salad',
    'harusame salad': 'harusame sesame noodle salad',
    'smashed tasmanian potatoes': 'smashed tasmanian potatoes',
    'smashed potatoes': 'smashed tasmanian potatoes',
    'bruny island wallaby wing age': 'bruny island wallaby wing age',
    'wallaby wing age': 'bruny island wallaby wing age',
    'wallaby wings': 'bruny island wallaby wing age',
    'shiro miso braised mushrooms': 'shiro miso braised mushrooms',
    'miso mushrooms': 'shiro miso braised mushrooms',
    'miso braised mushrooms': 'shiro miso braised mushrooms',
    'yakiniku platter': 'yakiniku platter',
    'yakiniku platter grilled meat': 'yakiniku platter',
    'okonomiyaki': 'okonomiyaki new',
    'tsukemono': 'tsukemono',
    'blanched greens': 'blanched greens',
    'japanese potato salad': 'japanese potato salad',
    'potato salad': 'japanese potato salad',
    'steamed rice': 'rice',
    'rice': 'rice',
    'bar wa fu salad': 'bar wa fu salad',
    'kimchi': 'kim chi',
    'pickled daikon': 'pickled daikon',
    'charcoal grilled menma': 'charcoal grilled menma',
    'menma': 'charcoal grilled menma',
    'umibudo': 'umibudo',
    'koji super hot sauce': 'house made koji fermented super hot sauce',
    // Specials
    'aburi scallop uni': 'aburi scallop uni',
    'yaki tako': 'yaki tako',
    'tomato salada': 'tomato salada',
    'open temaki sushi': 'open temaki sushi',
    'wagyu rump 8': 'wagyu rump 8',
    'wagyu rump': 'wagyu rump 8',
    'kingfish collar miso zuke': 'kingfish collar miso zuke',
    'kingfish collar': 'kingfish collar miso zuke',
    'pink snapper carpaccio': 'pink snapper carpaccio',
    'cape grim beef tongue': 'cape grim beef tongue',
    'beef tongue': 'cape grim beef tongue',
    'tomato no ohitashi': 'tomato no ohitashi',
    // Oysters
    'natural oysters': 'natural oysters',
    'oysters natural': 'natural oysters',
    'sanbaizu oysters': 'sanbaizu oysters',
    'oysters sanbaizu': 'sanbaizu oysters',
    'tempura oysters': 'tempura oysters',
    'oysters tempura': 'tempura oysters',
    'kosho kilpatrick': 'kosho kilpatrick',
    'kosho kilpatrick oysters': 'kosho kilpatrick',
    'cucumber finger lime oysters': 'cucumber finger lime oysters',
    'tuna uni oyster': 'tuna uni oyster',
    // Skewers
    'unagi kushi age': 'unagi kushi age',
    'unagi skewer': 'unagi kushi age',
    'button squash kushi age': 'button squash kushi age',
    'button squash': 'button squash kushi age',
    'chicken thigh yakitori': 'chicken thigh yakitori',
    'chicken yakitori': 'chicken thigh yakitori',
    'shishito no hibachi yaki': 'shishito no hibachi yaki',
    'shishito hibachi': 'shishito no hibachi yaki',
    // Desserts
    'coffee jelly': 'coffee jelly with vanilla bean ice cream',
    'coffee jelly with vanilla bean ice cream': 'coffee jelly with vanilla bean ice cream',
    'matcha ice cream': 'matcha ice cream',
    'shiro miso parfait': 'shiro miso parfait',
    'miso parfait': 'shiro miso parfait',
    // --- RAMEN menu items ---
    'chicken soy ramen': 'chicken soy ramen',
    'tonkotsu pork ramen': 'tonkotsu pork ramen',
    'tonkotsu ramen': 'tonkotsu pork ramen',
    'tantan men': 'tantan men',
    'tantanmen': 'tantan men',
    'sukiyaki cape grim beef': 'sukiyaki cape grim beef',
    'sukiyaki cape grim beef udon': 'sukiyaki cape grim beef',
    'sukiyaki cape grim beef donburi': 'sukiyaki cape grim beef',
    'sukiyaki beef': 'sukiyaki cape grim beef',
    'vegetarian ramen': 'vegetarian or vegan ramen',
    'vegan ramen': 'vegetarian or vegan ramen',
    'vegetarian or vegan ramen': 'vegetarian or vegan ramen',
    'chicken snack ramen': 'chicken snack ramen',
    'snack ramen': 'chicken snack ramen',
    'japanese curry tsukemen': 'japanese curry tsukemen with chicken karaage',
    'japanese curry tsukemen with chicken karaage': 'japanese curry tsukemen with chicken karaage',
    'curry tsukemen': 'japanese curry tsukemen with chicken karaage',
    'kingfish poke bowl': 'kingfish poke bowl',
    'poke bowl': 'kingfish poke bowl',
    'soy miso butter beef fried rice': 'soy miso butter beef fried rice',
    'miso butter beef fried rice': 'soy miso butter beef fried rice',
    'beef fried rice': 'soy miso butter beef fried rice',
    // Ramen add-ons
    'ajitsuke tamago': 'ajitsuke tamago',
    'ajitsuke egg': 'ajitsuke tamago',
    'chashu pork belly': 'chashu pork belly',
    'glazed pork shoulder': 'glazed pork shoulder',
    'butter soy chicken': 'butter soy chicken',
    'chilli miso': 'chilli miso',
    'spicy kimchi': 'spicy kimchi',
    // --- COCKTAILS ---
    'ichigo go': 'ichigo go',
    'chi momo sangria': 'chi momo sangria',
    'chimomo sangria': 'chi momo sangria',
    'japanese flipper': 'japanese flipper',
    'tentacle pornstar martini': 'tentacle pornstar martini',
    'pornstar martini': 'tentacle pornstar martini',
    'okinawan daiquiri': 'okinawan daiquiri',
    'youkoso spritzu': 'youkoso hibiscus spritz or ryuku hibiscus sprtiz',
    'youkoso spritz': 'youkoso hibiscus spritz or ryuku hibiscus sprtiz',
    'youkoso hibiscus spritz': 'youkoso hibiscus spritz or ryuku hibiscus sprtiz',
    'shizukani': 'shizukani',
    'shiso fly': 'shiso fly',
    'kyuri collins': 'kyuri collins',
    'spicy yuzu margarita': 'spicy yuzu margarita',
    'yuzu margarita': 'spicy yuzu margarita',
    'kinkakuji negroni': 'kinkakuji golden negroni',
    'golden negroni': 'kinkakuji golden negroni',
    'bitter bachi': 'bitter batchi',
    'bitter batchi': 'bitter batchi',
    'golden sour': 'golden sour',
    'momotaro sour': 'momotaro sour',
    'jade cocoon': 'jade cocoon',
    'sakura martini': 'sakura martini',
    'yuzu tokyo cheesecake': 'yuzu tokyo cheesecake',
    'kofuna': 'kuri old fashioned',
    'hanami': 'hanami',
    'kosho mary': 'kosho mary',
    'miso caramel espresso martini': 'miso caramel espresso martini',
    'espresso martini': 'miso caramel espresso martini',
    'oyabun cocktail': 'oyabun cocktail',
    'oyabun': 'oyabun cocktail',
    // Shots / Horoyoi
    'japanese pickleback': 'japanese pickleback',
    'pickleback': 'japanese pickleback',
    'pinku': 'pinku',
    'the shogun': 'shogun shot',
    'shogun': 'shogun shot',
    'shogun shot': 'shogun shot',
    'hari kiri': 'wasabi tequila',
    // Mocktails
    'kari kari juice': 'kari kari juice',
    'kari kari': 'kari kari juice',
    'virgin mojito': 'virgin mojito',
    'shi cran be sober': 'shi cran be sober',
    'no sho mary': 'no sho mary',
    // Highballs / Chu-Hi
    'yuzu highball': 'yuzu highball',
    'lemon highball': 'lemon highball',
    'house mixed chu hi': 'house mixed chu hi',
    'chu hi lemon': 'chu hi lemon',
    'chu hi yuzu': 'chu hi yuzu',
    'chu hi ume': 'chu hi ume',
    'chu hi grapefruit': 'chu hi grapefruit',
    'chu hi shiso': 'chu hi shiso',
    'chu hi lychee': 'chu hi lychee',
    'chu hi mikan': 'chu hi mikan',
    // Soft drinks
    'yuzu lemonade': 'yuzu lemonade',
    'ume soda': 'ume soda',
    'shiso soda': 'shiso soda',
    'lychee soda': 'lychee soda',
    'grapefruit soda': 'grapefruit soda',
    'mikan soda': 'mikan soda',
    // Coffee & Tea
    'bar wa iced coffee': 'bar wa iced coffee',
    'matcha latte': 'matcha latte',
    // Tasting flights
    'sake tasting flight': 'sake tasting flight',
    'umeshu tasting flight': 'umeshu tasting flight',
    'suntory three whisky tasting flight': 'suntory three whisky tasting flight',
    'yamazaki through the ages': 'yamazaki through the ages whisky tasting flight',
    'gin tasting flight': 'gin tasting flight'
};

// Levenshtein distance (edit distance between two strings)
window._levenshtein = function(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    var matrix = [];
    for (var i = 0; i <= b.length; i++) matrix[i] = [i];
    for (var j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (var i = 1; i <= b.length; i++) {
        for (var j = 1; j <= a.length; j++) {
            var cost = b[i - 1] === a[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,       // deletion
                matrix[i][j - 1] + 1,       // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return matrix[b.length][a.length];
};

window._similarity = function(a, b) {
    var na = window._normalise(a), nb = window._normalise(b);
    if (na === nb) return 1.0;
    if (!na || !nb) return 0;

    // Exact substring match (one fully contains the other)
    if (na.indexOf(nb) !== -1 || nb.indexOf(na) !== -1) {
        var containRatio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
        return 0.75 + (containRatio * 0.2); // 0.75-0.95 depending on length ratio
    }

    // Token overlap (Jaccard-like)
    var tokA = na.split(' '), tokB = nb.split(' ');
    var setA = {}, overlap = 0;
    tokA.forEach(function(t) { setA[t] = true; });
    tokB.forEach(function(t) { if (setA[t]) overlap++; });
    var union = new Set(tokA.concat(tokB)).size;
    var jaccard = union > 0 ? overlap / union : 0;

    // Levenshtein-based similarity (only compute when strings are similar length and jaccard shows overlap)
    var levScore = 0;
    var lenRatio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length, 1);
    if (lenRatio > 0.4 && jaccard > 0.15 && na.length < 60 && nb.length < 60) {
        var dist = window._levenshtein(na, nb);
        var maxLen = Math.max(na.length, nb.length);
        levScore = maxLen > 0 ? 1 - (dist / maxLen) : 0;
    } else if (lenRatio > 0.6) {
        // Cheap approximation for longer strings: character frequency overlap
        levScore = lenRatio * jaccard;
    }

    // Leading character match bonus (helps with "Sapporo 425ml" vs "Sapporo 500ml")
    var leadMatch = 0;
    var minLen = Math.min(na.length, nb.length);
    for (var i = 0; i < minLen; i++) {
        if (na[i] === nb[i]) leadMatch++; else break;
    }
    var leadBonus = leadMatch >= 6 ? 0.12 : leadMatch >= 4 ? 0.06 : 0;

    // Weighted combination: Jaccard for semantic overlap, Levenshtein for spelling closeness
    var combined = (jaccard * 0.45) + (levScore * 0.45) + leadBonus;
    return Math.min(combined, 0.99);
};

// --- Async auto-matching (chunked to avoid UI freeze) ---
// Enhanced with BWI-specific POS name cleaning and curated alias map
window._runPOSAutoMatchAsync = function(posProducts) {
    var recipes = (window.recipes || []).filter(function(r) { return !r.archived; });
    var inventory = (window.inventoryItems || []).filter(function(i) { return !i.archived; });
    var existingMappings = window.posMappings || {};
    var aliasMap = window._bwiAliasMap || {};

    // Pre-build targets with BOTH raw normalised AND BWI-cleaned normalised names
    var targets = [];
    recipes.forEach(function(r) {
        var norm = window._normalise(r.name);
        var cleanNorm = window._normalise(window._bwiPOSClean(r.name));
        targets.push({ id: r.id, name: r.name, norm: norm, cleanNorm: cleanNorm, type: 'recipe' });
        if (r.posAlias) {
            var aliasNorm = window._normalise(r.posAlias);
            var aliasClean = window._normalise(window._bwiPOSClean(r.posAlias));
            targets.push({ id: r.id, name: r.name, norm: aliasNorm, cleanNorm: aliasClean, type: 'recipe' });
        }
    });
    inventory.forEach(function(inv) {
        var norm = window._normalise(inv.name);
        var cleanNorm = window._normalise(window._bwiPOSClean(inv.name));
        targets.push({ id: inv.id, name: inv.name, norm: norm, cleanNorm: cleanNorm, type: 'inventory' });
        if (inv.posAlias) {
            var aliasNorm = window._normalise(inv.posAlias);
            var aliasClean = window._normalise(window._bwiPOSClean(inv.posAlias));
            targets.push({ id: inv.id, name: inv.name, norm: aliasNorm, cleanNorm: aliasClean, type: 'inventory' });
        }
    });
    targets.forEach(function(t) {
        t.tokens = t.norm.split(' ');
        t.cleanTokens = t.cleanNorm.split(' ');
    });

    // Build target lookup by normalised name for alias resolution
    var targetByNorm = {};
    targets.forEach(function(t) {
        if (!targetByNorm[t.norm]) targetByNorm[t.norm] = t;
        if (!targetByNorm[t.cleanNorm]) targetByNorm[t.cleanNorm] = t;
    });

    var autoMatched = [], suggested = [], unmatched = [], alreadyMapped = [];
    var idx = 0;
    var CHUNK = 40;

    function processChunk() {
        var end = Math.min(idx + CHUNK, posProducts.length);
        for (; idx < end; idx++) {
            var pos = posProducts[idx];
            if (existingMappings[pos.name]) { alreadyMapped.push({ pos: pos, mappedTo: existingMappings[pos.name] }); continue; }

            var posNorm = window._normalise(pos.name);
            var posClean = window._normalise(window._bwiPOSClean(pos.name));

            // --- PHASE 1: Check BWI curated alias map ---
            var aliasTarget = aliasMap[posNorm] || aliasMap[posClean];
            if (aliasTarget) {
                var resolved = targetByNorm[aliasTarget] || targetByNorm[window._normalise(aliasTarget)];
                if (resolved) {
                    autoMatched.push({ pos: pos, match: { id: resolved.id, name: resolved.name, type: resolved.type }, score: 0.98, type: resolved.type });
                    continue;
                }
            }

            // --- PHASE 2: Fuzzy match using BOTH raw and cleaned names ---
            var bestMatch = null, bestScore = 0, bestType = '';
            var posToks = posNorm.split(' ');
            var posCleanToks = posClean.split(' ');

            for (var ti = 0; ti < targets.length; ti++) {
                var t = targets[ti];

                // Try matching both raw and cleaned versions, take the best
                var pairs = [[posNorm, posToks, t.norm, t.tokens], [posClean, posCleanToks, t.cleanNorm, t.cleanTokens]];
                for (var pi = 0; pi < pairs.length; pi++) {
                    var pn = pairs[pi][0], pt = pairs[pi][1], tn = pairs[pi][2], tt = pairs[pi][3];

                    if (pn === tn) { bestScore = 1.0; bestMatch = { id: t.id, name: t.name, type: t.type }; bestType = t.type; break; }
                    if (pn.indexOf(tn) !== -1 || tn.indexOf(pn) !== -1) {
                        var cr = Math.min(pn.length, tn.length) / Math.max(pn.length, tn.length);
                        var sc = 0.75 + (cr * 0.2);
                        if (sc > bestScore) { bestScore = sc; bestMatch = { id: t.id, name: t.name, type: t.type }; bestType = t.type; }
                        continue;
                    }
                    var overlap = 0;
                    for (var ppi = 0; ppi < pt.length; ppi++) { for (var tti = 0; tti < tt.length; tti++) { if (pt[ppi] === tt[tti]) { overlap++; break; } } }
                    if (overlap === 0) continue;
                    var union = new Set(pt.concat(tt)).size;
                    var jaccard = overlap / union;
                    var leadMatch = 0, minLen = Math.min(pn.length, tn.length);
                    for (var ci = 0; ci < minLen; ci++) { if (pn[ci] === tn[ci]) leadMatch++; else break; }
                    var leadBonus = leadMatch >= 6 ? 0.12 : leadMatch >= 4 ? 0.06 : 0;
                    var score = (jaccard * 0.9) + leadBonus;
                    if (score > bestScore) { bestScore = score; bestMatch = { id: t.id, name: t.name, type: t.type }; bestType = t.type; }
                }
                if (bestScore >= 1.0) break; // Exact match found, stop searching
            }

            var result = { pos: pos, match: bestMatch, score: bestScore, type: bestType };
            if (bestScore >= 0.8) autoMatched.push(result);
            else if (bestScore >= 0.4) suggested.push(result);
            else unmatched.push(result);
        }

        if (idx < posProducts.length) {
            setTimeout(processChunk, 0);
        } else {
            suggested.sort(function(a,b) { return b.score - a.score; });
            autoMatched.sort(function(a,b) { return b.score - a.score; });
            window._posLinkResults = { autoMatched: autoMatched, suggested: suggested, unmatched: unmatched, alreadyMapped: alreadyMapped };
            window._showPOSLinkReview();
        }
    }
    processChunk();
};

// --- Sync auto-matching (kept for small datasets) ---
window._runPOSAutoMatch = function(posProducts) {
    var recipes = (window.recipes || []).filter(function(r) { return !r.archived; });
    var inventory = (window.inventoryItems || []).filter(function(i) { return !i.archived; });
    var existingMappings = window.posMappings || {};

    // Pre-build normalised lookup targets for speed
    var targets = [];
    recipes.forEach(function(r) {
        targets.push({ id: r.id, name: r.name, norm: window._normalise(r.name), type: 'recipe' });
        if (r.posAlias) targets.push({ id: r.id, name: r.name, norm: window._normalise(r.posAlias), type: 'recipe' });
    });
    inventory.forEach(function(inv) {
        targets.push({ id: inv.id, name: inv.name, norm: window._normalise(inv.name), type: 'inventory' });
        if (inv.posAlias) targets.push({ id: inv.id, name: inv.name, norm: window._normalise(inv.posAlias), type: 'inventory' });
    });

    // Pre-tokenise all targets
    targets.forEach(function(t) { t.tokens = t.norm.split(' '); });

    var autoMatched = [];
    var suggested = [];
    var unmatched = [];
    var alreadyMapped = [];

    posProducts.forEach(function(pos) {
        if (existingMappings[pos.name]) {
            alreadyMapped.push({ pos: pos, mappedTo: existingMappings[pos.name] });
            return;
        }

        var posNorm = window._normalise(pos.name);
        var posToks = posNorm.split(' ');
        var bestMatch = null, bestScore = 0, bestType = '';

        for (var ti = 0; ti < targets.length; ti++) {
            var t = targets[ti];

            // Fast exact match
            if (posNorm === t.norm) {
                bestScore = 1.0; bestMatch = { id: t.id, name: t.name, type: t.type }; bestType = t.type;
                break;
            }

            // Fast substring check
            if (posNorm.indexOf(t.norm) !== -1 || t.norm.indexOf(posNorm) !== -1) {
                var containRatio = Math.min(posNorm.length, t.norm.length) / Math.max(posNorm.length, t.norm.length);
                var score = 0.75 + (containRatio * 0.2);
                if (score > bestScore) { bestScore = score; bestMatch = { id: t.id, name: t.name, type: t.type }; bestType = t.type; }
                continue;
            }

            // Fast token overlap (Jaccard)
            var overlap = 0;
            for (var pi = 0; pi < posToks.length; pi++) {
                for (var tti = 0; tti < t.tokens.length; tti++) {
                    if (posToks[pi] === t.tokens[tti]) { overlap++; break; }
                }
            }
            if (overlap === 0) continue; // Skip entirely if zero token overlap

            var union = new Set(posToks.concat(t.tokens)).size;
            var jaccard = overlap / union;

            // Leading char bonus
            var leadMatch = 0;
            var minLen = Math.min(posNorm.length, t.norm.length);
            for (var ci = 0; ci < minLen; ci++) {
                if (posNorm[ci] === t.norm[ci]) leadMatch++; else break;
            }
            var leadBonus = leadMatch >= 6 ? 0.12 : leadMatch >= 4 ? 0.06 : 0;

            // Only compute Levenshtein for promising candidates
            var levScore = 0;
            if (jaccard >= 0.3) {
                var lenRatio = Math.min(posNorm.length, t.norm.length) / Math.max(posNorm.length, t.norm.length, 1);
                if (lenRatio > 0.5 && posNorm.length < 50 && t.norm.length < 50) {
                    var dist = window._levenshtein(posNorm, t.norm);
                    levScore = 1 - (dist / Math.max(posNorm.length, t.norm.length));
                }
            }

            var score = (jaccard * 0.45) + (levScore * 0.45) + leadBonus;
            if (score > bestScore) { bestScore = score; bestMatch = { id: t.id, name: t.name, type: t.type }; bestType = t.type; }
        }

        var result = { pos: pos, match: bestMatch, score: bestScore, type: bestType };
        if (bestScore >= 0.8) autoMatched.push(result);
        else if (bestScore >= 0.45) suggested.push(result);
        else unmatched.push(result);
    });

    suggested.sort(function(a,b) { return b.score - a.score; });
    autoMatched.sort(function(a,b) { return b.score - a.score; });

    window._posLinkResults = { autoMatched: autoMatched, suggested: suggested, unmatched: unmatched, alreadyMapped: alreadyMapped };
    window._showPOSLinkReview();
};

// --- Review UI (lightweight — no heavy dropdowns) ---
window._showPOSLinkReview = function() {
    var r = window._posLinkResults;
    if (!r) return;

    // Store accept/reject state for suggested items
    if (!window._posLinkDecisions) window._posLinkDecisions = {};

    var html = '<div style="max-width:95vw;">';

    // Summary bar
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">' +
        '<div style="flex:1;min-width:110px;background:var(--bg-main);padding:10px;border-radius:6px;text-align:center;border:1px solid var(--green);">' +
            '<div style="font-size:20px;font-weight:700;color:var(--green);">' + r.autoMatched.length + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);">Auto-Matched</div></div>' +
        '<div style="flex:1;min-width:110px;background:var(--bg-main);padding:10px;border-radius:6px;text-align:center;border:1px solid var(--orange);">' +
            '<div style="font-size:20px;font-weight:700;color:var(--orange);">' + r.suggested.length + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);">Suggested</div></div>' +
        '<div style="flex:1;min-width:110px;background:var(--bg-main);padding:10px;border-radius:6px;text-align:center;border:1px solid var(--red);">' +
            '<div style="font-size:20px;font-weight:700;color:var(--red);">' + r.unmatched.length + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);">Unmatched</div></div>' +
        '<div style="flex:1;min-width:110px;background:var(--bg-main);padding:10px;border-radius:6px;text-align:center;border:1px solid var(--text-muted);">' +
            '<div style="font-size:20px;font-weight:700;color:var(--text-muted);">' + r.alreadyMapped.length + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);">Already Mapped</div></div>' +
    '</div>';

    // --- Auto-matched section (checkboxes, lightweight) ---
    if (r.autoMatched.length > 0) {
        html += '<details open style="margin-bottom:16px;"><summary style="cursor:pointer;font-weight:700;font-size:14px;color:var(--green);padding:8px 0;">✅ Auto-Matched (' + r.autoMatched.length + ') — high confidence</summary>';
        html += '<div style="max-height:300px;overflow-y:auto;margin-top:8px;">';
        r.autoMatched.forEach(function(m, idx) {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid var(--border);font-size:13px;">' +
                '<input type="checkbox" checked data-auto-idx="' + idx + '" style="transform:scale(1.1);">' +
                '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;"><strong>' + window.esc(m.pos.name) + '</strong> <span style="color:var(--text-muted);font-size:11px;">$' + m.pos.price.toFixed(2) + '</span></div>' +
                '<span style="color:var(--text-muted);font-size:11px;flex-shrink:0;">→</span>' +
                '<div style="flex:1;color:var(--green);min-width:0;overflow:hidden;text-overflow:ellipsis;"><strong>' + window.esc(m.match.name) + '</strong> <span style="font-size:11px;opacity:0.7;">' + Math.round(m.score * 100) + '%</span></div>' +
            '</div>';
        });
        html += '</div></details>';
    }

    // --- Suggested matches (accept/reject per row — NO dropdowns) ---
    if (r.suggested.length > 0) {
        html += '<details open style="margin-bottom:16px;"><summary style="cursor:pointer;font-weight:700;font-size:14px;color:var(--orange);padding:8px 0;">🔍 Suggested (' + r.suggested.length + ') — accept or skip</summary>';
        html += '<div style="font-size:11px;color:var(--text-muted);padding:4px 0 8px;">Click ✓ to accept the match, ✗ to skip. Use the search box below to manually link unmatched items later.</div>';
        html += '<div style="max-height:400px;overflow-y:auto;margin-top:4px;">';
        r.suggested.forEach(function(m, idx) {
            var accepted = window._posLinkDecisions['sug_' + idx] === 'accept';
            var rejected = window._posLinkDecisions['sug_' + idx] === 'reject';
            var rowBg = accepted ? 'rgba(16,185,129,0.06)' : rejected ? 'rgba(239,68,68,0.04)' : 'transparent';
            html += '<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px;background:' + rowBg + ';" id="sug-row-' + idx + '">' +
                '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><strong>' + window.esc(m.pos.name) + '</strong></div>' +
                '<span style="color:var(--text-muted);font-size:10px;flex-shrink:0;">→</span>' +
                '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--orange);">' + window.esc(m.match ? m.match.name : '?') + ' <span style="opacity:0.6;">' + Math.round(m.score * 100) + '%</span></div>' +
                '<button onclick="window._posLinkDecisions[\'sug_' + idx + '\']=\'accept\';this.parentElement.style.background=\'rgba(16,185,129,0.08)\'" style="background:none;border:1px solid var(--green);color:var(--green);border-radius:4px;cursor:pointer;padding:2px 8px;font-size:12px;flex-shrink:0;' + (accepted?'background:var(--green);color:#fff;':'') + '">✓</button>' +
                '<button onclick="window._posLinkDecisions[\'sug_' + idx + '\']=\'reject\';this.parentElement.style.background=\'rgba(239,68,68,0.06)\'" style="background:none;border:1px solid var(--border);color:var(--red);border-radius:4px;cursor:pointer;padding:2px 8px;font-size:12px;flex-shrink:0;' + (rejected?'background:var(--red);color:#fff;':'') + '">✗</button>' +
            '</div>';
        });
        html += '</div>';
        html += '<div style="display:flex;gap:6px;margin-top:8px;">' +
            '<button onclick="window._posAcceptAllSuggested()" class="btn btn-outline" style="font-size:11px;padding:6px 12px;color:var(--green);border-color:var(--green);">✓ Accept All Suggested</button>' +
            '<button onclick="window._posRejectAllSuggested()" class="btn btn-outline" style="font-size:11px;padding:6px 12px;color:var(--red);border-color:var(--red);">✗ Skip All Suggested</button>' +
        '</div>';
        html += '</details>';
    }

    // --- Unmatched (just list them — manual linking via search) ---
    if (r.unmatched.length > 0) {
        html += '<details style="margin-bottom:16px;"><summary style="cursor:pointer;font-weight:700;font-size:14px;color:var(--red);padding:8px 0;">❌ Unmatched (' + r.unmatched.length + ') — no match found</summary>';
        html += '<div style="font-size:11px;color:var(--text-muted);padding:4px 0 8px;">These POS products didn\'t match any recipe or inventory item. You can link them manually later from the POS Alias Editor or by editing recipes.</div>';
        html += '<div style="max-height:300px;overflow-y:auto;margin-top:4px;">';
        r.unmatched.forEach(function(m) {
            html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-bottom:1px solid var(--border);font-size:12px;">' +
                '<div style="flex:1;"><strong>' + window.esc(m.pos.name) + '</strong></div>' +
                '<span style="color:var(--text-muted);font-size:11px;">$' + m.pos.price.toFixed(2) + ' | ' + window.esc(m.pos.group || m.pos.categories) + '</span>' +
            '</div>';
        });
        html += '</div></details>';
    }

    // --- Already mapped ---
    if (r.alreadyMapped.length > 0) {
        html += '<details style="margin-bottom:16px;"><summary style="cursor:pointer;font-weight:700;font-size:14px;color:var(--text-muted);padding:8px 0;">📌 Already Mapped (' + r.alreadyMapped.length + ')</summary>';
        html += '<div style="max-height:200px;overflow-y:auto;margin-top:8px;opacity:0.7;">';
        r.alreadyMapped.forEach(function(m) {
            var targetName = m.mappedTo;
            var rec = (window.recipes||[]).find(function(rc) { return rc.id === m.mappedTo; });
            if (rec) targetName = rec.name;
            html += '<div style="padding:4px 8px;font-size:12px;border-bottom:1px solid var(--border);">' +
                window.esc(m.pos.name) + ' → <strong style="color:var(--green);">' + window.esc(targetName) + '</strong></div>';
        });
        html += '</div></details>';
    }

    // Confirm button
    html += '<div style="display:flex;gap:10px;margin-top:16px;">' +
        '<button onclick="window._confirmPOSLinks()" class="btn btn-green" style="flex:1;font-size:14px;padding:14px;">✅ Confirm & Save Mappings</button>' +
        '<button onclick="window.closeModal()" class="btn btn-outline" style="padding:14px;">Cancel</button>' +
    '</div>';

    html += '</div>';
    window.openModal('🔗 POS Auto-Link Results', html);
};

// Accept/Reject all suggested helpers
window._posAcceptAllSuggested = function() {
    var r = window._posLinkResults;
    if (!r) return;
    r.suggested.forEach(function(m, idx) { window._posLinkDecisions['sug_' + idx] = 'accept'; });
    // Re-render
    window.closeModal();
    window._showPOSLinkReview();
};
window._posRejectAllSuggested = function() {
    var r = window._posLinkResults;
    if (!r) return;
    r.suggested.forEach(function(m, idx) { window._posLinkDecisions['sug_' + idx] = 'reject'; });
    window.closeModal();
    window._showPOSLinkReview();
};

// --- Confirm and save all mappings ---
window._confirmPOSLinks = function() {
    var r = window._posLinkResults;
    if (!r) return;
    var recipes = window.recipes || [];
    var mappings = window.posMappings || {};
    var savedCount = 0;
    var decisions = window._posLinkDecisions || {};

    var _saveMatch = function(posName, match) {
        if (!match) return;
        if (match.type === 'recipe') {
            mappings[posName] = match.id;
            var rec = recipes.find(function(rc) { return rc.id === match.id; });
            if (rec && !rec.posAlias) rec.posAlias = posName;
        } else {
            mappings[posName] = 'inv:' + match.id;
        }
        savedCount++;
    };

    // Process auto-matched (only checked ones)
    var autoChecks = document.querySelectorAll('[data-auto-idx]');
    autoChecks.forEach(function(cb) {
        if (!cb.checked) return;
        var idx = parseInt(cb.getAttribute('data-auto-idx'));
        var m = r.autoMatched[idx];
        if (m && m.match) _saveMatch(m.pos.name, m.match);
    });

    // Process suggested matches (only accepted ones)
    r.suggested.forEach(function(m, idx) {
        if (decisions['sug_' + idx] === 'accept' && m.match) {
            _saveMatch(m.pos.name, m.match);
        }
    });

    window.posMappings = mappings;
    window._posLinkDecisions = {};
    window.saveToDisk();
    window.closeModal();
    window.showToast(savedCount + ' POS mappings saved! Total: ' + Object.keys(mappings).length);
    window.showView('pos-linker');
};

// --- View current mappings ---
window.viewCurrentMappings = function() {
    var mappings = window.posMappings || {};
    var keys = Object.keys(mappings);
    if (keys.length === 0) return window.showToast('No POS mappings saved yet.', 'error');

    var recipes = window.recipes || [];
    var inventory = window.inventoryItems || [];
    var html = '<div style="max-height:500px;overflow-y:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="text-align:left;background:#111;border-bottom:1px solid var(--border);">' +
        '<th style="padding:8px 10px;">POS Product Name</th>' +
        '<th style="padding:8px 10px;">Mapped To</th>' +
        '<th style="padding:8px 10px;">Type</th>' +
        '<th style="padding:8px 10px;width:50px;"></th>' +
        '</tr></thead><tbody>';

    keys.sort().forEach(function(posName) {
        var target = mappings[posName];
        var targetName = target, type = '?';
        if (typeof target === 'string' && target.indexOf('inv:') === 0) {
            var inv = inventory.find(function(i) { return i.id === target.replace('inv:', ''); });
            targetName = inv ? inv.name : target;
            type = 'Inventory';
        } else {
            var rec = recipes.find(function(rc) { return rc.id === target; });
            targetName = rec ? rec.name : target;
            type = 'Recipe';
        }
        html += '<tr style="border-bottom:1px solid var(--border);">' +
            '<td style="padding:6px 10px;">' + window.esc(posName) + '</td>' +
            '<td style="padding:6px 10px;color:var(--green);font-weight:600;">' + window.esc(targetName) + '</td>' +
            '<td style="padding:6px 10px;"><span style="font-size:11px;background:var(--bg-main);padding:2px 6px;border-radius:4px;">' + type + '</span></td>' +
            '<td style="padding:6px 10px;"><button onclick="window._removePOSMapping(this.dataset.pos)" data-pos="' + window.esc(posName) + '" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;">&times;</button></td>' +
        '</tr>';
    });

    html += '</tbody></table></div>';
    html += '<div style="margin-top:12px;text-align:right;color:var(--text-muted);font-size:12px;">' + keys.length + ' total mappings</div>';
    window.openModal('📋 Current POS Mappings', html);
};

window._removePOSMapping = function(posName) {
    delete window.posMappings[posName];
    window.saveToDisk();
    window.showToast('Mapping removed.');
    window.viewCurrentMappings();
};

window.clearPOSMappings = function() {
    var count = Object.keys(window.posMappings || {}).length;
    if (count === 0) return window.showToast('No mappings to clear.', 'error');
    window.confirmAction({
        title: '🔗 Clear All Mappings',
        message: 'This will remove all ' + count + ' POS mappings. Recipes will keep their posAlias field. Continue?',
        confirmLabel: 'Clear All',
        tier: 'dangerous',
        onConfirm: function() {
            window.posMappings = {};
            window.saveToDisk();
            window.showView('pos-linker');
            window.showToast('All POS mappings cleared.');
        }
    });
};

// =============================================================================
// POS MATCH RATE DASHBOARD
// =============================================================================
window.renderDepletionMatchRateView = function() {
    var E = window.esc;
    var logs = (window.depletionLogs || []).filter(function(d) { return !d.reversed; });
    var totalMatched = 0, totalUnmatched = 0;
    var unmatchedFreq = {};
    var perRunRates = [];

    logs.forEach(function(d) {
        var m = (d.matched || []).length;
        var u = (d.unmatched || []).length;
        totalMatched += m;
        totalUnmatched += u;
        if (m + u > 0) perRunRates.push({ date: d.date || '', rate: Math.round(m / (m + u) * 100) });
        (d.unmatched || []).forEach(function(item) {
            var name = item.rawName || item.posName || item.name || item || 'Unknown';
            if (typeof name !== 'string') name = String(name);
            unmatchedFreq[name] = (unmatchedFreq[name] || 0) + 1;
        });
    });

    var overallRate = (totalMatched + totalUnmatched) > 0 ? Math.round(totalMatched / (totalMatched + totalUnmatched) * 100) : 0;
    var rateColor = overallRate >= 80 ? 'var(--green)' : overallRate >= 50 ? 'var(--orange)' : 'var(--red)';

    var topUnmatched = Object.entries(unmatchedFreq).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10);

    var recipesWithAlias = (window.recipes || []).filter(function(r) { return !r.archived && r.posAlias; }).length;
    var totalActiveRecipes = (window.recipes || []).filter(function(r) { return !r.archived; }).length;
    var learnedMappings = Object.keys(window.posMappings || {}).length;
    var bwiAliases = Object.keys(window._bwiAliasMap || {}).length;

    var sparkline = function(data, w, h, color) {
        if (!data.length || data.every(function(d) { return d === 0; })) return '';
        var max = Math.max.apply(null, data.concat([1]));
        var pts = data.map(function(v, i) { return (i / (data.length - 1)) * w + ',' + (h - (v / max) * h * 0.85); }).join(' ');
        return '<svg width="' + w + '" height="' + h + '" style="display:block;"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    };

    var trendData = perRunRates.slice(-20).map(function(r) { return r.rate; });

    var html = '<div style="max-width:900px;margin:auto;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">';
    html += '<div><button onclick="window.showView(\'depletion-history\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0;margin-bottom:6px;">← Back to History</button>';
    html += '<h2 style="margin:0;">📊 POS Match Rate Dashboard</h2>';
    html += '<div style="color:var(--text-muted);font-size:13px;margin-top:4px;">Analyzing ' + logs.length + ' depletion runs</div></div></div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:15px;">';
    html += '<div class="card" style="padding:16px;text-align:center;border-top:4px solid ' + rateColor + ';">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Overall Match Rate</div>';
    html += '<div style="font-size:36px;font-weight:bold;color:' + rateColor + ';">' + overallRate + '%</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);">' + totalMatched + ' matched · ' + totalUnmatched + ' unmatched</div></div>';

    html += '<div class="card" style="padding:16px;text-align:center;border-top:4px solid var(--blue);">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Learned Mappings</div>';
    html += '<div style="font-size:36px;font-weight:bold;color:var(--blue);">' + learnedMappings + '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);">User-confirmed matches</div></div>';

    html += '<div class="card" style="padding:16px;text-align:center;border-top:4px solid var(--purple);">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">BWI Curated Aliases</div>';
    html += '<div style="font-size:36px;font-weight:bold;color:var(--purple);">' + bwiAliases + '</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);">Smart Matcher entries</div></div>';

    var aliasPct = totalActiveRecipes > 0 ? Math.round(recipesWithAlias / totalActiveRecipes * 100) : 0;
    html += '<div class="card" style="padding:16px;text-align:center;border-top:4px solid var(--orange);">';
    html += '<div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Recipe POS Alias Coverage</div>';
    html += '<div style="font-size:36px;font-weight:bold;color:var(--orange);">' + aliasPct + '%</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);">' + recipesWithAlias + ' of ' + totalActiveRecipes + ' recipes</div></div>';
    html += '</div>';

    if (trendData.length > 1) {
        html += '<div class="card" style="padding:16px;margin-bottom:15px;">';
        html += '<div style="font-size:13px;font-weight:700;margin-bottom:10px;">Match Rate Trend (last ' + trendData.length + ' runs)</div>';
        html += '<div style="padding:10px 0;">' + sparkline(trendData, 800, 60, rateColor) + '</div>';
        html += '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);">';
        html += '<span>' + (perRunRates.length > 20 ? perRunRates[perRunRates.length - 20].date : perRunRates[0].date) + '</span>';
        html += '<span>' + perRunRates[perRunRates.length - 1].date + '</span></div></div>';
    }

    if (topUnmatched.length > 0) {
        html += '<div class="card" style="padding:16px;margin-bottom:15px;">';
        html += '<div style="font-size:13px;font-weight:700;margin-bottom:10px;">Top Unmatched POS Items</div>';
        html += '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">These items appear most often without a match. Consider adding aliases or POS mappings.</div>';
        topUnmatched.forEach(function(item, i) {
            var barWidth = topUnmatched[0][1] > 0 ? Math.round(item[1] / topUnmatched[0][1] * 100) : 0;
            html += '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);">';
            html += '<span style="font-size:11px;color:var(--text-muted);width:20px;text-align:right;">' + (i + 1) + '.</span>';
            html += '<div style="flex:1;"><div style="font-size:13px;font-weight:600;margin-bottom:3px;">' + E(item[0]) + '</div>';
            html += '<div style="width:100%;height:4px;background:var(--border);border-radius:2px;"><div style="width:' + barWidth + '%;height:100%;background:var(--red);border-radius:2px;"></div></div></div>';
            html += '<span style="font-size:12px;font-weight:bold;color:var(--red);min-width:40px;text-align:right;">' + item[1] + 'x</span></div>';
        });
        html += '</div>';
    }

    if (logs.length === 0) {
        html += '<div class="card" style="text-align:center;padding:40px;">';
        html += '<div style="font-size:48px;margin-bottom:10px;">📊</div>';
        html += '<p style="color:var(--text-muted);">No depletion runs yet. Run your first stock depletion to see match rate analytics.</p></div>';
    }

    html += '</div>';
    return html;
};

