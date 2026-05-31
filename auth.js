// --- HOBART HUB: Auth Module ---
// Kiosk PIN security, lock state, role access, staff hub PIN entry

// --- 3. KIOSK PIN SECURITY (SHA-256 Hashed) ---
window._hashPin = async (pin) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin + '_hobarthub_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Migrate plaintext PIN to hashed on first load
(function() {
    const storedPin = localStorage.getItem('venuePin');
    if (storedPin && storedPin.length < 64) {
        // Still plaintext — hash it now
        window._hashPin(storedPin).then(hashed => {
            localStorage.setItem('venuePin', hashed);
            localStorage.setItem('venuePinHashed', 'true');
        });
    }
})();

window.isLocked = !!localStorage.getItem('venuePin');
window._lastActivity = Date.now();
window._autoLockMinutes = 10;

['click','keypress','touchstart'].forEach(evt =>
    document.addEventListener(evt, () => { window._lastActivity = Date.now(); }, { passive: true })
);

setInterval(() => {
    if (!window.isLocked && localStorage.getItem('venuePin')) {
        const idleMinutes = (Date.now() - window._lastActivity) / 60000;
        if (idleMinutes >= window._autoLockMinutes) {
            window.isLocked = true;
            window._activeStaffMember = null;
            sessionStorage.removeItem('activeStaffName');
            window.checkLockState();
            window.showToast('Hub auto-locked after inactivity.');
        }
    }
}, 60000);

window._restrictedViews = [
    'sales', 'suppliers', 'recipes', 'invoice', 'orientation', 'safe', 'handover',
    'margins', 'menu-engineering', 'sell-price-editor', 'price-alerts', 'forecast',
    'staff-directory', 'bulk-category-editor', 'pos-alias-editor', 'ai-order',
    'cross-venue', 'par-editor', 'batch-linker', 'costing-report', 'prime-cost', 'lightspeed-import',
    'badge-management', 'staff-hub-config', 'audit-log'
];

window.checkLockState = () => {
    // If a staff member is logged in, apply role-based filtering instead
    if (window._activeStaffMember) {
        window.applyRoleAccess();
        return;
    }
    // First restore ALL nav sections and items that applyRoleAccess may have hidden
    document.querySelectorAll('.nav-section').forEach(function(sec) {
        sec.style.display = 'block';
        var header = sec.querySelector('.nav-section-header');
        if (header) header.style.display = 'flex';
    });
    document.querySelectorAll('.nav-item[data-view]').forEach(function(el) {
        el.style.display = 'flex';
    });
    document.querySelectorAll('.btn-backup, .btn-restore').forEach(function(el) {
        el.style.display = 'flex';
    });

    const restrictedItems = document.querySelectorAll('.restricted');
    const lockBtn = document.getElementById('btn-lock');
    const staffBtn = document.getElementById('btn-staff-hub');
    if (window.isLocked) {
        restrictedItems.forEach(el => el.style.display = 'none');
        if (lockBtn) { lockBtn.innerHTML = '🔓 Unlock Hub'; lockBtn.style.background = 'rgba(59,130,246,0.1)'; lockBtn.style.color = 'var(--blue)'; lockBtn.style.borderColor = 'rgba(59,130,246,0.2)'; }
        if (staffBtn) staffBtn.style.display = 'flex';
        if (window._restrictedViews.includes(window.currentView)) window.showView('dashboard');
    } else {
        restrictedItems.forEach(el => {
            el.style.display = el.classList.contains('nav-section') ? 'block' : 'flex';
        });
        if (lockBtn) { lockBtn.innerHTML = '🔒 Lock Hub'; lockBtn.style.background = 'rgba(239,68,68,0.1)'; lockBtn.style.color = 'var(--red)'; lockBtn.style.borderColor = 'rgba(239,68,68,0.2)'; }
        if (staffBtn) staffBtn.style.display = 'none';
        window._activeStaffMember = null;
    }
};

