// kitchen.js — kitchen list with catalog chips, autocomplete, check/clear

let _kitchenSearch = '';        // (legacy, no longer used in render — kept for safety)
let _kitchenChipFilter = '';    // live filter for My Foods chips (typed in any input bar)
let _kitchenCatModalCallback = null;
let _receiptPromptDismissed = false;  // resets when items get added (new trip)
let _parsedReceipts = [];             // unimported parsed receipts
let _parsedReceiptsFetched = false;   // first fetch flag
let _activeReceiptImport = null;      // { filename, header, rows }

function renderGroceryQuick() {
    var el = document.getElementById('kitchen-quick');
    if (el) el.innerHTML = '';
}

function renderGroceryList() {
    const el = document.getElementById('kitchen-list-area');
    const tabEl = document.getElementById('kitchen-tab-area');
    if (el) el.innerHTML = '';
    if (!tabEl) return;
    renderGroceryInto(tabEl);
}

function renderGroceryInto(el) {
    if (!el) return;

    // Kick a parsed-receipts refresh once per dashboard load. Re-renders when results arrive.
    if (!_parsedReceiptsFetched) {
        _parsedReceiptsFetched = true;
        fetchParsedReceipts();
    }

    const items = D.kitchen_list || [];
    const known = D.kitchen_known_items || {};
    const counts = D.kitchen_purchase_counts || {};

    const unchecked = items.filter(i => !i.checked);
    const checked = items.filter(i => !!i.checked);
    const onList = new Set(items.map(i => i.name.toLowerCase()));

    // Category config
    const categoryOrder = D.kitchen_category_order || ['vegetables', 'produce', 'fruit', 'grains', 'drinks', 'snacks', 'dessert', 'other', 'dairy', 'protein', 'pharmacy', 'supplements'];
    const categoryLabels = {
        produce: 'Produce', vegetables: 'Vegetables', fruit: 'Fruit',
        protein: 'Protein', dairy: 'Dairy', grains: 'Grains',
        drinks: 'Drinks', snacks: 'Snacks', dessert: 'Dessert', other: 'Other',
        pharmacy: 'Pharmacy', supplements: 'Supplements'
    };

    let html = '<div style="margin-bottom:20px">';

    // --- Grocery List (always open, no search — search lives in My Foods below) ---
    const listCount = unchecked.length + checked.length;

    // Post-shop receipt banner: show when ALL items are checked AND not dismissed for this trip
    const allChecked = unchecked.length === 0 && checked.length > 0;
    const showReceiptBanner = allChecked && !_receiptPromptDismissed;
    const receiptBanner = showReceiptBanner
        ? `<div style="background:rgba(58,158,140,0.10);border:1px solid rgba(58,158,140,0.3);border-radius:8px;padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:14px;flex:1">Done shopping? Scan your receipt to log this trip.</span>
            <label style="cursor:pointer;padding:6px 14px;border-radius:6px;background:var(--green);color:#fff;font-size:12px;font-weight:600">📷 Scan receipt
                <input type="file" accept="image/*,.heic,.heif,.pdf" style="display:none" onchange="uploadKitchenReceipt(this.files[0])">
            </label>
            <button onclick="dismissReceiptPrompt()" style="font-size:11px;color:var(--text-muted);background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer">Dismiss</button>
        </div>`
        : '';

    html += `<div class="kitchen-section" style="margin-bottom:20px">
        ${receiptBanner}
        ${renderParsedReceiptsBanner()}
        ${renderSpendTrendCard()}
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;flex-wrap:wrap">
            <span style="font-size:18px;font-weight:700">Grocery List</span>
            ${listCount ? `<span style="font-size:13px;font-weight:400;color:var(--text-muted)">(${unchecked.length} items)</span>` : ''}
            <label style="cursor:pointer;font-size:11px;color:var(--ongoing);background:none;border:1px solid var(--ongoing);border-radius:6px;padding:2px 8px;margin-left:auto">📷 Scan receipt
                <input type="file" accept="image/*,.heic,.heif,.pdf" style="display:none" onchange="uploadKitchenReceipt(this.files[0])">
            </label>
            <button onclick="openCategoryOrder()" style="font-size:11px;color:var(--text-muted);background:none;border:1px solid var(--border);border-radius:6px;padding:2px 8px;cursor:pointer">Reorder</button>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:8px">
            ${unchecked.length ? `<button onclick="checkAllGroceries()" style="font-size:12px;color:var(--text-muted);background:none;border:1px solid var(--border);border-radius:6px;padding:3px 10px;cursor:pointer">Mark all purchased</button>` : ''}
            ${checked.length ? `<button onclick="clearGroceryChecked()" style="font-size:12px;color:var(--text-muted);background:none;border:1px solid var(--border);border-radius:6px;padding:3px 10px;cursor:pointer">Clear checked</button>` : ''}
        </div>`;

    // Active list
    if (unchecked.length || checked.length) {
        html += '<div style="background:var(--card-bg);border-radius:10px;padding:16px 20px;box-shadow:0 1px 3px rgba(0,0,0,0.06);margin-bottom:16px">';

        // Aisle-aware grouping. Each "slot" is a label in the rendered list.
        // Items without an aisle are bucketed by category. Items with an aisle
        // are bucketed under "Aisle N" labels, which collectively fall in the
        // category_order position of the "@aisles" sentinel.
        const aislesMap = D.kitchen_aisles || {};
        const aislesIdx = categoryOrder.indexOf('@aisles');
        // groups: slotKey -> { label, sortIdx, aisleNum, items: [] }
        const groups = {};
        unchecked.forEach(item => {
            const cat = (item.category || 'other').toLowerCase();
            const aisle = aislesMap[item.name.toLowerCase()];
            if (aisle != null && aislesIdx >= 0) {
                const key = `@aisle_${aisle}`;
                if (!groups[key]) groups[key] = { label: `Aisle ${aisle}`, sortIdx: aislesIdx, aisleNum: aisle, items: [] };
                groups[key].items.push(item);
            } else {
                const key = `cat_${cat}`;
                if (!groups[key]) {
                    const idx = categoryOrder.indexOf(cat);
                    groups[key] = { label: categoryLabels[cat] || cat, sortIdx: idx === -1 ? 9999 : idx, aisleNum: 0, items: [] };
                }
                groups[key].items.push(item);
            }
        });
        const orderedGroups = Object.values(groups).sort((a, b) =>
            (a.sortIdx - b.sortIdx) || (a.aisleNum - b.aisleNum) || a.label.localeCompare(b.label)
        );
        orderedGroups.forEach((g, gi) => {
            html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);padding:8px 0 2px;${gi > 0 ? 'border-top:1px solid var(--border);margin-top:4px' : ''}">${esc(g.label)}</div>`;
            g.items.forEach(item => {
                const aisle = aislesMap[item.name.toLowerCase()];
                const aisleBadge = aisle != null
                    ? `<span class="aisle-badge" data-name="${esc(item.name)}" onclick="event.stopPropagation();editGroceryAisle('${esc(item.name)}', this)" title="Tap to change location" style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;background:rgba(124,92,191,0.18);color:var(--accent);cursor:pointer;margin-right:6px">A${aisle}</span>`
                    : `<span class="aisle-badge" data-name="${esc(item.name)}" onclick="event.stopPropagation();editGroceryAisle('${esc(item.name)}', this)" title="Tap to set location (section or aisle #)" style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;background:transparent;color:var(--text-muted);border:1px dashed var(--border);cursor:pointer;margin-right:6px;opacity:0.55">📍</span>`;
                html += `<div class="card-item">
                    <span class="habit-check" onclick="toggleGrocery('${esc(item.name)}')" style="cursor:pointer">&#9675;</span>
                    <span class="item-text">${esc(item.name)}</span>
                    ${aisleBadge}
                    <button class="delete-btn" onclick="removeGrocery('${esc(item.name)}')" title="Remove">&times;</button>
                </div>`;
            });
        });

        // Checked items
        if (checked.length) {
            html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);padding:8px 0 2px;border-top:1px solid var(--border);margin-top:4px">Got it</div>`;
            checked.forEach(item => {
                html += `<div class="card-item" style="opacity:0.4">
                    <span class="habit-check done" onclick="toggleGrocery('${esc(item.name)}')" style="cursor:pointer">&#10003;</span>
                    <span class="item-text" style="text-decoration:line-through">${esc(item.name)}</span>
                    <button class="delete-btn" onclick="removeGrocery('${esc(item.name)}')" title="Remove">&times;</button>
                </div>`;
            });
        }

        html += '</div>';
    } else {
        html += '<div style="color:var(--text-muted);font-size:14px;margin-bottom:16px">No items on your list yet — type in My Foods below to add.</div>';
    }
    html += '</div>';

    // --- My Foods (search/filter chips + add new) ---
    const rawFilter = _kitchenChipFilter || '';                    // what the user typed (preserved for the input value)
    const chipFilter = rawFilter.toLowerCase().trim();             // normalized for matching
    function renderMyFoodsBar(suffix) {
        return `<div style="display:flex;gap:6px;margin:8px 0">
            <input type="text" id="kitchen-input-${suffix}" value="${esc(rawFilter)}" placeholder="Search or add new item..."
                style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px;background:var(--bg);color:var(--text)"
                oninput="kitchenChipFilterInput(this.value,'${suffix}')" onkeydown="kitchenMyFoodsKeydown(event,'${suffix}')" autocomplete="off">
            ${chipFilter ? `<button onclick="addGrocery('${suffix}')" style="padding:8px 14px;border:none;border-radius:6px;background:var(--text);color:var(--bg);font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap">+ Add</button>` : ''}
            ${chipFilter ? `<button onclick="kitchenChipFilterClear()" title="Clear" style="padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:none;color:var(--text-muted);font-size:13px;cursor:pointer">&times;</button>` : ''}
        </div>`;
    }

    // My Foods sort mode (persisted)
    const sortMode = localStorage.getItem('kitchen_my_foods_sort') || 'frequency';
    const sortBtn = (mode, label) => {
        const active = mode === sortMode;
        return `<button onclick="setMyFoodsSort('${mode}')" style="padding:3px 9px;border-radius:6px;border:1px solid ${active ? 'var(--accent)' : 'var(--border)'};background:${active ? 'rgba(124,92,191,0.12)' : 'none'};color:${active ? 'var(--accent)' : 'var(--text-muted)'};font-size:11px;font-weight:${active ? '700' : '500'};cursor:pointer">${esc(label)}</button>`;
    };

    html += `<details open class="kitchen-section">
        <summary style="font-size:16px;font-weight:700;cursor:pointer;padding:8px 0;list-style:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-size:12px;transition:transform 0.15s;display:inline-block" class="kitchen-arrow">&#9654;</span>
            <span>My Foods</span>
            <span style="display:inline-flex;gap:4px;margin-left:auto;font-weight:400" onclick="event.stopPropagation()">
                ${sortBtn('frequency', 'Freq')}
                ${sortBtn('alpha', 'A–Z')}
                ${sortBtn('both', 'Both')}
            </span>
        </summary>`;

    html += renderMyFoodsBar('top');

    // Catalog — known items as tappable chips.
    // Sort priority when filtering: name-prefix-match → word-prefix → substring; then by count desc, then alpha.
    // When no filter: sort by count desc, then alpha (legacy behavior).
    function _prefixRank(name, q) {
        if (!q) return 0;
        const n = name.toLowerCase();
        if (n.startsWith(q)) return 0;
        if (n.split(/[\s-]+/).some(w => w.startsWith(q))) return 1;
        if (n.includes(q)) return 2;
        return 3;  // shouldn't happen since we filter on substring; safety
    }
    const matchesFilter = (name) => !chipFilter || name.toLowerCase().includes(chipFilter);
    const catalogItems = Object.entries(known)
        .map(([name, cat]) => ({ name, cat, count: counts[name] || 0 }))
        .filter(i => matchesFilter(i.name))
        .sort((a, b) => {
            if (chipFilter) {
                const r = _prefixRank(a.name, chipFilter) - _prefixRank(b.name, chipFilter);
                if (r !== 0) return r;
            }
            if (b.count !== a.count) return b.count - a.count;
            return a.name.localeCompare(b.name);
        });

    if (catalogItems.length) {
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-size:14px;font-weight:700">${chipFilter ? `Matches for "${esc(chipFilter)}"` : 'Quick add from favorites'}</div>
            <button onclick="openCatalogEditor()" style="font-size:11px;color:var(--text-muted);background:none;border:1px solid var(--border);border-radius:6px;padding:3px 10px;cursor:pointer">Edit</button>
        </div>`;

        if (sortMode === 'alpha') {
            // Flat alphabetical — no Most bought, no category subgroups
            const alphaItems = catalogItems.slice().sort((a, b) => a.name.localeCompare(b.name));
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
            alphaItems.forEach(item => { html += renderCatalogChip(item, onList); });
            html += '</div>';
        } else if (sortMode === 'both') {
            // Top-N by frequency, then alphabetical rest
            const TOP_N = 10;
            const byFreq = catalogItems.slice().sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
            const topFreq = byFreq.filter(i => i.count > 0).slice(0, TOP_N);
            const topSet = new Set(topFreq.map(i => i.name));
            const restAlpha = catalogItems.filter(i => !topSet.has(i.name)).sort((a, b) => a.name.localeCompare(b.name));
            if (topFreq.length) {
                html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:6px">Most bought</div>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
                topFreq.forEach(item => { html += renderCatalogChip(item, onList); });
                html += '</div>';
            }
            if (restAlpha.length) {
                html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:6px">Everything else (A–Z)</div>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">';
                restAlpha.forEach(item => { html += renderCatalogChip(item, onList); });
                html += '</div>';
            }
        } else {
            // 'frequency' — legacy behavior: Most bought + category subgroups
            const catGroups = {};
            const frequent = catalogItems.filter(i => i.count > 0);
            const rest = catalogItems.filter(i => i.count === 0);

            if (frequent.length) {
                html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:6px">Most bought</div>';
                html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
                frequent.forEach(item => { html += renderCatalogChip(item, onList); });
                html += '</div>';
            }

            rest.forEach(item => {
                if (!catGroups[item.cat]) catGroups[item.cat] = [];
                catGroups[item.cat].push(item);
            });

            const catsWithItems = categoryOrder.filter(c => catGroups[c]);
            Object.keys(catGroups).forEach(c => { if (!catsWithItems.includes(c)) catsWithItems.push(c); });

            if (catsWithItems.length) {
                const allItemsOpen = chipFilter ? ' open' : '';
                html += `<details${allItemsOpen} style="margin-top:4px"><summary style="font-size:12px;font-weight:600;cursor:pointer;color:var(--text-muted)">All items by category</summary><div style="margin-top:8px">`;
                catsWithItems.forEach(cat => {
                    html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin:8px 0 4px">${categoryLabels[cat] || cat}</div>`;
                    html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">';
                    catGroups[cat].forEach(item => { html += renderCatalogChip(item, onList); });
                    html += '</div>';
                });
                html += '</div></details>';
            }
        }

    } else if (chipFilter) {
        html += `<div style="color:var(--text-muted);font-size:13px;font-style:italic;padding:8px 0">No matches for "${esc(chipFilter)}". Tap + Add to create a new item.</div>`;
    }
    html += renderMyFoodsBar('bottom');
    html += '</details>';

    // --- Pantry (collapsed by default) ---
    const pantry = D.kitchen_pantry || {};
    const pantryItems = Object.entries(pantry)
        .map(([name, data]) => ({ name, added: data.added, cat: (known[name] || 'other') }))
        .sort((a, b) => a.name.localeCompare(b.name));

    html += `<details class="kitchen-section">
        <summary style="font-size:16px;font-weight:700;cursor:pointer;padding:8px 0;list-style:none;display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;transition:transform 0.15s;display:inline-block" class="kitchen-arrow">&#9654;</span>
            Pantry <span style="font-size:13px;font-weight:400;color:var(--text-muted)">(${pantryItems.length} items)</span>
        </summary>`;

    if (pantryItems.length) {
        // Group by category
        const pantryGroups = {};
        pantryItems.forEach(item => {
            if (!pantryGroups[item.cat]) pantryGroups[item.cat] = [];
            pantryGroups[item.cat].push(item);
        });

        const pantryRenderedCats = new Set();
        categoryOrder.forEach(cat => {
            if (!pantryGroups[cat]) return;
            pantryRenderedCats.add(cat);
            html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin:8px 0 4px">${categoryLabels[cat] || cat}</div>`;
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">';
            pantryGroups[cat].forEach(item => {
                const label = item.name.charAt(0).toUpperCase() + item.name.slice(1);
                const daysAgo = Math.round((new Date() - new Date(item.added + 'T12:00:00')) / 86400000);
                const dateLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? '1d ago' : daysAgo + 'd ago';
                html += `<button onclick="pantryNeedItem('${esc(item.name)}')"
                    oncontextmenu="event.preventDefault();openItemNote('${esc(item.name)}')" ontouchstart="startLongPress('${esc(item.name)}',event)" ontouchend="cancelLongPress()" ontouchmove="cancelLongPress()"
                    style="padding:6px 12px;border-radius:16px;border:1px solid rgba(58,158,140,0.3);font-size:13px;cursor:pointer;background:rgba(58,158,140,0.1);color:var(--green);transition:all 0.12s"
                    title="Added ${dateLabel} — tap to move to kitchen list">${esc(label)} <span style="font-size:10px;opacity:0.6">${dateLabel}</span></button>`;
            });
            html += '</div>';
        });
        // Any uncategorized
        Object.keys(pantryGroups).forEach(cat => {
            if (pantryRenderedCats.has(cat)) return;
            html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin:8px 0 4px">${categoryLabels[cat] || cat}</div>`;
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">';
            pantryGroups[cat].forEach(item => {
                const label = item.name.charAt(0).toUpperCase() + item.name.slice(1);
                const daysAgo = Math.round((new Date() - new Date(item.added + 'T12:00:00')) / 86400000);
                const dateLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? '1d ago' : daysAgo + 'd ago';
                html += `<button onclick="pantryNeedItem('${esc(item.name)}')"
                    oncontextmenu="event.preventDefault();openItemNote('${esc(item.name)}')" ontouchstart="startLongPress('${esc(item.name)}',event)" ontouchend="cancelLongPress()" ontouchmove="cancelLongPress()"
                    style="padding:6px 12px;border-radius:16px;border:1px solid rgba(58,158,140,0.3);font-size:13px;cursor:pointer;background:rgba(58,158,140,0.1);color:var(--green);transition:all 0.12s"
                    title="Added ${dateLabel} — tap to move to kitchen list">${esc(label)} <span style="font-size:10px;opacity:0.6">${dateLabel}</span></button>`;
            });
            html += '</div>';
        });
    } else {
        html += '<div style="color:var(--text-muted);font-size:13px">Items will appear here after you complete a kitchen trip.</div>';
    }

    html += '</details>';

    // --- Meal Notes (collapsed by default) ---
    const mealNotes = D.meal_notes || [];

    html += `<details class="kitchen-section">
        <summary style="font-size:16px;font-weight:700;cursor:pointer;padding:8px 0;list-style:none;display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;transition:transform 0.15s;display:inline-block" class="kitchen-arrow">&#9654;</span>
            Meal Notes${mealNotes.length ? ` <span style="font-size:13px;font-weight:400;color:var(--text-muted)">(${mealNotes.length})</span>` : ''}
        </summary>
        <div style="display:flex;gap:8px;margin-bottom:12px">
            <textarea id="meal-note-input" placeholder="Meal idea, recipe note, what you liked/disliked..."
                style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);font-family:inherit;resize:vertical;min-height:60px"
                onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();addMealNote()}"></textarea>
            <button onclick="addMealNote()" style="padding:8px 16px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer;align-self:flex-end">Save</button>
        </div>`;

    // Show last 3, rest collapsed
    const showNotes = mealNotes.slice(0, 3);
    const moreNotes = mealNotes.slice(3);

    if (showNotes.length) {
        showNotes.forEach((note, i) => {
            const d = new Date(note.date + 'T12:00:00');
            const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            html += `<div style="background:var(--card-bg);border-radius:8px;padding:12px 16px;margin-bottom:8px;border-left:3px solid var(--accent)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span style="font-size:11px;color:var(--text-muted)">${dateLabel}</span>
                    <button onclick="deleteMealNote(${i})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;opacity:0.5" title="Delete">&times;</button>
                </div>
                <div style="font-size:14px;color:var(--text);white-space:pre-wrap;line-height:1.5">${esc(note.text)}</div>
            </div>`;
        });
    }

    if (moreNotes.length) {
        html += `<details><summary style="font-size:12px;font-weight:600;cursor:pointer;color:var(--text-muted)">${moreNotes.length} older notes</summary><div style="margin-top:8px">`;
        moreNotes.forEach((note, i) => {
            const d = new Date(note.date + 'T12:00:00');
            const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            html += `<div style="background:var(--card-bg);border-radius:8px;padding:12px 16px;margin-bottom:8px;border-left:3px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span style="font-size:11px;color:var(--text-muted)">${dateLabel}</span>
                    <button onclick="deleteMealNote(${i + 3})" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;opacity:0.5" title="Delete">&times;</button>
                </div>
                <div style="font-size:14px;color:var(--text);white-space:pre-wrap;line-height:1.5">${esc(note.text)}</div>
            </div>`;
        });
        html += '</div></details>';
    }

    if (!mealNotes.length) {
        html += '<div style="color:var(--text-muted);font-size:13px">Jot down meal ideas, recipe notes, or what you liked about a meal.</div>';
    }

    html += '</details>';

    html += '</div>';
    el.innerHTML = html;

    // Rotate arrows on open/close
    el.querySelectorAll('details.kitchen-section').forEach(d => {
        const arrow = d.querySelector('.kitchen-arrow');
        if (arrow) arrow.style.transform = d.open ? 'rotate(90deg)' : 'rotate(0deg)';
        d.addEventListener('toggle', () => {
            if (arrow) arrow.style.transform = d.open ? 'rotate(90deg)' : 'rotate(0deg)';
        });
    });
}

