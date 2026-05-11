// --- HOBART HUB: Storage Module ---
// Data persistence (localStorage + Firebase), import/export, toast notifications, theme toggle

// --- LOG TRIMMING (prevent unbounded growth) ---
window._trimLogs = () => {
    const caps = {
        stockMovements: 500,
        depletionLogs: 200,
        wastageLogs: 200,
        tempLogs: 2000,           // ~3-4 months at 20/day
        complianceLogs: 1000,     // ~2 years of daily sign-offs
        auditLog: 1000,           // ~2 years
        taskHistory: 1000,        // ~3 months of daily tasks
        handoverLogs: 400,        // ~13 months
        incidentLogs: 300,
        defectLogs: 300,
        contractorLogs: 200,
        orientationLogs: 200,
        lsImportLog: 100
    };
    Object.keys(caps).forEach(k => {
        if (window[k] && Array.isArray(window[k]) && window[k].length > caps[k]) {
            window[k] = window[k].slice(-caps[k]);
        }
    });
};

// --- DATA SIZE MONITOR ---
window.getStorageUsage = () => {
    var total = 0;
    try { for (var i = 0; i < localStorage.length; i++) { var key = localStorage.key(i); total += (key.length + localStorage.getItem(key).length) * 2; } } catch(e) {}
    return total;
};
window.checkStorageHealth = () => {
    var bytes = window.getStorageUsage();
    var mb = (bytes / (1024 * 1024)).toFixed(1);
    if (bytes > 4 * 1024 * 1024 && !window._storageBannerShown) {
        window._storageBannerShown = true;
        if (window.showToast) window.showToast('Storage at ' + mb + 'MB / 5MB — consider exporting a backup and clearing old data.', 'error');
    }
    return { bytes: bytes, mb: parseFloat(mb) };
};

// --- AUTO-BACKUP TO FIREBASE ---
window._getBackupKey = () => (window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi') + '_lastBackupDate';
window._lastBackupDate = localStorage.getItem(window._getBackupKey()) || '';
window._runDailyBackup = () => {
    var today = new Date().toISOString().split('T')[0];
    if (window._lastBackupDate === today) return;
    if (typeof db === 'undefined') return;
    var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    var payload = {}; window.saveKeys.forEach(k => { payload[k] = window[k]; });
    payload._backupTime = new Date().toISOString();
    db.collection('backups').doc(vid + '_' + today).set(payload)
        .then(() => {
            window._lastBackupDate = today;
            localStorage.setItem(window._getBackupKey(), today);
            // Clean old backups (keep 7 days)
            var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
            var cutoffStr = cutoff.toISOString().split('T')[0];
            db.collection('backups').where('__name__', '<', vid + '_' + cutoffStr)
                .get().then(snap => { snap.forEach(doc => doc.ref.delete()); }).catch(() => {});
        }).catch(() => {});
};

// Debounced Firebase write — max once every 4 seconds
window._saveTimer = null;
window._retryTimer = null; // Separate timer for retries — won't be clobbered by new saves
window._lastFirebaseSave = 0;
window._firebaseRetryCount = 0;

window.saveToDisk = () => {
    // Trim unbounded log arrays before saving
    window._trimLogs();
    const syncLabel = document.getElementById('sync-status');
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';

    // Always save to localStorage immediately
    window.saveKeys.forEach(k => {
        try {
            localStorage.setItem(vid+'_'+k, JSON.stringify(window[k]));
        } catch(e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                if (window.showToast && !window._quotaWarned) { window.showToast('Storage nearly full — data saved to cloud only. Consider exporting a backup.', 'error'); window._quotaWarned = true; }
            }
        }
    });

    if (syncLabel) { syncLabel.innerHTML = '💾 Saved Local'; syncLabel.style.color = 'var(--blue)'; }
    window.updateNotifBadge();

    // Debounce Firebase — only write if 4+ seconds since last write
    if (window._saveTimer) clearTimeout(window._saveTimer);
    window._saveTimer = setTimeout(() => {
        if (typeof db === 'undefined') {
            if (syncLabel) { syncLabel.innerHTML = '🟢 Saved Local'; syncLabel.style.color = 'var(--green)'; }
            return;
        }
        const now = Date.now();
        if (now - window._lastFirebaseSave < 4000) return; // Extra guard
        window._lastFirebaseSave = now;
        let payload = {}; window.saveKeys.forEach(k => payload[k] = window[k]);
        db.collection('venueData').doc(window.getVenueDocId()).set(payload, { merge: true })
            .then(() => {
                window._firebaseRetryCount = 0;
                if (syncLabel) { syncLabel.innerHTML = '🟢 Live Sync'; syncLabel.style.color = 'var(--green)'; }
                window._runDailyBackup();
            })
            .catch(err => {
                console.error('Firebase save error:', err);
                window._firebaseRetryCount++;
                if (window._firebaseRetryCount <= 3) {
                    if (syncLabel) { syncLabel.innerHTML = '🔄 Retrying sync (' + window._firebaseRetryCount + '/3)...'; syncLabel.style.color = 'var(--orange)'; }
                    if (window.showToast && window._firebaseRetryCount === 1) window.showToast('Sync failed — retrying...', 'error');
                    if (window._retryTimer) clearTimeout(window._retryTimer);
                    window._retryTimer = setTimeout(() => { window._lastFirebaseSave = 0; window.saveToDisk(); }, 10000);
                } else {
                    if (syncLabel) { syncLabel.innerHTML = '❌ Sync Failed — <span onclick="window._firebaseRetryCount=0;window.saveToDisk()" style="cursor:pointer;text-decoration:underline;">Retry</span>'; syncLabel.style.color = 'var(--red)'; }
                    if (window.showToast) window.showToast('Data not synced to cloud. Check your connection.', 'error');
                }
            });
    }, 3000); // Wait 3 seconds after last save call before writing to Firebase
};