// --- ROLE-BASED SIDEBAR FILTERING ---
// When a staff member is logged in, show only their role's allowed views
window.applyRoleAccess = () => {
    var staff = window._activeStaffMember;
    if (!staff) return;
    var role = staff.role || 'FOH';
    var config = ((window.staffHubConfig || {}).roles || {})[role] || {};
    var allowed = config.allowedViews || (window.staffHubConfig || {}).defaultViews || window._defaultStaffViews || [];
    var isFullAccess = allowed.includes('*') || role === 'Manager' || role === 'Director';

    // Step 1: Ensure sections and restricted items are visible (for filtering)
    document.querySelectorAll('.nav-section').forEach(function(sec) {
        sec.style.display = 'block';
        var header = sec.querySelector('.nav-section-header');
        if (header) header.style.display = 'flex';
    });
    document.querySelectorAll('.restricted').forEach(function(el) {
        el.style.display = el.classList.contains('nav-section') ? 'block' : 'flex';
    });
    document.querySelectorAll('.nav-item[data-view]').forEach(function(el) {
        el.style.display = 'flex';
    });

    // Step 2: Now filter items by role's allowed views
    document.querySelectorAll('.nav-item[data-view]').forEach(function(el) {
        var view = el.getAttribute('data-view');
        el.style.display = (isFullAccess || allowed.includes(view)) ? 'flex' : 'none';
    });

    // Step 3: Hide entire nav sections if none of their items are visible
    document.querySelectorAll('.nav-section').forEach(function(sec) {
        var items = sec.querySelectorAll('.nav-item[data-view]');
        if (items.length === 0) { sec.style.display = 'none'; return; }
        var anyVisible = Array.from(items).some(function(el) { return el.style.display !== 'none'; });
        var header = sec.querySelector('.nav-section-header');
        if (header) header.style.display = anyVisible ? 'flex' : 'none';
        if (!anyVisible) sec.style.display = 'none';
        else sec.style.display = 'block';
    });

    // Show lock button as "Lock" (staff can lock themselves out)
    var lockBtn = document.getElementById('btn-lock');
    if (lockBtn) { lockBtn.innerHTML = '🔒 Lock'; lockBtn.style.background = 'rgba(239,68,68,0.1)'; lockBtn.style.color = 'var(--red)'; lockBtn.style.borderColor = 'rgba(239,68,68,0.2)'; lockBtn.onclick = function() { window.lockStaffHub(); }; }

    // Hide staff hub button (already logged in), hide backup/restore
    var staffBtn = document.getElementById('btn-staff-hub');
    if (staffBtn) staffBtn.style.display = 'none';
    document.querySelectorAll('.btn-backup, .btn-restore').forEach(function(el) { el.style.display = 'none'; });
};

// --- STAFF HUB PIN ENTRY ---
window.showStaffPinEntry = () => {
    window._showPinModal('👤 Staff Hub', 'Enter your personal PIN to access My Hub', async (attempt) => {
        const hashed = await window._hashPin(attempt);
        const match = (window.staffDirectory || []).find(s => s.pin && s.pin === hashed && s.status !== 'Inactive');
        if (match) {
            window._activeStaffMember = match;
            sessionStorage.setItem('activeStaffName', match.name);
            window._lastActivity = Date.now();
            window.closeModal();
            // Force-open all sidebar sections for staff session (one-time on login)
            ['sec-ops','sec-team','sec-financials','sec-settings','sec-external'].forEach(function(id) {
                var el = document.getElementById(id);
                if (el) el.style.display = 'block';
                var arr = document.getElementById('arr-' + id);
                if (arr) arr.textContent = '▾';
            });
            window.applyRoleAccess();
            window.showView('my-hub');
            window.showToast('Welcome, ' + match.name + '!');
        } else {
            window._pinBuffer = '';
            const dots = document.querySelectorAll('.pin-dot');
            dots.forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
            const errEl = document.getElementById('pin-error');
            if (errEl) errEl.textContent = 'PIN not recognised. Ask your manager to set your PIN.';
        }
    });
};

window.lockStaffHub = () => {
    window._activeStaffMember = null;
    sessionStorage.removeItem('activeStaffName');
    // Restore lock button to normal toggleLock behaviour
    var lockBtn = document.getElementById('btn-lock');
    if (lockBtn) lockBtn.onclick = function() { window.toggleLock(); };
    window.checkLockState();
    // Restore saved section collapse state from localStorage
    var _saved = JSON.parse(localStorage.getItem('hubSections') || '{}');
    Object.keys(_saved).forEach(function(id) {
        var el = document.getElementById(id);
        var arr = document.getElementById('arr-' + id);
        if (el) el.style.display = _saved[id] ? 'block' : 'none';
        if (arr) arr.textContent = _saved[id] ? '▾' : '▸';
    });
    window.showView('dashboard');
    window.showToast('Staff Hub locked.');
};