async function addMealNote() {
    const input = document.getElementById('meal-note-input');
    const text = input.value.trim();
    if (!text) return;
    await fetch('/api/kitchen/meal-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
    input.value = '';
    loadDashboard();
}

async function deleteMealNote(index) {
    await fetch('/api/kitchen/meal-notes/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index })
    });
    loadDashboard();
}

async function pantryNeedItem(name) {
    await fetch('/api/kitchen/pantry/need', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.charAt(0).toUpperCase() + name.slice(1) })
    });
    loadDashboard();
}

// Batch selection for catalog chips
let _kitchenPending = new Map();      // name -> {category, btn} — items pending ADD
let _kitchenPendingRemove = new Set(); // names pending REMOVE (active chips tapped)
let _catalogEditMode = false;

function renderCatalogChip(item, onList) {
    const active = onList.has(item.name);
    const label = item.name.charAt(0).toUpperCase() + item.name.slice(1);
    const notes = D.kitchen_item_notes || {};
    const hasNote = !!notes[item.name];
    const dot = hasNote ? '<span style="width:5px;height:5px;border-radius:50%;background:var(--orange);display:inline-block;margin-left:2px;vertical-align:top"></span>' : '';

    if (active) {
        const pendingRemove = _kitchenPendingRemove.has(item.name);
        const style = pendingRemove
            ? 'padding:6px 12px;border-radius:16px;border:1px solid #d65b9a;font-size:13px;background:rgba(232,91,154,0.22);color:#a82a64;cursor:pointer;transition:all 0.12s;'
            : 'padding:6px 12px;border-radius:16px;border:1px solid rgba(124,92,191,0.3);font-size:13px;background:rgba(124,92,191,0.2);color:var(--accent);opacity:0.85;cursor:pointer;transition:all 0.12s;';
        const prefix = pendingRemove ? '✕ ' : '✓ ';
        const tip = pendingRemove ? 'Tap again to undo removal' : 'On list — tap to mark for removal';
        return `<button onclick="toggleCatalogItem('${esc(item.name)}','${esc(item.cat)}',this)"
            oncontextmenu="event.preventDefault();openItemNote('${esc(item.name)}')" ontouchstart="startLongPress('${esc(item.name)}',event)" ontouchend="cancelLongPress()" ontouchmove="cancelLongPress()"
            style="${style}"
            title="${tip}">${prefix}${esc(label)}${dot}</button>`;
    }

    return `<button onclick="toggleCatalogItem('${esc(item.name)}','${esc(item.cat)}',this)"
        oncontextmenu="event.preventDefault();openItemNote('${esc(item.name)}')" ontouchstart="startLongPress('${esc(item.name)}',event)" ontouchend="cancelLongPress()" ontouchmove="cancelLongPress()"
        style="padding:6px 12px;border-radius:16px;border:1px solid;font-size:13px;cursor:pointer;background:var(--card-bg);color:var(--text-secondary);border-color:var(--border);transition:all 0.12s"
        title="${item.count ? item.count + ' times' : ''}">${esc(label)}${dot}</button>`;
}