window.loadData = () => {
    // Manual reload — pull from Firebase and re-render
    const _vidLD = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'; window.saveKeys.forEach(k => { try { window[k] = JSON.parse(localStorage.getItem(_vidLD+'_'+k) || localStorage.getItem(k)) || window[k]; } catch(e) {} });
    if (window._backfillDocAccessLevels) window._backfillDocAccessLevels();
    if (typeof db !== 'undefined') {
        db.collection('venueData').doc(window.getVenueDocId()).get().then((doc) => {
            if (doc.exists) {
                let data = doc.data();
                window.saveKeys.forEach(k => { if (data[k] !== undefined) window[k] = data[k]; });
                if (window._backfillDocAccessLevels) window._backfillDocAccessLevels();
                const _vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'; window.saveKeys.forEach(k => localStorage.setItem(_vid+'_'+k, JSON.stringify(window[k])));
                window.checkLockState();
                // Don't re-render here — avoid loop. User can navigate normally.
            }
        }).catch(err => console.error("Firebase read error:", err));
    } else {
        window.checkLockState();
    }
};

window.exportData = () => {
    let payload = {};
    window.saveKeys.forEach(k => payload[k] = window[k]);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
    const downloadAnchorNode = document.createElement('a'); downloadAnchorNode.setAttribute("href", dataStr); downloadAnchorNode.setAttribute("download", "HobartHub_Backup_" + new Date().toISOString().split('T')[0] + ".json");
    document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove();
};

