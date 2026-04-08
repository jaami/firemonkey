// ==UserScript==
// @name         YouTube Filter (V18.6)
// @namespace    http://yourdomain.example
// @version      18.6
// @description  Blocks YouTube content by keywords/channels + aggressive Shorts hiding. Works with ytd and ytm elements. Keeps UI alive.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    console.log('YouTube Filter script started!');
    const STORAGE_KEY = 'blockedKeywords';
    const BACKUP_KEY = 'blockedKeywords_backup';
    const HIDE_SHORTS_KEY = 'hideShorts';
    const CHECK_INTERVAL = 300;
    const HIDDEN_ATTRIBUTE = 'data-yf-hidden';

    let blockedKeywords = [];
    let lowerBlockedKeywords = [];
    let hideShorts = false;
    let uiCreated = false; // track if UI was ever created

    function loadPreferences() {
        try {
            const primary = localStorage.getItem(STORAGE_KEY);
            if (primary) {
                blockedKeywords = JSON.parse(primary);
            }
            if ((!blockedKeywords || blockedKeywords.length === 0) && localStorage.getItem(BACKUP_KEY)) {
                const backup = JSON.parse(localStorage.getItem(BACKUP_KEY));
                if (backup && backup.length > 0) {
                    blockedKeywords = backup;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(blockedKeywords));
                }
            }
            if (!Array.isArray(blockedKeywords)) {
                blockedKeywords = [];
            }
            if (blockedKeywords.length > 0) {
                localStorage.setItem(BACKUP_KEY, JSON.stringify(blockedKeywords));
            }
        } catch (e) {
            blockedKeywords = [];
        }

        try {
            const saved = localStorage.getItem(HIDE_SHORTS_KEY);
            hideShorts = saved === 'true';
        } catch (e) {
            hideShorts = false;
        }

        lowerBlockedKeywords = blockedKeywords.map(kw => kw.toLowerCase());
        console.log('YouTube Filter: Loaded', blockedKeywords.length, 'keywords, hideShorts =', hideShorts);
    }

    function saveKeywords(newKeywords) {
        try {
            if (!Array.isArray(newKeywords)) newKeywords = [];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newKeywords));
            localStorage.setItem(BACKUP_KEY, JSON.stringify(newKeywords));
            blockedKeywords = newKeywords;
            lowerBlockedKeywords = blockedKeywords.map(kw => kw.toLowerCase());
        } catch (e) {
            console.error('Failed to save keywords', e);
        }
    }

    function saveHideShorts(value) {
        try {
            localStorage.setItem(HIDE_SHORTS_KEY, value.toString());
            hideShorts = value;
            console.log('Hide Shorts set to', value);
        } catch (e) {
            console.error('Failed to save hideShorts', e);
        }
    }

    loadPreferences();

    // Hide element but never hide the player
    function hideElement(el) {
        if (!el || el.hasAttribute(HIDDEN_ATTRIBUTE)) return;

        if (el.matches && (
            el.matches('#movie_player, ytd-player, .html5-video-player, ytm-player') ||
            el.closest('#movie_player, ytd-player, .html5-video-player, ytm-player')
        )) {
            return;
        }

        try {
            el.style.setProperty('display', 'none', 'important');
            el.setAttribute(HIDDEN_ATTRIBUTE, 'true');
        } catch (e) { /* ignore */ }
    }

    // Check if an element (or its children) contains blocked text
    function elementContainsBlockedText(el) {
        if (!el) return false;
        if (el.tagName && (el.tagName.includes('YTD-SEARCH') || el.tagName.includes('YTM-SEARCH'))) return false;

        // ========== FIXED: added ytd-attributed-channel-name and yt-text-view-model ==========
        const channelSelectors = [
            'ytd-channel-name', 'ytm-channel-thumbnail-with-link-renderer',
            'ytd-attributed-channel-name', 'yt-text-view-model',
            '[class*="channel"]', 'a[href*="/@"]', '.ytd-channel-name',
            '.YtmBadgeAndBylineRendererItemByline'
        ];
        for (let selector of channelSelectors) {
            const channelEls = el.querySelectorAll(selector);
            for (let channelEl of channelEls) {
                const channelText = (channelEl.textContent || '').toLowerCase();
                const channelAttrs = channelEl.getAttribute('aria-label') || '';
                for (let kw of lowerBlockedKeywords) {
                    if (channelText.includes(kw) || channelAttrs.toLowerCase().includes(kw)) {
                        return true;
                    }
                }
            }
        }

        const titleSelectors = [
            '#video-title', '[id*="title"]', 'h3', 'ytd-video-meta-block',
            '.media-item-headline', '.media-item-metadata h3', '.ytd-video-renderer #video-title',
            '.ytd-rich-item-renderer #video-title', 'ytm-media-item .media-item-headline'
        ];
        for (let selector of titleSelectors) {
            const titleEls = el.querySelectorAll(selector);
            for (let titleEl of titleEls) {
                const titleText = (titleEl.textContent || '').toLowerCase();
                for (let kw of lowerBlockedKeywords) {
                    if (kw.length <= 5) {
                        const regex = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
                        if (regex.test(titleText)) return true;
                    } else {
                        if (titleText.includes(kw)) return true;
                    }
                }
            }
        }

        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) {
            const label = ariaLabel.toLowerCase();
            for (let kw of lowerBlockedKeywords) {
                if (label.includes(kw)) return true;
            }
        }

        return false;
    }

    function getChannelIdFromHref(href) {
        if (!href) return null;
        const match = href.match(/\/@([^\/?#]+)/);
        return match ? match[1].toLowerCase() : null;
    }

    function hideAllShorts() {
        if (!hideShorts) return;

        document.querySelectorAll('ytd-reel-shelf-renderer, ytd-rich-section-renderer, ytd-rich-shelf-renderer, ytm-reel-shelf-renderer').forEach(hideElement);
        document.querySelectorAll('ytd-reel-item-renderer, ytm-reel-item-renderer').forEach(hideElement);
        document.querySelectorAll('a[href*="/shorts/"]').forEach(link => {
            const container = link.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-reel-item-renderer, ytd-compact-video-renderer, ytd-rich-grid-media, ytd-video-meta-block, ytm-media-item, ytm-video-with-context-renderer');
            if (container) hideElement(container);
            else hideElement(link);
        });
        document.querySelectorAll('ytd-badge-supported-renderer, badge-shape, [class*="badge"], [id*="badge"]').forEach(badge => {
            const text = badge.textContent.toLowerCase();
            if (text.includes('shorts') || text.includes('short')) {
                const container = badge.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-reel-item-renderer, ytd-compact-video-renderer, ytd-rich-grid-media, ytm-media-item, ytm-video-with-context-renderer');
                if (container) hideElement(container);
                else hideElement(badge);
            }
        });
        document.querySelectorAll('[href*="/shorts"], [data-is-shorts], [is-shorts], [data-shorts]').forEach(el => {
            const container = el.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-reel-item-renderer, ytd-compact-video-renderer, ytd-rich-grid-media, ytm-media-item, ytm-video-with-context-renderer') || el;
            hideElement(container);
        });
        document.querySelectorAll('a, span, div, yt-formatted-string, ytm-formatted-string').forEach(el => {
            if (el.textContent.trim() === 'Shorts' || el.textContent.trim() === 'SHORTS') {
                const container = el.closest('ytd-rich-section-renderer, ytd-reel-shelf-renderer, ytm-rich-section-renderer, ytm-reel-shelf-renderer');
                if (container) hideElement(container);
            }
        });
    }

    // ========== FIXED: also scan for channel names using the new selectors on search page ==========
    function filterByChannelNameOnly() {
        // First, scan for channel names inside non‑link elements
        const channelContainers = document.querySelectorAll('ytd-attributed-channel-name, yt-text-view-model, ytd-channel-name, [class*="channel"]');
        channelContainers.forEach(container => {
            const channelName = (container.textContent || '').toLowerCase();
            if (lowerBlockedKeywords.some(kw => channelName.includes(kw))) {
                const videoContainer = container.closest(
                    'ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-channel-renderer, ytm-media-item, ytm-video-with-context-renderer'
                );
                if (videoContainer) hideElement(videoContainer);
            }
        });

        // Also check channel links (existing logic)
        const channelLinks = document.querySelectorAll('a[href*="/@"]');
        channelLinks.forEach(link => {
            const channelName = link.textContent.trim();
            const channelId = getChannelIdFromHref(link.href) || '';

            const shouldBlock = lowerBlockedKeywords.some(kw => {
                if (channelName.toLowerCase().includes(kw)) return true;
                const kwNoSpace = kw.replace(/\s+/g, '');
                if (channelId.includes(kwNoSpace)) return true;
                return false;
            });

            if (!shouldBlock) return;

            const container = link.closest(
                'ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-channel-renderer, ytm-media-item, ytm-video-with-context-renderer'
            );
            if (container) hideElement(container);
        });

        hideAllShorts();
    }

    function filterContent() {
        if (window.location.pathname.includes('/results')) {
            filterByChannelNameOnly();
            return;
        }

        try {
            lowerBlockedKeywords = blockedKeywords.map(kw => kw.toLowerCase());
        } catch (e) { return; }

        hideAllShorts();

        const channelLinks = document.querySelectorAll('a[href*="/@"]');
        channelLinks.forEach(link => {
            const channelId = getChannelIdFromHref(link.href);
            if (!channelId) return;
            const shouldBlock = lowerBlockedKeywords.some(kw => channelId.includes(kw));
            if (!shouldBlock) return;
            const container = link.closest(
                'ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ' +
                'ytd-compact-video-renderer, yt-lockup-view-model, ytd-shelf-renderer, ' +
                'ytd-rich-section-renderer, ytd-item-section-renderer, ytd-rich-grid-media, ' +
                'ytd-video-meta-block, ytd-channel-name, ytd-playlist-renderer, ytd-radio-renderer, ' +
                'ytd-promoted-video-renderer, ytd-ad-slot-renderer, ytd-channel-renderer, ' +
                'ytm-media-item, ytm-video-with-context-renderer'
            );
            if (container) hideElement(container);
        });

        const containerSelectors = [
            'ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-grid-video-renderer',
            'ytd-compact-video-renderer', 'ytd-shelf-renderer', 'ytd-ad-slot-renderer',
            'ytd-rich-section-renderer', 'ytd-item-section-renderer', 'ytd-reel-shelf-renderer',
            'ytd-video-with-context-renderer', 'ytd-playlist-renderer', 'ytd-channel-renderer',
            'ytd-rich-shelf-renderer', 'ytd-compact-station-renderer', 'ytd-search-pyv-renderer',
            'ytd-promoted-video-renderer', 'ytd-radio-renderer', 'yt-lockup-view-model',
            'ytd-rich-grid-media', 'ytd-video-meta-block', 'ytd-channel-name',
            'ytd-continuation-item-renderer', 'ytd-browse', 'ytd-two-column-browse-results-renderer',
            'ytd-section-list-renderer', 'ytd-rich-grid-renderer', 'ytd-rich-grid-row',
            'ytm-media-item', 'ytm-video-with-context-renderer', 'ytm-item-section-renderer',
            'ytm-rich-item-renderer'
        ];

        containerSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (elementContainsBlockedText(el)) {
                    hideElement(el);
                }
            });
        });

        const shelfKeywords = ["shorts", "breaking news", "news", "latest from", "watched", "trending", "live now", "recommended", "popular", "top picks"];
        document.querySelectorAll('ytd-rich-shelf-renderer, ytd-shelf-renderer, ytd-reel-shelf-renderer, ytd-rich-section-renderer, ytm-rich-shelf-renderer, ytm-reel-shelf-renderer').forEach(shelf => {
            const title = (shelf.innerText || '').toLowerCase();
            if (shelfKeywords.some(kw => title.includes(kw))) {
                hideElement(shelf);
            }
        });

        const videoIds = document.querySelectorAll('[video-id], [data-video-id]');
        videoIds.forEach(el => {
            const vid = el.getAttribute('video-id') || el.getAttribute('data-video-id') || '';
            if (lowerBlockedKeywords.some(kw => vid.toLowerCase().includes(kw))) {
                const container = el.closest(containerSelectors.join(',')) || el;
                hideElement(container);
            }
        });
    }

    let filterTimer;
    function runFilter() {
        if (filterTimer) clearTimeout(filterTimer);
        filterTimer = setTimeout(filterContent, 100);
    }

    function observeShadowRoots(root) {
        if (!root) return;
        const observer = new MutationObserver(runFilter);
        observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['aria-label', 'title', 'href', 'data-title', 'video-id', 'data-video-id']
        });
        const elementsWithShadow = root.querySelectorAll('*');
        elementsWithShadow.forEach(el => {
            if (el.shadowRoot) {
                observeShadowRoots(el.shadowRoot);
            }
        });
    }

    function startObserving() {
        if (document.body) {
            observeShadowRoots(document.body);
        } else {
            setTimeout(startObserving, 100);
        }
    }

    const bodyObserver = new MutationObserver(mutations => {
        mutations.forEach(mut => {
            mut.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.shadowRoot) {
                        observeShadowRoots(node.shadowRoot);
                    }
                    node.querySelectorAll('*').forEach(el => {
                        if (el.shadowRoot) {
                            observeShadowRoots(el.shadowRoot);
                        }
                    });
                }
            });
        });
        runFilter();
    });

    if (document.body) {
        observeShadowRoots(document.body);
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observeShadowRoots(document.body);
            bodyObserver.observe(document.body, { childList: true, subtree: true });
        });
    }

    setInterval(filterContent, CHECK_INTERVAL);
    window.addEventListener('scroll', () => { runFilter(); }, { passive: true });

    // --- UI Persistence: Watch for button removal and recreate immediately ---
    let removalObserver = null;

    function ensureUI() {
        if (!document.body) return;
        if (!document.getElementById('filter-toggle-btn')) {
            console.log('ensureUI: button missing, recreating UI');
            createUI();
        } else if (removalObserver === null) {
            // Set up observer to watch for button removal
            const btn = document.getElementById('filter-toggle-btn');
            if (btn) {
                removalObserver = new MutationObserver((mutations) => {
                    for (let mut of mutations) {
                        if (mut.removedNodes.length > 0) {
                            // Check if the removed node is the button or its parent
                            for (let node of mut.removedNodes) {
                                if (node.id === 'filter-toggle-btn' || (node.querySelector && node.querySelector('#filter-toggle-btn'))) {
                                    console.log('Button removed, recreating...');
                                    setTimeout(createUI, 0);
                                    break;
                                }
                            }
                        }
                    }
                });
                removalObserver.observe(document.body, { childList: true, subtree: true });
                console.log('Removal observer set up');
            }
        }
    }

    // URL change detection
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(() => {
                filterContent();
                ensureUI();
            }, 500);
        }
    }).observe(document, { subtree: true, childList: true });

    // Also run ensureUI periodically (every 2 seconds) as a fallback
    setInterval(ensureUI, 2000);

    // Initial UI creation and watchdog start
    function initialUI() {
        if (document.body) {
            createUI();
            ensureUI(); // sets up removal observer
        } else {
            setTimeout(initialUI, 100);
        }
    }
    initialUI();

    // Delay filter calls to let YouTube settle
    setTimeout(filterContent, 300);
    setTimeout(filterContent, 1000);
    setTimeout(filterContent, 3000);
    setTimeout(filterContent, 5000);

    // --- UI definition (unchanged except for debug logs) ---
    function createUI() {
        if (document.getElementById('filter-toggle-btn')) {
            console.log('createUI: button already exists, skipping');
            return;
        }
        console.log('createUI: creating button and panel');

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'filter-toggle-btn';
        toggleBtn.textContent = '🎯 Filter';
        toggleBtn.style.cssText = `position:fixed; top:20px; left:20px; z-index:2147483647; padding:10px 15px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold; box-shadow:0 2px 10px rgba(0,0,0,0.3);`;

        const panel = document.createElement('div');
        panel.id = 'universal-filter-list';
        panel.style.cssText = `position:fixed; top:80px; left:20px; width:350px; max-height:550px; overflow-y:auto; background:white; border:2px solid #4CAF50; border-radius:10px; padding:20px; z-index:2147483646; box-shadow:0 8px 25px rgba(0,0,0,0.5); display:none; font-family:Arial, sans-serif; color:#000000;`;

        panel.innerHTML = `
            <div id="filter-title" style="font-weight:bold; font-size:18px; color:#4CAF50; margin-bottom:15px;">YouTube Filter</div>
            <div id="kw-list-box" style="min-height:60px; max-height:150px; overflow-y:auto; border:1px solid #ccc; border-radius:5px; padding:10px; margin-bottom:15px; background:#f9f9f9; color:#000000;"></div>
            <textarea id="kw-input" placeholder="Add keywords (Geo, Dunya, etc.)" style="width:100%; height:60px; margin-bottom:15px; padding:10px; border:1px solid #ccc; border-radius:5px; box-sizing:border-box; color:#000000;"></textarea>

            <div style="display:flex; align-items:center; margin-bottom:15px;">
                <input type="checkbox" id="hide-shorts-checkbox" style="width:18px; height:18px; margin-right:8px;">
                <label for="hide-shorts-checkbox" style="font-size:14px; cursor:pointer; color:#000000;">Hide all Shorts (Aggressive)</label>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:10px;">
                <button id="kw-add-btn" style="padding:10px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">Add</button>
                <button id="kw-clr-btn" style="padding:10px; background:#ff9800; color:white; border:none; border-radius:5px; cursor:pointer;">Clear</button>
                <button id="kw-exp-btn" style="padding:10px; background:#2196F3; color:white; border:none; border-radius:5px; cursor:pointer;">Export</button>
                <button id="kw-imp-btn" style="padding:10px; background:#673AB7; color:white; border:none; border-radius:5px; cursor:pointer;">Import</button>
                <button id="kw-refresh-btn" style="padding:10px; background:#FF5722; color:white; border:none; border-radius:5px; cursor:pointer; grid-column: span 2;">⟳ Force Rescan Now</button>
            </div>
            <button id="kw-close-btn" style="padding:10px; background:#ff4444; color:white; border:none; border-radius:5px; cursor:pointer; width:100%;">Close</button>
        `;

        document.body.appendChild(toggleBtn);
        document.body.appendChild(panel);

        const updateList = () => {
            const box = document.getElementById('kw-list-box');
            document.getElementById('filter-title').textContent = `YouTube Filter - ${blockedKeywords.length} words`;
            box.innerHTML = '';
            blockedKeywords.forEach((kw, i) => {
                const item = document.createElement('div');
                item.style.cssText = `display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee; font-size:14px; color:#000000;`;
                item.innerHTML = `<span>${kw}</span><span style="color:red; cursor:pointer; font-weight:bold; padding: 0 5px;">×</span>`;
                item.querySelector('span:last-child').onclick = () => {
                    blockedKeywords.splice(i, 1);
                    saveKeywords(blockedKeywords);
                    updateList();
                    filterContent();
                };
                box.appendChild(item);
            });
        };

        const shortsCheckbox = panel.querySelector('#hide-shorts-checkbox');
        shortsCheckbox.checked = hideShorts;
        shortsCheckbox.addEventListener('change', (e) => {
            saveHideShorts(e.target.checked);
            filterContent();
        });

        toggleBtn.onclick = () => {
            const isHidden = panel.style.display === 'none';
            panel.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? '🎯 Hide' : '🎯 Filter';
        };

        panel.querySelector('#kw-add-btn').onclick = () => {
            const input = document.getElementById('kw-input');
            const news = input.value.split(/[\n,]+/).map(k => k.trim()).filter(k => k);
            const newKeywords = [...new Set([...blockedKeywords, ...news])];
            saveKeywords(newKeywords);
            updateList();
            input.value = '';
            filterContent();
        };

        panel.querySelector('#kw-clr-btn').onclick = () => {
            if (confirm('Clear all keywords?')) {
                saveKeywords([]);
                updateList();
                filterContent();
            }
        };

        panel.querySelector('#kw-exp-btn').onclick = () => {
            const blob = new Blob([JSON.stringify(blockedKeywords, null, 2)], {type: "application/json"});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `yt_filter_backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
        };

        panel.querySelector('#kw-imp-btn').onclick = () => {
            const fileIn = document.createElement('input');
            fileIn.type = 'file';
            fileIn.accept = '.json';
            fileIn.onchange = e => {
                const reader = new FileReader();
                reader.onload = r => {
                    try {
                        const imported = JSON.parse(r.target.result);
                        if (Array.isArray(imported)) {
                            saveKeywords(imported);
                            updateList();
                            filterContent();
                            alert(`Successfully imported ${imported.length} keywords!`);
                        } else {
                            alert('Invalid file format - must be a JSON array');
                        }
                    } catch (err) {
                        alert('Error parsing file: ' + err.message);
                    }
                };
                reader.readAsText(e.target.files[0]);
            };
            fileIn.click();
        };

        panel.querySelector('#kw-refresh-btn').onclick = () => {
            filterContent();
            alert('Manual rescan completed!');
        };

        panel.querySelector('#kw-close-btn').onclick = () => {
            panel.style.display = 'none';
            toggleBtn.textContent = '🎯 Filter';
        };

        updateList();
    }
})();
