// kitchen.js — kitchen list with catalog chips, autocomplete, check/clear

let _kitchenSearch = '';        // (legacy, no longer used in render — kept for safety)
let _kitchenChipFilter = '';    // live filter for My Foods chips (typed in any input bar)
let _kitchenCatModalCallback = null;
let _receiptPromptDismissed = false;  // resets when items get added (new trip)

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

        // Group unchecked by category
        const grouped = {};
        unchecked.forEach(item => {
            const cat = (item.category || 'other').toLowerCase();
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });
        const renderedCats = new Set();
        function renderGroup(cat) {
            if (!grouped[cat] || renderedCats.has(cat)) return '';
            renderedCats.add(cat);
            let g = `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);padding:8px 0 2px;${renderedCats.size > 1 ? 'border-top:1px solid var(--border);margin-top:4px' : ''}">${categoryLabels[cat] || cat}</div>`;
            grouped[cat].forEach(item => {
                g += `<div class="card-item">
                    <span class="habit-check" onclick="toggleGrocery('${esc(item.name)}')" style="cursor:pointer">&#9675;</span>
                    <span class="item-text">${esc(item.name)}</span>
                    <button class="delete-btn" onclick="removeGrocery('${esc(item.name)}')" title="Remove">&times;</button>
                </div>`;
            });
            return g;
        }
        categoryOrder.forEach(cat => { html += renderGroup(cat); });
        Object.keys(grouped).forEach(cat => { html += renderGroup(cat); });

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

    html += `<details open class="kitchen-section">
        <summary style="font-size:16px;font-weight:700;cursor:pointer;padding:8px 0;list-style:none;display:flex;align-items:center;gap:8px">
            <span style="font-size:12px;transition:transform 0.15s;display:inline-block" class="kitchen-arrow">&#9654;</span>
            My Foods
        </summary>`;

    html += renderMyFoodsBar('top');

    // Catalog — known items as tappable chips, sorted by purchase count
    // When chipFilter is set, only show chips whose name contains the filter (case-insensitive).
    const matchesFilter = (name) => !chipFilter || name.toLowerCase().includes(chipFilter);
    const catalogItems = Object.entries(known)
        .map(([name, cat]) => ({ name, cat, count: counts[name] || 0 }))
        .filter(i => matchesFilter(i.name))
        .sort((a, b) => b.count - a.count);

    if (catalogItems.length) {
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="font-size:14px;font-weight:700">${chipFilter ? `Matches for "${esc(chipFilter)}"` : 'Quick add from favorites'}</div>
            <button onclick="openCatalogEditor()" style="font-size:11px;color:var(--text-muted);background:none;border:1px solid var(--border);border-radius:6px;padding:3px 10px;cursor:pointer">Edit</button>
        </div>`;

        // Group by category, but sorted by frequency within each
        const catGroups = {};
        // First pass: items with counts go into a "frequent" group
        const frequent = catalogItems.filter(i => i.count > 0);
        const rest = catalogItems.filter(i => i.count === 0);

        if (frequent.length) {
            html += '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin-bottom:6px">Most bought</div>';
            html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
            frequent.forEach(item => {
                html += renderCatalogChip(item, onList);
            });
            html += '</div>';
        }

        // Rest grouped by category
        rest.forEach(item => {
            if (!catGroups[item.cat]) catGroups[item.cat] = [];
            catGroups[item.cat].push(item);
        });

        const catsWithItems = categoryOrder.filter(c => catGroups[c]);
        // Also add any categories not in the standard order
        Object.keys(catGroups).forEach(c => { if (!catsWithItems.includes(c)) catsWithItems.push(c); });

        if (catsWithItems.length) {
            // Auto-open "All items" details when actively filtering so matches are visible
            const allItemsOpen = chipFilter ? ' open' : '';
            html += `<details${allItemsOpen} style="margin-top:4px"><summary style="font-size:12px;font-weight:600;cursor:pointer;color:var(--text-muted)">All items by category</summary><div style="margin-top:8px">`;
            catsWithItems.forEach(cat => {
                html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);margin:8px 0 4px">${categoryLabels[cat] || cat}</div>`;
                html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px">';
                catGroups[cat].forEach(item => {
                    html += renderCatalogChip(item, onList);
                });
                html += '</div>';
            });
            html += '</div></details>';
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
let _kitchenPending = new Map(); // name -> {category, btn}
let _catalogEditMode = false;

