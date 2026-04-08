// ==UserScript==
// @name         KTU Site Blocker (Right‑Click) - Early Block + Funny Image
// @namespace    https://github.com/yourname/site-blocker
// @version      1.4
// @description  Block websites instantly, show a funny image on the block page.
// @author       You
// @match        *://*/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @grant        GM_log
// ==/UserScript==

(function() {
    'use strict';

    // ---------- Configuration ----------
    const STORAGE_KEY = 'blocked_sites';
    const BLOCK_IMAGE_URL = 'https://nursebloginternational.wordpress.com/wp-content/uploads/2015/11/nurse-requirements-600x450.jpg';
    let blockedSites = [];

    // ---------- Helper functions ----------
    function loadBlocklist() {
        let stored;
        try {
            stored = GM_getValue(STORAGE_KEY);
        } catch(e) {
            stored = localStorage.getItem(STORAGE_KEY);
        }
        if (stored) {
            try {
                blockedSites = JSON.parse(stored);
            } catch(e) {
                blockedSites = [];
            }
        } else {
            blockedSites = [];
        }
        if (!Array.isArray(blockedSites)) blockedSites = [];
        blockedSites = blockedSites.map(s => s.toLowerCase());
        console.log('[Site Blocker] Blocklist loaded:', blockedSites);
    }

    function saveBlocklist() {
        const toStore = JSON.stringify(blockedSites);
        try {
            GM_setValue(STORAGE_KEY, toStore);
        } catch(e) {
            localStorage.setItem(STORAGE_KEY, toStore);
        }
    }

    function addToBlocklist(host) {
        host = host.toLowerCase();
        if (!blockedSites.includes(host)) {
            blockedSites.push(host);
            saveBlocklist();
            return true;
        }
        return false;
    }

    function removeFromBlocklist(host) {
        host = host.toLowerCase();
        const idx = blockedSites.indexOf(host);
        if (idx !== -1) {
            blockedSites.splice(idx, 1);
            saveBlocklist();
            return true;
        }
        return false;
    }

    function isCurrentBlocked() {
        const host = window.location.hostname.toLowerCase();
        const blocked = blockedSites.includes(host);
        console.log('[Site Blocker] Check', host, 'blocked?', blocked);
        return blocked;
    }

    // ---------- Block page (safe method) ----------
    function showBlockPage() {
        console.log('[Site Blocker] Showing block page (innerHTML method)');
        const hostname = window.location.hostname.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });

        // Replace the entire document content
        document.documentElement.innerHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Site Blocked</title>
                <style>
                    body {
                        font-family: sans-serif;
                        text-align: center;
                        padding: 2rem;
                        background: #f5f5f5;
                        margin: 0;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        background: white;
                        padding: 2rem;
                        border-radius: 16px;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                        border-radius: 8px;
                        margin-bottom: 1.5rem;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                    h1 {
                        color: #d32f2f;
                        margin-top: 0;
                    }
                    button {
                        background: #2196f3;
                        color: white;
                        border: none;
                        padding: 0.5rem 1rem;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 1rem;
                        margin-top: 1rem;
                    }
                    button:hover {
                        background: #0b7dda;
                    }
                    .footer {
                        margin-top: 1.5rem;
                        font-size: 0.85rem;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <img src="${BLOCK_IMAGE_URL}" alt="Funny block image">
                    <h1>🚫 Site Blocked</h1>
                    <p>This site (<strong>${hostname}</strong>) has been blocked by your personal blocklist.</p>
                    <p>You can remove it from the list using the edit menu.</p>
                    <button id="editListBtn">✏️ Edit blocklist</button>
                    <div class="footer">
                        <small>Time to do something productive! 😄</small>
                    </div>
                </div>
                <script>
                    document.getElementById('editListBtn').onclick = function() {
                        window.location.href = window.location.href + (window.location.search ? '&' : '?') + 'editblocklist=true';
                    };
                <\/script>
            </body>
            </html>
        `;

        // Force stop all network activity
        window.stop();

        // Additional cleanup: remove any remaining script tags that might have been added
        const scripts = document.getElementsByTagName('script');
        for (let i = scripts.length - 1; i >= 0; i--) {
            scripts[i].remove();
        }

        // Stop any ongoing timers or animation frames (optional)
        const highestTimeoutId = setTimeout(() => {}, 0);
        for (let i = 0; i <= highestTimeoutId; i++) {
            clearTimeout(i);
            clearInterval(i);
        }
        cancelAnimationFrame(requestAnimationFrame(() => {}));
    }

    // ---------- Early block check ----------
    loadBlocklist();

    if (isCurrentBlocked()) {
        showBlockPage();
        return; // No further execution – the rest of the script only runs for non‑blocked sites
    }

    // ---------- Custom context menu (Ctrl+Right‑click) ----------
    // (Everything below is unchanged from your previous working version)
    let customMenu = null;

		function hideCustomMenu() {
    if (customMenu) {
        try {
            if (customMenu.parentNode) customMenu.parentNode.removeChild(customMenu);
        } catch(e) {}
        customMenu = null;
    }
    // Also remove any lingering close handlers (they are tied to the menu, but we'll reset them in showCustomMenu)
    if (window._menuCloseHandler) {
        document.removeEventListener('click', window._menuCloseHandler);
        document.removeEventListener('contextmenu', window._menuCloseHandler);
        window._menuCloseHandler = null;
    }
}

    function showCustomMenu(x, y) {
        hideCustomMenu(); // ensure any previous menu is gone

        try {
            const menu = document.createElement('div');
            menu.style.position = 'fixed';
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            menu.style.backgroundColor = '#fff';
            menu.style.border = '1px solid #ccc';
            menu.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)';
            menu.style.zIndex = 999999;
            menu.style.borderRadius = '4px';
            menu.style.fontFamily = 'sans-serif';
            menu.style.fontSize = '14px';
            menu.style.minWidth = '150px';
            menu.style.padding = '4px 0';

            const items = [
                { text: '🚫 Block this site', action: () => {
                    const host = window.location.hostname;
                    if (addToBlocklist(host)) {
                        alert(`Blocked ${host}. Reloading to apply...`);
                        window.location.reload();
                    } else {
                        alert(`${host} is already blocked.`);
                    }
                    hideCustomMenu();
                }},
                { text: '✏️ Edit blocklist', action: () => {
                    hideCustomMenu();
                    showEditUI();
                }},
                { text: '❌ Cancel', action: () => hideCustomMenu() }
            ];

            items.forEach(item => {
                const div = document.createElement('div');
                div.textContent = item.text;
                div.style.padding = '6px 12px';
                div.style.cursor = 'pointer';
                div.style.whiteSpace = 'nowrap';
                div.addEventListener('mouseover', () => div.style.backgroundColor = '#f0f0f0');
                div.addEventListener('mouseout', () => div.style.backgroundColor = 'transparent');
                div.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.action();
                });
                menu.appendChild(div);
            });

            document.body.appendChild(menu);
            customMenu = menu;

            // Define the close handler and store it globally so we can remove it later
            const closeHandler = (e) => {
                if (!menu.contains(e.target)) {
                    hideCustomMenu();
                }
            };
            window._menuCloseHandler = closeHandler;

            // Use a short delay to avoid capturing the event that opened the menu
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
                document.addEventListener('contextmenu', closeHandler);
            }, 0);
        } catch(err) {
            console.error('[Site Blocker] Error showing menu:', err);
        }
    }

    // ---------- Edit UI (modal) ----------
    let editModal = null;

    function showEditUI() {
        if (editModal) {
            editModal.style.display = 'flex';
            refreshEditList();
            return;
        }

        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = 0;
        modal.style.left = 0;
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.zIndex = 1000000;
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.fontFamily = 'sans-serif';

        const panel = document.createElement('div');
        panel.style.backgroundColor = '#fff';
        panel.style.padding = '20px';
        panel.style.borderRadius = '8px';
        panel.style.width = '400px';
        panel.style.maxWidth = '90%';
        panel.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';

        panel.innerHTML = `
            <h3 style="margin-top:0;">Blocked Sites</h3>
            <div id="blocklistContainer" style="max-height:300px; overflow-y:auto; margin-bottom:15px;">
                <ul id="blocklistUl" style="list-style:none; padding:0;"></ul>
            </div>
            <div style="margin-bottom:15px;">
                <input type="text" id="newSiteInput" placeholder="example.com" style="width:70%; padding:6px;">
                <button id="addSiteBtn">Add</button>
            </div>
            <div style="text-align:right;">
                <button id="closeEditBtn">Close</button>
            </div>
        `;

        modal.appendChild(panel);
        document.body.appendChild(modal);
        editModal = modal;

        const refresh = () => refreshEditList();

        const addSite = () => {
            const input = document.getElementById('newSiteInput');
            let host = input.value.trim().toLowerCase();
            if (host) {
                host = host.replace(/^https?:\/\//i, '').split('/')[0];
                if (addToBlocklist(host)) {
                    input.value = '';
                    refresh();
                } else {
                    alert('Site already in list');
                }
            }
        };

        const closeModal = () => {
            modal.style.display = 'none';
        };

        setTimeout(() => {
            document.getElementById('addSiteBtn').addEventListener('click', addSite);
            document.getElementById('closeEditBtn').addEventListener('click', closeModal);
            document.getElementById('newSiteInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addSite();
            });
        }, 0);

        refresh();
    }

    function refreshEditList() {
        const ul = document.getElementById('blocklistUl');
        if (!ul) return;
        ul.innerHTML = '';
        if (blockedSites.length === 0) {
            ul.innerHTML = '<li style="color:#999;">No sites blocked.</li>';
            return;
        }
        // Create a sorted copy of blockedSites
        const sortedSites = [...blockedSites].sort((a, b) => a.localeCompare(b));
        sortedSites.forEach(site => {
            const li = document.createElement('li');
            li.style.marginBottom = '8px';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.innerHTML = `<span>${site}</span><button class="removeSiteBtn" data-site="${site}" style="background:#f44336; color:white; border:none; border-radius:3px; padding:2px 6px; cursor:pointer;">Remove</button>`;
            ul.appendChild(li);
        });
        // Re-attach remove events (same as before)
        document.querySelectorAll('.removeSiteBtn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const site = btn.getAttribute('data-site');
                if (site && removeFromBlocklist(site)) {
                    refreshEditList();
                }
            });
        });
    }

    // ---------- Floating edit button ----------
    function addFloatingButton() {
        const btn = document.createElement('div');
        btn.textContent = '✏️ Edit blocklist';
        btn.style.position = 'fixed';
        btn.style.bottom = '20px';
        btn.style.right = '20px';
        btn.style.backgroundColor = '#2196f3';
        btn.style.color = 'white';
        btn.style.padding = '8px 12px';
        btn.style.borderRadius = '30px';
        btn.style.fontSize = '14px';
        btn.style.fontFamily = 'sans-serif';
        btn.style.cursor = 'pointer';
        btn.style.zIndex = 99999;
        btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        btn.addEventListener('click', showEditUI);
        document.body.appendChild(btn);
    }

    // ---------- Setup UI only if not blocked ----------
    document.addEventListener('contextmenu', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            showCustomMenu(e.clientX, e.clientY);
        }
    });

    addFloatingButton();

    if (window.location.search.includes('editblocklist=true')) {
        showEditUI();
        const newUrl = window.location.href.replace(/(\?|&)editblocklist=true/, '');
        if (newUrl !== window.location.href) {
            window.history.replaceState({}, document.title, newUrl);
        }
    }
})();
