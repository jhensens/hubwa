// --- HOBART HUB: Invoices Module ---
// Invoice Ripper Pro: PDF Text + Scanned Image Vision, Review UI, Matching, Commit Flow

// =============================================================================
// 8. INVOICE RIPPER PRO — PDF TEXT + SCANNED IMAGE VISION
// Handles: text-layer PDFs, image-only scanned PDFs, direct image uploads
// Flow: Upload → AI reads → Review & confirm → Stock+history updated
// =============================================================================

window.pendingInvoiceData = null;

// AI zone prediction from product name
window._guessZoneFromName = (name) => {
    const n = name.toLowerCase();
    if (/beer|lager|ale|cider|wine|sake|spirit|vodka|gin|rum|whisky|whiskey|bourbon|liqueur|champagne|prosecco|seltzer|soft drink|cola|juice|syrup|bitters|vermouth|aperol|campari|tonic|soda|mineral water|energy drink|cocktail/i.test(n)) {
        const z = (window.storageZones||[]).find(x=>x.area==='FOH');
        return { dept:'FOH', zone: z?z.name:'' };
    }
    if (/chicken|beef|pork|lamb|fish|salmon|tuna|prawn|crab|squid|egg|flour|rice|noodle|pasta|oil|butter|cream|milk|cheese|tofu|mushroom|vegetable|onion|garlic|ginger|herb|spice|sauce|miso|soy|dashi|kombu|vinegar|sugar|salt|pepper|wagyu|duck|seafood|produce|frozen|fresh/i.test(n)) {
        const z = (window.storageZones||[]).find(x=>x.area==='BOH');
        return { dept:'BOH', zone: z?z.name:'' };
    }
    if (/bag|box|container|wrap|foil|glove|chemical|cleaner|sanitiser|sanitizer|detergent|paper|napkin|straw|tissue/i.test(n)) {
        return { dept:'BOH', zone:'Dry Store' };
    }
    return { dept:'BOH', zone:'' };
};

window.renderInvoiceView = () => {
    return `
    <div style="max-width: 1300px; margin: auto;">
        ${window._orderTabBar('invoice')}
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px">
            <div>
                <h2 style="margin:0">🧾 Invoice Ripper Pro</h2>
                <div style="color:var(--text-muted);font-size:13px;margin-top:2px">Upload a supplier invoice — AI extracts line items, matches inventory, flags price changes</div>
            </div>
        </div>

        <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap;">

            <!-- LEFT: Upload + Results -->
            <div style="flex:1; min-width:min(350px,100%);">
                <div class="card" style="border-top:5px solid var(--blue); text-align:center; padding:30px; margin-bottom:20px;">
                    <div style="font-size:40px; margin-bottom:10px;">📄</div>
                    <p style="color:var(--text-muted); margin:0 0 15px 0; font-size:13px;">PDF invoice or scanned image from your Brother scanner</p>
                    <input type="file" id="invoice-file" accept="application/pdf,image/*" style="display:none;" onchange="window.handleInvoiceUpload(event)">
                    <button onclick="document.getElementById('invoice-file').click()" class="btn btn-blue" style="font-size:15px; padding:12px 24px; width:100%;">📎 Select Invoice File</button>
                    <p id="invoice-status" style="margin-top:15px; color:var(--brand-accent); font-size:13px; font-weight:bold;"></p>
                </div>
                <div id="invoice-results"></div>
            </div>

            <!-- RIGHT: Preview -->
            <div class="card" id="invoice-preview-container" style="flex:1.5; min-width:400px; display:none; padding:15px; min-height:600px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <strong style="font-size:13px; color:var(--text-muted);">Invoice Preview</strong>
                    <button onclick="document.getElementById('invoice-preview-container').style.display='none'" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:18px;">&times;</button>
                </div>
                <div id="invoice-preview-inner" style="width:100%; min-height:550px;"></div>
            </div>
        </div>
    </div>`;
};

// Central upload handler — detects PDF vs image
window.handleInvoiceUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('invoice-status');
    const previewContainer = document.getElementById('invoice-preview-container');
    const previewInner = document.getElementById('invoice-preview-inner');
    statusEl.innerHTML = '⏳ Reading file...';

    const fileType = file.type;
    const objectUrl = URL.createObjectURL(file);

    // Show preview
    previewContainer.style.display = 'block';
    if (fileType === 'application/pdf') {
        previewInner.innerHTML = `<iframe src="${objectUrl}" style="width:100%; height:600px; border:none; border-radius:6px;"></iframe>`;
    } else {
        previewInner.innerHTML = `<img src="${objectUrl}" style="max-width:100%; border-radius:6px; border:1px solid var(--border);">`;
    }

    // Determine extraction strategy
    if (fileType === 'application/pdf') {
        statusEl.innerHTML = '📄 Extracting text from PDF...';
        await window._extractPdfAndParse(file);
    } else {
        // Direct image — use Gemini Vision
        statusEl.innerHTML = '📷 Sending scanned image to AI Vision...';
        await window._parseImageInvoice(file);
    }
};