// --- Long-press for item notes ---
let _longPressTimer = null;
function startLongPress(name, e) {
    _longPressTimer = setTimeout(() => {
        _longPressTimer = null;
        openItemNote(name);
    }, 500);
}
function cancelLongPress() {
    if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null; }
}

function openItemNote(name) {
    const notes = D.kitchen_item_notes || {};
    const note = notes[name] || '';
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const known = D.kitchen_known_items || {};
    const cat = known[name] || 'other';

    let overlay = document.getElementById('item-note-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'item-note-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlay.onclick = (e) => { if (e.target === overlay) closeItemNote(); };

    overlay.innerHTML = `<div style="background:var(--card-bg);border-radius:12px;padding:20px;max-width:400px;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.3)">
        <div style="font-size:16px;font-weight:700;margin-bottom:12px;color:var(--text)">${esc(label)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">Category: ${esc(cat)}</div>
        <textarea id="item-note-text" placeholder="Notes — reactions, inflammation, where to buy, etc."
            style="width:100%;min-height:100px;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);resize:vertical;font-family:inherit;line-height:1.5">${esc(note)}</textarea>
        <div style="display:flex;gap:8px;margin-top:12px">
            <button onclick="saveItemNote('${esc(name)}')" style="flex:1;padding:8px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Save</button>
            <button onclick="closeItemNote()" style="flex:1;padding:8px;border:none;border-radius:8px;background:var(--border);color:var(--text-muted);font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
        </div>
    </div>`;
}

async function saveItemNote(name) {
    const text = document.getElementById('item-note-text').value.trim();
    await fetch('/api/kitchen/catalog/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, note: text })
    });
    if (!D.kitchen_item_notes) D.kitchen_item_notes = {};
    if (text) D.kitchen_item_notes[name] = text;
    else delete D.kitchen_item_notes[name];
    closeItemNote();
    // Re-render to show/hide note dots
    const tabEl = document.getElementById('kitchen-tab-area');
    if (tabEl) {
        const detailsOpen = tabEl.querySelector('details')?.open;
        renderGroceryInto(tabEl);
        if (detailsOpen) { const d = tabEl.querySelector('details'); if (d) d.open = true; }
    }
}