window._showPinModal = (title, subtitle, onSuccess, showForgot) => {
    window._pinBuffer = '';
    window._pinCallback = onSuccess;
    const forgotLink = showForgot
        ? '<div style="margin-top:18px;"><a href="#" onclick="event.preventDefault();window._startForgotPinFlow();" style="color:var(--blue);font-size:12px;text-decoration:underline;">Forgot PIN?</a></div>'
        : '';
    const body = '<div style="text-align:center;">' +
        (subtitle ? '<p style="color:var(--text-muted);font-size:13px;margin:0 0 20px;">' + subtitle + '</p>' : '') +
        '<div id="pin-dots" style="display:flex;justify-content:center;gap:12px;margin-bottom:24px;">' +
            '<div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div>' +
        '</div>' +
        '<div id="pin-error" style="color:var(--red);font-size:12px;min-height:20px;margin-bottom:12px;"></div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:240px;margin:0 auto;">' +
            [1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => {
                if (k === '') return '<div></div>';
                if (k === '⌫') return '<button onclick="window._pinKey(\'del\')" class="btn btn-outline" style="font-size:18px;padding:14px;border-radius:12px;">⌫</button>';
                return '<button onclick="window._pinKey(\'' + k + '\')" class="btn btn-outline" style="font-size:20px;font-weight:600;padding:14px;border-radius:12px;">' + k + '</button>';
            }).join('') +
        '</div>' +
        forgotLink +
    '</div>';
    _origOpenModal(title, body);
};

// =============================================================================
// MASTER PIN — admin override that can reset a forgotten manager PIN
// Stored as SHA-256 hash in localStorage under 'masterPin'.
// Single point of failure: if forgotten, the only recovery is wiping localStorage.
// =============================================================================
window.openMasterPinSettings = () => {
    const existing = localStorage.getItem('masterPin');
    if (!existing) {
        // First-time setup
        window._showPinModal('🔑 Set Master PIN', 'This PIN can reset a forgotten manager PIN. Choose 4+ digits and write it down somewhere safe — losing it means data loss.', async (newPin) => {
            if (newPin.length < 4) return;
            const hashed = await window._hashPin(newPin);
            localStorage.setItem('masterPin', hashed);
            window.closeModal();
            if (typeof window.logAudit === 'function') window.logAudit('auth', 'master-pin-set', '', 'Master PIN created');
            window.showToast('🔑 Master PIN set. Keep it safe.');
        });
        return;
    }
    // Change existing — verify current first, then prompt for new
    window._showPinModal('🔑 Verify Master PIN', 'Enter the current Master PIN to change it.', async (attempt) => {
        const hashed = await window._hashPin(attempt);
        if (hashed !== existing) {
            window._pinBuffer = '';
            document.querySelectorAll('.pin-dot').forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
            const errEl = document.getElementById('pin-error');
            if (errEl) errEl.textContent = 'Incorrect Master PIN.';
            return;
        }
        window.closeModal();
        setTimeout(() => {
            window._showPinModal('🔑 New Master PIN', 'Enter a new Master PIN (4+ digits).', async (newPin) => {
                if (newPin.length < 4) return;
                const newHashed = await window._hashPin(newPin);
                localStorage.setItem('masterPin', newHashed);
                window.closeModal();
                if (typeof window.logAudit === 'function') window.logAudit('auth', 'master-pin-change', '', 'Master PIN changed');
                window.showToast('🔑 Master PIN updated.');
            });
        }, 100);
    });
};

window._startForgotPinFlow = () => {
    const masterHash = localStorage.getItem('masterPin');
    if (!masterHash) {
        const errEl = document.getElementById('pin-error');
        if (errEl) errEl.textContent = 'No Master PIN set. Ask the owner to clear localStorage to reset.';
        return;
    }
    window.closeModal();
    setTimeout(() => {
        window._showPinModal('🔑 Master PIN Required', 'Enter the Master PIN to reset the manager PIN.', async (attempt) => {
            const hashed = await window._hashPin(attempt);
            if (hashed !== masterHash) {
                window._pinBuffer = '';
                document.querySelectorAll('.pin-dot').forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
                const errEl = document.getElementById('pin-error');
                if (errEl) errEl.textContent = 'Incorrect Master PIN.';
                return;
            }
            window.closeModal();
            setTimeout(() => {
                window._showPinModal('🔐 New Manager PIN', 'Enter a new manager PIN (4+ digits).', async (newPin) => {
                    if (newPin.length < 4) return;
                    const newHashed = await window._hashPin(newPin);
                    localStorage.setItem('venuePin', newHashed);
                    localStorage.setItem('venuePinHashed', 'true');
                    window.isLocked = false;
                    window._lastActivity = Date.now();
                    window.closeModal();
                    window.checkLockState();
                    if (typeof window.logAudit === 'function') window.logAudit('auth', 'pin-reset-via-master', '', 'Manager PIN reset via Master PIN override');
                    window.showToast('✅ Manager PIN reset. Hub unlocked.');
                });
            }, 100);
        });
    }, 100);
};