// Strategy A: Text-layer PDF (fast, cheap)
window._extractPdfAndParse = async (file) => {
    const statusEl = document.getElementById('invoice-status');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const typedarray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            let items = textContent.items.map(item => ({ str: item.str, x: item.transform[4], y: item.transform[5] }));
            items.sort((a, b) => { if (Math.abs(b.y - a.y) <= 5) return a.x - b.x; return b.y - a.y; });
            items.forEach(item => fullText += item.str.trim() + ' ');
        }

        // If text layer is empty or too short, fall back to Vision
        if (fullText.trim().length < 50) {
            statusEl.innerHTML = '🔍 No text layer found — switching to Vision AI...';
            await window._parsePdfAsImages(file);
            return;
        }

        statusEl.innerHTML = '🤖 AI reading invoice data...';
        await window._parseTextInvoice(fullText);
    } catch (err) {
        statusEl.innerHTML = `<span style="color:var(--red);">PDF read error: ${err.message}</span>`;
    }
};

// Strategy B: Render PDF pages as images → Vision
window._parsePdfAsImages = async (file) => {
    const statusEl = document.getElementById('invoice-status');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const typedarray = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;

        // Render first 3 pages to canvas and encode as base64
        const imageDataArray = [];
        for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // High res for OCR
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            imageDataArray.push(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
        }

        await window._parseVisionInvoice(imageDataArray);
    } catch (err) {
        statusEl.innerHTML = `<span style="color:var(--red);">Vision fallback error: ${err.message}</span>`;
    }
};

// Strategy C: Direct image file → Vision
window._parseImageInvoice = async (file) => {
    try {
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        await window._parseVisionInvoice([base64]);
    } catch (err) {
        document.getElementById('invoice-status').innerHTML = `<span style="color:var(--red);">Image read error: ${err.message}</span>`;
    }
};

// Gemini Vision API call (for scanned/image invoices)
window._parseVisionInvoice = async (base64ImageArray) => {
    const statusEl = document.getElementById('invoice-status');
    window.showLoadingOverlay('🤖 AI is reading invoice images...');
    const apiKey = window.getApiKey();
    if (!apiKey) { window.hideLoadingOverlay(); statusEl.innerHTML = '<span style="color:var(--red);">No API key set.</span>'; return; }

    const parts = [
        {
            text: `You are an invoice data extraction AI. Extract ALL line items from this invoice image.
Return ONLY valid JSON in this exact structure:
{
  "supplier": "Supplier Name",
  "invoiceNumber": "INV-12345",
  "date": "DD/MM/YYYY",
  "items": [
    {
      "itemName": "Full product name",
      "sku": "Product code or empty string",
      "quantity": 1.0,
      "buyUnit": "CTN or each or kg etc",
      "unitPrice": 12.50,
      "totalLinePrice": 12.50,
      "gstFree": false
    }
  ],
  "subtotal": 0.00,
  "gstTotal": 0.00,
  "invoiceTotal": 0.00
}
Be thorough. Extract every product line. Use 0 for missing prices. Use empty string for missing SKUs.`
        },
        ...base64ImageArray.map(b64 => ({
            inline_data: { mime_type: "image/jpeg", data: b64 }
        }))
    ];

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Empty API response');
        let rawJson = data.candidates[0].content.parts[0].text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        window.pendingInvoiceData = JSON.parse(rawJson);
        statusEl.innerHTML = `<span style="color:var(--green);">✓ AI extracted ${window.pendingInvoiceData.items.length} line items. Review below.</span>`;
        window.hideLoadingOverlay();
        window._renderInvoiceReview();
    } catch (err) {
        window.hideLoadingOverlay();
        statusEl.innerHTML = `<span style="color:var(--red);">Vision API error: ${err.message}</span>`;
    }
};

// Gemini Text API call (for text-layer PDFs)
window._parseTextInvoice = async (rawText) => {
    const statusEl = document.getElementById('invoice-status');
    window.showLoadingOverlay('🤖 AI is extracting invoice data...');
    const apiKey = window.getApiKey();
    if (!apiKey) { window.hideLoadingOverlay(); statusEl.innerHTML = '<span style="color:var(--red);">No API key set.</span>'; return; }

    const prompt = `You are an invoice data extraction AI. Extract ALL line items from this invoice text.
Return ONLY valid JSON in this exact structure:
{
  "supplier": "Supplier Name",
  "invoiceNumber": "INV-12345",
  "date": "DD/MM/YYYY",
  "items": [
    {
      "itemName": "Full product name",
      "sku": "Product code or empty string",
      "quantity": 1.0,
      "buyUnit": "CTN or each or kg etc",
      "unitPrice": 12.50,
      "totalLinePrice": 12.50,
      "gstFree": false
    }
  ],
  "subtotal": 0.00,
  "gstTotal": 0.00,
  "invoiceTotal": 0.00
}
Invoice text:
${rawText}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json" } })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) throw new Error('Empty API response');
        let rawJson = data.candidates[0].content.parts[0].text.replace(/^```json/g, '').replace(/^```/g, '').replace(/```$/g, '').trim();
        window.pendingInvoiceData = JSON.parse(rawJson);
        statusEl.innerHTML = `<span style="color:var(--green);">✓ AI extracted ${window.pendingInvoiceData.items.length} line items. Review below.</span>`;
        window.hideLoadingOverlay();
        window._renderInvoiceReview();
    } catch (err) {
        window.hideLoadingOverlay();
        statusEl.innerHTML = `<span style="color:var(--red);">AI error: ${err.message}</span>`;
    }
};

