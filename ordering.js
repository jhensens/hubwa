// --- HOBART HUB: Ordering Module ---
// AI Order Suggester, Lightspeed CSV Import, Prep/Order List, Copy Order Text

// =============================================================================
// 5. AUTO-ORDER / PREP LIST
// =============================================================================


// =============================================================================
// AI ORDER SUGGESTER
// Smart quantities based on depletion history + PAR + delivery schedule
// =============================================================================
window.openAiOrderSuggester = async () => {
    const apiKey = window.getApiKey();
    if (!apiKey) return;

    const statusDiv = document.getElementById('ai-order-status');
    const resultsDiv = document.getElementById('ai-order-results');
    if (!statusDiv) return;

    statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--purple);padding:12px;color:var(--purple);font-weight:bold;">🤖 Analysing stock levels and depletion history...</div>';
    resultsDiv.innerHTML = '';

    const isWeekend = [0,5,6].includes(new Date().getDay());
    const today = new Date();
    const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.getDay()];

    // Build item context for AI
    const items = (window.inventoryItems||[]).filter(i => !i.archived);
    const belowPar = items.filter(i => {
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        return i.stock < par;
    });

    // Analyse depletion history per item
    const depHistory = window.depletionLogs || [];
    const getAvgDepletion = (itemId) => {
        const allDepletes = depHistory.flatMap(log =>
            (log.changes||[]).filter(c => c.id === itemId).map(c => Math.abs(c.delta||0))
        );
        return allDepletes.length > 0 ? allDepletes.reduce((a,b)=>a+b,0)/allDepletes.length : null;
    };

    // Build supplier context
    const suppliers = window.suppliers || [];
    const supContext = suppliers.map(s =>
        s.name + ': delivers on ' + (s.deliveryDays||[]).join('/') + ', min spend $' + (s.minSpend||0) + ', cutoff ' + (s.cutoff||'no cutoff')
    ).join(' | ');

    // Build items needing order with depletion context
    const itemContext = belowPar.map(i => {
        const par = isWeekend ? (i.parWeekend||i.par||0) : (i.parWeekday||i.par||0);
        const deficit = par - i.stock;
        const avgDep = getAvgDepletion(i.id);
        return `${i.name} (${i.supplier||'unassigned'}): stock=${Number(i.stock).toFixed(1)} ${i.buyUnit}, PAR=${par}, deficit=${deficit.toFixed(1)}, avg daily depletion=${avgDep ? avgDep.toFixed(2) : 'unknown'}`;
    }).join('\n');

    if (belowPar.length === 0) {
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ All inventory is at or above PAR. Nothing to order right now.</div>';
        return;
    }

    const prompt = `You are a smart ordering assistant for Bar Wa Izakaya, a Japanese izakaya bar in Hobart, Tasmania.

Today is ${today.toLocaleDateString('en-AU', {weekday:'long',day:'numeric',month:'long'})} (${dayName}).

SUPPLIER DELIVERY SCHEDULE:
${supContext || 'No supplier schedule set'}

ITEMS BELOW PAR (need ordering):
${itemContext}

For each item, suggest:
1. How much to order (considering: deficit, avg depletion rate, upcoming deliveries, whether to order extra buffer)
2. Which day to place the order (based on delivery days)
3. A brief reason for your recommendation

Return ONLY a JSON array:
[{
  "itemName": "string",
  "supplier": "string",
  "currentStock": number,
  "suggestedOrder": number,
  "unit": "string",
  "orderDay": "string",
  "urgency": "high|medium|low",
  "reason": "string (max 15 words)"
}]

Only include items that genuinely need ordering. Be practical — don't over-order.`;

    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Empty API response');
        const suggestions = JSON.parse(data.candidates[0].content.parts[0].text.replace(/```json|```/g,'').trim());

        window._aiOrderSuggestions = suggestions;
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--green);padding:12px;color:var(--green);font-weight:bold;">✅ AI analysis complete — ' + suggestions.length + ' items reviewed</div>';

        // Group by supplier
        const bySup = {};
        suggestions.forEach(s => {
            if (!bySup[s.supplier]) bySup[s.supplier] = [];
            bySup[s.supplier].push(s);
        });

        const urgencyColor = { high: 'var(--red)', medium: 'var(--orange)', low: 'var(--text-muted)' };
        const urgencyLabel = { high: '🔴 Urgent', medium: '🟡 Soon', low: '🟢 Low' };

        const html = Object.entries(bySup).map(([sup, items]) => { window._aoSup = sup;
            const rows = items.map(item =>
                '<tr style="border-bottom:1px solid var(--border);">' +
                '<td style="padding:7px 10px;"><strong style="font-size:13px;">' + esc(item.itemName) + '</strong><br>' +
                    '<small style="color:var(--text-muted);">Currently: ' + Number(item.currentStock).toFixed(1) + ' ' + item.unit + '</small></td>' +
                '<td style="padding:7px 10px;font-weight:bold;font-size:14px;color:var(--blue);">' + Number(item.suggestedOrder).toFixed(1) + ' <small style="font-size:12px;color:var(--text-muted);">' + item.unit + '</small></td>' +
                '<td style="padding:10px 12px;font-size:12px;color:var(--text-muted);">' + (item.orderDay||'ASAP') + '</td>' +
                '<td style="padding:10px 12px;"><span style="font-size:11px;color:' + (urgencyColor[item.urgency]||'var(--text-muted)') + ';">' + (urgencyLabel[item.urgency]||'') + '</span></td>' +
                '<td style="padding:10px 12px;font-size:12px;color:var(--text-muted);font-style:italic;">' + esc(item.reason) + '</td>' +
                '</tr>'
            ).join('');

            return '<div class="card" style="border-top:4px solid var(--purple);margin-bottom:12px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">' +
                    '<h3 style="margin:0;font-size:15px;">' + esc(sup) + '</h3>' +
                    '<button onclick="window.generateAiOrderEmail(window._aoSup)" class="btn btn-purple" style="font-size:12px;">✉️ Generate Order Email</button>' +
                '</div>' +
                '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
                '<th style="padding:8px 12px;text-align:left;">Item</th><th style="padding:8px 12px;">Suggest Order</th><th style="padding:8px 12px;">Order Day</th><th style="padding:8px 12px;">Urgency</th><th style="padding:8px 12px;">Reason</th>' +
                '</tr></thead><tbody>' + rows + '</tbody></table>' +
            '</div>';
        }).join('');

        resultsDiv.innerHTML = html;

    } catch(e) {
        statusDiv.innerHTML = '<div class="card" style="border-left:4px solid var(--red);padding:12px;color:var(--red);">AI Error: ' + e.message + '</div>';
    }
};

window.generateAiOrderEmail = (supName) => {
    const suggestions = (window._aiOrderSuggestions||[]).filter(s=>s.supplier===supName);
    if (suggestions.length === 0) return window.showToast('No suggestions for ' + supName, 'error');

    const lines = suggestions.map(s => '- ' + Number(s.suggestedOrder).toFixed(1) + 'x ' + s.unit + ' of ' + s.itemName).join('\n');
    const text = 'Hi ' + supName + ',\n\nCould I please place an order for the following:\n\n' + lines + '\n\nThanks,\nBar Wa Izakaya';

    // Log the order
    if (!window.orderHistory) window.orderHistory = [];
    window.orderHistory.push({
        date: window._isoDate(),
        supplier: supName,
        estSpend: suggestions.reduce((sum,s)=>sum+(Number(s.suggestedOrder)*((window.inventoryItems||[]).find(i=>i.name===s.itemName)?.price||0)),0),
        items: suggestions.map(s=>({ name:s.itemName, qty:s.suggestedOrder, unit:s.unit, price:(window.inventoryItems||[]).find(i=>i.name===s.itemName)?.price||0 })),
        aiGenerated: true
    });
    window.saveToDisk();

    navigator.clipboard.writeText(text).then(() => window.showToast('AI order email copied for ' + supName + '!'));
};

window.renderAiOrderView = () => {
    return '<div style="max-width:900px;margin:auto;">' +
        window._orderTabBar('ai-order') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0;">✨ AI Order Suggester</h2>' +
            '<p style="margin:5px 0 0 0;color:var(--text-muted);font-size:13px;">Analyses stock levels, depletion history, and delivery schedules to suggest smart order quantities.</p></div>' +
            '<button onclick="window.openAiOrderSuggester()" class="btn btn-purple" style="font-size:16px;padding:12px 24px;">✨ Run AI Analysis</button>' +
        '</div>' +
        '<div id="ai-order-status" style="margin-bottom:15px;"></div>' +
        '<div id="ai-order-results"></div>' +
    '</div>';
};


