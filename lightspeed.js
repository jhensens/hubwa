// --- HOBART HUB: Lightspeed/Kounta API Integration ---
// Direct API connection to Lightspeed Restaurant (K-Series / Kounta)
// Pulls completed orders, feeds into existing POS depletion pipeline
// Mirrors Tanda integration pattern: localStorage credentials, auto-sync timer, settings modal

// =============================================================================
// 1. CREDENTIAL HELPERS
// =============================================================================

window.getLsCredentials = () => {
    const vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    return {
        clientId: localStorage.getItem(vid + '_lsClientId') || '',
        clientSecret: localStorage.getItem(vid + '_lsClientSecret') || '',
        companyId: localStorage.getItem(vid + '_lsCompanyId') || '',
        siteId: localStorage.getItem(vid + '_lsSiteId') || '',
        siteName: localStorage.getItem(vid + '_lsSiteName') || '',
        lastPull: localStorage.getItem(vid + '_lsLastPull') || ''
    };
};

window.isLsConnected = () => {
    const c = window.getLsCredentials();
    return !!(c.clientId && c.clientSecret && c.companyId && c.siteId);
};

// =============================================================================
// 2. API FETCH WRAPPER
// =============================================================================

// Single-endpoint fetch with Basic Auth. Returns {data, headers} or null.
window.fetchKounta = async (endpoint) => {
    const creds = window.getLsCredentials();
    if (!creds.clientId || !creds.clientSecret) return null;
    if (!navigator.onLine) return null;

    const auth = btoa(creds.clientId + ':' + creds.clientSecret);
    // If endpoint is a full URL (pagination cursor), use it directly
    const url = endpoint.startsWith('http')
        ? endpoint
        : 'https://api.kounta.com/v1/' + endpoint + (endpoint.includes('.json') ? '' : '.json');

    try {
        const res = await fetch(url, {
            headers: {
                'Authorization': 'Basic ' + auth,
                'Accept': 'application/json'
            }
        });
        if (res.status === 429) {
            // Rate limited — wait and retry once
            await new Promise(r => setTimeout(r, 2000));
            const retry = await fetch(url, {
                headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' }
            });
            if (!retry.ok) return null;
            return { data: await retry.json(), headers: retry.headers };
        }
        if (!res.ok) return null;
        return { data: await res.json(), headers: res.headers };
    } catch (e) {
        console.error('Kounta API error:', e);
        return null;
    }
};

// Paginated fetch — follows X-Next-Page cursor, accumulates all pages
window.fetchKountaAll = async (endpoint) => {
    var allResults = [];
    var url = endpoint;
    var maxPages = 40; // safety cap (1000 orders max)
    var page = 0;
    while (url && page < maxPages) {
        var result = await window.fetchKounta(url);
        if (!result) break;
        var data = Array.isArray(result.data) ? result.data : [];
        if (data.length === 0) break;
        allResults = allResults.concat(data);
        var nextPage = result.headers ? result.headers.get('X-Next-Page') : null;
        url = nextPage || null;
        page++;
    }
    return allResults;
};

// =============================================================================
// 3. CONNECTION TEST & SITE DISCOVERY
// =============================================================================

window.lsTestConnection = async () => {
    // Step 1: Verify credentials via /v1/companies/me
    var result = await window.fetchKounta('companies/me');
    if (!result || !result.data) {
        return { ok: false, error: 'Invalid credentials or API unreachable. Check your Client ID and Secret.' };
    }

    var company = result.data;
    var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_lsCompanyId', company.id);

    // Step 2: Fetch sites for this company
    var sitesResult = await window.fetchKounta('companies/' + company.id + '/sites');
    if (!sitesResult || !sitesResult.data) {
        return { ok: false, error: 'Connected but could not fetch sites.' };
    }

    var sites = Array.isArray(sitesResult.data) ? sitesResult.data : [];
    return { ok: true, company: company, sites: sites };
};

// =============================================================================
// 4. SALES PULL
// =============================================================================

