// --- HOBART HUB: Documents Module ---
// Digital safe, HACCP breach history, knowledge base, SOPs

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
    const venueName = window._getVenueName();
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


// --- COMBINED: Knowledge Base & SOPs (from later in mgmt.js) ---

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

window._kbSearch = '';
window._kbSearchDebounce = null;
window._kbDoSearch = (val) => {
    clearTimeout(window._kbSearchDebounce);
    window._kbSearchDebounce = setTimeout(() => {
        window._kbSearch = val;
        const container = document.getElementById('kb-results');
        if (!container) return;
        container.innerHTML = window._renderKbCards();
    }, 200);
};

window._renderKbCards = () => {
    const kb = window.knowledgeBase || [];
    const activeTab = window._kbActiveTab || 'all';
    const search = (window._kbSearch || '').toLowerCase().trim();

    let filtered = activeTab === 'all' ? kb.map((k,i) => ({...k, idx:i}))
        : kb.map((k,i) => ({...k, idx:i})).filter(k => k.category === activeTab);

    // Full-text search across title + content + category
    if (search) {
        const terms = search.split(/\s+/);
        filtered = filtered.filter(k => {
            const haystack = ((k.title||'') + ' ' + (k.content||'') + ' ' + (k.category||'')).toLowerCase();
            return terms.every(t => haystack.includes(t));
        });
    }

    if (filtered.length === 0 && search) {
        return '<div style="text-align:center;padding:32px;color:var(--text-muted);"><div style="font-size:28px;margin-bottom:8px;">🔍</div><div style="font-size:14px;">No SOPs match "<strong>' + esc(search) + '</strong>"</div><div style="font-size:12px;margin-top:4px;">Try different keywords or check other categories</div></div>';
    }

    if (filtered.length === 0) {
        return '<div style="text-align:center;padding:48px 20px;color:var(--text-muted)"><div style="font-size:36px;margin-bottom:12px">📚</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;color:var(--text-main)">No SOPs added</div><div style="font-size:13px;max-width:320px;margin:0 auto;line-height:1.5">Create standard operating procedures so everyone knows the playbook</div><button onclick="window.seedKnowledgeBase()" class="btn btn-blue" style="margin-top:15px;">🏮 Load BWI Defaults</button></div>';
    }

    // Highlight search terms in results
    const highlight = (text, maxLen) => {
        let t = esc(text.substring(0, maxLen)) + (text.length > maxLen ? '...' : '');
        if (search) {
            search.split(/\s+/).forEach(term => {
                if (term.length < 2) return;
                const re = new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
                t = t.replace(re, '<mark style="background:rgba(59,130,246,0.2);color:var(--text-main);padding:0 2px;border-radius:2px;">$1</mark>');
            });
        }
        return t;
    };

    return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">' + filtered.map(k =>
        '<div class="card" style="margin:0;padding:20px;cursor:pointer;transition:transform 0.2s;border-top:4px solid var(--blue);" onclick="window.viewSOP(' + k.idx + ')" onmouseover="this.style.transform=\'translateY(-3px)\'" onmouseout="this.style.transform=\'translateY(0)\'">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
                '<h4 style="margin:0;font-size:15px;flex:1;padding-right:8px;">' + highlight(k.title, 100) + '</h4>' +
                (k.fileUrl ? '<span style="font-size:18px;flex-shrink:0;" title="Has attachment">📎</span>' : '') +
            '</div>' +
            '<span style="font-size:11px;color:var(--text-muted);background:var(--bg-main);padding:2px 8px;border-radius:8px;border:1px solid var(--border);display:inline-block;margin-bottom:10px;">' + esc(k.category || 'General') + '</span>' +
            (k.content ? '<p style="color:var(--text-muted);font-size:13px;margin:0;line-height:1.4;">' + highlight(k.content, 120) + '</p>' : '<p style="color:var(--text-muted);font-size:13px;margin:0;font-style:italic;">File attachment only</p>') +
        '</div>'
    ).join('') + '</div>';
};