// =============================================================================
// LIGHTSPEED REPORT IMPORTER
// Handles Sales By, Guests, and Reconciliation CSVs
// =============================================================================
window.renderLightspeedImportView = () => {
    return '<div style="max-width:900px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">' +
            '<div>' +
                '<h2 style="margin:0;">📥 Lightspeed Import</h2>' +
                '<p style="margin:5px 0 0 0;color:var(--text-muted);font-size:13px;">Drop your Lightspeed CSV exports here — Sales By, Guests, or Reconciliation. The Hub detects each type automatically.</p>' +
            '</div>' +
            '<div style="display:flex;gap:8px;">' +
                '<button onclick="window.showView(\'depletion-history\')" class="btn btn-outline" style="font-size:12px;">📉 Depletion History</button>' +
                '<button onclick="window.showView(\'invoice\')" class="btn btn-outline" style="font-size:12px;">🧾 Invoice Ripper</button>' +
            '</div>' +
        '</div>' +

        // Drop zone
        '<div id="ls-dropzone" style="border:2px dashed var(--border);border-radius:12px;padding:40px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:20px;" ' +
            'onclick="document.getElementById(\'ls-file-input\').click()" ' +
            'ondragover="event.preventDefault();this.style.borderColor=\'#3b82f6\';this.style.background=\'rgba(59,130,246,0.05)\';" ' +
            'ondragleave="this.style.borderColor=\'#2a2a35\';this.style.background=\'\';" ' +
            'ondrop="event.preventDefault();this.style.borderColor=\'#2a2a35\';this.style.background=\'\';window.handleLsFiles(event.dataTransfer.files);">' +
            '<div style="font-size:48px;margin-bottom:10px;">📊</div>' +
            '<div style="font-size:16px;font-weight:bold;margin-bottom:5px;">Drop Lightspeed CSV files here</div>' +
            '<div style="font-size:13px;color:var(--text-muted);">Or click to browse · Accepts Sales By, Guests, and Reconciliation reports</div>' +
            '<input type="file" id="ls-file-input" multiple accept=".csv" style="display:none;" onchange="window.handleLsFiles(this.files)">' +
        '</div>' +

        // Date range selector
        '<div class="card" style="padding:15px;margin-bottom:20px;">' +
            '<div style="display:flex;align-items:center;gap:15px;flex-wrap:wrap;">' +
                '<div style="font-size:13px;color:var(--text-muted);font-weight:bold;">Import date range:</div>' +
                '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">' +
                    '<input type="radio" name="ls-mode" value="all" checked onchange="window._lsMode=\'all\'"> All dates in file' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">' +
                    '<input type="radio" name="ls-mode" value="today" onchange="window._lsMode=\'today\'"> Today only' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">' +
                    '<input type="radio" name="ls-mode" value="week" onchange="window._lsMode=\'week\'"> This week' +
                '</label>' +
            '</div>' +
        '</div>' +

        // Results area
        '<div id="ls-results"></div>' +

        // Recent imports log
        '<div style="margin-top:25px;">' +
            '<h3 style="margin:0 0 12px 0;font-size:14px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Recent Imports</h3>' +
            ((window.lsImportLog||[]).length === 0 ?
                '<p style="color:var(--text-muted);font-size:13px;">No imports yet.</p>' :
                (window.lsImportLog||[]).slice(-10).reverse().map(log =>
                    '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dashed var(--border);font-size:13px;">' +
                        '<span>' + esc(log.icon) + ' <strong>' + esc(log.type) + '</strong> — ' + esc(log.summary) + '</span>' +
                        '<span style="color:var(--text-muted);">' + log.time + '</span>' +
                    '</div>'
                ).join('')
            ) +
        '</div>' +
    '</div>';
};

window._lsMode = 'all';

window.handleLsFiles = (files) => {
    if (!files || files.length === 0) return;
    const results = document.getElementById('ls-results');
    results.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">Processing files...</div>';

    const fileArr = Array.from(files);
    let processed = 0;
    const summaries = [];

    fileArr.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const summary = window.processLsFile(file.name, text);
            summaries.push(summary);
            processed++;
            if (processed === fileArr.length) {
                window.saveToDisk();
                // If any Sales By file was processed, route through depletion confirmation
                var hasSalesBy = summaries.some(function(s) { return s.type === 'Sales By'; });
                if (hasSalesBy && window._pendingCsvSalesItems && window._pendingCsvSalesItems.length > 0) {
                    window.showLsResults(summaries);
                    // Brief delay so user sees the import summary, then show confirmation
                    setTimeout(function() {
                        window.showDepletionConfirmation(window._pendingCsvSalesItems, 'csv-depletion');
                        window._pendingCsvSalesItems = null;
                    }, 800);
                } else {
                    window.showLsResults(summaries);
                }
            }
        };
        reader.readAsText(file);
    });
};

window.processLsFile = (filename, text) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return { type: 'Unknown', icon: '❓', status: 'error', message: 'File appears empty' };

    const header = lines[0].toLowerCase();

    if (header.includes('product') && header.includes('quantity') && header.includes('sale amount')) {
        return window.parseLsSalesBy(lines);
    } else if (header.includes('guest count') && header.includes('avg per guest')) {
        return window.parseLsGuests(lines);
    } else if (header.includes('cashup') || header.includes('recorded') && header.includes('counted')) {
        return window.parseLsReconciliation(lines);
    } else {
        return { type: 'Unknown', icon: '❓', status: 'error', message: 'Could not identify report type. Expected Sales By, Guests, or Reconciliation CSV.' };
    }
};

// Parse CSV line handling quoted fields
window.parseCsvLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') { inQuotes = !inQuotes; }
        else if (line[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
        else { current += line[i]; }
    }
    result.push(current.trim());
    return result;
};

// ---- SALES BY PARSER ----
window.parseLsSalesBy = (lines) => {
    const rows = lines.slice(1).map(l => window.parseCsvLine(l));
    let totalSales = 0, totalCost = 0, matched = 0, depleted = 0;
    const productSales = [];

    rows.forEach(r => {
        const name = r[2] || '';
        const qty = parseFloat(r[3]) || 0;
        const saleAmt = parseFloat(r[5]) || 0;
        const cost = parseFloat(r[7]) || 0;
        const gpPct = parseFloat(r[8]) || 0;
        if (!name || qty === 0) return;

        totalSales += saleAmt;
        totalCost += cost;
        productSales.push({ name, qty, saleAmt, cost, gpPct });
    });

    // Defer depletion to unified confirmation UI — store salesItems for later
    const salesItems = productSales.map(p => ({ rawName: p.name, qtySold: p.qty }));
    window._pendingCsvSalesItems = salesItems;

    // Preview-only for import log summary (no stock changes)
    const previewResult = window.previewSalesDeductions(salesItems);
    matched = previewResult.matched.length;
    depleted = previewResult.stockChanges.length;

    // Calculate food vs bev split
    const foodKeywords = ['gyoza','chicken','edamame','rice','salad','pork','beef','wagyu','tofu','tempura','katsu','takoyaki','karaage','dumpling','noodle','ramen','curry','soup'];
    const bevKeywords = ['sapporo','beer','wine','sake','whisky','whiskey','cocktail','negroni','spritz','gin','rum','vodka','tequila','spirits','shochu','umeshu','yuzu','soda','juice','tea','coffee'];

    let foodSales = 0, bevSales = 0;
    productSales.forEach(p => {
        const nameLower = p.name.toLowerCase();
        const isBev = bevKeywords.some(k => nameLower.includes(k));
        const isFood = foodKeywords.some(k => nameLower.includes(k));
        if (isBev) bevSales += p.saleAmt;
        else if (isFood) foodSales += p.saleAmt;
    });

    // Store for food/bev split
    const today = new Date().toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'/');
    if (!window.lsSalesByData) window.lsSalesByData = {};
    window.lsSalesByData[today] = { products: productSales, totalSales, totalCost, foodSales, bevSales };

    if (!window.lsImportLog) window.lsImportLog = [];
    window.lsImportLog.push({ type:'Sales By', icon:'📊', summary: productSales.length + ' products · $' + totalSales.toFixed(0) + ' revenue · ' + matched + ' matched · ' + (salesItems.length - matched) + ' unmatched', time: new Date().toLocaleTimeString() });

    return {
        type: 'Sales By',
        icon: '📊',
        status: 'success',
        rows: productSales.length,
        totalSales,
        totalCost,
        foodSales,
        bevSales,
        matched,
        depleted,
        products: productSales.slice(0,10)
    };
};

