// --- HOBART HUB: Notifications Module ---
// Audit trail, print reports, notification center, DOMContentLoaded initialization

// --- 7b. AUDIT TRAIL ---
window.logAudit = function(collection, action, itemId, details) {
    if (!window.auditLog) window.auditLog = [];
    window.auditLog.unshift({
        id: window.generateId('aud'),
        timestamp: new Date().toISOString(),
        collection: collection,
        action: action,
        itemId: itemId || '',
        details: details || '',
        venue: window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi',
        user: window._activeStaffMember ? window._activeStaffMember.name : (window.isLocked ? 'System' : 'Manager')
    });
    // Keep last 500 entries
    if (window.auditLog.length > 500) window.auditLog = window.auditLog.slice(0, 500);
};

// --- PRINT REPORT UTILITY ---
// Reusable print template: opens new window with venue branding + auto-triggers print
window.printReport = function(title, contentHtml, options) {
    options = options || {};
    var venue = window._getVenueName();
    var dateStr = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    var win = window.open('', '_blank');
    if (!win) return window.showToast('Pop-up blocked. Allow pop-ups for printing.', 'error');
    win.document.write('<!DOCTYPE html><html><head><title>' + title + ' — ' + venue + '</title>' +
    '<style>' +
        'body{font-family:Inter,-apple-system,sans-serif;font-size:13px;color:#222;max-width:900px;margin:30px auto;line-height:1.6;}' +
        '.print-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #333;padding-bottom:10px;margin-bottom:20px;}' +
        '.print-header h1{font-size:20px;margin:0;}.print-header .venue{font-size:12px;color:#888;}' +
        '.print-footer{margin-top:30px;padding-top:10px;border-top:1px solid #ddd;font-size:10px;color:#aaa;display:flex;justify-content:space-between;}' +
        'table{width:100%;border-collapse:collapse;}' +
        'th{padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#666;border-bottom:2px solid #333;background:#f9fafb;}' +
        'td{padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;}' +
        'tr:nth-child(even){background:#f9fafb;}' +
        '.section-title{font-size:14px;font-weight:700;margin:20px 0 8px;padding:6px 0;border-bottom:1px solid #ddd;}' +
        '.flag-red{color:#dc2626;font-weight:bold;} .flag-green{color:#16a34a;}' +
        '@media print{body{margin:10mm;max-width:none;}@page{margin:10mm;size:' + (options.landscape ? 'A4 landscape' : 'A4') + ';}}' +
        (options.extraCss || '') +
    '</style></head><body>' +
    '<div class="print-header"><div><h1>' + title + '</h1><div class="venue">' + venue + '</div></div>' +
    '<div style="text-align:right;font-size:12px;color:#888;">' + dateStr + (options.subtitle ? '<br>' + options.subtitle : '') + '</div></div>' +
    contentHtml +
    '<div class="print-footer"><span>' + venue + ' &middot; Hobart Hub</span><span>Printed ' + dateStr + '</span></div>' +
    '<script>window.onload=function(){window.print();}<\/script></body></html>');
    win.document.close();
};

