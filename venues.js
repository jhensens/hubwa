// --- HOBART HUB: Venues Module ---
// Multi-venue framework: venue selector, switching, theming, device setup

// =============================================================================
// MULTI-VENUE FRAMEWORK (LIA)
// Venue selector persisted in localStorage
// Each venue has its own Firebase doc + localStorage namespace
// =============================================================================
// =============================================================================
// MULTI-VENUE SYSTEM
// =============================================================================
window._venues = [
    { id: 'bwi', name: 'Bar Wa Izakaya', emoji: '🍶', color: '#7c3aed', docId: 'hobartHub' },
    { id: 'lia', name: 'Lost In Asia', emoji: '🌴', color: '#22d3ee', docId: 'lia' }
];

window.getCurrentVenue = () => {
    // Check URL param first (for setup), then localStorage, then default to bwi
    const urlParams = new URLSearchParams(window.location.search);
    const urlVenue = urlParams.get('venue');
    if (urlVenue && window._venues.find(v=>v.id===urlVenue)) {
        // Set this device's default venue from URL param
        if (urlParams.get('setup') === 'true') {
            localStorage.setItem('hubDeviceVenue', urlVenue);
            // Remove the URL params without reload
            window.history.replaceState({}, '', window.location.pathname);
            window.showToast('Device set to ' + urlVenue.toUpperCase() + ' permanently!');
        }
    }
    // Device venue = permanent venue for this device (set during setup)
    // Active venue = current session venue (can be switched by PIN holders)
    const deviceVenue = localStorage.getItem('hubDeviceVenue') || 'bwi';
    const activeVenue = localStorage.getItem('hubActiveVenue') || deviceVenue;
    return window._venues.find(v=>v.id===activeVenue) || window._venues[0];
};

window.getVenueDocId = () => window.getCurrentVenue().docId;
window.getDeviceVenue = () => localStorage.getItem('hubDeviceVenue') || 'bwi';

// localStorage keys are venue-prefixed to avoid cross-contamination on shared devices
window.getLocalKey = (key) => window.getCurrentVenue().id + '_' + key;

window.renderVenueSwitcher = () => {
    if (window.isLocked && localStorage.getItem('venuePin')) {
        window.requirePin(() => { if (!window.isLocked) window.renderVenueSwitcher(); });
        return;
    }
    const current = window.getCurrentVenue();
    const deviceVenue = window.getDeviceVenue();
    const venueHtml = window._venues.map(v => {
        const isActive = current.id === v.id;
        const isDevice = deviceVenue === v.id;
        return '<div onclick="window.switchVenue(\'' + v.id + '\')" ' +
            'style="display:flex;align-items:center;gap:12px;padding:15px;border-radius:10px;cursor:pointer;' +
            'border:2px solid ' + (isActive?v.color:'var(--border)') + ';' +
            'background:' + (isActive?'rgba(139,92,246,0.08)':'var(--bg-main)') + ';' +
            'margin-bottom:10px;transition:all 0.2s;">' +
            '<div style="font-size:32px;">' + v.emoji + '</div>' +
            '<div style="flex:1;">' +
                '<div style="font-weight:bold;font-size:15px;color:' + (isActive?v.color:'var(--text-main)') + ';">' + v.name + '</div>' +
                '<div style="font-size:11px;color:var(--text-muted);">' +
                    (isActive ? 'Currently active' : 'Click to switch') +
                    (isDevice ? ' · <strong>This device</strong>' : '') +
                '</div>' +
            '</div>' +
            (isActive ? '<div style="color:' + v.color + ';font-size:20px;">✓</div>' : '') +
        '</div>';
    }).join('');

    const setupHtml = '<div style="margin-top:20px;padding-top:15px;border-top:1px solid var(--border);">' +
        '<div style="margin-bottom:15px;padding:12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:8px;">' +
        '<p style="font-size:12px;color:var(--text-muted);margin:0 0 8px 0;">🗑️ <strong>Wipe Venue Data</strong> — Reset current venue to blank:</p>' +
        '<button onclick="window.wipeVenueData()" class="btn btn-outline" style="width:100%;color:var(--red);border-color:var(--red);font-size:13px;">⚠️ Wipe ' + current.name + ' Data</button>' +
        '</div>' +
        '<p style="font-size:12px;color:var(--text-muted);margin:0 0 10px 0;">⚙️ <strong>Device Setup</strong> — Set which venue this device defaults to:</p>' +
        '<div style="display:flex;gap:8px;margin-bottom:15px;">' +
        window._venues.map(v =>
            '<button onclick="window.setDeviceVenue(\'' + v.id + '\')" class="btn ' + (deviceVenue===v.id?'btn-dark':'btn-outline') + '" style="flex:1;font-size:13px;">' + v.emoji + ' ' + v.name + '</button>'
        ).join('') +
        '</div>' +
        '<p style="font-size:11px;color:var(--text-muted);margin:0;">Device venue determines which data loads by default and what staff see.</p>' +
    '</div>';

    window.openModal('🏢 Venue Management', venueHtml + setupHtml);
};