function renderCatalogChip(item, onList) {
    const active = onList.has(item.name);
    const label = item.name.charAt(0).toUpperCase() + item.name.slice(1);
    const notes = D.kitchen_item_notes || {};
    const hasNote = !!notes[item.name];
    const dot = hasNote ? '<span style="width:5px;height:5px;border-radius:50%;background:var(--orange);display:inline-block;margin-left:2px;vertical-align:top"></span>' : '';

    if (active) {
        return `<button oncontextmenu="event.preventDefault();openItemNote('${esc(item.name)}')" ontouchstart="startLongPress('${esc(item.name)}',event)" ontouchend="cancelLongPress()" ontouchmove="cancelLongPress()"
            style="padding:6px 12px;border-radius:16px;border:1px solid;font-size:13px;background:rgba(124,92,191,0.2);color:var(--accent);border-color:rgba(124,92,191,0.3);opacity:0.7;cursor:default;transition:all 0.12s"
            title="Already on list">✓ ${esc(label)}${dot}</button>`;
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
    const categoryOrder = ['vegetables', 'produce', 'fruit', 'grains', 'drinks', 'snacks', 'dessert', 'other', 'dairy', 'protein', 'pharmacy', 'supplements'];
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
        const note = notes[name] || '';
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="flex:2;font-size:14px;color:var(--text)">${esc(label)}</span>
            <select onchange="updateCatalogCat('${esc(name)}',this.value)" style="flex:1;padding:4px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--bg);color:var(--text)">
                ${categoryOrder.map(c => `<option value="${c}" ${c === cat ? 'selected' : ''}>${categoryLabels[c] || c}</option>`).join('')}
            </select>
            <button onclick="renameCatalogItem('${esc(name)}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px" title="Rename">&#9998;</button>
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
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <div style="font-size:16px;font-weight:700;color:var(--text)">Edit Catalog</div>
            <button onclick="closeCatalogEditor()" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer">&times;</button>
        </div>
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
        // Already on list — ignore in batch mode
        return;
    }

    if (_kitchenPending.has(name)) {
        // Deselect
        _kitchenPending.delete(name);
        btn.style.background = 'var(--card-bg)';
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderColor = 'var(--border)';
        btn.textContent = label;
    } else {
        // Select
        _kitchenPending.set(name, { category, btn });
        btn.style.background = 'var(--accent)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--accent)';
        btn.textContent = '✓ ' + label;
    }

    // Show/hide the "Add to list" bar
    updateGroceryBatchBar();
}

function updateGroceryBatchBar() {
    let barTop = document.getElementById('kitchen-batch-bar-top');
    let barBottom = document.getElementById('kitchen-batch-bar-bottom');
    const barHTML = () => {
        const count = _kitchenPending.size;
        return `<span>${count} item${count > 1 ? 's' : ''} selected</span>
            <div style="display:flex;gap:8px">
                <button onclick="commitGroceryBatch()" style="padding:6px 14px;border:none;border-radius:6px;background:#fff;color:var(--accent);font-size:13px;font-weight:700;cursor:pointer">Add to list</button>
                <button onclick="cancelGroceryBatch()" style="padding:6px 14px;border:none;border-radius:6px;background:rgba(255,255,255,0.2);color:#fff;font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
            </div>`;
    };
    const barStyle = 'background:var(--accent);color:#fff;padding:10px 16px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;font-weight:600;font-size:14px;';
    const details = document.querySelector('#kitchen-tab-area details');

    if (_kitchenPending.size === 0) {
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
    for (const [name, { category }] of _kitchenPending) {
        const displayName = name.charAt(0).toUpperCase() + name.slice(1);
        await fetch('/api/kitchen/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: displayName, category })
        });
    }
    _kitchenPending.clear();
    loadDashboard();
}

function cancelGroceryBatch() {
    // Reset all pending chips
    for (const [name, { btn }] of _kitchenPending) {
        const label = name.charAt(0).toUpperCase() + name.slice(1);
        btn.style.background = 'var(--card-bg)';
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderColor = 'var(--border)';
        btn.textContent = label;
    }
    _kitchenPending.clear();
    updateGroceryBatchBar();
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
    if (result.all_checked) {
        pendingDelete = { type: 'kitchen-done' };
        document.getElementById('modal-text').innerHTML = 'All done at the kitchen store?';
        document.getElementById('modal').querySelector('.confirm').textContent = 'Yes, done!';
        document.getElementById('modal').classList.add('open');
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
    pendingDelete = { type: 'kitchen-done' };
    document.getElementById('modal-text').innerHTML = 'All done at the kitchen store?';
    document.getElementById('modal').querySelector('.confirm').textContent = 'Yes, done!';
    document.getElementById('modal').classList.add('open');
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
        const label = categoryLabels[cat] || cat;
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="flex:1;font-size:14px;color:var(--text)">${esc(label)}</span>
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