// ---- GUESTS PARSER ----
window.parseLsGuests = (lines) => {
    const rows = lines.slice(1).map(l => window.parseCsvLine(l));
    let imported = 0;

    rows.forEach(r => {
        const rawDate = r[0] || '';
        const guests = parseInt(r[1]) || 0;
        const total = parseFloat(r[5]) || 0;
        const avgPerGuest = parseFloat(r[6]) || 0;

        if (!rawDate || !guests) return;

        // Convert YYYY-MM-DD to DD/MM/YYYY
        const parts = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!parts) return;
        const dateStr = parts[3] + '/' + parts[2] + '/' + parts[1];

        // Apply mode filter
        if (window._lsMode === 'today') {
            const today = new Date().toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'/');
            if (dateStr !== today) return;
        } else if (window._lsMode === 'week') {
            const d = new Date(rawDate);
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
            if (d < weekAgo) return;
        }

        // Update or add to salesData
        if (!window.salesData) window.salesData = [];
        const idx = window.salesData.findIndex(s => s.date === dateStr);
        if (idx >= 0) {
            window.salesData[idx].covers = guests;
            window.salesData[idx].avgSpend = avgPerGuest;
            if (!window.salesData[idx].total && total) window.salesData[idx].total = total;
        } else {
            window.salesData.push({ date: dateStr, covers: guests, avgSpend: avgPerGuest, total, eftpos: 0, cash: 0 });
        }
        imported++;
    });

    if (!window.lsImportLog) window.lsImportLog = [];
    window.lsImportLog.push({ type:'Guests', icon:'👥', summary: imported + ' days imported', time: new Date().toLocaleTimeString() });

    return { type:'Guests', icon:'👥', status:'success', imported, rows };
};

// ---- RECONCILIATION PARSER ----
window.parseLsReconciliation = (lines) => {
    const rows = lines.slice(1).map(l => window.parseCsvLine(l));
    let imported = 0;
    const byDate = {};
    const warnings = [];

    rows.forEach(r => {
        const cashupNum = r[0];
        const rawDate = r[1] || '';
        const register = r[3] || '';
        const staffRaw = r[4] || '';
        const counted = parseFloat(r[5]) || 0;
        const recorded = parseFloat(r[6]) || 0;
        const variance = parseFloat(r[7]) || 0;

        // Parse date from "2026-03-16 09:01:21"
        const datePart = rawDate.match(/(\d{4}-\d{2}-\d{2})/);
        if (!datePart) return;
        const ymd = datePart[1];
        const parts = ymd.match(/(\d{4})-(\d{2})-(\d{2})/);
        const dateStr = parts[3] + '/' + parts[2] + '/' + parts[1];

        // Clean staff name — strip leading numbers and punctuation
        const staff = staffRaw.replace(/^[\d\s\.\-_]+/, '').trim();

        // Apply mode filter
        if (window._lsMode === 'today') {
            const today = new Date().toLocaleDateString('en-AU',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'/');
            if (dateStr !== today) return;
        } else if (window._lsMode === 'week') {
            const d = new Date(ymd);
            const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
            if (d < weekAgo) return;
        }

        // Sum across registers for same date
        if (!byDate[dateStr]) byDate[dateStr] = { recorded: 0, counted: 0, variance: 0, staff, registers: [] };
        byDate[dateStr].recorded += recorded;
        byDate[dateStr].counted += counted;
        byDate[dateStr].variance += variance;
        byDate[dateStr].registers.push(register);

        // Flag large variances
        if (Math.abs(variance) > 200) {
            warnings.push({ date: dateStr, register, variance, staff });
        }
    });

    // Update salesData
    Object.entries(byDate).forEach(([dateStr, data]) => {
        if (!window.salesData) window.salesData = [];
        const idx = window.salesData.findIndex(s => s.date === dateStr);
        const entry = {
            date: dateStr,
            total: data.recorded,
            eftpos: Math.max(0, data.recorded - Math.abs(data.counted < data.recorded ? data.recorded - data.counted : 0)),
            cash: data.counted,
            cashVariance: data.variance,
            staffCashUp: data.staff
        };
        if (idx >= 0) {
            window.salesData[idx] = { ...window.salesData[idx], ...entry };
        } else {
            window.salesData.push(entry);
        }
        imported++;
    });

    if (!window.lsImportLog) window.lsImportLog = [];
    window.lsImportLog.push({ type:'Reconciliation', icon:'💳', summary: imported + ' days · ' + (warnings.length > 0 ? warnings.length + ' variance alerts' : 'no variance issues'), time: new Date().toLocaleTimeString() });

    return { type:'Reconciliation', icon:'💳', status:'success', imported, warnings, byDate };
};

// ---- DISPLAY RESULTS ----
window.showLsResults = (summaries) => {
    const el = document.getElementById('ls-results');
    if (!el) return;

    const html = summaries.map(s => {
        if (s.status === 'error') {
            return '<div class="card" style="border-left:4px solid var(--red);padding:15px;margin-bottom:15px;">' +
                '<div style="font-weight:bold;color:var(--red);">❓ Unknown file type</div>' +
                '<div style="font-size:13px;color:var(--text-muted);margin-top:5px;">' + esc(s.message) + '</div>' +
            '</div>';
        }

        if (s.type === 'Sales By') {
            const foodPct = s.totalSales > 0 ? (s.foodSales/s.totalSales*100).toFixed(1) : 0;
            const bevPct = s.totalSales > 0 ? (s.bevSales/s.totalSales*100).toFixed(1) : 0;
            const topProducts = s.products.slice(0,5).map(p =>
                '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px dashed var(--border);font-size:12px;">' +
                '<span>' + esc(p.name.substring(0,35)) + '</span>' +
                '<span style="color:var(--green);">$' + p.saleAmt.toFixed(0) + ' · ' + p.qty + ' sold</span>' +
                '</div>'
            ).join('');

            return '<div class="card" style="border-left:4px solid var(--green);margin-bottom:15px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">' +
                    '<div><strong style="font-size:16px;">📊 Sales By — Imported</strong><br>' +
                    '<small style="color:var(--text-muted);">' + s.rows + ' products · ' + s.depleted + ' inventory items depleted</small></div>' +
                    '<div style="text-align:right;"><div style="font-size:22px;font-weight:bold;color:var(--green);">$' + s.totalSales.toFixed(0) + '</div><small style="color:var(--text-muted);">Total revenue</small></div>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">' +
                    '<div style="background:var(--bg-main);padding:10px;border-radius:8px;text-align:center;">' +
                        '<div style="font-size:11px;color:var(--orange);text-transform:uppercase;">🍱 Food</div>' +
                        '<div style="font-size:20px;font-weight:bold;">$' + s.foodSales.toFixed(0) + '</div>' +
                        '<div style="font-size:11px;color:var(--text-muted);">' + foodPct + '% of sales</div>' +
                    '</div>' +
                    '<div style="background:var(--bg-main);padding:10px;border-radius:8px;text-align:center;">' +
                        '<div style="font-size:11px;color:var(--blue);text-transform:uppercase;">🍶 Beverage</div>' +
                        '<div style="font-size:20px;font-weight:bold;">$' + s.bevSales.toFixed(0) + '</div>' +
                        '<div style="font-size:11px;color:var(--text-muted);">' + bevPct + '% of sales</div>' +
                    '</div>' +
                '</div>' +
                '<div style="font-size:12px;color:var(--text-muted);font-weight:bold;margin-bottom:5px;">TOP SELLERS</div>' +
                topProducts +
            '</div>';
        }

        if (s.type === 'Guests') {
            return '<div class="card" style="border-left:4px solid var(--blue);margin-bottom:15px;">' +
                '<strong style="font-size:16px;">👥 Guests — Imported</strong><br>' +
                '<small style="color:var(--text-muted);">' + s.imported + ' days of covers data added to takings</small>' +
            '</div>';
        }

        if (s.type === 'Reconciliation') {
            const warningHtml = s.warnings.length > 0 ?
                '<div style="margin-top:12px;">' +
                '<div style="font-size:12px;color:var(--red);font-weight:bold;margin-bottom:5px;">⚠️ VARIANCE ALERTS</div>' +
                s.warnings.map(w =>
                    '<div style="font-size:12px;padding:5px 0;border-bottom:1px dashed var(--border);display:flex;justify-content:space-between;">' +
                    '<span>' + esc(w.date) + ' · ' + esc(w.register) + ' · ' + esc(w.staff) + '</span>' +
                    '<span style="color:var(--red);font-weight:bold;">$' + w.variance.toFixed(2) + '</span>' +
                    '</div>'
                ).join('') + '</div>' : '';

            return '<div class="card" style="border-left:4px solid var(--purple);margin-bottom:15px;">' +
                '<strong style="font-size:16px;">💳 Reconciliation — Imported</strong><br>' +
                '<small style="color:var(--text-muted);">' + s.imported + ' days of takings imported from Lightspeed</small>' +
                warningHtml +
            '</div>';
        }

        return '';
    }).join('');

    el.innerHTML = html;
    window.showView('lightspeed-import'); // refresh to update recent imports log
};