window.importData = (event) => {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            // ── Preview before commit ──
            const E = window.esc;
            const counts = {
                recipes: (data.recipes || []).length,
                inventoryItems: (data.inventoryItems || []).length,
                staffDirectory: (data.staffDirectory || []).length,
                suppliers: (data.suppliers || []).length,
                tempLogs: (data.tempLogs || []).length,
                depletionLogs: (data.depletionLogs || []).length,
                salesData: (data.salesData || []).length,
                knowledgeBase: (data.knowledgeBase || []).length
            };
            const totalKeys = window.saveKeys.filter(k => data[k] !== undefined).length;
            const summaryRows = Object.entries(counts).map(([k, v]) =>
                '<tr><td style="padding:4px 8px;font-size:12px;color:var(--text-muted);">' + E(k) + '</td>' +
                '<td style="padding:4px 8px;font-size:13px;text-align:right;font-weight:600;">' + v + '</td></tr>'
            ).join('');
            const fileLabel = E(file.name) + ' · ' + Math.round(file.size / 1024) + ' KB';

            window.confirmAction({
                title: '📦 Restore Backup — Preview',
                message: '<p style="margin:0 0 10px;color:var(--text-muted);font-size:12px;"><strong>File:</strong> ' + fileLabel + '<br><strong>Contains:</strong> ' + totalKeys + ' of ' + window.saveKeys.length + ' data keys</p>' +
                    '<table style="width:100%;border-collapse:collapse;background:var(--bg-main);border-radius:6px;overflow:hidden;">' +
                    '<tbody>' + summaryRows + '</tbody></table>' +
                    '<p style="margin:12px 0 0;color:var(--orange);font-size:12px;"><strong>⚠️ This replaces your current data.</strong> A copy of current state is auto-saved to localStorage before restore.</p>',
                confirmLabel: 'Restore Backup',
                tier: 'dangerous',
                onConfirm: () => {
                    try { localStorage.setItem('_preRestoreBackup', JSON.stringify(Object.fromEntries(window.saveKeys.map(k => [k, window[k]])))); } catch(_) {}
                    window.saveKeys.forEach(k => { window[k] = data[k] || window[k]; });
                    window.saveToDisk();
                    window.showToast('✅ Backup restored and synced to Firebase.', 'success');
                    window.showView('dashboard');
                }
            });
        } catch (err) { window.showToast('Error parsing backup file.', 'error'); console.error(err); }
    };
    reader.readAsText(file);
};

// --- 5. GLOBAL TOAST NOTIFICATIONS (stacking) ---
window._getToastContainer = () => {
    let c = document.getElementById('hub-toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'hub-toast-container';
        c.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;flex-direction:column-reverse;gap:8px;align-items:center;pointer-events:none;';
        document.body.appendChild(c);
    }
    // Add keyframes only once
    if (!document.getElementById('toast-keyframes')) {
        const s = document.createElement('style'); s.id = 'toast-keyframes';
        s.innerHTML = '@keyframes toastIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes toastOut{from{transform:translateY(0);opacity:1}to{transform:translateY(20px);opacity:0}}';
        document.head.appendChild(s);
    }
    return c;
};
window.showToast = (msg, type = "success") => {
    const container = window._getToastContainer();
    // Max 3 visible — remove oldest
    while (container.children.length >= 3) container.lastChild.remove();
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.cssText = 'background:' + (type === 'error' ? 'var(--red)' : 'var(--green)') + ';color:white;padding:12px 24px;border-radius:30px;font-weight:bold;font-size:14px;box-shadow:0 10px 25px rgba(0,0,0,0.5);animation:toastIn 0.3s ease forwards;pointer-events:auto;white-space:nowrap;';
    container.insertBefore(toast, container.firstChild);
    setTimeout(() => { toast.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
};

// --- THEME TOGGLE ---
window.toggleTheme = () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('hubTheme', isLight ? 'light' : 'dark');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.innerHTML = isLight ? '☀️ Light Mode' : '🌙 Dark Mode';
};
// Apply saved theme on load
(function() {
    if (localStorage.getItem('hubTheme') === 'light') {
        document.body.classList.add('light-mode');
        setTimeout(() => { const btn = document.getElementById('btn-theme'); if (btn) btn.innerHTML = '☀️ Light Mode'; }, 100);
    }
})();