// Pull completed orders since last pull (or given date). Aggregates product quantities.
// Returns { salesItems: [{rawName, qtySold}], orderCount, revenue } or null on failure.
window.lsPullSales = async (dateFrom) => {
    var creds = window.getLsCredentials();
    if (!creds.companyId || !creds.siteId) return null;

    // Default: pull since last pull date, or today
    if (!dateFrom) {
        dateFrom = creds.lastPull ? creds.lastPull.split('T')[0] : window._isoDate();
    }

    var endpoint = 'companies/' + creds.companyId + '/sites/' + creds.siteId +
        '/orders/complete.json?created_gte=' + dateFrom;
    var orders = await window.fetchKountaAll(endpoint);

    if (!orders || orders.length === 0) {
        window._lightspeedData = window._lightspeedData || {};
        window._lightspeedData.lastUpdated = window._isoTime();
        return { salesItems: [], orderCount: 0, revenue: 0 };
    }

    // Aggregate product quantities across all orders
    var productMap = {}; // productName -> { qtySold, revenue }
    var totalRevenue = 0;

    orders.forEach(function(order) {
        var lines = order.lines || [];
        lines.forEach(function(line) {
            var name = (line.product && line.product.name) || '';
            var qty = Math.abs(line.quantity || 1);
            var price = line.unit_price || 0;
            if (!name || qty <= 0) return;

            if (!productMap[name]) productMap[name] = { qtySold: 0, revenue: 0 };
            productMap[name].qtySold += qty;
            productMap[name].revenue += qty * price;
            totalRevenue += qty * price;
        });
    });

    var salesItems = Object.entries(productMap).map(function(entry) {
        return { rawName: entry[0], qtySold: entry[1].qtySold };
    });

    // Update last pull timestamp
    var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_lsLastPull', window._isoNow());

    // Log the pull
    if (!window.lsApiPullLog) window.lsApiPullLog = [];
    window.lsApiPullLog.push({
        date: window._isoDate(),
        time: window._isoTime(),
        orderCount: orders.length,
        revenue: totalRevenue,
        itemCount: salesItems.length,
        source: 'api-pull'
    });
    // Keep last 100 pull logs
    if (window.lsApiPullLog.length > 100) window.lsApiPullLog = window.lsApiPullLog.slice(-100);

    // Update runtime data
    window._lightspeedData = {
        companyId: creds.companyId,
        siteName: creds.siteName,
        lastPull: window._isoTime(),
        lastUpdated: window._isoTime(),
        orderCount: orders.length,
        totalRevenue: totalRevenue,
        productCount: salesItems.length
    };

    window.saveToDisk();
    return { salesItems: salesItems, orderCount: orders.length, revenue: totalRevenue };
};

// =============================================================================
// 5. AUTO-SYNC TIMER
// =============================================================================

window._lsAutoInterval = null;

window.startLsAutoRefresh = () => {
    window.stopLsAutoRefresh();
    // Poll every 15 minutes for new completed orders
    window._lsAutoInterval = setInterval(async () => {
        if (document.hidden || !navigator.onLine || !window.isLsConnected()) return;
        try {
            var result = await window.lsPullSales();
            if (result && result.salesItems.length > 0) {
                window._pendingApiSalesItems = result.salesItems;
                window.showToast('Lightspeed: ' + result.orderCount + ' order' + (result.orderCount !== 1 ? 's' : '') + ' found (' + result.salesItems.length + ' products). Review in Lightspeed settings.');
            }
        } catch (e) {
            console.error('Lightspeed auto-sync error:', e);
        }
    }, 15 * 60 * 1000);
};

window.stopLsAutoRefresh = () => {
    if (window._lsAutoInterval) {
        clearInterval(window._lsAutoInterval);
        window._lsAutoInterval = null;
    }
};

// =============================================================================
// 6. DEPLETION BRIDGE
// =============================================================================

// Feed sales data into the existing unified depletion confirmation pipeline
window.lsRunDepletion = (salesItems) => {
    if (!salesItems || salesItems.length === 0) {
        return window.showToast('No sales items to deplete.', 'error');
    }
    window.showDepletionConfirmation(salesItems, 'api-depletion');
};

// Pull + deplete in one action (settings modal button)
window.lsPullAndDeplete = async () => {
    window.showLoadingOverlay('Pulling sales from Lightspeed...');
    try {
        var result = await window.lsPullSales();
        window.hideLoadingOverlay();

        if (!result) {
            return window.showToast('Failed to connect to Lightspeed. Check credentials.', 'error');
        }
        if (result.salesItems.length === 0) {
            return window.showToast('No new orders found since last pull.');
        }

        window.showToast(result.orderCount + ' order' + (result.orderCount !== 1 ? 's' : '') + ', ' + result.salesItems.length + ' products found.');
        window.lsRunDepletion(result.salesItems);
    } catch (e) {
        window.hideLoadingOverlay();
        window.showToast('Lightspeed pull failed: ' + e.message, 'error');
    }
};