window.renderPrepListView = () => {
    const isWeekend = [0, 5, 6].includes(new Date().getDay());
    const currentDay = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];

    const ordersNeeded = (window.inventoryItems || []).filter(i => {
        if (i.archived) return false;
        let parTarget = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
        return i.stock < parTarget;
    }).reduce((acc, item) => {
        if (!acc[item.supplier]) acc[item.supplier] = { items: [], totalSpend: 0, supObj: window.suppliers.find(s => s.name === item.supplier) };
        let parTarget = isWeekend ? (item.parWeekend || item.par || 0) : (item.parWeekday || item.par || 0);
        let qtyToOrder = parTarget - item.stock;
        acc[item.supplier].items.push({ ...item, toOrder: qtyToOrder });
        acc[item.supplier].totalSpend += (qtyToOrder * (item.price || 0));
        return acc;
    }, {});

    return `
    <div style="max-width: 900px; margin: auto;">
        ${window._orderTabBar('prep-list')}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <h2 style="margin:0">📝 Order Hub</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Targeting <strong style="color:var(--blue);">${isWeekend ? 'WEEKEND' : 'WEEKDAY'}</strong> PAR levels — items below par grouped by supplier</div>
            </div>
            <button onclick="window.showView(\'inventory\')" class="btn btn-outline">Update Stock Levels</button>
        </div>
        ${Object.keys(ordersNeeded).length === 0 ? '<div class="card"><p style="color:var(--green); font-weight:bold; font-size:18px;">✅ All inventory is at or above PAR. Nothing to order!</p></div>' : ''}
        ${Object.keys(ordersNeeded).map(supName => {
            const data = ordersNeeded[supName];
            const supObj = data.supObj || { minSpend: 0, deliveryDays: null };
            const meetsMin = data.totalSpend >= supObj.minSpend;
            const validDay = !supObj.deliveryDays || supObj.deliveryDays.length === 0 || supObj.deliveryDays.includes(currentDay);
            let warningHtml = '';
            if (!meetsMin) warningHtml += `<span style="color:var(--red); font-size:12px; margin-right:10px;">⚠️ Under Min Spend ($${data.totalSpend.toFixed(2)} / $${supObj.minSpend})</span>`;
            if (!validDay) warningHtml += `<span style="color:var(--orange); font-size:12px;">🚫 No Delivery on ${currentDay}</span>`;
            return `
            <div class="card" style="border-top:4px solid var(--blue); margin-bottom:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:10px; margin-bottom:10px;">
                    <div>
                        <h3 style="margin:0;">${supName === 'null' || supName === '' ? 'Unassigned Supplier' : esc(supName)}</h3>
                        <div style="margin-top:5px;">${warningHtml || `<span style="color:var(--green); font-size:12px;">✓ Ready to Order (Est. $${data.totalSpend.toFixed(2)})</span>`}</div>
                    </div>
                    <button onclick="window.copyOrderText('${supName}', ${data.totalSpend})" class="btn btn-outline" style="font-size:11px; padding:6px 12px;">📋 Copy Order Text</button>
                </div>
                <table style="width:100%; font-size:14px; text-align:left; border-collapse:collapse;">
                    <tbody>
                        ${data.items.map(o => `
                        <tr style="border-bottom:1px dashed var(--bg-main);">
                            <td style="padding:7px 0;"><strong style="font-size:13px;">${esc(o.name)}</strong> <small style="color:var(--text-muted);">[${esc(o.sku || 'No SKU')}]</small></td>
                            <td style="padding:7px 0; font-size:12px; color:var(--text-muted);">Stock: ${o.stock} / PAR: ${isWeekend ? o.parWeekend : o.parWeekday}</td>
                            <td style="padding:7px 0; text-align:right; color:var(--brand-accent); font-weight:bold; font-size:14px;">Order: ${o.toOrder.toFixed(1)} <small>${o.buyUnit || 'Unit'}</small></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
        }).join('')}
    </div>`;
};

// =============================================================================
// PREP LIST GENERATOR
// Calculates batch prep quantities based on estimated covers + recipe usage
// =============================================================================
window._prepCovers = 0;
window._prepStation = 'All';

window.renderPrepGenView = () => {
    const E = window.esc;
    const covers = window._prepCovers || 0;
    const stationFilter = window._prepStation || 'All';

    // Get batch recipes (prep items)
    const batchRecipes = (window.recipes || []).filter(r => r.type === 'Batch' && !r.archived && r.yieldQty > 0);
    // Get menu recipes that use batch ingredients
    const menuRecipes = (window.recipes || []).filter(r => r.type === 'Menu' && !r.archived && (r.status || 'Active') === 'Active');

    // Get available stations from batch recipes
    const stations = [...new Set(batchRecipes.map(r => r.station || 'Prep').filter(Boolean))];

    // Calculate how much of each batch recipe is needed per cover
    // Walk through all menu recipes, find batch ingredient usage, aggregate
    const batchUsage = {}; // batchId -> { name, totalQtyPerCover, yieldQty, unit, station, usedBy: [] }

    // Estimate covers from recent data if user hasn't set
    const salesData = window.salesData || [];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const isWeekend = [0, 5, 6].includes(dayOfWeek);
    const dayName = today.toLocaleDateString('en-AU', { weekday: 'long' });

    // Get average covers for this day of week from last 4 weeks
    let avgCoversForDay = 0;
    let dayCount = 0;
    for (let w = 1; w <= 4; w++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (w * 7));
        const fmtDate = d.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const sale = salesData.find(s => s.date === fmtDate);
        if (sale && sale.covers > 0) { avgCoversForDay += Number(sale.covers); dayCount++; }
    }
    avgCoversForDay = dayCount > 0 ? Math.round(avgCoversForDay / dayCount) : 0;
    const suggestedCovers = covers || avgCoversForDay;

    // Calculate batch usage across all menu recipes
    menuRecipes.forEach(menu => {
        (menu.ingredients || []).forEach(ing => {
            if (ing.type !== 'batch') return;
            const batch = batchRecipes.find(b => b.id === ing.ref);
            if (!batch) return;
            const qtyPerServe = Number(ing.qty) || 0;
            const batchYield = Number(batch.yieldQty) || 1;
            if (!batchUsage[batch.id]) {
                batchUsage[batch.id] = {
                    name: batch.name,
                    totalQtyPerCover: 0,
                    yieldQty: batchYield,
                    yieldUnit: batch.yieldUnit || 'portions',
                    station: batch.station || 'Prep',
                    cost: batch.cost || 0,
                    usedBy: []
                };
            }
            batchUsage[batch.id].totalQtyPerCover += qtyPerServe;
            batchUsage[batch.id].usedBy.push(menu.name);
        });
    });

    // Calculate prep quantities for the target covers
    const prepItems = Object.entries(batchUsage)
        .map(([id, b]) => {
            const totalNeeded = b.totalQtyPerCover * suggestedCovers;
            const batchesNeeded = Math.ceil(totalNeeded / b.yieldQty);
            return {
                id, name: b.name, station: b.station,
                totalNeeded: totalNeeded.toFixed(1),
                batchesNeeded,
                yieldQty: b.yieldQty,
                yieldUnit: b.yieldUnit,
                cost: b.cost,
                totalCost: (b.cost * batchesNeeded).toFixed(2),
                usedBy: [...new Set(b.usedBy)]
            };
        })
        .filter(p => stationFilter === 'All' || p.station === stationFilter)
        .sort((a, b) => b.batchesNeeded - a.batchesNeeded);

    const totalPrepCost = prepItems.reduce((s, p) => s + parseFloat(p.totalCost), 0);

    let html = '<div style="max-width:900px;margin:auto;">';
    html += window._orderTabBar('prep-gen');
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">';
    html += '<div><h2 style="margin:0;">🍳 Prep List Generator</h2>';
    html += '<div style="color:var(--text-muted);font-size:13px;margin-top:2px;">Calculate batch prep quantities based on expected covers</div></div>';
    html += '</div>';

    // Controls
    html += '<div class="card" style="padding:16px;margin-bottom:16px;">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:end;">';

    // Covers input
    html += '<div><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Expected Covers</label>';
    html += '<input type="number" id="prep-covers" class="input-box" value="' + suggestedCovers + '" placeholder="e.g. 80" style="margin:0;" onchange="window._prepCovers=parseInt(this.value)||0;window.showView(\'prep-gen\')">';
    html += '</div>';

    // Day context
    html += '<div><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Day</label>';
    html += '<div style="font-size:14px;font-weight:600;padding:10px;background:var(--bg-main);border-radius:6px;border:1px solid var(--border);">' + dayName + (isWeekend ? ' <span style="color:var(--orange);font-size:11px;">(Weekend)</span>' : '') + '</div>';
    html += '</div>';

    // Station filter
    html += '<div><label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Station</label>';
    html += '<select class="input-box" style="margin:0;" onchange="window._prepStation=this.value;window.showView(\'prep-gen\')">';
    html += '<option value="All"' + (stationFilter === 'All' ? ' selected' : '') + '>All Stations</option>';
    stations.forEach(s => { html += '<option value="' + E(s) + '"' + (stationFilter === s ? ' selected' : '') + '>' + E(s) + '</option>'; });
    html += '</select></div>';

    // Print button
    html += '<button onclick="window._printPrepList()" class="btn btn-blue" style="padding:10px 16px;">🖨️ Print</button>';
    html += '</div>';

    // Average covers hint
    if (avgCoversForDay > 0) {
        html += '<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">📊 Average for ' + dayName + ': <strong>' + avgCoversForDay + ' covers</strong> (last 4 weeks)</div>';
    }
    html += '</div>';

    // Results
    if (suggestedCovers === 0) {
        html += '<div class="card" style="text-align:center;padding:32px;color:var(--text-muted);">';
        html += '<div style="font-size:28px;margin-bottom:8px;">🍳</div>';
        html += '<div style="font-size:14px;">Enter expected covers to generate prep quantities</div></div>';
    } else if (prepItems.length === 0) {
        html += '<div class="card" style="text-align:center;padding:32px;color:var(--text-muted);">';
        html += '<div style="font-size:28px;margin-bottom:8px;">✅</div>';
        html += '<div style="font-size:14px;">No batch recipes linked to menu items' + (stationFilter !== 'All' ? ' for ' + E(stationFilter) : '') + '</div>';
        html += '<div style="font-size:12px;margin-top:4px;">Link batch recipes as ingredients in your menu recipes for prep list generation</div></div>';
    } else {
        // Summary KPIs
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px;">';
        html += '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--blue);"><div style="font-size:24px;font-weight:800;color:var(--blue);">' + suggestedCovers + '</div><div style="font-size:11px;color:var(--text-muted);">Covers</div></div>';
        html += '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--orange);"><div style="font-size:24px;font-weight:800;color:var(--orange);">' + prepItems.length + '</div><div style="font-size:11px;color:var(--text-muted);">Prep Items</div></div>';
        html += '<div class="card" style="text-align:center;padding:12px;border-top:3px solid var(--green);"><div style="font-size:24px;font-weight:800;color:var(--green);">$' + totalPrepCost.toFixed(0) + '</div><div style="font-size:11px;color:var(--text-muted);">Est. Cost</div></div>';
        html += '</div>';

        // Prep table
        html += '<div class="card" style="padding:0;overflow:hidden;">';
        html += '<table style="width:100%;border-collapse:collapse;">';
        html += '<thead><tr style="background:#111;font-size:11px;color:var(--text-muted);text-transform:uppercase;">';
        html += '<th style="padding:10px 12px;text-align:left;">Prep Item</th>';
        html += '<th style="padding:10px 12px;text-align:center;">Batches</th>';
        html += '<th style="padding:10px 12px;text-align:center;">Yield</th>';
        html += '<th style="padding:10px 12px;text-align:right;">Cost</th>';
        html += '<th style="padding:10px 12px;text-align:left;">Used By</th>';
        html += '</tr></thead><tbody>';

        prepItems.forEach(p => {
            const urgency = p.batchesNeeded >= 3 ? 'var(--red)' : p.batchesNeeded >= 2 ? 'var(--orange)' : 'var(--text-main)';
            html += '<tr style="border-bottom:1px solid var(--border);">';
            html += '<td style="padding:10px 12px;"><strong style="font-size:13px;">' + E(p.name) + '</strong>';
            if (p.station) html += ' <span style="font-size:10px;background:var(--bg-main);padding:1px 6px;border-radius:8px;border:1px solid var(--border);color:var(--text-muted);">' + E(p.station) + '</span>';
            html += '</td>';
            html += '<td style="padding:10px 12px;text-align:center;font-size:20px;font-weight:800;color:' + urgency + ';">' + p.batchesNeeded + 'x</td>';
            html += '<td style="padding:10px 12px;text-align:center;font-size:12px;color:var(--text-muted);">' + p.yieldQty + ' ' + E(p.yieldUnit) + '</td>';
            html += '<td style="padding:10px 12px;text-align:right;font-size:12px;color:var(--text-muted);">$' + p.totalCost + '</td>';
            html += '<td style="padding:10px 12px;font-size:11px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + E(p.usedBy.join(', ')) + '">' + E(p.usedBy.slice(0, 3).join(', ')) + (p.usedBy.length > 3 ? ' +' + (p.usedBy.length - 3) : '') + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
    }
    html += '</div>';
    return html;
};

window._printPrepList = () => {
    const covers = window._prepCovers || 0;
    const stationFilter = window._prepStation || 'All';
    const venue = window._getVenueName();
    const dayName = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Recalculate prep items
    const batchRecipes = (window.recipes || []).filter(r => r.type === 'Batch' && !r.archived && r.yieldQty > 0);
    const menuRecipes = (window.recipes || []).filter(r => r.type === 'Menu' && !r.archived && (r.status || 'Active') === 'Active');
    const batchUsage = {};
    menuRecipes.forEach(menu => {
        (menu.ingredients || []).forEach(ing => {
            if (ing.type !== 'batch') return;
            const batch = batchRecipes.find(b => b.id === ing.ref);
            if (!batch) return;
            if (!batchUsage[batch.id]) batchUsage[batch.id] = { name: batch.name, totalQtyPerCover: 0, yieldQty: Number(batch.yieldQty) || 1, yieldUnit: batch.yieldUnit || 'portions', station: batch.station || 'Prep' };
            batchUsage[batch.id].totalQtyPerCover += Number(ing.qty) || 0;
        });
    });
    const prepItems = Object.entries(batchUsage)
        .map(([id, b]) => ({ name: b.name, station: b.station, batchesNeeded: Math.ceil((b.totalQtyPerCover * covers) / b.yieldQty), yieldQty: b.yieldQty, yieldUnit: b.yieldUnit }))
        .filter(p => stationFilter === 'All' || p.station === stationFilter)
        .sort((a, b) => b.batchesNeeded - a.batchesNeeded);

    let text = venue + ' — Prep List\n' + dayName + ' · ' + covers + ' covers' + (stationFilter !== 'All' ? ' · ' + stationFilter : '') + '\n\n';
    prepItems.forEach(p => {
        text += p.batchesNeeded + 'x  ' + p.name + '  (' + p.yieldQty + ' ' + p.yieldUnit + ' per batch)\n';
    });

    const win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><title>Prep List</title><style>body{font-family:monospace;font-size:14px;max-width:600px;margin:30px auto;line-height:1.8;}@media print{body{margin:15px;}}</style></head><body><pre>' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre><script>window.onload=()=>{window.print();}<\/script></body></html>');
    win.document.close();
};

window.copyOrderText = (supName, estSpend) => {
    const isWeekend = [0, 5, 6].includes(new Date().getDay());
    const items = (window.inventoryItems || []).filter(i => i.supplier === supName && !i.archived && i.stock < (isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0)));
    let text = `Hi ${supName},\n\nCould I please place an order for the following:\n\n`;
    const orderItems = [];
    items.forEach(i => {
        let par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
        const qty = (par - i.stock).toFixed(1);
        text += `- ${qty}x ${i.buyUnit || 'Unit'} of ${i.name} ${i.sku ? `[${i.sku}]` : ''}\n`;
        orderItems.push({ name: i.name, sku: i.sku||'', qty, unit: i.buyUnit||'Unit', price: i.price||0 });
    });
    const _venueName = window._getVenueName();
    text += '\nThanks,\n' + _venueName;
    if (!window.orderHistory) window.orderHistory = [];
    window.orderHistory.push({ date: window._isoDate(), supplier: supName, estSpend, items: orderItems });
    window.saveToDisk();
    navigator.clipboard.writeText(text).then(() => window.showToast(`Order copied & logged for ${supName}!`));
};