function closeItemNote() {
    const overlay = document.getElementById('item-note-overlay');
    if (overlay) overlay.style.display = 'none';
}

// --- Catalog edit modal ---
function openCatalogEditor() {
    const known = D.kitchen_known_items || {};
    const counts = D.kitchen_purchase_counts || {};
    const notes = D.kitchen_item_notes || {};
    // Use the live category_order (minus the @aisles sentinel) so any user-added category shows up.
    const categoryOrder = (D.kitchen_category_order || ['vegetables', 'produce', 'fruit', 'grains', 'drinks', 'snacks', 'dessert', 'other', 'dairy', 'protein', 'pharmacy', 'supplements']).filter(c => c !== '@aisles');
    const categoryLabels = {
        produce: 'Produce', vegetables: 'Vegetables', fruit: 'Fruit',
        protein: 'Protein', dairy: 'Dairy', grains: 'Grains',
        drinks: 'Drinks', snacks: 'Snacks', dessert: 'Dessert', other: 'Other',
        pharmacy: 'Pharmacy', supplements: 'Supplements'
    };
    const catOptions = categoryOrder.map(c => `<option value="${c}">${categoryLabels[c] || c}</option>`).join('');

    const items = Object.entries(known).sort((a, b) => a[0].localeCompare(b[0]));

    let rows = items.map(([name, cat]) => {
        const label = name.charAt(0).toUpperCase() + name.slice(1);
        return `<div style="display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid var(--border)">
            <input type="text" value="${esc(label)}" data-orig="${esc(name)}" class="catalog-rename-input" style="flex:2;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg);color:var(--text)"
                onkeydown="if(event.key==='Enter'){event.preventDefault();this.nextElementSibling.click()}">
            <button onclick="renameCatalogItemFromInput(this)" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;color:var(--text-muted)" title="Save rename">✓</button>
            <select onchange="updateCatalogCat('${esc(name)}',this.value)" style="flex:1;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text)">
                ${categoryOrder.map(c => `<option value="${c}" ${c === cat ? 'selected' : ''}>${categoryLabels[c] || c}</option>`).join('')}
            </select>
            <button onclick="removeCatalogItem('${esc(name)}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;line-height:1" title="Delete">&times;</button>
        </div>`;
    }).join('');

    let overlay = document.getElementById('catalog-edit-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'catalog-edit-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlay.onclick = (e) => { if (e.target === overlay) closeCatalogEditor(); };

    overlay.innerHTML = `<div style="background:var(--card-bg);border-radius:12px;padding:20px;max-width:500px;width:100%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,0.3)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:16px;font-weight:700;color:var(--text)">Edit Catalog</div>
            <button onclick="closeCatalogEditor()" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer">&times;</button>
        </div>
        <div style="margin-bottom:12px"><button onclick="openCategoriesEditor()" style="font-size:11px;color:var(--accent);background:none;border:1px solid rgba(124,92,191,0.4);border-radius:6px;padding:3px 10px;cursor:pointer">⚙ Manage categories</button></div>
        <div style="flex:1;overflow-y:auto;min-height:0">
            ${rows}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
            <input type="text" id="catalog-new-name" placeholder="New item..." style="flex:2;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg);color:var(--text)" onkeydown="if(event.key==='Enter')addCatalogItem()">
            <select id="catalog-new-cat" style="flex:1;padding:6px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text)">${catOptions}</select>
            <button onclick="addCatalogItem()" style="padding:6px 14px;border:none;border-radius:6px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Add</button>
        </div>
    </div>`;
}

// --- Categories editor (rename/delete categories themselves) ---
function openCategoriesEditor() {
    const order = (D.kitchen_category_order || []).slice();
    const known = D.kitchen_known_items || {};
    const itemsByCat = {};
    Object.entries(known).forEach(([n, c]) => {
        if (!itemsByCat[c]) itemsByCat[c] = [];
        itemsByCat[c].push(n);
    });

    let overlay = document.getElementById('categories-edit-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'categories-edit-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(20,20,30,0.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlay.onclick = (e) => { if (e.target === overlay) closeCategoriesEditor(); };

    const rows = order.map(cat => {
        if (cat === '@aisles') {
            return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);background:rgba(124,92,191,0.08)">
                <span style="flex:1;font-size:13px;font-style:italic;color:var(--text-muted)">Aisles (1, 2, 3…) <span style="font-size:10px">— sentinel, can't edit</span></span>
            </div>`;
        }
        const count = (itemsByCat[cat] || []).length;
        return `<div style="display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid var(--border)">
            <input type="text" value="${esc(cat)}" data-cat="${esc(cat)}" class="cat-rename-input" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg);color:var(--text)">
            <span style="font-size:11px;color:var(--text-muted);min-width:50px;text-align:right">${count} item${count === 1 ? '' : 's'}</span>
            <button onclick="renameCategoryFromEditor('${esc(cat)}', this)" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;color:var(--text-muted)" title="Save rename">✓</button>
            <button onclick="deleteCategoryFromEditor('${esc(cat)}', ${count})" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;line-height:1" title="Delete category">&times;</button>
        </div>`;
    }).join('');

    overlay.innerHTML = `<div style="background:var(--card-bg);border-radius:12px;padding:20px;max-width:480px;width:100%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,0.4);border:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:16px;font-weight:700;color:var(--text)">Manage Categories</div>
            <button onclick="closeCategoriesEditor()" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer">&times;</button>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Edit name in the field then ✓ to rename. × deletes (items reassign to "other"). Use Reorder for ordering.</div>
        <div style="flex:1;overflow-y:auto;min-height:0">${rows}</div>
        <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
            <input type="text" id="cat-add-name" placeholder="New category…" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg);color:var(--text)" onkeydown="if(event.key==='Enter')addCategoryFromEditor()">
            <button onclick="addCategoryFromEditor()" style="padding:6px 14px;border:none;border-radius:6px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Add</button>
        </div>
    </div>`;
}

function closeCategoriesEditor() {
    const overlay = document.getElementById('categories-edit-overlay');
    if (overlay) overlay.style.display = 'none';
}

async function renameCategoryFromEditor(oldName, btn) {
    const input = btn.parentElement.querySelector('.cat-rename-input');
    const newName = (input.value || '').trim().toLowerCase();
    if (!newName || newName === oldName.toLowerCase()) { input.value = oldName; return; }
    try {
        const res = await fetch('/api/kitchen/category/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old: oldName, new: newName })
        });
        const data = await res.json();
        if (data.error) { alert(data.error); input.value = oldName; return; }
    } catch (e) {
        alert('Rename failed: ' + e.message);
        input.value = oldName;
        return;
    }
    await loadDashboard();
    openCategoriesEditor();  // re-render
}

async function deleteCategoryFromEditor(name, count) {
    const reassign = count > 0
        ? (prompt(`Delete "${name}" — ${count} item${count === 1 ? '' : 's'} will move to which category?`, 'other') || '').trim().toLowerCase()
        : 'other';
    if (count > 0 && !reassign) return;
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
        const res = await fetch('/api/kitchen/category/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, reassign_to: reassign })
        });
        const data = await res.json();
        if (data.error) { alert(data.error); return; }
    } catch (e) {
        alert('Delete failed: ' + e.message);
        return;
    }
    await loadDashboard();
    openCategoriesEditor();
}

async function addCategoryFromEditor() {
    const input = document.getElementById('cat-add-name');
    const name = (input.value || '').trim().toLowerCase();
    if (!name) return;
    if (name === '@aisles') { alert('@aisles is reserved'); return; }
    const order = (D.kitchen_category_order || []).slice();
    if (!order.includes(name)) {
        const aislesAt = order.indexOf('@aisles');
        if (aislesAt >= 0) order.splice(aislesAt, 0, name);
        else order.push(name);
        try {
            await fetch('/api/kitchen/category-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order })
            });
            D.kitchen_category_order = order;
        } catch (e) {
            alert('Failed to add: ' + e.message);
            return;
        }
    }
    input.value = '';
    await loadDashboard();
    openCategoriesEditor();
}

function closeCatalogEditor() {
    const overlay = document.getElementById('catalog-edit-overlay');
    if (overlay) overlay.style.display = 'none';
}

async function addCatalogItem() {
    const nameEl = document.getElementById('catalog-new-name');
    const catEl = document.getElementById('catalog-new-cat');
    const name = nameEl.value.trim();
    if (!name) return;
    await fetch('/api/kitchen/catalog/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category: catEl.value })
    });
    nameEl.value = '';
    await loadDashboard();
    openCatalogEditor(); // refresh the modal
}

function renameCatalogItem(oldName) {
    const newName = prompt('Rename item:', oldName.charAt(0).toUpperCase() + oldName.slice(1));
    if (!newName || newName.trim().toLowerCase() === oldName) return;
    fetch('/api/kitchen/catalog/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_name: oldName, new_name: newName.trim() })
    }).then(() => loadDashboard().then(() => openCatalogEditor()));
}

async function renameCatalogItemFromInput(btn) {
    const input = btn.previousElementSibling;
    const oldName = input.dataset.orig;
    const newName = (input.value || '').trim();
    if (!newName) { input.value = oldName.charAt(0).toUpperCase() + oldName.slice(1); return; }
    if (newName.toLowerCase() === oldName.toLowerCase()) return;
    try {
        const res = await fetch('/api/kitchen/catalog/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_name: oldName, new_name: newName })
        });
        const data = await res.json();
        if (data.error) { alert(data.error); return; }
    } catch (e) {
        alert('Rename failed: ' + e.message);
        return;
    }
    await loadDashboard();
    openCatalogEditor();
}

async function removeCatalogItem(name) {
    await fetch('/api/kitchen/catalog/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    await loadDashboard();
    openCatalogEditor(); // refresh
}

async function updateCatalogCat(name, category) {
    await fetch('/api/kitchen/catalog/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category })
    });
}

function toggleCatalogItem(name, category, btn) {
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    const onList = (D.kitchen_list || []).some(i => i.name.toLowerCase() === name.toLowerCase());

    if (onList) {
        // Toggle pending-remove state — pink chip means "will be removed on commit"
        if (_kitchenPendingRemove.has(name)) {
            _kitchenPendingRemove.delete(name);
            btn.style.background = 'rgba(124,92,191,0.2)';
            btn.style.color = 'var(--accent)';
            btn.style.borderColor = 'rgba(124,92,191,0.3)';
            btn.style.opacity = '0.85';
            btn.textContent = '✓ ' + label;
            btn.title = 'On list — tap to mark for removal';
        } else {
            _kitchenPendingRemove.add(name);
            btn.style.background = 'rgba(232,91,154,0.22)';
            btn.style.color = '#a82a64';
            btn.style.borderColor = '#d65b9a';
            btn.style.opacity = '1';
            btn.textContent = '✕ ' + label;
            btn.title = 'Tap again to undo removal';
        }
        updateGroceryBatchBar();
        return;
    }

    if (_kitchenPending.has(name)) {
        _kitchenPending.delete(name);
        btn.style.background = 'var(--card-bg)';
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderColor = 'var(--border)';
        btn.textContent = label;
    } else {
        _kitchenPending.set(name, { category, btn });
        btn.style.background = 'var(--accent)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--accent)';
        btn.textContent = '✓ ' + label;
    }
    updateGroceryBatchBar();
}

function updateGroceryBatchBar() {
    let barTop = document.getElementById('kitchen-batch-bar-top');
    let barBottom = document.getElementById('kitchen-batch-bar-bottom');
    const barHTML = () => {
        const addCount = _kitchenPending.size;
        const removeCount = _kitchenPendingRemove.size;
        let label = '';
        let btnLabel = '';
        if (addCount && removeCount) {
            label = `Add ${addCount} · Remove ${removeCount}`;
            btnLabel = 'Add and remove items';
        } else if (addCount) {
            label = `${addCount} item${addCount > 1 ? 's' : ''} selected`;
            btnLabel = 'Add items';
        } else {
            label = `${removeCount} item${removeCount > 1 ? 's' : ''} to remove`;
            btnLabel = 'Remove items';
        }
        return `<span>${label}</span>
            <div style="display:flex;gap:8px">
                <button onclick="commitGroceryBatch()" style="padding:6px 14px;border:none;border-radius:6px;background:#fff;color:var(--accent);font-size:13px;font-weight:700;cursor:pointer">${btnLabel}</button>
                <button onclick="cancelGroceryBatch()" style="padding:6px 14px;border:none;border-radius:6px;background:rgba(255,255,255,0.2);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
            </div>`;
    };
    const barStyle = 'background:var(--accent);color:#fff;padding:10px 16px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;font-weight:600;font-size:14px;flex-wrap:wrap;gap:8px;';
    const details = document.querySelector('#kitchen-tab-area details');

    if (_kitchenPending.size === 0 && _kitchenPendingRemove.size === 0) {
        if (barTop) barTop.style.display = 'none';
        if (barBottom) barBottom.style.display = 'none';
        return;
    }

    if (!barTop && details) {
        barTop = document.createElement('div');
        barTop.id = 'kitchen-batch-bar-top';
        barTop.style.cssText = barStyle + 'margin-bottom:12px;';
        details.insertBefore(barTop, details.querySelector('div'));
    }
    if (!barBottom && details) {
        barBottom = document.createElement('div');
        barBottom.id = 'kitchen-batch-bar-bottom';
        barBottom.style.cssText = barStyle + 'margin-top:12px;';
        details.appendChild(barBottom);
    }

    if (barTop) { barTop.style.display = 'flex'; barTop.innerHTML = barHTML(); }
    if (barBottom) { barBottom.style.display = 'flex'; barBottom.innerHTML = barHTML(); }
}

async function commitGroceryBatch() {
    // Adds first
    for (const [name, { category }] of _kitchenPending) {
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        await fetch('/api/kitchen/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: displayName, category })
        });
    }
    // Then removals — match by original-case name from the kitchen_list
    const list = D.kitchen_list || [];
    for (const name of _kitchenPendingRemove) {
        const onListEntry = list.find(i => i.name.toLowerCase() === name.toLowerCase());
        const displayName = onListEntry ? onListEntry.name : (name.charAt(0).toUpperCase() + name.slice(1));
        await fetch('/api/kitchen/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: displayName })
        });
    }
    _kitchenPending.clear();
    _kitchenPendingRemove.clear();
    loadDashboard();
}

function cancelGroceryBatch() {
    _kitchenPending.clear();
    _kitchenPendingRemove.clear();
    // Easiest: just re-render via loadDashboard so chips revert to default styling
    updateGroceryBatchBar();
    renderGroceryList();
}

// --- My Foods: live chip filter + add (replaces old autocomplete dropdown) ---

function kitchenChipFilterInput(val, suffix) {
    _kitchenChipFilter = val;
    renderGroceryList(); // re-render to filter chips and toggle +Add button
    // Restore focus to whichever input was being typed in
    const el = document.getElementById('kitchen-input-' + (suffix || 'top'));
    if (el) {
        el.focus();
        el.setSelectionRange(val.length, val.length);
    }
}

function kitchenChipFilterClear() {
    _kitchenChipFilter = '';
    renderGroceryList();
}

function kitchenMyFoodsKeydown(e, suffix) {
    if (e.key === 'Enter') {
        e.preventDefault();
        addGrocery(suffix);
    } else if (e.key === 'Escape') {
        kitchenChipFilterClear();
    }
}

async function addGrocery(suffix) {
    const name = (_kitchenChipFilter || '').trim();
    if (!name) return;
    await _addGroceryByName(name, () => {
        _kitchenChipFilter = '';
    });
}

// Stubs preserved for any inline handlers in unmoved old markup (no-op)
function kitchenAutocomplete() {}
function kitchenKeydown() {}
function selectGroceryAc() {}
function kitchenAcHover() {}

// Shared add flow: known catalog item → direct add; new item → category modal
async function _addGroceryByName(name, onComplete) {
    const known = D.kitchen_known_items || {};
    const items = D.kitchen_list || [];
    if (items.some(i => i.name.toLowerCase() === name.toLowerCase())) {
        // Already on list — no-op
        if (onComplete) onComplete();
        return;
    }
    if (known[name.toLowerCase()]) {
        // Known catalog item — add directly with known category
        await fetch('/api/kitchen/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        _receiptPromptDismissed = false;  // new trip might be starting
        if (onComplete) onComplete();
        loadDashboard();
        return;
    }
    // Unknown — open category modal
    openKitchenCatModal(name, async (category) => {
        await fetch('/api/kitchen/add-with-category', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category })
        });
        _receiptPromptDismissed = false;
        if (onComplete) onComplete();
        loadDashboard();
    });
}

// --- Receipt scanner ---

function dismissReceiptPrompt() {
    _receiptPromptDismissed = true;
    renderGroceryList();
}

async function uploadKitchenReceipt(file) {
    if (!file) return;
    const fd = new FormData();
    fd.append('photo', file);
    const res = await fetch('/api/kitchen/scan-receipt', { method: 'POST', body: fd });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Upload failed');
        return;
    }
    const data = await res.json();
    const msg = data.newly_spawned
        ? `Receipt sent to Claude in the 'receipts' terminal tab. New session — give Claude ~5s to start, then it'll parse ${data.filename}.`
        : `Receipt sent to Claude (${data.filename}). Switch to the 'receipts' terminal tab to watch.`;
    alert(msg);
    _receiptPromptDismissed = true;  // hide banner after scan
    renderGroceryList();
}

// --- Grocery List search/add bar ---

function kitchenSearchInput(val) {
    _kitchenSearch = val;
    // Re-render to apply filter + show/hide +Add button
    renderGroceryList();
    // Re-focus the input and place cursor at end
    const el = document.getElementById('kitchen-search');
    if (el) {
        el.focus();
        el.setSelectionRange(val.length, val.length);
    }
}

function kitchenSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        kitchenSearchAdd();
    } else if (e.key === 'Escape') {
        kitchenSearchClear();
    }
}

function kitchenSearchAdd() {
    const val = (_kitchenSearch || '').trim();
    if (!val) return;
    _addGroceryByName(val, () => { _kitchenSearch = ''; });
}

function kitchenSearchClear() {
    _kitchenSearch = '';
    renderGroceryList();
}

// --- Category picker modal (for new items) ---

function openKitchenCatModal(name, callback) {
    _kitchenCatModalCallback = callback;
    const nameEl = document.getElementById('kitchen-cat-modal-name');
    const chipsEl = document.getElementById('kitchen-cat-modal-chips');
    const modal = document.getElementById('kitchen-cat-modal');
    if (!nameEl || !chipsEl || !modal) return;
    nameEl.textContent = name;
    const categoryOrder = D.kitchen_category_order || ['vegetables', 'produce', 'fruit', 'grains', 'drinks', 'snacks', 'dessert', 'other', 'dairy', 'protein', 'pharmacy', 'supplements'];
    const categoryLabels = {
        produce: 'Produce', vegetables: 'Vegetables', fruit: 'Fruit',
        protein: 'Protein', dairy: 'Dairy', grains: 'Grains',
        drinks: 'Drinks', snacks: 'Snacks', dessert: 'Dessert', other: 'Other',
        pharmacy: 'Pharmacy', supplements: 'Supplements'
    };
    chipsEl.innerHTML = categoryOrder.map(cat =>
        `<button onclick="pickKitchenCatModal('${esc(cat)}')" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border);background:var(--card-bg);color:var(--text);font-size:13px;font-weight:600;cursor:pointer">${esc(categoryLabels[cat] || cat)}</button>`
    ).join('');
    modal.classList.add('open');
}

function closeKitchenCatModal() {
    _kitchenCatModalCallback = null;
    const modal = document.getElementById('kitchen-cat-modal');
    if (modal) modal.classList.remove('open');
}

async function pickKitchenCatModal(category) {
    const cb = _kitchenCatModalCallback;
    closeKitchenCatModal();
    if (cb) await cb(category);
}

async function toggleGrocery(name) {
    const resp = await fetch('/api/kitchen/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    const result = await resp.json();
    await loadDashboard();
    if (result.all_checked && !_receiptPromptDismissed) {
        openKitchenDoneModal();
    }
}

async function removeGrocery(name) {
    await fetch('/api/kitchen/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    loadDashboard();
}

async function checkAllGroceries() {
    const unchecked = (D.kitchen_list || []).filter(i => !i.checked);
    for (const item of unchecked) {
        await fetch('/api/kitchen/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: item.name })
        });
    }
    await loadDashboard();
    if (!_receiptPromptDismissed) openKitchenDoneModal();
}

// --- Kitchen "Done shopping" modal handlers ---

function openKitchenDoneModal() {
    const m = document.getElementById('kitchen-done-modal');
    if (m) m.classList.add('open');
}

function closeKitchenDoneModal() {
    const m = document.getElementById('kitchen-done-modal');
    if (m) m.classList.remove('open');
}

async function kitchenDoneScanReceipt(file) {
    closeKitchenDoneModal();
    if (!file) return;
    // Clear checked items first (move to pantry, the trip is finished).
    // The receipt-import flow will then layer line-items / spend / counts on top.
    await fetch('/api/kitchen/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    // Existing upload helper handles photo → Claude scan + banner
    await uploadKitchenReceipt(file);
    _receiptPromptDismissed = true;
}

async function kitchenDoneNoReceipt() {
    closeKitchenDoneModal();
    await fetch('/api/kitchen/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    _receiptPromptDismissed = true;
    loadDashboard();
}

function kitchenDoneNotYet() {
    closeKitchenDoneModal();
    _receiptPromptDismissed = true;  // banner can still show — but the auto-pop won't fire again this session
}

async function clearGroceryChecked() {
    await fetch('/api/kitchen/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
    });
    loadDashboard();
}

// --- Category order modal ---
let _catOrder = null;

function openCategoryOrder() {
    const categoryLabels = {
        produce: 'Produce', vegetables: 'Vegetables', fruit: 'Fruit',
        protein: 'Protein', dairy: 'Dairy', grains: 'Grains',
        drinks: 'Drinks', snacks: 'Snacks', dessert: 'Dessert', other: 'Other',
        pharmacy: 'Pharmacy', supplements: 'Supplements'
    };
    _catOrder = [...(D.kitchen_category_order || Object.keys(categoryLabels))];

    let overlay = document.getElementById('cat-order-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'cat-order-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;';
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
    overlay.onclick = (e) => { if (e.target === overlay) closeCategoryOrder(); };
    renderCategoryOrder();
}

function renderCategoryOrder() {
    const categoryLabels = {
        produce: 'Produce', vegetables: 'Vegetables', fruit: 'Fruit',
        protein: 'Protein', dairy: 'Dairy', grains: 'Grains',
        drinks: 'Drinks', snacks: 'Snacks', dessert: 'Dessert', other: 'Other',
        pharmacy: 'Pharmacy', supplements: 'Supplements'
    };
    const overlay = document.getElementById('cat-order-overlay');

    let rows = _catOrder.map((cat, i) => {
        const isAisles = cat === '@aisles';
        const label = isAisles ? 'Aisles (1, 2, 3…)' : (categoryLabels[cat] || cat);
        const tint = isAisles ? 'background:rgba(124,92,191,0.10);' : '';
        const hint = isAisles ? '<span style="font-size:11px;color:var(--text-muted);margin-left:6px">numbered aisles cluster here</span>' : '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 6px;border-bottom:1px solid var(--border);${tint}">
            <span style="flex:1;font-size:14px;color:var(--text)">${esc(label)}${hint}</span>
            <button onclick="moveCat(${i},-1)" ${i === 0 ? 'disabled style="opacity:0.2"' : ''} style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:14px;color:var(--text)">&#9650;</button>
            <button onclick="moveCat(${i},1)" ${i === _catOrder.length - 1 ? 'disabled style="opacity:0.2"' : ''} style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:14px;color:var(--text)">&#9660;</button>
        </div>`;
    }).join('');

    overlay.innerHTML = `<div style="background:var(--card-bg);border-radius:12px;padding:20px;max-width:400px;width:100%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 30px rgba(0,0,0,0.3)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div style="font-size:16px;font-weight:700;color:var(--text)">Category Order</div>
            <button onclick="closeCategoryOrder()" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer">&times;</button>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">Matches your store walking route</div>
        <div style="flex:1;overflow-y:auto;min-height:0">${rows}</div>
        <div style="display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
            <button onclick="saveCategoryOrder()" style="flex:1;padding:8px;border:none;border-radius:8px;background:var(--accent);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Save</button>
            <button onclick="closeCategoryOrder()" style="flex:1;padding:8px;border:none;border-radius:8px;background:var(--border);color:var(--text-muted);font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
        </div>
    </div>`;
}

function moveCat(index, dir) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= _catOrder.length) return;
    [_catOrder[index], _catOrder[newIndex]] = [_catOrder[newIndex], _catOrder[index]];
    renderCategoryOrder();
}

async function saveCategoryOrder() {
    await fetch('/api/kitchen/category-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: _catOrder })
    });
    D.kitchen_category_order = _catOrder;
    closeCategoryOrder();
    loadDashboard();
}

function closeCategoryOrder() {
    const overlay = document.getElementById('cat-order-overlay');
    if (overlay) overlay.style.display = 'none';
}

// --- Parsed-receipts banner + import modal ---

async function fetchParsedReceipts() {
    try {
        const res = await fetch('/api/kitchen/parsed-receipts/list');
        const data = await res.json();
        _parsedReceipts = data.receipts || [];
        renderGroceryList();
    } catch (e) {
        _parsedReceipts = [];
    }
}

function renderParsedReceiptsBanner() {
    if (!_parsedReceipts || !_parsedReceipts.length) return '';
    const items = _parsedReceipts.map(r => {
        const total = r.total ? `$${Number(r.total).toFixed(2)}` : '—';
        const dateLabel = r.date || '';
        const store = r.store || 'Receipt';
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px dashed var(--border)">
            <span style="font-size:13px;flex:1"><b>${esc(store)}</b> · ${esc(dateLabel)} · ${esc(String(r.items_count))} items · ${total}</span>
            <button onclick="openReceiptImport('${esc(r.filename)}')" style="padding:5px 12px;border-radius:6px;background:var(--green);color:#fff;border:none;font-size:12px;font-weight:600;cursor:pointer">Import</button>
        </div>`;
    }).join('');
    return `<div style="background:rgba(124,92,191,0.08);border:1px solid rgba(124,92,191,0.3);border-radius:8px;padding:10px 14px;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--accent);margin-bottom:4px">${_parsedReceipts.length} parsed receipt${_parsedReceipts.length === 1 ? '' : 's'} ready to import</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">Categorize items + commit them to the trip log.</div>
        ${items}
    </div>`;
}

async function openReceiptImport(filename) {
    try {
        const res = await fetch('/api/kitchen/parsed-receipts/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if (data.error) { alert(data.error); return; }
        const aislesMap = D.kitchen_aisles || {};
        // Pre-fill aisle from catalog if known
        (data.rows || []).forEach(r => {
            if (r.aisle == null && r.catalog_name && aislesMap[r.catalog_name] != null) {
                r.aisle = aislesMap[r.catalog_name];
            }
        });
        _activeReceiptImport = { filename, header: data.header || {}, rows: data.rows || [] };
        renderReceiptImportModal();
        document.getElementById('receipt-import-modal').classList.add('open');
    } catch (e) {
        alert('Failed to load receipt: ' + e.message);
    }
}

function closeReceiptImportModal() {
    document.getElementById('receipt-import-modal').classList.remove('open');
    _activeReceiptImport = null;
}

function _rowIsSorted(r) {
    // "Sorted" = you have touched this row. Algorithm-prefilled rows still need
    // your confirmation (tap the row OR change any field). This protects against
    // silently importing whatever the rules-based parser guessed.
    return !!(r && r.user_touched);
}

function _updateReceiptImportProgress() {
    if (!_activeReceiptImport) return;
    const rows = _activeReceiptImport.rows;
    const sorted = rows.filter(_rowIsSorted).length;
    const el = document.getElementById('receipt-import-progress');
    if (!el) return;
    if (sorted === rows.length) {
        el.style.color = 'var(--green)';
        el.textContent = `✓ All ${rows.length} confirmed — ready to import`;
    } else {
        el.style.color = '#e8741c';
        el.textContent = `${sorted} / ${rows.length} confirmed — tap each row to confirm (or edit anything to mark it touched)`;
    }
}

function renderReceiptImportModal() {
    if (!_activeReceiptImport) return;
    const { header, rows } = _activeReceiptImport;
    document.getElementById('receipt-import-title').textContent = `${header.store || 'Receipt'} · ${header.date || ''}`;
    const totalStr = header.total ? `$${Number(header.total).toFixed(2)}` : '—';
    const savedStr = header.saved ? ` · saved $${Number(header.saved).toFixed(2)}` : '';
    document.getElementById('receipt-import-header').textContent =
        `${rows.length} line items · total ${totalStr}${savedStr}`;

    const categoryOrder = D.kitchen_category_order || ['vegetables', 'produce', 'fruit', 'grains', 'drinks', 'snacks', 'dessert', 'other', 'dairy', 'protein', 'pharmacy', 'supplements'];
    const categoriesAlpha = categoryOrder.slice().sort((a, b) => a.localeCompare(b));
    const known = D.kitchen_known_items || {};
    const catalogNames = Object.keys(known).sort();

    const rowsHtml = rows.map((r, i) => {
        const priceStr = r.price ? `$${Number(r.price).toFixed(2)}` : '';
        const qty = Number(r.qty) || 1;
        const qtyBadge = qty > 1
            ? `<span style="background:var(--green);color:#fff;padding:1px 6px;border-radius:8px;font-size:11px;font-weight:700;margin-right:4px">×${qty}</span>`
            : '';
        const locationOpts = _locationOptionsHtml(r.category, r.aisle);
        const NEW_ITEM_OPT = `<option value="__new__">+ New catalog item…</option>`;
        const catalogOpts = [
            `<option value=""${!r.catalog_name ? ' selected' : ''}>— pick catalog item —</option>`,
            NEW_ITEM_OPT,
            ...catalogNames.map(n => `<option value="${esc(n)}"${n === r.catalog_name ? ' selected' : ''}>${esc(n)}</option>`),
            NEW_ITEM_OPT,
        ].join('');
        const dimStyle = r.include ? '' : 'opacity:0.45;';
        const isSorted = _rowIsSorted(r);
        const sortedStyle = isSorted
            ? 'background:var(--card-bg);border-left:4px solid transparent;'
            : 'background:rgba(255,140,40,0.18);border-left:4px solid #e8741c;';
        return `<div data-row-idx="${i}" onclick="confirmReceiptRow(${i}, event)" style="padding:8px 6px 8px 10px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text);cursor:pointer;${sortedStyle}${dimStyle}">
            <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">
                <input type="checkbox" data-row="${i}" data-field="include" ${r.include ? 'checked' : ''} onclick="event.stopPropagation()" style="margin:3px 0 0 0;flex-shrink:0" title="Include this item in the imported trip — uncheck to skip">
                <div style="flex:1;min-width:0">
                    <div style="font-weight:600;color:var(--text);word-break:break-word">${qtyBadge}${esc(r.name)}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${priceStr}${qty > 1 ? ` &nbsp;·&nbsp; ${qty} units` : ''}${isSorted ? '' : ' &nbsp;·&nbsp; <span style="color:#e8741c;font-weight:700">tap to confirm</span>'}</div>
                </div>
            </div>
            <div style="display:flex;gap:6px;padding-left:26px" onclick="event.stopPropagation()">
                <select data-row="${i}" data-field="catalog_name" style="flex:2;min-width:0;padding:5px 4px;font-size:12px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px">${catalogOpts}</select>
                <select data-row="${i}" data-field="location" style="flex:1.4;min-width:0;padding:5px 4px;font-size:12px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px" title="Where in the store this lives — pick a section (Produce, Dairy, …) OR an aisle number">${locationOpts}</select>
            </div>
        </div>`;
    }).join('');

    document.getElementById('receipt-import-rows').innerHTML = rowsHtml;
    _updateReceiptImportProgress();

    // Wire field changes back into state
    document.getElementById('receipt-import-rows').querySelectorAll('input,select').forEach(el => {
        el.addEventListener('change', (e) => {
            const i = parseInt(e.target.dataset.row, 10);
            const f = e.target.dataset.field;
            if (!_activeReceiptImport || isNaN(i)) return;
            if (f === 'include') {
                _activeReceiptImport.rows[i].include = e.target.checked;
                _activeReceiptImport.rows[i].user_touched = true;
                _restyleReceiptRow(i);
                return;
            }
            if (f === 'location' && e.target.value === '__new_section__') {
                onReceiptImportNewCategory(i, e.target);
                return;
            }
            if (f === 'catalog_name' && e.target.value === '__new__') {
                onReceiptImportNewCatalogItem(i, e.target);
                return;
            }
            if (f === 'location') {
                const { category, aisle } = _parseLocationVal(e.target.value);
                _activeReceiptImport.rows[i].category = category;
                _activeReceiptImport.rows[i].aisle = aisle;
            } else {
                _activeReceiptImport.rows[i][f] = e.target.value;
            }
            _activeReceiptImport.rows[i].user_touched = true;
            // Auto-snap location to the catalog item's stored category/aisle
            if (f === 'catalog_name') {
                const known = D.kitchen_known_items || {};
                const aislesMap = D.kitchen_aisles || {};
                const inferredCat = known[e.target.value];
                const storedAisle = aislesMap[e.target.value];
                if (storedAisle != null) {
                    _activeReceiptImport.rows[i].category = '@aisles';
                    _activeReceiptImport.rows[i].aisle = storedAisle;
                } else if (inferredCat) {
                    _activeReceiptImport.rows[i].category = inferredCat;
                    _activeReceiptImport.rows[i].aisle = null;
                }
                const locSel = document.querySelector(`select[data-row="${i}"][data-field="location"]`);
                if (locSel) {
                    locSel.innerHTML = _locationOptionsHtml(
                        _activeReceiptImport.rows[i].category,
                        _activeReceiptImport.rows[i].aisle
                    );
                }
            }
            _restyleReceiptRow(i);
        });
    });
}

function _restyleReceiptRow(i) {
    if (!_activeReceiptImport) return;
    const r = _activeReceiptImport.rows[i];
    const rowEl = document.querySelector(`[data-row-idx="${i}"]`);
    if (!rowEl) return;
    const sorted = _rowIsSorted(r);
    if (sorted) {
        rowEl.style.background = 'var(--card-bg)';
        rowEl.style.borderLeft = '4px solid transparent';
    } else {
        rowEl.style.background = 'rgba(255,140,40,0.18)';
        rowEl.style.borderLeft = '4px solid #e8741c';
    }
    rowEl.style.opacity = r.include ? '1' : '0.45';
    _updateReceiptImportProgress();
}

function confirmReceiptRow(i, evt) {
    if (!_activeReceiptImport) return;
    const r = _activeReceiptImport.rows[i];
    if (!r) return;
    r.user_touched = true;
    // Re-render this row so the "tap to confirm" hint goes away
    renderReceiptImportModal();
}

// Build a combined location <select> innerHTML: sections + Aisle 1-30 + + New section,
// ordered by D.kitchen_category_order with @aisles unpacked into individual aisle options.
function _locationOptionsHtml(currentCat, currentAisle, opts) {
    opts = opts || {};
    const includeNewOpt = opts.includeNewOpt !== false;
    const order = D.kitchen_category_order || ['fruit','vegetables','produce','grains','snacks','dessert','other','@aisles','dairy','drinks','protein','supplements','pharmacy','meat'];
    const categoryLabels = {
        produce: 'Produce', vegetables: 'Vegetables', fruit: 'Fruit',
        protein: 'Protein / Meat', dairy: 'Dairy', grains: 'Grains',
        drinks: 'Drinks', snacks: 'Snacks', dessert: 'Dessert', other: 'Other',
        pharmacy: 'Pharmacy', supplements: 'Supplements', meat: 'Meat'
    };
    let inAisles = false;
    let html = '';
    // Selected value form: 'section:<name>' or 'aisle:<N>' or '' for unset
    const currentVal = (currentCat === '@aisles' && currentAisle != null)
        ? `aisle:${currentAisle}`
        : (currentCat ? `section:${currentCat}` : '');
    if (!currentVal) {
        html += `<option value="" selected>— pick location —</option>`;
    }
    order.forEach(slot => {
        if (slot === '@aisles') {
            for (let n = 1; n <= 30; n++) {
                const v = `aisle:${n}`;
                html += `<option value="${v}"${v === currentVal ? ' selected' : ''}>Aisle ${n}</option>`;
            }
            inAisles = true;
        } else {
            const label = categoryLabels[slot] || slot;
            const v = `section:${slot}`;
            html += `<option value="${v}"${v === currentVal ? ' selected' : ''}>${esc(label)}</option>`;
        }
    });
    if (includeNewOpt) html += `<option value="__new_section__">+ New section…</option>`;
    return html;
}

function _parseLocationVal(v) {
    // Returns { category, aisle } where category is the section string or '@aisles', aisle is int|null
    if (!v) return { category: '', aisle: null };
    if (v.startsWith('aisle:')) {
        const n = parseInt(v.slice(6), 10) || null;
        return { category: '@aisles', aisle: n };
    }
    if (v.startsWith('section:')) {
        return { category: v.slice(8), aisle: null };
    }
    return { category: '', aisle: null };
}

function setMyFoodsSort(mode) {
    if (!['frequency', 'alpha', 'both'].includes(mode)) return;
    localStorage.setItem('kitchen_my_foods_sort', mode);
    renderGroceryList();
}

function editGroceryAisle(name, badgeEl) {
    if (!badgeEl) return;
    const key = name.toLowerCase();
    const aislesMap = D.kitchen_aisles || (D.kitchen_aisles = {});
    const known = D.kitchen_known_items || {};
    const currentAisle = aislesMap[key];
    const currentCat = known[key] || (currentAisle != null ? '@aisles' : '');
    // Build the unified location picker
    const sel = document.createElement('select');
    sel.style.cssText = 'padding:3px 6px;font-size:12px;border:1px solid var(--accent);border-radius:6px;background:var(--bg);color:var(--text);margin-right:6px;cursor:pointer';
    sel.innerHTML = _locationOptionsHtml(currentCat, currentAisle, { includeNewOpt: false });
    badgeEl.replaceWith(sel);
    sel.focus();
    let done = false;
    const commit = async (cancel) => {
        if (done) return;
        done = true;
        if (cancel) { loadDashboard(); return; }
        const loc = sel.value;
        // Optimistic local update
        const { category, aisle } = _parseLocationVal(loc);
        if (aisle != null) {
            aislesMap[key] = aisle;
            known[key] = '@aisles';
        } else {
            delete aislesMap[key];
            if (category) known[key] = category;
        }
        try {
            await fetch('/api/kitchen/location/set', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: key, location: loc })
            });
        } catch (e) {
            alert('Failed to save location: ' + e.message);
        }
        loadDashboard();
    };
    sel.addEventListener('change', () => commit(false));
    sel.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); commit(true); }
    });
    sel.addEventListener('blur', () => { if (!done) commit(true); });
}