window.wipeVenueData = () => {
    const v = window.getCurrentVenue();
    window.closeModal();
    window.confirmAction({
        title: '⚠️ Wipe All Data',
        message: 'This will permanently delete <strong>all</strong> inventory, recipes, takings, compliance logs, staff data and settings for <strong>' + window.esc(v.name) + '</strong>.<br><br>This <strong>cannot be undone</strong>.',
        confirmLabel: 'Wipe Everything',
        confirmColor: 'var(--red)',
        tier: 'critical',
        typeWord: 'WIPE',
        onConfirm: () => {
            const vid = v.id;
            window.saveKeys.forEach(k => {
                const emptyVal = Array.isArray(window[k]) ? [] : (typeof window[k] === 'object' ? {} : '');
                window[k] = emptyVal;
                localStorage.removeItem(vid + '_' + k);
                localStorage.removeItem(k);
            });
            window.saveToDisk();
            window.showToast(v.name + ' data wiped. Starting fresh!');
            setTimeout(() => location.reload(), 1000);
        }
    });
};

window.switchVenue = (id) => {
    if (id === window.getCurrentVenue().id) { window.closeModal(); return; }
    localStorage.setItem('hubActiveVenue', id);
    window.closeModal();
    window.showToast('Switching to ' + (window._venues.find(v=>v.id===id)||{}).name + '...');
    setTimeout(() => location.reload(), 600);
};

window.setDeviceVenue = (id) => {
    const venue = window._venues.find(v=>v.id===id);
    if (!venue) return;
    window.closeModal();
    window.confirmAction({
        title: '🏢 Set Device Venue',
        message: 'Set this device to always default to <strong>' + window.esc(venue.name) + '</strong>?<br>This affects what staff see when they open the Hub.',
        confirmLabel: 'Set Default',
        confirmColor: 'var(--blue)',
        tier: 'standard',
        onConfirm: () => {
            localStorage.setItem('hubDeviceVenue', id);
            localStorage.setItem('hubActiveVenue', id);
            window.showToast('Device set to ' + venue.name + '!');
            setTimeout(() => location.reload(), 600);
        }
    });
};

window.updateVenueBadge = () => {
    const v = window.getCurrentVenue();
    const badge = document.getElementById('venue-badge');
    if (badge) {
        badge.textContent = v.emoji + ' ' + v.name;
        badge.style.borderColor = v.color;
        badge.style.color = v.color;
    }
    // Apply venue theme
    window.applyVenueTheme(v);
};

window.applyVenueTheme = (v) => {
    const root = document.documentElement;
    const body = document.body;
    // Remove all venue classes
    body.classList.remove('venue-bwi', 'venue-lia');
    body.classList.add('venue-' + v.id);

    if (v.id === 'lia') {
        root.style.setProperty('--brand-dark', '#22d3ee');
        root.style.setProperty('--brand-accent', '#0ea5e9');
        root.style.setProperty('--sidebar-bg', '#041a1a');
        root.style.setProperty('--sidebar-hover', '#083030');
        root.style.setProperty('--blue', '#22d3ee');
        root.style.setProperty('--purple', '#22d3ee');
        root.style.setProperty('--card-bg', '#0a1f1f');
        root.style.setProperty('--bg-main', '#041515');
        // Top bar colour
        const header = document.querySelector('.main-header');
        if (header) { header.style.borderBottom = '3px solid #22d3ee'; header.style.background = 'linear-gradient(135deg, #041a1a, #083030)'; }
        // Logo
        const logoEl = document.getElementById('venue-logo');
        if (logoEl) { logoEl.src = './lia-logo.png'; logoEl.style.filter = 'none'; logoEl.style.width = '120px'; logoEl.style.marginTop = '4px'; }
        document.title = 'Lost In Asia Hub';
    } else {
        root.style.setProperty('--brand-dark', '#a78bfa');
        root.style.setProperty('--brand-accent', '#7c3aed');
        root.style.setProperty('--sidebar-bg', '#090912');
        root.style.setProperty('--sidebar-hover', '#1e1e2e');
        root.style.setProperty('--blue', '#3b82f6');
        root.style.setProperty('--purple', '#8b5cf6');
        root.style.setProperty('--card-bg', '#13131a');
        root.style.setProperty('--bg-main', '#0d0d14');
        // Reset top bar
        const header = document.querySelector('.main-header');
        if (header) { header.style.borderBottom = ''; header.style.background = ''; }
        // Logo
        const logoEl = document.getElementById('venue-logo');
        if (logoEl) { logoEl.src = './bwi-logo.png'; logoEl.style.filter = 'invert(1) contrast(1.4) brightness(1.3)'; logoEl.style.width = '88px'; }
        document.title = 'Hobart Hub | Bar Wa Izakaya';
    }
};