// =============================================================================
// AUTO-ORDER DRAFTS ENGINE
// Automatically stages orders when stock drops below PAR after depletion
// Checks supplier delivery schedule and cutoff times
// =============================================================================

// Generate draft orders for suppliers delivering tomorrow (or today if before cutoff)
// Called after depletion runs, CSV imports, or manually from Drafts tab
window._generateOrderDrafts = () => {
    const items = (window.inventoryItems || []).filter(i => !i.archived);
    const suppliers = window.suppliers || [];
    const now = new Date();
    const isWeekend = [0, 5, 6].includes(now.getDay());

    // Check both today and tomorrow delivery windows
    const todayDay = window._dayNames[now.getDay()];
    const tomorrow = new Date(now.getTime() + 86400000);
    const tomorrowDay = window._dayNames[tomorrow.getDay()];
    const currentHHMM = now.toTimeString().slice(0, 5); // "HH:MM"

    // Find items below PAR grouped by supplier
    const belowPar = items.filter(i => {
        const par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
        return par > 0 && (i.stock || 0) < par && i.supplier;
    });

    if (belowPar.length === 0) return; // nothing to draft

    // Group by supplier
    const bySup = {};
    belowPar.forEach(i => {
        if (!bySup[i.supplier]) bySup[i.supplier] = [];
        bySup[i.supplier].push(i);
    });

    const newDrafts = [];

    Object.entries(bySup).forEach(([supName, supItems]) => {
        const sup = suppliers.find(s => s.name === supName);
        if (!sup) return; // skip unassigned/unknown suppliers

        // Determine delivery window: tomorrow delivery (order today), or today if before cutoff
        const deliversTomorrow = sup.deliveryDays && sup.deliveryDays.includes(tomorrowDay);
        const deliversToday = sup.deliveryDays && sup.deliveryDays.includes(todayDay);
        const beforeCutoff = !sup.cutoff || currentHHMM < sup.cutoff;

        // Only create drafts for actionable delivery windows
        let deliveryDay = '';
        let orderByTime = '';
        if (deliversTomorrow) {
            deliveryDay = tomorrowDay;
            orderByTime = sup.cutoff || '';
        } else if (deliversToday && beforeCutoff) {
            deliveryDay = todayDay;
            orderByTime = sup.cutoff || '';
        } else {
            // Find next delivery day
            const dayNames = window._dayNames;
            for (let d = 2; d <= 7; d++) {
                const futureDate = new Date(now.getTime() + d * 86400000);
                const futureDay = dayNames[futureDate.getDay()];
                if (sup.deliveryDays && sup.deliveryDays.includes(futureDay)) {
                    deliveryDay = futureDay;
                    orderByTime = sup.cutoff || '';
                    break;
                }
            }
            if (!deliveryDay) return; // no upcoming delivery day found
        }

        // Check if there's already an active draft for this supplier
        const existingDraft = (window.orderDrafts || []).find(d =>
            d.supplier === supName && d.status === 'pending'
        );
        if (existingDraft) {
            // Update existing draft with current stock levels
            existingDraft.items = supItems.map(i => {
                const par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
                const qty = parseFloat((par - (i.stock || 0)).toFixed(1));
                return {
                    id: i.id,
                    name: i.recipeName || i.name,
                    fullName: i.name,
                    sku: i.sku || '',
                    qty: qty,
                    unit: i.buyUnit || 'Unit',
                    price: i.price || 0,
                    currentStock: i.stock || 0,
                    par: par
                };
            });
            existingDraft.estSpend = existingDraft.items.reduce((s, it) => s + (it.qty * it.price), 0);
            existingDraft.deliveryDay = deliveryDay;
            existingDraft.orderByTime = orderByTime;
            existingDraft.updatedAt = window._isoNow();
            return;
        }

        // Build draft order
        const draftItems = supItems.map(i => {
            const par = isWeekend ? (i.parWeekend || i.par || 0) : (i.parWeekday || i.par || 0);
            const qty = parseFloat((par - (i.stock || 0)).toFixed(1));
            return {
                id: i.id,
                name: i.recipeName || i.name,
                fullName: i.name,
                sku: i.sku || '',
                qty: qty,
                unit: i.buyUnit || 'Unit',
                price: i.price || 0,
                currentStock: i.stock || 0,
                par: par
            };
        });

        const estSpend = draftItems.reduce((s, it) => s + (it.qty * it.price), 0);

        newDrafts.push({
            id: window.generateId('draft'),
            supplier: supName,
            items: draftItems,
            estSpend: estSpend,
            minSpend: sup.minSpend || 0,
            deliveryDay: deliveryDay,
            orderByTime: orderByTime,
            contact: sup.contact || '',
            status: 'pending', // pending | confirmed | dismissed
            createdAt: window._isoNow(),
            updatedAt: window._isoNow(),
            source: 'auto' // auto | manual
        });
    });

    if (newDrafts.length > 0) {
        if (!window.orderDrafts) window.orderDrafts = [];
        window.orderDrafts.push(...newDrafts);
        window.saveToDisk();
        window.showToast('📦 ' + newDrafts.length + ' order draft' + (newDrafts.length > 1 ? 's' : '') + ' staged — review in Order Drafts');
    }
};