function _suggestCatalogName(rawName) {
    // Strip leading store/brand prefixes + size suffixes, keep core noun
    let s = (rawName || '').toLowerCase();
    s = s.replace(/\b(heb|hb|cm|sel|kozy|shack|bnl|bobs?|red mill|quakr|quaker|goodflow|hsy|gv)\b/g, '');
    s = s.replace(/\b(org|organic|cage free|brown|lg|eg|fw|f|w|lb|lbs|oz|ct|pk|pack|bag|jar|can|bottle|whole|raw|natural|fresh)\b/g, '');
    s = s.replace(/\b\d+\s*(oz|lb|lbs|ct|pk|g|kg|ml|l)\b/g, '');
    s = s.replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    // Take first 2 words max
    return s.split(' ').slice(0, 2).join(' ');
}

async function onReceiptImportNewCatalogItem(rowIndex, selectEl) {
    const row = _activeReceiptImport.rows[rowIndex];
    const guess = _suggestCatalogName(row.name);
    const name = (prompt('New catalog item name (lowercase, canonical — e.g. "broccoli" not "HEB ORG BROCCOLI"):', guess) || '').trim().toLowerCase();
    if (!name) {
        selectEl.value = row.catalog_name || '';
        return;
    }
    const known = D.kitchen_known_items || (D.kitchen_known_items = {});
    // If category not yet set on this row, default to "other"
    const category = (row.category || 'other').toLowerCase();
    known[name] = category;
    row.catalog_name = name;
    row.category = category;
    renderReceiptImportModal();  // re-render so the new item shows in every row's dropdown
}