window._pinKey = (key) => {
    const errEl = document.getElementById('pin-error');
    if (errEl) errEl.textContent = '';
    if (key === 'del') {
        window._pinBuffer = window._pinBuffer.slice(0, -1);
    } else if (window._pinBuffer.length < 8) {
        window._pinBuffer += key;
    }
    // Update dots
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((d, i) => {
        d.style.background = i < window._pinBuffer.length ? 'var(--brand-dark)' : 'transparent';
        d.style.border = '2px solid ' + (i < window._pinBuffer.length ? 'var(--brand-dark)' : 'var(--border)');
    });
    // Auto-submit at 4+ digits after short delay
    if (window._pinBuffer.length >= 4) {
        setTimeout(() => {
            if (window._pinCallback) window._pinCallback(window._pinBuffer);
        }, 200);
    }
};

window._pinAttempts = 0;
window._pinLockoutUntil = 0;

window.requirePin = (onSuccess) => {
    const pin = localStorage.getItem('venuePin');
    if (!pin) { onSuccess(); return; }
    if (!window.isLocked) { onSuccess(); return; }
    window._showPinModal('🔒 Enter PIN', 'Manager PIN required to continue', async (attempt) => {
        if (Date.now() < window._pinLockoutUntil) {
            const secsLeft = Math.ceil((window._pinLockoutUntil - Date.now()) / 1000);
            const errEl = document.getElementById('pin-error');
            if (errEl) errEl.textContent = 'Too many attempts. Wait ' + secsLeft + 's.';
            window._pinBuffer = '';
            const dots = document.querySelectorAll('.pin-dot');
            dots.forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
            return;
        }
        const hashed = await window._hashPin(attempt);
        if (hashed === pin) {
            window._pinAttempts = 0;
            window.isLocked = false;
            window._lastActivity = Date.now();
            window.closeModal();
            window.checkLockState();
            window.showToast('Hub unlocked.');
            onSuccess();
        } else {
            window._pinAttempts++;
            window._pinBuffer = '';
            const dots = document.querySelectorAll('.pin-dot');
            dots.forEach(d => { d.style.background = 'transparent'; d.style.border = '2px solid var(--border)'; });
            const errEl = document.getElementById('pin-error');
            if (window._pinAttempts >= 5) {
                window._pinLockoutUntil = Date.now() + 30000;
                if (errEl) errEl.textContent = '5 failed attempts. Locked for 30 seconds.';
                if (typeof window.logAudit === 'function') window.logAudit('auth', 'pin-lockout', '', '5 failed PIN attempts — 30s lockout');
            } else {
                if (errEl) errEl.textContent = 'Incorrect PIN. ' + (5 - window._pinAttempts) + ' attempts remaining.';
            }
        }
    }, true);
};

window.toggleLock = () => {
    const pin = localStorage.getItem('venuePin');
    if (!pin) {
        // First time — set up PIN via styled modal
        window._showPinModal('🔐 Set Manager PIN', 'Choose a 4+ digit PIN to secure restricted areas', async (newPin) => {
            if (newPin.length >= 4) {
                const hashed = await window._hashPin(newPin);
                localStorage.setItem('venuePin', hashed);
                localStorage.setItem('venuePinHashed', 'true');
                window.isLocked = true;
                window.closeModal();
                window.checkLockState();
                window.showToast('PIN set. Hub locked.');
            }
        });
    } else if (window.isLocked) {
        window.requirePin(() => {});
    } else {
        window.isLocked = true;
        window.checkLockState();
        window.showView('dashboard');
        window.showToast('Hub locked.');
    }
};