// Deplete from previously auto-synced pending items
window.lsDepletePending = () => {
    if (window._pendingApiSalesItems && window._pendingApiSalesItems.length > 0) {
        window.lsRunDepletion(window._pendingApiSalesItems);
        window._pendingApiSalesItems = null;
    } else {
        window.showToast('No pending sales data. Try pulling fresh data first.');
    }
};

// =============================================================================
// 7. SETTINGS MODAL
// =============================================================================

window.openLightspeedSettings = () => {
    var creds = window.getLsCredentials();
    var connected = window.isLsConnected();
    var ld = window._lightspeedData;
    var pending = window._pendingApiSalesItems;
    var E = window.esc;

    var statusDot = connected ? '🟢' : '🔴';
    var statusText = connected ? 'Connected' : 'Not Connected';

    var html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px;background:var(--bg-main);border-radius:8px;border:1px solid var(--border);">' +
        '<span style="font-size:20px;">' + statusDot + '</span>' +
        '<div style="flex:1;">' +
            '<div style="font-weight:600;font-size:14px;">' + statusText + '</div>' +
            (connected ? '<div style="font-size:11px;color:var(--text-muted);">Site: ' + E(creds.siteName || 'Unknown') +
                (ld ? ' · Last sync: ' + (ld.lastUpdated || '—') : '') + '</div>' : '') +
        '</div>' +
        (connected ? '<span style="font-size:10px;padding:3px 8px;border-radius:12px;background:rgba(16,185,129,0.1);color:var(--green);border:1px solid rgba(16,185,129,0.2);">Auto-sync: 15min</span>' : '') +
    '</div>';

    // Credential inputs
    html += '<div style="margin-bottom:12px;">' +
        '<label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Client ID</label>' +
        '<input type="text" id="ls-client-id" class="input-box" value="' + E(creds.clientId) + '" placeholder="From Kounta back office Add-ons..." style="margin-bottom:8px;">' +
        '<label style="font-size:11px;color:var(--text-muted);display:block;margin-bottom:4px;">Client Secret</label>' +
        '<input type="password" id="ls-client-secret" class="input-box" value="' + E(creds.clientSecret) + '" placeholder="From Kounta back office Add-ons...">' +
    '</div>';

    html += '<button onclick="window.saveLsCredentials()" class="btn btn-green" style="width:100%;margin-bottom:8px;">Save & Connect</button>';

    if (connected) {
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
            '<button onclick="window.lsPullAndDeplete()" class="btn btn-blue" style="font-size:12px;">📥 Pull & Deplete</button>' +
            '<button onclick="window.showLoadingOverlay(\'Refreshing...\');window.lsPullSales().then(function(){window.hideLoadingOverlay();window.openLightspeedSettings();})" class="btn btn-outline" style="font-size:12px;">🔄 Refresh Data</button>' +
        '</div>';

        // Pending data alert
        if (pending && pending.length > 0) {
            html += '<div class="card" style="border-left:4px solid var(--orange);padding:10px 14px;margin-bottom:12px;">' +
                '<div style="font-size:13px;font-weight:600;color:var(--orange);margin-bottom:4px;">📦 ' + pending.length + ' products pending depletion</div>' +
                '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">From auto-sync. Review and confirm stock deductions.</div>' +
                '<button onclick="window.closeModal();window.lsDepletePending()" class="btn btn-orange" style="font-size:12px;width:100%;">Review & Deplete</button>' +
            '</div>';
        }

        // Data summary
        if (ld) {
            html += '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">' +
                '<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;">Last Pull Summary</div>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:13px;">' +
                    '<div style="color:var(--text-muted);">Orders: <strong style="color:var(--text-main);">' + (ld.orderCount || 0) + '</strong></div>' +
                    '<div style="color:var(--text-muted);">Products: <strong style="color:var(--text-main);">' + (ld.productCount || 0) + '</strong></div>' +
                    '<div style="color:var(--text-muted);">Revenue: <strong style="color:var(--green);">$' + (ld.totalRevenue || 0).toFixed(0) + '</strong></div>' +
                    '<div style="color:var(--text-muted);">Pulled at: <strong style="color:var(--text-main);">' + (ld.lastPull || '—') + '</strong></div>' +
                '</div>' +
            '</div>';
        }

        // Disconnect button
        html += '<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:12px;">' +
            '<button onclick="window.lsDisconnect()" class="btn btn-outline" style="width:100%;font-size:11px;color:var(--text-muted);">Disconnect Lightspeed</button>' +
        '</div>';
    }

    // Help text
    html += '<div style="margin-top:12px;padding:10px;background:var(--bg-main);border-radius:6px;border:1px solid var(--border);font-size:11px;color:var(--text-muted);">' +
        'Get your Client ID and Secret from <a href="https://my.kounta.com" target="_blank" style="color:var(--blue);">my.kounta.com</a> → Add-ons section. ' +
        '<a href="https://apidoc.kounta.com" target="_blank" style="color:var(--blue);">API Docs ↗</a>' +
    '</div>';

    window.openModal('🛒 Lightspeed Integration', html);
};