async function onReceiptImportNewCategory(rowIndex, selectEl) {
    const name = (prompt('New section name? (e.g. "frozen", "bulk", "bakery")') || '').trim().toLowerCase();
    const r = _activeReceiptImport.rows[rowIndex];
    if (!name) {
        // Revert the dropdown
        selectEl.innerHTML = _locationOptionsHtml(r.category, r.aisle);
        return;
    }
    const order = (D.kitchen_category_order || []).slice();
    if (!order.includes(name)) {
        // Insert just before @aisles if present, otherwise at end
        const aislesAt = order.indexOf('@aisles');
        if (aislesAt >= 0) order.splice(aislesAt, 0, name);
        else order.push(name);
        try {
            await fetch('/api/kitchen/category-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order })
            });
            D.kitchen_category_order = order;
        } catch (e) {
            alert('Failed to save new section: ' + e.message);
            selectEl.innerHTML = _locationOptionsHtml(r.category, r.aisle);
            return;
        }
    }
    r.category = name;
    r.aisle = null;
    r.user_touched = true;
    renderReceiptImportModal();  // re-render so new option appears in all rows
}

async function submitReceiptImport() {
    if (!_activeReceiptImport) return;
    const { filename, rows } = _activeReceiptImport;
    const update_pantry = document.getElementById('receipt-import-pantry').checked;
    // Learn rules for any row that has both a catalog_name and a unique-ish match key (first word of name)
    const learn_rules = [];
    rows.forEach(r => {
        if (!r.include || !r.catalog_name) return;
        const firstWord = (r.name || '').toLowerCase().split(/\s+/).filter(Boolean)[0];
        if (firstWord && firstWord.length >= 3) {
            learn_rules.push({ match: firstWord, category: r.category, catalog_name: r.catalog_name });
        }
    });
    try {
        const res = await fetch('/api/kitchen/parsed-receipts/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, selections: rows, learn_rules, update_pantry })
        });
        const data = await res.json();
        if (data.error) { alert(data.error); return; }
        closeReceiptImportModal();
        _parsedReceiptsFetched = false;
        loadDashboard();  // pulls fresh kitchen_trips + counts
    } catch (e) {
        alert('Import failed: ' + e.message);
    }
}