// --- 8. NOTIFICATION CENTER ---
window._notifOpen = false;
window.getNotifications = function() {
    const notifs = [];
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-AU');
    const freqDays = { Weekly: 7, Fortnightly: 14, Monthly: 30, Quarterly: 90 };

    // Overdue rotational tasks
    (window.rotationalTasks || []).forEach(t => {
        if (t.dueDateMode === 'specific') {
            if (t.specificDueDate && new Date(t.specificDueDate) <= now) notifs.push({type:'task', icon:'🔄', text: t.name + ' is overdue', view:'tasks', priority:1});
        } else if (t.lastLogIso) {
            const days = (now - new Date(t.lastLogIso)) / 86400000;
            if (days >= (freqDays[t.freq] || 7)) notifs.push({type:'task', icon:'🔄', text: t.name + ' is overdue', view:'tasks', priority:1});
        } else if (t.anchorDate) {
            const anchor = new Date(t.anchorDate);
            if (anchor <= now) notifs.push({type:'task', icon:'🔄', text: t.name + ' is due', view:'tasks', priority:1});
        } else {
            notifs.push({type:'task', icon:'🔄', text: t.name + ' needs attention', view:'tasks', priority:2});
        }
    });

    // Expiring documents (<30 days) — only for docs the current user can see
    (window.digitalSafe || []).forEach(d => {
        if (!d.expiry) return;
        if (window._canSeeDoc && !window._canSeeDoc(d)) return;
        const exp = new Date(d.expiry);
        const daysLeft = (exp - now) / 86400000;
        if (daysLeft < 0) notifs.push({type:'doc', icon:'📄', text: d.name + ' has EXPIRED', view:'safe', priority:0});
        else if (daysLeft <= 30) notifs.push({type:'doc', icon:'📄', text: d.name + ' expires in ' + Math.ceil(daysLeft) + 'd', view:'safe', priority:1});
    });

    // Outstanding SOP acknowledgements for the current logged-in staff member
    if (window._activeStaffMember && window._isSOPAcked) {
        (window.knowledgeBase || []).forEach((k,i) => {
            if (!k.requireAck) return;
            if (window._canSeeDoc && !window._canSeeDoc(k)) return;
            const sopId = window._sopId(k, i);
            if (!window._isSOPAcked(sopId)) {
                notifs.push({type:'sop-ack', icon:'📋', text: 'Read & acknowledge: ' + k.title, view:'knowledge', priority:1});
            }
        });
    }

    // Below par stock
    (window.inventoryItems || []).filter(i => !i.archived && i.par && i.stock < i.par).forEach(i => {
        notifs.push({type:'stock', icon:'📦', text: i.name + ' below par (' + (i.stock||0) + '/' + i.par + ')', view:'inventory', priority:2});
    });

    // Open maintenance tickets
    (window.defectLogs || []).filter(d => d.status !== 'Resolved').forEach(d => {
        notifs.push({type:'maint', icon:'🛠️', text: (d.item || 'Issue') + ' — open ticket', view:'maintenance', priority:2});
    });

    // Staff qualification expiry
    (window.staffDirectory || []).forEach(s => {
        if (!s.qualifications || s.status === 'Inactive') return;
        (window.qualificationTypes || []).forEach(qt => {
            const q = s.qualifications[qt.id];
            if (!q || !q.expiry) return;
            const daysLeft = (new Date(q.expiry) - now) / 86400000;
            if (daysLeft < 0) notifs.push({type:'qual', icon:'🎓', text: (s.name||'Staff') + ' — ' + qt.name + ' EXPIRED', view:'orientation', priority:0});
            else if (daysLeft <= 30) notifs.push({type:'qual', icon:'🎓', text: (s.name||'Staff') + ' — ' + qt.name + ' expires in ' + Math.ceil(daysLeft) + 'd', view:'orientation', priority:1});
        });
    });

    // HACCP breaches today
    (window.tempLogs || []).forEach(t => {
        if (window._isToday(t.time) && parseFloat(t.value) > 5) {
            notifs.push({type:'haccp', icon:'🌡️', text: (t.unit||'Unit') + ' temp breach: ' + t.value + '°C', view:'compliance', priority:0});
        }
    });

    // Supplier order cutoff reminders
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDay = dayNames[tomorrow.getDay()];
    const currentHHMM = now.getHours() * 100 + now.getMinutes();
    (window.suppliers || []).forEach(s => {
        if (!s.cutoff || !s.deliveryDays) return;
        // Check if supplier delivers tomorrow
        if (!s.deliveryDays.includes(tomorrowDay)) return;
        // Parse cutoff time (e.g. "15:00")
        const parts = s.cutoff.split(':');
        const cutoffMins = parseInt(parts[0]) * 100 + parseInt(parts[1] || 0);
        // Alert if within 2 hours before cutoff
        if (currentHHMM >= (cutoffMins - 200) && currentHHMM <= cutoffMins) {
            // Check if any items from this supplier are below par
            const lowItems = (window.inventoryItems || []).filter(i => !i.archived && i.supplier === s.name && i.par && i.stock < i.par);
            if (lowItems.length > 0) {
                notifs.push({type:'order', icon:'📦', text: s.name + ' cutoff ' + s.cutoff + ' — ' + lowItems.length + ' items below par', view:'prep-list', priority:0});
            }
        }
    });

    // Unread announcements
    const unreadAnn = (window.announcements || []).filter(a => {
        if (a.expiry && new Date(a.expiry) < now) return false;
        return a.priority === 'urgent' && (!a.acknowledged || a.acknowledged.length === 0);
    });
    unreadAnn.forEach(a => {
        notifs.push({type:'announce', icon:'📢', text: a.title, view:'noticeboard', priority:0});
    });

    // Sort by priority (0=critical first)
    notifs.sort((a, b) => a.priority - b.priority);
    return notifs;
};

window.updateNotifBadge = function() {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const count = window.getNotifications().length;
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = count > 0 ? 'flex' : 'none';
};

window.toggleNotifPanel = function() {
    window._notifOpen = !window._notifOpen;
    let panel = document.getElementById('notif-panel');
    if (!window._notifOpen) { if (panel) panel.remove(); return; }

    const notifs = window.getNotifications();
    const items = notifs.length === 0
        ? '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">✅ All clear — nothing needs attention</div>'
        : notifs.slice(0, 12).map(n =>
            `<div onclick="window.showView('${n.view}');window.toggleNotifPanel();" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);font-size:13px;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                <span style="font-size:16px;flex-shrink:0;">${n.icon}</span>
                <span style="color:${n.priority===0?'var(--red)':n.priority===1?'var(--orange)':'var(--text-main)'}">${window.esc(n.text)}</span>
            </div>`
        ).join('');

    if (panel) panel.remove();
    panel = document.createElement('div');
    panel.id = 'notif-panel';
    panel.innerHTML = `<div style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);font-weight:700;border-bottom:1px solid var(--border);">Notifications (${notifs.length})</div>${items}`;
    panel.style.cssText = 'position:absolute;top:100%;right:0;width:340px;max-height:420px;overflow-y:auto;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.4);z-index:500;';
    const bell = document.getElementById('notif-bell');
    if (bell) bell.appendChild(panel);
};