// Smart fuzzy matching: SKU first, then name similarity
window._findBestMatch = (aiItem) => {
    const inv = window.inventoryItems || [];
    // 0. Check learned matches first
    const learnedMap = window.invoiceMatchMap || {};
    const learnKey = (aiItem.itemName||'').toLowerCase().trim();
    if (learnedMap[learnKey]) {
        const learnedItem = inv.find(i => i.id === learnedMap[learnKey]);
        if (learnedItem) return { item: learnedItem, confidence: 'learned' };
    }
    // 1. Exact SKU match
    if (aiItem.sku) {
        const skuMatch = inv.find(i => i.sku && i.sku.toLowerCase() === aiItem.sku.toLowerCase());
        if (skuMatch) return { item: skuMatch, confidence: 'sku' };
    }
    // 2. Fuzzy name match (word overlap ≥ 70%)
    let bestItem = null, bestScore = 0;
    inv.forEach(item => {
        const words = item.name.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (words.length === 0) return;
        let matchCount = words.filter(w => aiItem.itemName.toLowerCase().includes(w)).length;
        const score = matchCount / words.length;
        if (score > bestScore && score >= 0.65) { bestScore = score; bestItem = item; }
    });
    if (bestItem) return { item: bestItem, confidence: bestScore >= 0.9 ? 'high' : 'fuzzy' };
    return null;
};

// Review screen — shows all matched and unmatched items for confirmation
window._renderInvoiceReview = () => {
    const ai = window.pendingInvoiceData;
    if (!ai || !ai.items) return;

    // Run matching for all items
    window._invoiceReviewState = ai.items.map((aiItem, index) => {
        const match = window._findBestMatch(aiItem);
        return {
            index,
            aiItem,
            matchedInvId: match ? match.item.id : null,
            confidence: match ? match.confidence : 'none',
            action: match ? 'update' : 'new',  // 'update', 'new', 'skip'
        };
    });

    window._renderInvoiceReviewUI();
};