// --- Spend trend card ---

function renderSpendTrendCard() {
    const trips = (D.kitchen_trips || []).filter(t => typeof t.total === 'number' && t.total > 0);
    if (!trips.length) return '';
    const sorted = trips.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const totals = sorted.map(t => t.total);
    const avg = totals.reduce((s, x) => s + x, 0) / totals.length;
    const last = sorted[sorted.length - 1];
    const last5 = totals.slice(-5);
    const last5Avg = last5.reduce((s, x) => s + x, 0) / last5.length;

    // 30-day total
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const last30Total = sorted.filter(t => (t.date || '') >= cutoffStr).reduce((s, t) => s + t.total, 0);

    // Mini sparkline (last 8 trips)
    const sparkData = totals.slice(-8);
    const max = Math.max(...sparkData, 1);
    const bars = sparkData.map(v => {
        const h = Math.max(3, Math.round((v / max) * 28));
        return `<span title="$${v.toFixed(2)}" style="display:inline-block;width:6px;height:${h}px;background:var(--green);border-radius:1px;margin-right:2px;vertical-align:bottom"></span>`;
    }).join('');

    const dateLabel = last.date ? new Date(last.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

    return `<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted)">Grocery spend</div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:30px">${bars}</div>
        <div style="font-size:12px;color:var(--text-muted);display:flex;gap:14px;flex-wrap:wrap">
            <span><b style="color:var(--text);font-size:13px">$${last.total.toFixed(2)}</b> last (${esc(dateLabel)})</span>
            <span><b style="color:var(--text);font-size:13px">$${last5Avg.toFixed(2)}</b> avg/trip</span>
            <span><b style="color:var(--text);font-size:13px">$${last30Total.toFixed(2)}</b> last 30d</span>
            <span style="opacity:0.7">${trips.length} trip${trips.length === 1 ? '' : 's'} logged</span>
        </div>
    </div>`;
}