// Close notif panel on outside click
document.addEventListener('click', (e) => {
    if (window._notifOpen && !e.target.closest('#notif-bell')) { window._notifOpen = false; const p = document.getElementById('notif-panel'); if (p) p.remove(); }
});

document.addEventListener('DOMContentLoaded', () => {
    // Show loading state immediately
    const content = document.getElementById('mainContent');
    if (content) content.innerHTML = '<div class="loading-state"><h2>Loading Hub...</h2><p>Connecting to Firebase...</p></div>';

    // Load from localStorage first for instant render
    window.saveKeys.forEach(k => {
        const _vid2 = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'; const stored = localStorage.getItem(_vid2+'_'+k) || localStorage.getItem(k);
        if (stored) {
            try { window[k] = JSON.parse(stored); } catch(e) {}
        }
    });

    // Run migrations (Director role, doc access levels)
    if (window._backfillDocAccessLevels) window._backfillDocAccessLevels();

    // Lightspeed auto-sync on load (pulls last 2 days of sales/covers)
    setTimeout(function() { if (window.lsAutoSyncOnLoad) window.lsAutoSyncOnLoad(); }, 2000);

    // Run init callbacks (e.g., restore active stocktake)
    (window._hubInitCallbacks || []).forEach(function(fn) { try { fn(); } catch(e) { console.error('Init callback error:', e); } });

    // Show setup wizard in nav only if data is sparse (first-time setup)
    const _wizEl = document.getElementById('nav-setup-wizard');
    if (_wizEl && (window.inventoryItems||[]).length < 10 && (window.rotationalTasks||[]).length < 3) {
        _wizEl.style.display = '';
    }

    // Render immediately from localStorage
    window.checkLockState();
    window.updateVenueBadge();
    window.showView('dashboard');
    setTimeout(() => window.updateNotifBadge(), 500);
    setTimeout(() => { window.checkStorageHealth(); }, 1500);
    setTimeout(() => { window.loadTandaData(); window.startTandaAutoRefresh(); }, 2000);
    setTimeout(() => { if (window.isLsConnected && window.isLsConnected()) window.startLsAutoRefresh(); }, 3000);

    // Force PIN setup if no PIN exists
    setTimeout(() => {
        if (!localStorage.getItem('venuePin')) {
            window._showPinModal('🔐 Setup Manager PIN', 'A PIN is required to secure restricted areas. Choose a 4+ digit PIN.', async (newPin) => {
                if (newPin.length >= 4) {
                    const hashed = await window._hashPin(newPin);
                    localStorage.setItem('venuePin', hashed);
                    localStorage.setItem('venuePinHashed', 'true');
                    window.isLocked = true;
                    window.closeModal();
                    window.checkLockState();
                    window.showToast('PIN set! Hub is now secured.');
                }
            });
        }
    }, 800);

    // Then sync from Firebase in background and re-render if data differs
    if (typeof db !== 'undefined') {
        db.collection('venueData').doc(window.getVenueDocId()).get().then((doc) => {
            if (doc.exists) {
                let data = doc.data();
                let changed = false;
                const _safeLen = v => {
                    if (Array.isArray(v)) return v.length;
                    if (v === undefined || v === null) return 0;
                    const s = JSON.stringify(v);
                    return s ? s.length : 0;
                };
                window.saveKeys.forEach(k => {
                    if (data[k] !== undefined) {
                        if (_safeLen(data[k]) !== _safeLen(window[k])) changed = true;
                        window[k] = data[k];
                    }
                });
                // Also save Firebase data back to localStorage for next load
                const _vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi'; window.saveKeys.forEach(k => localStorage.setItem(_vid+'_'+k, JSON.stringify(window[k])));
                if (changed) {
                    window.checkLockState();
                    // Only re-render if on dashboard - avoid re-render loop
                    if (!window.currentView || window.currentView === 'dashboard') {
                        window.showView('dashboard');
                    }
                }
                const syncLabel = document.getElementById('sync-status');
                if (syncLabel) { syncLabel.innerHTML = '🟢 Live Sync'; syncLabel.style.color = 'var(--green)'; }
            }
        }).catch(err => {
            console.error("Firebase read error:", err);
            const syncLabel = document.getElementById('sync-status');
            if (syncLabel) { syncLabel.innerHTML = '⚠️ Offline Mode'; syncLabel.style.color = 'var(--orange)'; }
        });
    }
});