// Dismiss a draft
window._dismissDraft = (draftId) => {
    const draft = (window.orderDrafts || []).find(d => d.id === draftId);
    if (draft) {
        draft.status = 'dismissed';
        draft.updatedAt = window._isoNow();
        window.saveToDisk();
        window.showView('order-drafts');
    }
};

// Update qty on a draft item + recalc line/spend display inline
window._updateDraftQty = (draftId, itemIdx, newQty) => {
    const draft = (window.orderDrafts || []).find(d => d.id === draftId);
    if (!draft || !draft.items[itemIdx]) return;
    draft.items[itemIdx].qty = parseFloat(newQty) || 0;
    draft.estSpend = draft.items.reduce((s, it) => s + (it.qty * it.price), 0);
    draft.updatedAt = window._isoNow();
    // Update display elements without re-rendering the whole view
    var lineEl = document.querySelector('[data-draft="' + draftId + '"] [data-line="' + itemIdx + '"]');
    if (lineEl) lineEl.textContent = '$' + (draft.items[itemIdx].qty * draft.items[itemIdx].price).toFixed(2);
    var spendEl = document.getElementById('draft-spend-' + draftId);
    if (spendEl) spendEl.textContent = '$' + draft.estSpend.toFixed(2);
};

// Save draft edits on blur (when user finishes editing a qty field)
window._saveDraftOnBlur = () => { window.saveToDisk(); };

// Remove an item from a draft
window._removeDraftItem = (draftId, itemIdx) => {
    const draft = (window.orderDrafts || []).find(d => d.id === draftId);
    if (!draft) return;
    draft.items.splice(itemIdx, 1);
    if (draft.items.length === 0) {
        draft.status = 'dismissed';
    }
    draft.estSpend = draft.items.reduce((s, it) => s + (it.qty * it.price), 0);
    draft.updatedAt = window._isoNow();
    window.saveToDisk();
    window.showView('order-drafts');
};

// Confirm a draft — copies order text, logs to orderHistory, removes draft
window._confirmDraft = (draftId) => {
    const draft = (window.orderDrafts || []).find(d => d.id === draftId);
    if (!draft || draft.status !== 'pending') return;

    // Recalculate spend from current qtys
    draft.estSpend = draft.items.reduce((s, it) => s + (it.qty * it.price), 0);

    // Build order text
    const venueName = window._getVenueName();
    let text = 'Hi ' + draft.supplier + ',\n\nCould I please place an order for the following:\n\n';
    draft.items.filter(it => it.qty > 0).forEach(it => {
        text += '- ' + it.qty + 'x ' + it.unit + ' of ' + it.fullName + (it.sku ? ' [' + it.sku + ']' : '') + '\n';
    });
    text += '\nThanks,\n' + venueName;

    // Log to orderHistory
    if (!window.orderHistory) window.orderHistory = [];
    window.orderHistory.push({
        date: window._isoDate(),
        supplier: draft.supplier,
        estSpend: draft.estSpend,
        items: draft.items.filter(it => it.qty > 0).map(it => ({
            name: it.fullName,
            sku: it.sku,
            qty: it.qty,
            unit: it.unit,
            price: it.price
        })),
        autoDraft: true
    });

    // Mark draft as confirmed
    draft.status = 'confirmed';
    draft.updatedAt = window._isoNow();
    window.saveToDisk();

    // Copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        window.showToast('✅ Order confirmed & copied for ' + draft.supplier + '!');
    }).catch(() => {
        window.showToast('Order confirmed for ' + draft.supplier + ' (clipboard failed — check console)');
        console.log('Order text:\n' + text);
    });

    window.logAudit('orderDrafts', 'draft-confirmed', draft.id,
        draft.supplier + ': ' + draft.items.length + ' items, est $' + draft.estSpend.toFixed(2));

    window.showView('order-drafts');
};