window.renderKnowledgeView = () => {
    const kb = window.knowledgeBase || [];
    const cats = window.kbCategories || [...new Set(kb.map(k => k.category).filter(Boolean))];
    const activeTab = window._kbActiveTab || 'all';
    const search = window._kbSearch || '';

    const tabPills = [
        '<span class="tag-pill ' + (activeTab==='all'?'active':'') + '" onclick="window._kbActiveTab=\'all\';window._kbSearch=\'\';window.showView(\'knowledge\');">All (' + kb.length + ')</span>'
    ].concat(cats.map(c => {
        const count = kb.filter(k => k.category === c).length;
        return '<span class="tag-pill ' + (activeTab===c?'active':'') + '" onclick="window._kbActiveTab=\'' + c.replace(/'/g,"\\'") + '\';window.showView(\'knowledge\');">' + esc(c) + ' (' + count + ')</span>';
    })).join('');

    return '<div style="max-width:1000px;margin:auto;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;flex-wrap:wrap;gap:10px;">' +
            '<div><h2 style="margin:0">📚 Knowledge Base</h2><div style="color:var(--text-muted);font-size:13px;margin-top:2px">SOPs, training manuals, and operational procedures</div></div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                '<button onclick="window.newSOPForm()" class="btn btn-blue">+ New SOP</button>' +
                '<button onclick="window.editKbCategories()" class="btn btn-outline" style="font-size:12px;">⚙️ Categories</button>' +
            '</div>' +
        '</div>' +
        // Search bar
        '<div style="margin-bottom:15px;">' +
            '<input type="text" class="input-box" placeholder="🔍 Search SOPs... e.g. \'close bar\' or \'food safety\'" value="' + esc(search) + '" oninput="window._kbDoSearch(this.value)" style="margin:0;font-size:14px;">' +
        '</div>' +
        '<div style="margin-bottom:20px;display:flex;flex-wrap:wrap;gap:6px;">' + tabPills + '</div>' +
        '<div id="kb-results">' + window._renderKbCards() + '</div>' +
    '</div>';
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

// =============================================================================
// BWI DATA SEEDERS — Knowledge Base & Categories
// =============================================================================

window.seedKBCategories = () => {
    window.kbCategories = [
        'Opening & Closing',
        'Food Safety & HACCP',
        'Bar Procedures',
        'FOH Procedures',
        'BOH Procedures',
        'Emergency & Safety',
        'Equipment Guides',
        'HR & Policies'
    ];
    window.saveToDisk();
};

window.seedKnowledgeBase = () => {
    if ((window.knowledgeBase||[]).length > 0) {
        return window.confirmAction({ title:'📚 Seed SOPs', message:'You already have ' + window.knowledgeBase.length + ' SOPs. <strong>Add</strong> BWI defaults alongside them?', confirmLabel:'Add Defaults', tier:'standard',
            onConfirm:() => { window._doSeedKB(); }
        });
    }
    window._doSeedKB();
};

window._doSeedKB = () => {
    // Seed categories first
    window.seedKBCategories();
    const today = new Date().toLocaleDateString('en-AU');

    const sops = [
        {
            title: 'Temperature Logging Procedure',
            category: 'Food Safety & HACCP',
            content: `PURPOSE: Ensure all fridges and freezers are within safe temperature ranges at all times.\n\nWHEN TO LOG:\n• Opening shift — before service begins\n• Closing shift — before leaving\n• Any time a unit alarm sounds or door is left open\n\nACCEPTABLE RANGES:\n• Fridges / Coolrooms: 0°C to 5°C\n• Freezers: -18°C or below\n• If a unit reads ABOVE 5°C or ABOVE -15°C (freezer), it is a FAIL\n\nFAIL PROCEDURE:\n1. Do NOT store new food in the unit\n2. Check door seals, check if door was left ajar\n3. If temp is 5-8°C — monitor for 30 mins, re-check\n4. If temp is above 8°C — move perishables to working unit immediately\n5. Log the corrective action in the Hub temp log\n6. Notify manager\n\nHOW TO LOG IN HUB:\n• Go to Compliance → Temperatures\n• Enter temp for each unit\n• If any unit fails, the Hub will prompt for a corrective action\n• Click "Log All Temps" when done\n• Sign off with your initials`
        },
        {
            title: 'Opening Procedure — Full Guide',
            category: 'Opening & Closing',
            content: `ARRIVAL & SETUP (30 mins before service):\n1. Disarm alarm, turn on lights\n2. Walk-through — check nothing out of place, no overnight issues\n3. Turn on all equipment: POS, EFTPOS, coffee machine, fryers, ovens\n4. Log fridge/freezer temps in Hub (Compliance → Temps)\n5. Count float and set up tills\n6. Check reservations on booking system — note any large groups or special requests\n7. Review prep list and confirm specials with kitchen\n8. Check emails and voicemail for supplier changes or cancellations\n\nFOH SETUP:\n9. Set tables — chopsticks, napkins, water jugs, candles\n10. Check menus are clean and current\n11. Restock toilets — paper, soap, hand towel\n12. Turn on music to correct level, adjust lighting\n13. Sweep entry, check outdoor area (if applicable)\n\nBAR SETUP:\n14. Stock check bar against PAR — spirits, beer, wine, mixers\n15. Fill ice wells\n16. Prep garnishes — citrus, herbs, specialty items\n17. Test all POS and EFTPOS terminals\n\nTEAM BRIEF:\n18. Brief team on: covers, specials, 86'd items, allergen alerts, VIPs\n19. Confirm roles and sections for the shift\n20. Open doors — service begins!`
        },
        {
            title: 'Closing Procedure — Full Guide',
            category: 'Opening & Closing',
            content: `KITCHEN CLOSE-DOWN:\n1. All food wrapped, labelled with date, and stored FIFO\n2. Wipe down all benches and surfaces with sanitiser\n3. Clean grill, fryers, and flat-top\n4. Empty and clean bain-maries\n5. Turn off ovens, fryers, and gas (check all knobs!)\n6. Sweep and mop kitchen floors\n7. Clean and clear drains\n8. Empty kitchen bins, replace liners\n\nBAR CLOSE-DOWN:\n9. Wipe down bar top, speed rail, back bar\n10. Empty and clean ice wells\n11. Restock fridges to opening PAR levels\n12. Run glasswasher final cycle, clean filters\n13. Empty bar bins\n\nFOH CLOSE-DOWN:\n14. Clear and wipe all tables\n15. Sweep and mop dining floor\n16. Stack/arrange chairs\n17. Check and lock toilets\n\nADMIN:\n18. Count all tills — reconcile with POS takings\n19. Log wastage in Hub (Wastage Tracker)\n20. Log closing fridge/freezer temps in Hub\n21. Write handover notes in Hub (any issues, 86s, follow-ups)\n22. Lock all doors and windows\n23. Set alarm\n24. Final walk-through — lights off, everything secure`
        },
        {
            title: 'Allergen Management Protocol',
            category: 'Food Safety & HACCP',
            content: `OVERVIEW: Allergen mismanagement can be life-threatening. Every team member must know this protocol.\n\nCOMMON ALLERGENS IN OUR MENU:\n• Gluten (soy sauce, tempura, noodles)\n• Soy (soy sauce, tofu, edamame, miso)\n• Shellfish / Crustaceans (prawns, crab)\n• Fish\n• Sesame (sesame oil, seeds, tahini)\n• Peanuts / Tree Nuts\n• Egg (tempura batter, some sauces)\n• Dairy (some desserts, butter)\n\nWHEN A GUEST DECLARES AN ALLERGY:\n1. Take it seriously — never dismiss or downplay\n2. Write the allergy clearly on the order docket\n3. Inform the kitchen VERBALLY as well as on the docket\n4. Kitchen must use clean equipment — separate tongs, cutting board, pan\n5. If unsure whether a dish is safe, CHECK with head chef. Never guess.\n6. When delivering food, confirm: "This is your [dish] prepared without [allergen]"\n\nCROSS-CONTAMINATION PREVENTION:\n• Separate storage for common allergens where possible\n• Clean and sanitise bench before allergen-free prep\n• Use dedicated utensils when preparing allergen-free meals\n• Wash hands between handling different ingredients\n\nSEVERE REACTION (ANAPHYLAXIS):\n1. Call 000 immediately\n2. Help guest use their EpiPen if they have one\n3. Keep guest calm and seated\n4. Do NOT give food or water\n5. Log incident in Hub (Incidents)`
        },
        {
            title: 'Incident & Injury Reporting',
            category: 'Emergency & Safety',
            content: `ALL incidents must be reported — no matter how minor.\n\nWHAT COUNTS AS AN INCIDENT:\n• Staff injury (cuts, burns, slips, falls)\n• Guest injury or illness\n• Property damage\n• Aggressive behaviour or security issue\n• Food safety breach\n• Near-miss (something that ALMOST caused injury)\n\nIMMEDIATE STEPS:\n1. Ensure the injured person is safe and receiving first aid\n2. If serious — call 000\n3. If a guest is involved — manager must attend immediately\n4. Secure the area if needed (wet floor sign, close off area)\n\nREPORTING:\n1. Go to Hub → Incidents → Report Incident\n2. Fill in: date, time, who was involved, what happened, what action was taken\n3. Take photos if relevant\n4. Manager to review and follow up within 24 hours\n\nFOLLOW-UP:\n• Serious injuries must be reported to WorkSafe Tasmania\n• Review incident in next team meeting\n• Implement changes to prevent recurrence\n• Update SOPs if a process gap caused the incident`
        },
        {
            title: 'Cash Handling & Till Reconciliation',
            category: 'FOH Procedures',
            content: `OPENING FLOAT:\n• Standard float: $300 (confirm with manager)\n• Count float at start of shift — must match expected amount\n• If short, report to manager BEFORE trading\n\nDURING SERVICE:\n• All cash transactions through POS — no manual sales\n• Give correct change, count back to customer\n• $50 and $100 notes: check under UV light\n• Never leave till drawer open unattended\n• Tips go in tip jar — do not put in till\n\nCLOSING RECONCILIATION:\n1. Run Z-report on POS\n2. Count all cash in till — separate notes and coins\n3. Subtract opening float from total cash\n4. Cash takings should match POS cash total\n5. If variance > $5 — note in handover log with explanation\n6. Place takings in safe envelope, write amount and date\n7. Drop envelope in safe\n\nSAFE DROPS:\n• During busy service, if till exceeds $500 cash, do a safe drop\n• Two staff members present for any safe access\n• Log safe drop amount and time`
        },
        {
            title: 'Responsible Service of Alcohol (RSA)',
            category: 'Bar Procedures',
            content: `LEGAL REQUIREMENT: All staff serving alcohol must hold a current RSA. It is illegal to serve intoxicated persons.\n\nSIGNS OF INTOXICATION:\n• Slurred or loud speech\n• Unsteady on feet, swaying, stumbling\n• Aggressive or overly emotional behaviour\n• Spilling drinks, difficulty handling money\n• Bloodshot or glassy eyes\n• Loss of coordination\n\nREFUSAL PROCEDURE:\n1. Approach calmly and privately — do not embarrass the guest\n2. Say: "I'm sorry, I'm unable to serve you any more alcohol tonight."\n3. Offer water or non-alcoholic alternatives\n4. If they become aggressive — get manager involved immediately\n5. Offer to call a taxi or rideshare\n6. Do NOT let them drive — if they insist, note the registration and call police\n\nPREVENTION STRATEGIES:\n• Pace service — don't rush drinks to tables\n• Offer food with alcohol\n• Keep track of drinks served to each table/guest\n• Water on every table\n• Avoid heavy pours — use jiggers for spirits\n\nID CHECKING:\n• If a person looks under 25, ask for ID\n• Acceptable: Driver's licence, passport, proof of age card\n• If no valid ID — do not serve. No exceptions.`
        },
        {
            title: 'Receiving & Checking Deliveries',
            category: 'BOH Procedures',
            content: `WHEN A DELIVERY ARRIVES:\n1. Stop what you're doing — deliveries are time-sensitive (cold chain)\n2. Check delivery against purchase order or invoice\n3. Count all items — match quantities\n4. Check quality: no damaged packaging, no dented cans, no broken seals\n\nTEMPERATURE CHECKS:\n• Chilled goods must arrive at 5°C or below\n• Frozen goods must arrive at -15°C or below\n• Use probe thermometer on random items\n• If temp is outside range — REJECT the item and note on invoice\n\nREJECTION CRITERIA:\n• Temperature out of range\n• Past use-by date or too close to expiry\n• Damaged, dirty, or pest-contaminated packaging\n• Wrong item or wrong quantity\n• Note ALL rejections on the delivery docket and get driver to sign\n\nSTORAGE:\n1. Put frozen items away FIRST\n2. Then chilled items\n3. Then dry goods\n4. FIFO — new stock goes BEHIND existing stock\n5. Label anything that isn't pre-labelled with item name and date received\n\nINVOICE:\n• Sign invoice only after checking\n• Note any shorts or rejections on the invoice\n• Give invoice to manager for processing in Hub (Batch Invoices)`
        },
        {
            title: 'Waste Management & Logging',
            category: 'BOH Procedures',
            content: `WHY WE TRACK WASTE:\nFood waste directly impacts profitability. Every item wasted is money lost. Tracking helps us identify patterns and reduce waste.\n\nTYPES OF WASTE:\n• Prep waste — trim, peel, offcuts (expected — built into yield)\n• Spoilage — food expired or quality declined before use\n• Plate waste — food returned uneaten\n• Overproduction — too much prep, not enough sales\n• Spillage / Accidents — drops, spills, burns\n\nHOW TO LOG IN HUB:\n1. Go to Wastage Tracker\n2. Select the item from inventory\n3. Enter quantity wasted\n4. Select reason (Spoilage, Overproduction, Dropped, Quality, Staff Meal, Void)\n5. Add notes if helpful\n6. Save — this deducts from inventory automatically\n\nREDUCING WASTE:\n• Follow prep sheets — don't over-prep\n• FIFO — First In, First Out, always\n• Check use-by dates during opening walk-through\n• Portion control — use scales and measuring tools\n• Repurpose where safe (e.g. vegetable trim → stock)\n• Talk to manager if you notice a pattern (e.g. same item wasted repeatedly)\n\nWASTE TARGETS:\n• Food waste should be under 3% of food cost\n• Review waste reports weekly in team meeting`
        },
        {
            title: 'Emergency Evacuation Plan',
            category: 'Emergency & Safety',
            content: `KNOW YOUR EXITS:\n• Front entrance (main door)\n• Kitchen rear exit\n• [Update with your specific venue exits]\n\nASSEMBLY POINT: [Update with your specific location — e.g. "Car park across the street"]\n\nWHEN TO EVACUATE:\n• Fire alarm sounds\n• Smoke or fire detected\n• Gas leak suspected\n• Structural damage\n• Direction from emergency services\n• Manager calls evacuation\n\nEVACUATION PROCEDURE:\n1. STAY CALM — do not run or shout\n2. Turn off gas and equipment if safe to do so (kitchen — 5 seconds max)\n3. FOH: Guide guests to nearest exit. Check toilets.\n4. BOH: Exit via kitchen rear door\n5. Bar: Secure till if time allows (10 seconds max), exit via nearest route\n6. Manager: Grab sign-in sheet, do headcount at assembly point\n7. Call 000 if not already called\n8. Do NOT re-enter the building until cleared by fire brigade\n\nFIRE — R.A.C.E.:\n• R — RESCUE anyone in immediate danger\n• A — ALARM — activate fire alarm, call 000\n• C — CONTAIN — close doors behind you to slow fire spread\n• E — EVACUATE — follow evacuation procedure\n\nFIRE EXTINGUISHER — P.A.S.S.:\n• P — PULL the pin\n• A — AIM at the base of the fire\n• S — SQUEEZE the handle\n• S — SWEEP side to side\n\nIMPORTANT: Only attempt to fight a fire if it is SMALL, you are TRAINED, and you have a CLEAR ESCAPE ROUTE. Otherwise, evacuate immediately.`
        }
    ];

    sops.forEach(sop => {
        window.knowledgeBase.push({
            title: sop.title,
            category: sop.category,
            content: sop.content,
            fileUrl: null,
            lastModified: today
        });
    });

    window.saveToDisk();
    window.showToast(sops.length + ' BWI SOPs loaded!');
    window.showView('knowledge');
};