// Save credentials and test connection
window.saveLsCredentials = async () => {
    var clientId = document.getElementById('ls-client-id').value.trim();
    var clientSecret = document.getElementById('ls-client-secret').value.trim();
    if (!clientId || !clientSecret) return window.showToast('Both Client ID and Secret are required.', 'error');

    var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_lsClientId', clientId);
    localStorage.setItem(vid + '_lsClientSecret', clientSecret);

    window.closeModal();
    window.showLoadingOverlay('Connecting to Lightspeed...');

    var result = await window.lsTestConnection();
    window.hideLoadingOverlay();

    if (!result.ok) {
        return window.showToast('Connection failed: ' + result.error, 'error');
    }

    if (result.sites.length === 0) {
        return window.showToast('Connected but no sites found in your Kounta account.', 'error');
    }

    if (result.sites.length === 1) {
        // Auto-select sole site
        localStorage.setItem(vid + '_lsSiteId', result.sites[0].id);
        localStorage.setItem(vid + '_lsSiteName', result.sites[0].name);
        window.showToast('Lightspeed connected! Site: ' + result.sites[0].name);
        window.startLsAutoRefresh();
        window.openLightspeedSettings();
    } else {
        // Show site picker
        window._lsOpenSitePicker(result.sites);
    }
};

// Site picker for multi-site accounts
window._lsOpenSitePicker = (sites) => {
    var E = window.esc;
    var html = '<p style="font-size:13px;color:var(--text-muted);margin-bottom:15px;">Multiple sites found in your Kounta account. Select the site that corresponds to <strong>' + E(window._getVenueName()) + '</strong>:</p>';
    sites.forEach(function(s) {
        html += '<button onclick="window._lsSelectSite(' + s.id + ',\'' + E(s.name).replace(/'/g, "\\'") + '\')" class="btn btn-outline" style="width:100%;margin-bottom:8px;text-align:left;padding:12px 16px;">' +
            '<strong>' + E(s.name) + '</strong>' +
            (s.code ? ' <span style="font-size:11px;color:var(--text-muted);">(' + E(s.code) + ')</span>' : '') +
            ' <span style="font-size:11px;color:var(--text-muted);float:right;">ID: ' + s.id + '</span>' +
        '</button>';
    });
    window.openModal('Select Lightspeed Site', html);
};

window._lsSelectSite = (siteId, siteName) => {
    var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
    localStorage.setItem(vid + '_lsSiteId', siteId);
    localStorage.setItem(vid + '_lsSiteName', siteName);
    window.closeModal();
    window.showToast('Lightspeed connected! Site: ' + siteName);
    window.startLsAutoRefresh();
};

// Disconnect — clear all credentials
window.lsDisconnect = () => {
    window.confirmAction({
        title: 'Disconnect Lightspeed',
        message: 'This will remove your Lightspeed API credentials for this venue. You can reconnect at any time.',
        tier: 'dangerous',
        onConfirm: function() {
            var vid = window.getCurrentVenue ? window.getCurrentVenue().id : 'bwi';
            localStorage.removeItem(vid + '_lsClientId');
            localStorage.removeItem(vid + '_lsClientSecret');
            localStorage.removeItem(vid + '_lsCompanyId');
            localStorage.removeItem(vid + '_lsSiteId');
            localStorage.removeItem(vid + '_lsSiteName');
            localStorage.removeItem(vid + '_lsLastPull');
            window.stopLsAutoRefresh();
            window._lightspeedData = null;
            window._pendingApiSalesItems = null;
            window.showToast('Lightspeed disconnected.');
            window.openLightspeedSettings();
        }
    });
};