// Clean up old dismissed/confirmed drafts (keep last 50)
window._cleanOldDrafts = () => {
    if (!window.orderDrafts) return;
    const pending = window.orderDrafts.filter(d => d.status === 'pending');
    const done = window.orderDrafts.filter(d => d.status !== 'pending');
    window.orderDrafts = [...pending, ...done.slice(-50)];
};

// Render the Order Drafts view
window.renderOrderDraftsView = () => {
    const E = window.esc;
    window._cleanOldDrafts();
    const drafts = (window.orderDrafts || []);
    const pending = drafts.filter(d => d.status === 'pending');
    const confirmed = drafts.filter(d => d.status === 'confirmed').slice(-10).reverse();
    const dismissed = drafts.filter(d => d.status === 'dismissed').slice(-10).reverse();

    const totalPendingSpend = pending.reduce((s, d) => s + (d.estSpend || 0), 0);
    const totalPendingItems = pending.reduce((s, d) => s + d.items.length, 0);

    // Pending drafts
    const pendingHtml = pending.length === 0
        ? '<div class="card" style="text-align:center;padding:30px;color:var(--text-muted);">' +
            '<div style="font-size:36px;margin-bottom:10px;">✅</div>' +
            '<div style="font-weight:600;font-size:15px;">No pending order drafts</div>' +
            '<div style="font-size:13px;margin-top:6px;">Drafts are auto-generated after depletion runs when stock drops below PAR.</div>' +
          '</div>'
        : pending.map(d => {
            const meetsMin = d.estSpend >= (d.minSpend || 0);
            const isUrgent = d.deliveryDay === window._dayNames[new Date().getDay()] ||
                             d.deliveryDay === window._dayNames[(new Date().getDay() + 1) % 7];

            let statusBadge = '';
            if (!meetsMin && d.minSpend > 0) statusBadge += '<span style="font-size:11px;color:var(--red);margin-right:8px;">⚠️ Under min spend ($' + d.estSpend.toFixed(0) + '/$' + d.minSpend + ')</span>';
            if (isUrgent && d.orderByTime) statusBadge += '<span style="font-size:11px;color:var(--orange);">⏰ Order by ' + d.orderByTime + '</span>';

            const itemRows = d.items.map((it, idx) => {
                const lineTotal = (it.qty * it.price).toFixed(2);
                return '<tr style="border-bottom:1px solid var(--border);">' +
                    '<td style="padding:8px 10px;">' +
                        '<strong style="font-size:13px;">' + E(it.name) + '</strong>' +
                        (it.sku ? ' <small style="color:var(--text-muted);">[' + E(it.sku) + ']</small>' : '') +
                        '<div style="font-size:11px;color:var(--text-muted);">Stock: ' + Number(it.currentStock).toFixed(1) + ' · PAR: ' + it.par + '</div>' +
                    '</td>' +
                    '<td style="padding:8px 10px;text-align:center;">' +
                        '<input type="number" value="' + it.qty + '" min="0" step="0.5" ' +
                        'onchange="window._updateDraftQty(\'' + d.id + '\',' + idx + ',this.value)" ' +
                        'onblur="window._saveDraftOnBlur()" ' +
                        'class="input-box" style="width:70px;text-align:center;margin:0;padding:6px;">' +
                    '</td>' +
                    '<td style="padding:8px 10px;text-align:center;color:var(--text-muted);font-size:12px;">' + E(it.unit) + '</td>' +
                    '<td style="padding:8px 10px;text-align:right;font-size:12px;">$' + (it.price || 0).toFixed(2) + '</td>' +
                    '<td style="padding:8px 10px;text-align:right;font-weight:bold;font-size:13px;" data-draft="' + d.id + '" data-line="' + idx + '">$' + lineTotal + '</td>' +
                    '<td style="padding:8px 10px;text-align:center;">' +
                        '<button onclick="window._removeDraftItem(\'' + d.id + '\',' + idx + ')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--text-muted);" title="Remove item">✕</button>' +
                    '</td>' +
                '</tr>';
            }).join('');

            return '<div class="card" style="border-top:4px solid ' + (isUrgent ? 'var(--orange)' : 'var(--blue)') + ';margin-bottom:14px;padding:0;overflow:hidden;">' +
                '<div style="padding:14px 16px;border-bottom:1px solid var(--border);">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
                        '<div>' +
                            '<h3 style="margin:0;font-size:16px;">' + E(d.supplier) + '</h3>' +
                            '<div style="font-size:12px;color:var(--text-muted);margin-top:3px;">' +
                                '🚚 Delivers ' + E(d.deliveryDay) +
                                (d.orderByTime ? ' · Cutoff ' + E(d.orderByTime) : '') +
                                ' · ' + d.items.length + ' item' + (d.items.length !== 1 ? 's' : '') +
                            '</div>' +
                            (statusBadge ? '<div style="margin-top:4px;">' + statusBadge + '</div>' : '') +
                        '</div>' +
                        '<div style="text-align:right;">' +
                            '<div id="draft-spend-' + d.id + '" style="font-size:20px;font-weight:bold;color:var(--brand-accent);">$' + d.estSpend.toFixed(2) + '</div>' +
                            '<div style="font-size:10px;color:var(--text-muted);">Est. Spend</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div style="padding:0 16px;">' +
                    '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                    '<thead><tr style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">' +
                        '<th style="padding:8px 10px;text-align:left;">Item</th>' +
                        '<th style="padding:8px 10px;text-align:center;">Order Qty</th>' +
                        '<th style="padding:8px 10px;text-align:center;">Unit</th>' +
                        '<th style="padding:8px 10px;text-align:right;">Unit $</th>' +
                        '<th style="padding:8px 10px;text-align:right;">Line $</th>' +
                        '<th style="padding:8px 10px;width:30px;"></th>' +
                    '</tr></thead>' +
                    '<tbody>' + itemRows + '</tbody>' +
                    '</table>' +
                '</div>' +
                '<div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;">' +
                    '<button onclick="window._dismissDraft(\'' + d.id + '\')" class="btn btn-outline" style="font-size:12px;">Dismiss</button>' +
                    '<button onclick="window._confirmDraft(\'' + d.id + '\')" class="btn btn-blue" style="font-size:12px;">✅ Confirm & Copy Order</button>' +
                '</div>' +
            '</div>';
        }).join('');

    // Recent confirmed/dismissed (collapsed)
    const historyHtml = (confirmed.length + dismissed.length) > 0
        ? '<details style="margin-top:20px;">' +
            '<summary style="cursor:pointer;font-size:13px;color:var(--text-muted);font-weight:600;padding:8px 0;">Recent Draft History (' + (confirmed.length + dismissed.length) + ')</summary>' +
            '<div style="margin-top:8px;">' +
            [...confirmed, ...dismissed].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).map(d => {
                const icon = d.status === 'confirmed' ? '✅' : '🚫';
                const color = d.status === 'confirmed' ? 'var(--green)' : 'var(--text-muted)';
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px dashed var(--border);font-size:13px;">' +
                    '<span>' + icon + ' <strong>' + E(d.supplier) + '</strong> — ' + d.items.length + ' items · $' + (d.estSpend || 0).toFixed(0) + '</span>' +
                    '<span style="color:' + color + ';font-size:12px;">' + window._fmtDateTime(d.updatedAt) + '</span>' +
                '</div>';
            }).join('') +
            '</div></details>'
        : '';

    return '<div style="max-width:900px;margin:auto;padding-bottom:40px;">' +
        window._orderTabBar('order-drafts') +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">' +
            '<div>' +
                '<h2 style="margin:0;">📦 Auto-Order Drafts</h2>' +
                '<p style="margin:5px 0 0 0;color:var(--text-muted);font-size:13px;">Auto-staged orders based on PAR levels and supplier delivery schedules. Review, edit quantities, then confirm.</p>' +
            '</div>' +
            '<button onclick="window._generateOrderDrafts();window.showView(\'order-drafts\');" class="btn btn-blue" style="font-size:12px;">🔄 Refresh Drafts</button>' +
        '</div>' +

        (pending.length > 0 ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:10px;margin-bottom:18px;">' +
            '<div class="card" style="text-align:center;border-top:3px solid var(--orange);"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Pending Drafts</div><div style="font-size:24px;font-weight:bold;">' + pending.length + '</div></div>' +
            '<div class="card" style="text-align:center;border-top:3px solid var(--blue);"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Total Items</div><div style="font-size:24px;font-weight:bold;">' + totalPendingItems + '</div></div>' +
            '<div class="card" style="text-align:center;border-top:3px solid var(--green);"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Est. Spend</div><div style="font-size:24px;font-weight:bold;">$' + Math.round(totalPendingSpend).toLocaleString('en-AU') + '</div></div>' +
        '</div>' : '') +

        pendingHtml +
        historyHtml +
    '</div>';
};