window._renderInvoiceReviewUI = () => {
    const ai = window.pendingInvoiceData;
    const state = window._invoiceReviewState;
    const invOpts = `<option value="">-- Map to Existing Item --</option>` +
        (window.inventoryItems || []).filter(i => !i.archived).map(i => `<option value="${i.id}">${esc(i.name)} (${esc(i.buyUnit)})</option>`).join('');

    const autoMatched = state.filter(s => s.matchedInvId && s.action === 'update');
    const unmatched = state.filter(s => !s.matchedInvId || s.action === 'new' || s.action === 'skip');

    let html = `
    <div style="border-top:4px solid var(--blue); padding-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <div>
                <h3 style="margin:0; color:var(--brand-dark);">${esc(ai.supplier)} — ${esc(ai.date)}</h3>
                <small style="color:var(--text-muted);">Invoice #${esc(ai.invoiceNumber || 'N/A')} | ${ai.items.length} line items extracted | Total: $${Number(ai.invoiceTotal || 0).toFixed(2)}</small>
            </div>
            <button onclick="window._commitInvoice()" class="btn btn-green" style="font-size:14px; padding:10px 20px;">✓ Commit All & Update Stock</button>
        </div>`;

    // --- AUTO-MATCHED (green) ---
    if (autoMatched.length > 0) {
        html += `<div style="margin-bottom:20px;">
            <h4 style="color:var(--green); margin:0 0 10px 0; border-bottom:1px solid var(--border); padding-bottom:8px;">✓ Auto-Matched (${autoMatched.length} items)</h4>
            <div style="display:flex; flex-direction:column; gap:8px;">`;
        autoMatched.forEach(s => {
            const inv = window.inventoryItems.find(i => i.id === s.matchedInvId);
            const priceChange = inv && inv.price !== s.aiItem.unitPrice && s.aiItem.unitPrice > 0;
            const pctChange = inv && priceChange && inv.price ? (((s.aiItem.unitPrice - inv.price) / inv.price) * 100).toFixed(1) : null;
            html += `
            <div id="ir-row-${s.index}" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-main); padding:8px 12px; border-radius:6px; border-left:3px solid var(--green);">
                <div style="flex:2;">
                    <strong style="font-size:13px;">${esc(s.aiItem.itemName)}</strong>
                    <small style="color:var(--text-muted); display:block;">${s.aiItem.sku ? `SKU: ${esc(s.aiItem.sku)} · ` : ''}Qty: ${s.aiItem.quantity} ${esc(s.aiItem.buyUnit || '')}</small>
                </div>
                <div style="flex:1; text-align:center; font-size:12px; color:var(--text-muted);">
                    ➔ <strong style="color:var(--green);">${inv ? esc(inv.name) : '?'}</strong>
                    <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${s.confidence === 'learned' ? '🧠 Learned match' : s.confidence === 'sku' ? '🔑 SKU match' : s.confidence === 'high' ? '✓ Name match' : '~ Fuzzy match'}</div>
                </div>
                <div style="flex:1; text-align:right; font-size:13px;">
                    ${priceChange
                        ? (() => {
                            const big = Math.abs(pctChange) >= 10;
                            return `<span style="color:${big?'var(--red)':pctChange>0?'var(--orange)':'var(--green)'}; font-weight:bold;">$${Number(s.aiItem.unitPrice).toFixed(2)} ${big?'🚨':''}<small>(${pctChange>0?'▲':'▼'}${Math.abs(pctChange)}%)</small></span><br><small style="color:var(--text-muted);">was $${Number(inv.price).toFixed(2)}</small>`;
                          })()
                        : `<span style="color:var(--brand-accent);">$${Number(s.aiItem.unitPrice || 0).toFixed(2)}</span>`
                    }
                </div>
                <div style="margin-left:15px;">
                    <button onclick="window._irSetAction(${s.index}, 'skip')" class="btn btn-outline" style="font-size:11px; padding:4px 10px; color:var(--text-muted);">Skip</button>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    }

    // --- UNMATCHED / NEEDS REVIEW (orange) ---
    if (unmatched.length > 0) {
        html += `<div style="margin-bottom:20px;">
            <h4 style="color:var(--orange); margin:0 0 10px 0; border-bottom:1px solid var(--border); padding-bottom:8px;">❓ Needs Review (${unmatched.length} items)</h4>
            <div style="display:flex; flex-direction:column; gap:10px;">`;
        unmatched.forEach(s => {
            const isSkipped = s.action === 'skip';
            html += `
            <div id="ir-row-${s.index}" style="background:var(--bg-main); padding:10px 12px; border-radius:6px; border-left:3px solid ${isSkipped ? 'var(--border)' : 'var(--orange)'}; opacity:${isSkipped ? 0.5 : 1};">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                    <div style="flex:1; min-width:200px;">
                        <strong style="font-size:13px; color:${isSkipped ? 'var(--text-muted)' : 'var(--orange)'};">${esc(s.aiItem.itemName)}</strong>
                        <small style="color:var(--text-muted); display:block;">${s.aiItem.sku ? `SKU: ${esc(s.aiItem.sku)} · ` : ''}Qty: ${s.aiItem.quantity} ${esc(s.aiItem.buyUnit || '')} · $${Number(s.aiItem.unitPrice || 0).toFixed(2)}</small>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                        <select id="ir-map-${s.index}" class="input-box" style="margin:0; width:220px; font-size:12px; padding:7px; border-color:var(--orange);">${invOpts}</select>
                        <button onclick="window._irLinkExisting(${s.index})" class="btn btn-outline" style="font-size:11px; padding:6px 10px;">Link</button>
                        <button onclick="window._irQuickAdd(${s.index})" class="btn btn-blue" style="font-size:11px; padding:6px 10px;">+ New Item</button>
                        <button onclick="window._irSetAction(${s.index}, ${isSkipped ? "'new'" : "'skip'"})" class="btn btn-outline" style="font-size:11px; padding:6px 10px; color:var(--text-muted);">${isSkipped ? 'Undo Skip' : 'Skip'}</button>
                    </div>
                </div>
            </div>`;
        });
        html += `</div></div>`;
    }

    html += `
    <div style="background:rgba(16,185,129,0.08); border:1px solid var(--green); padding:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
        <div style="font-size:13px; color:var(--text-muted);">Ready to commit: <strong style="color:var(--green);">${autoMatched.length} updates</strong> + <strong style="color:var(--blue);">${unmatched.filter(s => s.action === 'new' && s.matchedInvId).length} new links</strong></div>
        <button onclick="window._commitInvoice()" class="btn btn-green" style="font-size:14px; padding:10px 20px;">✓ Commit All & Update Stock</button>
    </div>
    </div>`;

    document.getElementById('invoice-results').innerHTML = html;
};

// Toggle skip/active on a row
window._irSetAction = (index, action) => {
    window._invoiceReviewState[index].action = action;
    window._renderInvoiceReviewUI();
};

// Link unmatched item to existing inventory
window._irLinkExisting = (index) => {
    const sel = document.getElementById(`ir-map-${index}`);
    if (!sel || !sel.value) return window.showToast("Select an item to link.", "error");
    window._invoiceReviewState[index].matchedInvId = sel.value;
    window._invoiceReviewState[index].action = 'update';
    window._invoiceReviewState[index].confidence = 'manual';
    window._renderInvoiceReviewUI();
};

// Quick-add new inventory item from invoice line
window._irQuickAdd = (index) => {
    const aiItem = window._invoiceReviewState[index].aiItem;
    const newId = window.generateId('inv');
    const supplierName = window.pendingInvoiceData.supplier || '';
    const allCats = ['Food', 'Beverage', 'Packaging', 'Chemicals', 'Other', ...new Set((window.inventoryItems || []).map(i => i.category))];
    const catOpts = [...new Set(allCats)].map(c => `<option value="${c}">`).join('');
    const guess = window._guessZoneFromName(aiItem.itemName);
    const isBev = guess.dept === 'FOH';
    const guessedCat = isBev ? 'Beverage' : 'Food';
    const guessedZone = guess.zone || '';
    const html = `
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:10px; margin-bottom:10px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Name</label><input type="text" id="iq-n" class="input-box" value="${esc(aiItem.itemName)}"></div>
        <div><label style="font-size:11px; color:var(--text-muted);">Category</label><input type="text" id="iq-cat" list="iq-cat-list" class="input-box" value="${guessedCat}"><datalist id="iq-cat-list">${catOpts}</datalist></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Supplier</label><input type="text" id="iq-sup" class="input-box" value="${esc(supplierName)}"></div>
        <div><label style="font-size:11px; color:var(--text-muted);">SKU</label><input type="text" id="iq-sku" class="input-box" value="${esc(aiItem.sku || '')}"></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Department <small style="color:var(--blue);">(AI guess: ${guess.dept})</small></label>
            <select id="iq-dept" class="input-box"><option ${isBev?'selected':''}>FOH</option><option ${!isBev?'selected':''}>BOH</option><option>Office</option></select>
        </div>
        <div><label style="font-size:11px; color:var(--text-muted);">Storage Zone <small style="color:var(--blue);">(AI guess)</small></label>
            ${window.buildZoneSelect(guessedZone, 'iq-loc')}
        </div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:10px; background:var(--bg-main); padding:10px; border-radius:6px;">
        <div><label style="font-size:11px; color:var(--text-muted);">Buy Price ($)</label><input type="number" step="0.01" id="iq-p" class="input-box" value="${Number(aiItem.unitPrice || 0).toFixed(2)}"></div>
        <div><label style="font-size:11px; color:var(--text-muted);">Buy Unit</label><input type="text" id="iq-buyUnit" class="input-box" value="${esc(aiItem.buyUnit || 'CTN')}"></div>
        <div style="padding-top:20px;"><label style="font-size:13px; cursor:pointer;"><input type="checkbox" id="iq-gst" ${aiItem.gstFree ? 'checked' : ''} style="transform:scale(1.2);"> GST Free</label></div>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px; border:1px dashed var(--blue); padding:10px; border-radius:6px;">
        <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Yield (Use-Units per Buy-Unit)</label><input type="number" step="0.01" id="iq-yield" class="input-box" value="1"></div>
        <div><label style="font-size:11px; color:var(--blue); font-weight:bold;">Use Unit</label><input type="text" id="iq-useUnit" class="input-box" value="${isBev ? 'ml' : 'kg'}"></div>
    </div>
    <button onclick="window._irSaveNewItem('${newId}', ${index})" class="btn btn-green" style="width:100%; font-size:15px; padding:12px;">Save & Link to Invoice</button>`;
    window.openModal(`⚡ Quick Add: ${esc(aiItem.itemName)}`, html);
};

window._irSaveNewItem = (newId, index) => {
    const aiItem = window._invoiceReviewState[index].aiItem;
    const supplierName = document.getElementById('iq-sup').value;
    const newItem = {
        id: newId,
        name: document.getElementById('iq-n').value,
        category: document.getElementById('iq-cat').value,
        sku: document.getElementById('iq-sku').value,
        supplier: supplierName,
        price: parseFloat(document.getElementById('iq-p').value) || 0,
        buyUnit: document.getElementById('iq-buyUnit').value,
        gstFree: document.getElementById('iq-gst').checked,
        yield: parseFloat(document.getElementById('iq-yield').value) || 1,
        useUnit: document.getElementById('iq-useUnit').value,
        location: document.getElementById('iq-loc').value,
        department: document.getElementById('iq-dept') ? document.getElementById('iq-dept').value : 'BOH',
        stock: Number(aiItem.quantity) || 0,
        parWeekday: 0, parWeekend: 0, par: 0,
        archived: false,
        history: [{ date: window.pendingInvoiceData.date || window._isoDate(), supplier: supplierName, invoiceNo: window.pendingInvoiceData.invoiceNumber||'', qty: aiItem.quantity, price: parseFloat(document.getElementById('iq-p').value)||0, prevPrice: 0 }]
    };
    // Auto-add supplier if not known
    if (supplierName && !window.suppliers.find(s => s.name === supplierName)) {
        window.suppliers.push({ name: supplierName, contact: '', cutoff: '', minSpend: 0, deliveryDays: [] });
    }
    window.inventoryItems.push(newItem);
    window._invoiceReviewState[index].matchedInvId = newId;
    window._invoiceReviewState[index].action = 'update';
    window._invoiceReviewState[index].confidence = 'new';
    window.closeModal();
    window.showToast(`${newItem.name} added to inventory.`);
    window._renderInvoiceReviewUI();
};

// Final commit — apply all approved updates to inventory (date-aware)
window._learnInvoiceMatches = () => {
    const state = window._invoiceReviewState || [];
    if (!window.invoiceMatchMap) window.invoiceMatchMap = {};
    state.forEach(s => {
        if (s.matchedInvId && s.action === 'update') {
            const key = (s.aiItem.itemName||'').toLowerCase().trim();
            if (key) window.invoiceMatchMap[key] = s.matchedInvId;
        }
    });
};

window._commitInvoice = () => {
    const ai = window.pendingInvoiceData;
    const state = window._invoiceReviewState;
    if (!ai || !state) return;

    // Parse invoice date and check if historical (>7 days old)
    const parseInvDate = (str) => {
        if (!str) return null;
        const m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (m) return new Date(parseInt(m[3].length===2?'20'+m[3]:m[3]), parseInt(m[2])-1, parseInt(m[1]));
        return new Date(str);
    };
    const invDate = parseInvDate(ai.date);
    const today = new Date();
    const daysDiff = invDate ? Math.round((today - invDate) / (1000*3600*24)) : 0;
    const isHistorical = daysDiff > 7;

    if (isHistorical) {
        window.confirmAction({
            title: '📜 Historical Invoice',
            message: 'This invoice is dated <strong>' + window.esc(ai.date||'unknown') + '</strong> (' + daysDiff + ' days ago).<br><br>' +
                '✓ Price history will be updated<br>✓ Item prices updated<br>✗ Stock levels will NOT change<br><br>' +
                'This prevents inflating stock from old invoices.',
            confirmLabel: 'Process Historical', confirmColor: 'var(--orange)', tier: 'standard',
            onConfirm: () => window._doCommitInvoice(ai, state, true)
        });
        return;
    }

    window._doCommitInvoice(ai, state, false);
};

window._doCommitInvoice = (ai, state, isHistorical) => {
    let updatedCount = 0, skippedCount = 0;
    const changedInvIds = [];

    state.forEach(row => {
        if (row.action === 'skip') { skippedCount++; return; }
        const aiItem = row.aiItem;
        const invId = row.matchedInvId;
        const invIdx = invId ? window.inventoryItems.findIndex(i => i.id === invId) : -1;
        const unitPrice = parseFloat(aiItem.unitPrice) || 0;
        const qty = parseFloat(aiItem.quantity) || 0;
        if (invIdx >= 0) {
            const inv = window.inventoryItems[invIdx];
            const prevPrice = inv.price || 0;
            if (!inv.history) inv.history = [];
            inv.history.push({ date: ai.date||window._isoDate(), supplier: ai.supplier||'', invoiceNo: ai.invoiceNumber||'', qty, price: unitPrice, prevPrice });
            if (unitPrice > 0) { inv.price = unitPrice; if (unitPrice !== prevPrice) changedInvIds.push(inv.id); }
            inv.supplier = ai.supplier || inv.supplier;
            if (!isHistorical) { window.logStockMovement(inv.id, qty, 'invoice', { sourceRef: ai.invoiceNumber || '', notes: ai.supplier || '' }); inv.stock = (inv.stock||0) + qty; }
            updatedCount++;
        } else { skippedCount++; }
    });

    // Cascade recipe costs for changed prices
    const cascadeResult = changedInvIds.length > 0 ? window.cascadeRecipeCosts(changedInvIds) : null;

    window.saveToDisk();

    const histNote = isHistorical ? '<div style="background:rgba(245,158,11,0.1);border:1px solid var(--orange);border-radius:8px;padding:12px;margin-bottom:15px;font-size:13px;color:var(--orange);">📅 Historical invoice — stock levels unchanged. Price history updated.</div>' : '';
    const cascNote = cascadeResult && cascadeResult.updatedMenus > 0 ? '<div style="font-size:12px;color:var(--purple);margin-top:8px;">&#9851; ' + cascadeResult.updatedMenus + ' recipe costs recalculated</div>' : '';

    document.getElementById('invoice-results').innerHTML = '<div style="text-align:center;padding:30px;">' + histNote +
        '<div style="font-size:48px;margin-bottom:10px;">' + (isHistorical?'📋':'✅') + '</div>' +
        '<h3 style="color:var(--green);margin:0 0 10px 0;">' + (isHistorical?'Price History Updated':'Invoice Committed') + '</h3>' +
        '<div style="font-size:14px;color:var(--text-muted);margin-bottom:20px;"><strong style="color:var(--green);">' + updatedCount + '</strong> items · <strong style="color:var(--text-muted);">' + skippedCount + '</strong> skipped' + cascNote + '</div>' +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
            '<button onclick="window.showView(\'invoice\')" class="btn btn-blue">📄 Rip Another</button>' +
            '<button onclick="window.showView(\'inventory\')" class="btn btn-outline">📦 Inventory</button>' +
            (cascadeResult && cascadeResult.gpAlerts && cascadeResult.gpAlerts.length > 0 ? '<button onclick="window.showView(\'margins\')" class="btn btn-outline" style="border-color:var(--purple);color:var(--purple);">📊 Check Margins</button>' : '') +
        '</div></div>';
    document.getElementById('invoice-status').innerHTML = '';
    window.showToast('Invoice processed — ' + updatedCount + ' items updated!');
};

// =============================================================================
// BATCH INVOICE UPLOADER
// Queue multiple PDF/image invoices, process one at a time with review UI
// =============================================================================
window._batchInvoiceQueue = [];
window._batchInvoiceIdx = 0;
window._batchInvoiceTotals = { processed: 0, items: 0, newItems: 0 };

window.openBatchInvoiceUpload = () => {
    window._batchInvoiceQueue = [];
    window._batchInvoiceIdx = 0;
    window._batchInvoiceTotals = { processed: 0, items: 0, newItems: 0 };
    return `
    <div style="max-width:1300px;margin:auto;">
        <h2 style="margin-top:0;">📄 Batch Invoice Uploader</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-top:-8px;">Upload multiple invoices at once. Each will be processed one at a time with review.</p>

        <div class="card" id="batch-inv-drop-zone" style="border:2px dashed var(--border);text-align:center;padding:40px;margin-bottom:20px;cursor:pointer;transition:border-color 0.2s;"
            ondragover="event.preventDefault();this.style.borderColor='var(--blue)';"
            ondragleave="this.style.borderColor='var(--border)';"
            ondrop="event.preventDefault();this.style.borderColor='var(--border)';window._batchInvoiceAddFiles(event.dataTransfer.files);"
            onclick="document.getElementById('batch-inv-file-input').click();">
            <div style="font-size:48px;margin-bottom:10px;">📂</div>
            <p style="color:var(--text-muted);margin:0 0 10px;">Drag & drop invoices here, or click to browse</p>
            <p style="color:var(--text-muted);font-size:12px;margin:0;">Accepts PDF, JPG, PNG — multiple files allowed</p>
            <input type="file" id="batch-inv-file-input" accept="application/pdf,image/*" multiple style="display:none;" onchange="window._batchInvoiceAddFiles(this.files);">
        </div>

        <div id="batch-inv-queue" style="margin-bottom:20px;"></div>

        <div id="batch-inv-controls" style="display:none;margin-bottom:20px;">
            <button id="batch-inv-start-btn" onclick="window._batchInvoiceStart()" class="btn btn-blue" style="font-size:15px;padding:12px 24px;width:100%;">🚀 Start Processing</button>
        </div>

        <div id="batch-inv-progress" style="display:none;margin-bottom:20px;text-align:center;">
            <p id="batch-inv-progress-text" style="font-size:15px;font-weight:bold;color:var(--blue);"></p>
        </div>

        <div id="batch-inv-workspace" style="display:none;">
            <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
                <div style="flex:1;min-width:min(350px,100%);">
                    <div class="card" style="border-top:5px solid var(--blue);text-align:center;padding:30px;margin-bottom:20px;">
                        <div style="font-size:40px;margin-bottom:10px;">📄</div>
                        <p id="batch-inv-current-file" style="color:var(--text-muted);margin:0 0 15px 0;font-size:13px;"></p>
                        <p id="invoice-status" style="margin-top:15px;color:var(--brand-accent);font-size:13px;font-weight:bold;"></p>
                    </div>
                    <div id="invoice-results"></div>
                    <button id="batch-inv-next-btn" onclick="window._batchInvoiceNext()" class="btn btn-green" style="width:100%;font-size:15px;padding:12px;margin-top:15px;display:none;">Next Invoice ➜</button>
                </div>
                <div class="card" id="invoice-preview-container" style="flex:1.5;min-width:400px;display:none;padding:15px;min-height:600px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <strong style="font-size:13px;color:var(--text-muted);">Invoice Preview</strong>
                        <button onclick="document.getElementById('invoice-preview-container').style.display='none'" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;">&times;</button>
                    </div>
                    <div id="invoice-preview-inner" style="width:100%;min-height:550px;"></div>
                </div>
            </div>
        </div>

        <div id="batch-inv-summary" style="display:none;"></div>
    </div>`;
};

window._batchInvoiceAddFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (f.type === 'application/pdf' || f.type.startsWith('image/')) {
            window._batchInvoiceQueue.push({ file: f, status: 'pending', itemCount: 0, newCount: 0 });
        }
    }
    window._batchInvoiceRenderQueue();
    const ctrl = document.getElementById('batch-inv-controls');
    if (ctrl && window._batchInvoiceQueue.length > 0) ctrl.style.display = 'block';
};

window._batchInvoiceRenderQueue = () => {
    const container = document.getElementById('batch-inv-queue');
    if (!container) return;
    if (window._batchInvoiceQueue.length === 0) { container.innerHTML = ''; return; }
    const statusIcons = { pending: '⏳', processing: '🔄', done: '✅', error: '❌' };
    const statusColors = { pending: 'var(--text-muted)', processing: 'var(--blue)', done: 'var(--green)', error: 'var(--red)' };
    let html = '<div class="card" style="padding:12px;"><strong style="font-size:13px;color:var(--text-muted);margin-bottom:8px;display:block;">Queue (' + window._batchInvoiceQueue.length + ' files)</strong>';
    window._batchInvoiceQueue.forEach((item, idx) => {
        html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">' +
            '<span>' + statusIcons[item.status] + '</span>' +
            '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + item.file.name + '</span>' +
            '<span style="color:' + statusColors[item.status] + ';font-size:12px;font-weight:bold;">' + item.status.toUpperCase() + '</span>' +
            (item.status === 'pending' ? '<button onclick="window._batchInvoiceQueue.splice(' + idx + ',1);window._batchInvoiceRenderQueue();" style="background:none;border:none;cursor:pointer;color:var(--red);font-size:14px;" title="Remove">&times;</button>' : '') +
        '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
};

window._batchInvoiceStart = () => {
    if (window._batchInvoiceQueue.length === 0) return;
    window._batchInvoiceIdx = 0;
    window._batchInvoiceTotals = { processed: 0, items: 0, newItems: 0 };
    document.getElementById('batch-inv-controls').style.display = 'none';
    document.getElementById('batch-inv-drop-zone').style.display = 'none';
    document.getElementById('batch-inv-workspace').style.display = 'block';
    document.getElementById('batch-inv-progress').style.display = 'block';
    window._batchInvoiceProcessCurrent();
};

window._batchInvoiceProcessCurrent = () => {
    const idx = window._batchInvoiceIdx;
    const queue = window._batchInvoiceQueue;
    if (idx >= queue.length) {
        window._batchInvoiceShowSummary();
        return;
    }
    const entry = queue[idx];
    entry.status = 'processing';
    window._batchInvoiceRenderQueue();

    document.getElementById('batch-inv-progress-text').textContent = 'Processing ' + (idx + 1) + ' of ' + queue.length + '...';
    document.getElementById('batch-inv-current-file').textContent = entry.file.name;
    document.getElementById('batch-inv-next-btn').style.display = 'none';
    document.getElementById('invoice-results').innerHTML = '';

    // Reuse the existing handleInvoiceUpload by simulating its event
    const file = entry.file;
    const statusEl = document.getElementById('invoice-status');
    const previewContainer = document.getElementById('invoice-preview-container');
    const previewInner = document.getElementById('invoice-preview-inner');
    statusEl.innerHTML = 'Reading file...';

    const objectUrl = URL.createObjectURL(file);
    previewContainer.style.display = 'block';
    if (file.type === 'application/pdf') {
        previewInner.innerHTML = '<iframe src="' + objectUrl + '" style="width:100%;height:600px;border:none;border-radius:6px;"></iframe>';
    } else {
        previewInner.innerHTML = '<img src="' + objectUrl + '" style="max-width:100%;border-radius:6px;border:1px solid var(--border);">';
    }

    // Hook into _commitInvoice to detect when user commits — intercept the results
    const origCommit = window._commitInvoice;
    window._commitInvoice = function(isHistorical) {
        // Call original
        origCommit(isHistorical);
        // Restore original
        window._commitInvoice = origCommit;
        // Mark entry as done
        entry.status = 'done';
        // Count items from the pending data
        const pending = window.pendingInvoiceData;
        if (pending && pending.items) {
            entry.itemCount = pending.items.length;
            window._batchInvoiceTotals.items += pending.items.length;
        }
        window._batchInvoiceTotals.processed++;
        window._batchInvoiceRenderQueue();
        // Show next button
        if (window._batchInvoiceIdx < window._batchInvoiceQueue.length - 1) {
            document.getElementById('batch-inv-next-btn').style.display = 'block';
        } else {
            // Last one — show summary after short delay
            setTimeout(() => window._batchInvoiceShowSummary(), 500);
        }
    };

    // Trigger the extraction
    if (file.type === 'application/pdf') {
        statusEl.innerHTML = 'Extracting text from PDF...';
        window._extractPdfAndParse(file).catch(err => {
            entry.status = 'error';
            window._batchInvoiceRenderQueue();
            statusEl.innerHTML = '<span style="color:var(--red);">Error: ' + err.message + '</span>';
            window._commitInvoice = origCommit;
            document.getElementById('batch-inv-next-btn').style.display = 'block';
        });
    } else {
        statusEl.innerHTML = 'Sending image to AI Vision...';
        window._parseImageInvoice(file).catch(err => {
            entry.status = 'error';
            window._batchInvoiceRenderQueue();
            statusEl.innerHTML = '<span style="color:var(--red);">Error: ' + err.message + '</span>';
            window._commitInvoice = origCommit;
            document.getElementById('batch-inv-next-btn').style.display = 'block';
        });
    }
};

window._batchInvoiceNext = () => {
    window._batchInvoiceIdx++;
    document.getElementById('batch-inv-next-btn').style.display = 'none';
    window._batchInvoiceProcessCurrent();
};

window._batchInvoiceShowSummary = () => {
    document.getElementById('batch-inv-workspace').style.display = 'none';
    document.getElementById('batch-inv-progress').style.display = 'none';
    const totals = window._batchInvoiceTotals;
    const errorCount = window._batchInvoiceQueue.filter(q => q.status === 'error').length;
    document.getElementById('batch-inv-summary').style.display = 'block';
    document.getElementById('batch-inv-summary').innerHTML = '<div class="card" style="border-top:4px solid var(--green);text-align:center;padding:30px;">' +
        '<div style="font-size:48px;margin-bottom:10px;">✅</div>' +
        '<h3 style="color:var(--green);margin:0 0 10px;">Batch Import Complete!</h3>' +
        '<div style="font-size:15px;color:var(--text-muted);margin-bottom:6px;"><strong style="color:var(--green);">' + totals.processed + '</strong> invoices processed, <strong style="color:var(--blue);">' + totals.items + '</strong> items found</div>' +
        (errorCount > 0 ? '<div style="font-size:13px;color:var(--red);margin-bottom:10px;">' + errorCount + ' invoice(s) had errors</div>' : '') +
        '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:15px;">' +
            '<button onclick="window.showView(\'inventory\')" class="btn btn-blue">📦 Inventory</button>' +
            '<button onclick="window.showView(\'invoice\')" class="btn btn-outline">📄 Single Invoice</button>' +
            '<button onclick="window.showView(\'batch-invoice\')" class="btn btn-outline">🔄 New Batch</button>' +
        '</div>' +
    '</div>';
};