// =============================================================================
// ORDER HISTORY DASHBOARD
// Browse past orders, filter by supplier/date, see spend trends
// =============================================================================
window._ohFilters = { supplier: 'all', from: '', to: '' };
window._ohExpanded = {};

window.renderOrderHistoryView = () => {
    const E = window.esc;
    const orders = (window.orderHistory || []).slice().reverse();
    const f = window._ohFilters;

    // Unique suppliers for filter
    const supplierSet = [...new Set(orders.map(o => o.supplier).filter(Boolean))].sort();

    // Apply filters
    let filtered = orders;
    if (f.supplier !== 'all') filtered = filtered.filter(o => o.supplier === f.supplier);
    if (f.from) filtered = filtered.filter(o => o.date >= f.from);
    if (f.to) filtered = filtered.filter(o => o.date <= f.to);

    // KPIs
    const totalOrders = filtered.length;
    const totalSpend = filtered.reduce((s, o) => s + (Number(o.estSpend) || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;
    const uniqueSuppliers = new Set(filtered.map(o => o.supplier)).size;

    // Monthly spend aggregation for chart
    const byMonth = {};
    filtered.forEach(o => {
        const m = (o.date || '').slice(0, 7); // YYYY-MM
        if (m) byMonth[m] = (byMonth[m] || 0) + (Number(o.estSpend) || 0);
    });
    const monthKeys = Object.keys(byMonth).sort();
    const maxMonthSpend = Math.max(1, ...Object.values(byMonth));
    const monthBarHtml = monthKeys.length > 1 ? '<div style="overflow-x:auto;margin-bottom:20px;"><div style="display:flex;gap:4px;align-items:flex-end;height:120px;min-width:' + (monthKeys.length * 50) + 'px;">' +
        monthKeys.map(m => {
            const pct = (byMonth[m] / maxMonthSpend * 100);
            const label = m.slice(5); // MM
            return '<div style="flex:1;min-width:40px;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;height:100%;">' +
                '<div style="font-size:10px;color:var(--text-muted);margin-bottom:2px;">$' + Math.round(byMonth[m]).toLocaleString('en-AU') + '</div>' +
                '<div style="background:var(--blue);border-radius:4px 4px 0 0;height:' + Math.max(4, pct) + '%;transition:height 0.3s;"></div>' +
                '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">' + label + '</div></div>';
        }).join('') + '</div></div>' : '';

    // Order rows
    const orderRows = filtered.length === 0
        ? '<div class="card" style="text-align:center;color:var(--text-muted);padding:30px;">No orders found.</div>'
        : filtered.map((o, idx) => {
            const origIdx = orders.indexOf(o);
            const isExpanded = window._ohExpanded[origIdx];
            const itemCount = (o.items || []).length;
            const spend = Number(o.estSpend || 0);
            return '<div class="card" style="margin-bottom:8px;padding:0;overflow:hidden;">' +
                '<div onclick="window._ohToggle(' + origIdx + ')" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;cursor:pointer;gap:10px;flex-wrap:wrap;">' +
                    '<div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0;">' +
                        '<span style="font-size:18px;">' + (o.aiGenerated ? '🤖' : '📋') + '</span>' +
                        '<div style="min-width:0;">' +
                            '<strong style="font-size:14px;">' + E(o.supplier || 'Unknown') + '</strong>' +
                            '<div style="font-size:12px;color:var(--text-muted);">' + window._fmtDate(o.date) + ' · ' + itemCount + ' item' + (itemCount !== 1 ? 's' : '') + '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="text-align:right;flex-shrink:0;">' +
                        '<div style="font-size:16px;font-weight:bold;color:var(--brand-accent);">$' + spend.toFixed(2) + '</div>' +
                        '<div style="font-size:10px;color:var(--text-muted);">' + (isExpanded ? '▲ collapse' : '▼ details') + '</div>' +
                    '</div>' +
                '</div>' +
                (isExpanded ? '<div style="border-top:1px solid var(--border);padding:12px 16px;background:var(--bg-main);">' +
                    '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                    '<thead><tr style="text-align:left;border-bottom:1px solid var(--border);"><th style="padding:6px 8px;">Item</th><th style="padding:6px 8px;text-align:center;">Qty</th><th style="padding:6px 8px;text-align:center;">Unit</th><th style="padding:6px 8px;text-align:right;">Unit $</th><th style="padding:6px 8px;text-align:right;">Line $</th></tr></thead>' +
                    '<tbody>' + (o.items || []).map(it => {
                        const lineTotal = (Number(it.qty) || 0) * (Number(it.price) || 0);
                        return '<tr style="border-bottom:1px solid var(--border);"><td style="padding:6px 8px;">' + E(it.name) + (it.sku ? ' <small style="color:var(--text-muted);">[' + E(it.sku) + ']</small>' : '') + '</td>' +
                            '<td style="padding:6px 8px;text-align:center;">' + it.qty + '</td>' +
                            '<td style="padding:6px 8px;text-align:center;color:var(--text-muted);">' + E(it.unit || '') + '</td>' +
                            '<td style="padding:6px 8px;text-align:right;">$' + (Number(it.price) || 0).toFixed(2) + '</td>' +
                            '<td style="padding:6px 8px;text-align:right;font-weight:bold;">$' + lineTotal.toFixed(2) + '</td></tr>';
                    }).join('') + '</tbody></table></div>' : '') +
            '</div>';
        }).join('');

    return `<div style="max-width:900px;margin:auto;padding-bottom:40px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">
            <h2 style="margin:0;">📦 Order History</h2>
            <button onclick="window.showView('prep-list')" class="btn btn-outline" style="font-size:12px;">← Order Hub</button>
        </div>

        <div class="card" style="padding:12px 16px;margin-bottom:15px;">
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end;">
                <div style="flex:1;min-width:140px;">
                    <label style="font-size:11px;color:var(--text-muted);">Supplier</label>
                    <select onchange="window._ohFilters.supplier=this.value;document.getElementById('mainContent').innerHTML=window.renderOrderHistoryView();" class="input-box" style="margin:0;">
                        <option value="all">All Suppliers</option>
                        ${supplierSet.map(s => '<option value="' + E(s) + '"' + (f.supplier === s ? ' selected' : '') + '>' + E(s) + '</option>').join('')}
                    </select>
                </div>
                <div style="min-width:120px;">
                    <label style="font-size:11px;color:var(--text-muted);">From</label>
                    <input type="date" value="${f.from}" onchange="window._ohFilters.from=this.value;document.getElementById('mainContent').innerHTML=window.renderOrderHistoryView();" class="input-box" style="margin:0;">
                </div>
                <div style="min-width:120px;">
                    <label style="font-size:11px;color:var(--text-muted);">To</label>
                    <input type="date" value="${f.to}" onchange="window._ohFilters.to=this.value;document.getElementById('mainContent').innerHTML=window.renderOrderHistoryView();" class="input-box" style="margin:0;">
                </div>
                <button onclick="window._ohFilters={supplier:'all',from:'',to:''};document.getElementById('mainContent').innerHTML=window.renderOrderHistoryView();" class="btn btn-outline" style="font-size:11px;padding:6px 12px;">Clear</button>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:18px;">
            <div class="card" style="text-align:center;border-top:3px solid var(--blue);"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Orders</div><div style="font-size:24px;font-weight:bold;">${totalOrders}</div></div>
            <div class="card" style="text-align:center;border-top:3px solid var(--green);"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Total Spend</div><div style="font-size:24px;font-weight:bold;">$${Math.round(totalSpend).toLocaleString('en-AU')}</div></div>
            <div class="card" style="text-align:center;border-top:3px solid var(--purple);"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Avg Order</div><div style="font-size:24px;font-weight:bold;">$${Math.round(avgOrderValue).toLocaleString('en-AU')}</div></div>
            <div class="card" style="text-align:center;border-top:3px solid var(--orange);"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">Suppliers</div><div style="font-size:24px;font-weight:bold;">${uniqueSuppliers}</div></div>
        </div>

        ${monthBarHtml ? '<div class="card" style="padding:16px;margin-bottom:18px;"><h4 style="margin:0 0 10px 0;font-size:13px;color:var(--text-muted);">Monthly Order Spend</h4>' + monthBarHtml + '</div>' : ''}

        <h4 style="margin:0 0 10px 0;color:var(--text-muted);font-size:13px;">${filtered.length} order${filtered.length !== 1 ? 's' : ''}</h4>
        ${orderRows}
    </div>`;
};

window._ohToggle = (idx) => {
    window._ohExpanded[idx] = !window._ohExpanded[idx];
    document.getElementById('mainContent').innerHTML = window.renderOrderHistoryView();
};

