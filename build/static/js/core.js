// core.js — shared globals, utilities, render loop, modal, drag-drop, card system

// --- Global variables ---
let D = null; // dashboard data
let _serverDate = null;
let selectedTime = null;
let pendingDelete = null;
let expandedAll = false;
let currentTab = document.body.dataset.activeTab || 'today';

const TAB_ENDPOINTS = {
    today: '/api/data/today',
    map: '/api/data/map',
    kitchen: '/api/data/kitchen',
    inventory: () => {
        const name = document.body.dataset.itemName || '';
        return name ? `/api/data/item-buy?name=${encodeURIComponent(name)}` : '/api/data/inventory';
    },
    money: '/api/data/money',
};

// TAB_RENDERERS is built lazily in render() because the functions
// are defined in other JS files that load after core.js
let TAB_RENDERERS = null;

// --- initTab ---
function initTab() {
    document.getElementById('tab-today').style.display = currentTab === 'today' ? '' : 'none';
    document.getElementById('tab-map').style.display = currentTab === 'map' ? '' : 'none';
    document.getElementById('tab-kitchen').style.display = currentTab === 'kitchen' ? '' : 'none';
    document.getElementById('tab-inventory').style.display = currentTab === 'inventory' ? '' : 'none';
    document.getElementById('tab-money').style.display = currentTab === 'money' ? '' : 'none';

    // Inside inventory: show list OR item detail based on data-item-name
    const itemName = document.body.dataset.itemName || '';
    const listSection = document.getElementById('buy-list-section');
    const detailSection = document.getElementById('item-buy-area');
    if (listSection && detailSection) {
        if (itemName) {
            listSection.style.display = 'none';
            detailSection.style.display = '';
        } else {
            listSection.style.display = '';
            detailSection.style.display = 'none';
        }
    }
    document.querySelectorAll('#tab-selector .time-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === currentTab);
    });
}

// --- toggleExpandAll ---
function toggleExpandAll() {
    expandedAll = !expandedAll;
    document.getElementById('expand-btn').textContent = expandedAll ? 'Collapse' : 'Show all';
    render();
    if (expandedAll) {
        document.querySelectorAll('details').forEach(d => { d.open = true; });
    }
}

// --- toggleMapCollapse ---
function toggleMapCollapse() {
    const sections = document.querySelectorAll('#tab-map details.map-section');
    const anyOpen = Array.from(sections).some(d => d.open);
    sections.forEach(d => { d.open = !anyOpen; });
    const btn = document.getElementById('map-collapse-btn');
    if (btn) btn.textContent = anyOpen ? 'Expand all' : 'Collapse all';
}

// --- loadDashboard ---
async function loadDashboard() {
    try {
        let endpoint = TAB_ENDPOINTS[currentTab] || '/api/data';
        if (typeof endpoint === 'function') endpoint = endpoint();
        const res = await fetch(endpoint);
        const data = await res.json();
        if (data.error) {
            console.error('Server error:', data.error);
            document.getElementById('greeting').textContent = 'Dashboard error';
            document.getElementById('date-info').textContent = data.error;
            return;
        }
        D = data;
        // Normalize: habits items → strings (they use habits_log for done state)
        if (D.habits) D.habits.forEach(s => { s.items = s.items.map(i => typeof i === 'string' ? i : i.text); });
        if (!selectedTime) selectedTime = D.time_of_day;
        // Use server time for all time-dependent displays
        if (D.server_date) _serverDate = D.server_date;
        if (typeof _serverHour !== 'undefined' && D.server_hour !== undefined) {
            _serverHour = D.server_hour;
            _serverDayOfYear = D.server_day_of_year;
            updateSkyTheme();
        }
        render();
    } catch(e) {
        console.error('Failed to load dashboard:', e);
        document.getElementById('greeting').textContent = 'Dashboard error';
        document.getElementById('date-info').textContent = e.message || 'Could not load data — check server.log';
    }
}

// --- render ---
function render() {
    if (!TAB_RENDERERS) {
        TAB_RENDERERS = {
            today: [
                renderHeader, renderHRT, renderFoodBanner, renderGroceryQuick,
                renderLinenReminders, renderContactReminders, renderContacts,
                renderContactCalendar, renderHabits, renderTodos, renderSymptomForm,
                restoreEditModes
            ],
            map: [
                renderHeader, renderContacts, renderContactCalendar,
                renderHabitTracker, renderDotGrid, renderFoodLog,
                renderActivityCalendar, restoreEditModes
            ],
            kitchen: [
                renderHeader, renderGroceryList, renderDevNotes, restoreEditModes
            ],
            inventory: [
                renderHeader,
                () => {
                    const name = document.body.dataset.itemName || '';
                    if (name) {
                        renderBuyItemDetail();
                    } else {
                        renderPriorityNotes();
                        renderRestockBanner();
                        renderActiveInventory();
                        renderBuyList();
                        renderPastInventory();
                    }
                },
                restoreEditModes
            ],
            money: [
                renderHeader, renderQuickExpense, renderCsvImport, renderSetAside,
                renderSpendingBreakdown, renderThisMonth, renderRecentExpenses,
                renderSubscriptions, renderBudgetConfig, restoreEditModes
            ],
        };
    }
    const fns = TAB_RENDERERS[currentTab] || Object.values(TAB_RENDERERS).flat();
    for (const fn of fns) {
        try { fn(); } catch(e) { console.error(fn.name + ' failed:', e); }
    }
}

// --- Time selector ---
function setTime(t) {
    selectedTime = t;
    render();
}

function getTime() { return selectedTime || D.time_of_day; }

// --- Header ---
function renderHeader() {
    const greetings = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' };
    document.getElementById('greeting').textContent = greetings[getTime()];
    document.getElementById('date-info').textContent = D.date;

    document.querySelectorAll('#time-selector .time-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.time === getTime());
    });
    document.querySelectorAll('#tab-selector .time-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === currentTab);
    });
}

// --- Utility functions ---
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function escJs(s) { return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'\\"'); }

// --- Tab navigation: post to parent (split.html) so URL updates without reloading the shell ---
function switchTab(event, name) {
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0)) return;  // let browser open in new tab
    if (window.parent && window.parent !== window) {
        if (event) event.preventDefault();
        window.parent.postMessage({ type: 'tab', name: name }, location.origin);
    }
    // standalone (no parent shell): let the <a> href navigate normally
}

window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    if (e.source !== window.parent) return;
    if (!e.data || e.data.type !== 'switchTo') return;
    const name = e.data.name;
    if (name === currentTab) return;
    currentTab = name;
    document.body.dataset.activeTab = name;
    initTab();
    loadDashboard();
});

// --- Frosted-placeholder helpers (public mode) ---
function isFrosted(v) { return v && typeof v === 'object' && v._frosted === true; }
function frostedCard(title, fauxCount) {
    if (fauxCount == null) fauxCount = 3;
    const widths = ['', ' medium', ' short'];
    let rows = '';
    for (let i = 0; i < fauxCount; i++) rows += `<div class="frosted-faux-row${widths[i % widths.length]}"></div>`;
    return `<div class="frosted-card">
        <div class="frosted-blur">
            ${title ? `<div class="frosted-title">${esc(title)}</div>` : ''}
            ${rows}
        </div>
        <div class="frosted-overlay"><a href="/login" target="_top">Sign in to view</a></div>
    </div>`;
}

// moved to top — needs to be declared before loadDashboard runs

function todayStr() {
    if (_serverDate) return _serverDate;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// --- Edit mode ---
const editingCards = new Set();

function toggleEditMode(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    if (editingCards.has(cardId)) {
        editingCards.delete(cardId);
    } else {
        editingCards.add(cardId);
    }
    applyEditMode(card, editingCards.has(cardId));
}

function applyEditMode(card, editing) {
    card.classList.toggle('editing', editing);
    const toggle = card.querySelector('.edit-toggle');
    if (toggle) toggle.textContent = editing ? 'done' : 'edit';
    card.querySelectorAll('.habit-view, .todo-view').forEach(el => el.style.display = editing ? 'none' : '');
    card.querySelectorAll('.habit-edit, .todo-edit').forEach(el => el.style.display = editing ? '' : 'none');
}

function restoreEditModes() {
    editingCards.forEach(cardId => {
        const card = document.getElementById(cardId);
        if (card) applyEditMode(card, true);
    });
}

async function commitRename(input) {
    const oldName = input.dataset.original;
    const newName = input.value.trim();
    const section = input.dataset.section;
    const type = input.dataset.type || 'habit';
    if (!newName || newName === oldName) return;
    let endpoint, body;
    if (type === 'growth') {
        endpoint = '/api/growth/rename';
        body = { old: oldName, new: newName };
    } else {
        endpoint = type === 'todo' ? '/api/todos/rename' : type === 'edge' ? '/api/edges/rename' : '/api/habits/rename';
        body = { old: oldName, new: newName, section };
    }
    await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    loadDashboard();
}

// --- Drag and drop for habits ---
let dragItem = null;
function habitDragStart(e) {
    dragItem = e.currentTarget;
    dragItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}
function habitDragOver(e) {
    e.preventDefault();
    const target = e.currentTarget;
    if (target !== dragItem) {
        target.classList.add('drag-over');
    }
}
function habitDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}
function habitDragEnd(e) {
    dragItem.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragItem = null;
}
async function habitDrop(e, type) {
    e.preventDefault();
    const target = e.currentTarget;
    target.classList.remove('drag-over');
    if (!dragItem || target === dragItem) return;
    const fromSection = dragItem.dataset.section;
    const toSection = target.dataset.section;

    // Cross-card move (todo only)
    if (fromSection !== toSection && type === 'todo') {
        const item = dragItem.dataset.habit;
        await fetch('/api/todos/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item, to_section: toSection })
        });
        loadDashboard();
        return;
    }

    if (fromSection !== toSection) return;

    // Same-card reorder
    const card = target.closest('.card');
    const allItems = [...card.querySelectorAll('.card-item[draggable]')];
    const fromIdx = allItems.indexOf(dragItem);
    const toIdx = allItems.indexOf(target);

    const items = allItems.map(el => el.dataset.habit);
    const moved = items.splice(fromIdx, 1)[0];
    items.splice(toIdx, 0, moved);

    if (type === 'growth') {
        await fetch('/api/growth/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: items })
        });
    } else {
        const endpoint = (type === 'todo') ? '/api/todos/reorder' : '/api/habits/reorder';
        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ section: fromSection, items })
        });
    }
    loadDashboard();
}

// Card-level drop zone for dragging items into empty areas of a card
function cardDragOver(e) {
    e.preventDefault();
    e.currentTarget.style.outline = '2px dashed var(--ongoing)';
    e.currentTarget.style.outlineOffset = '-2px';
}
function cardDragLeave(e) {
    e.currentTarget.style.outline = '';
    e.currentTarget.style.outlineOffset = '';
}
async function cardDrop(e, sectionName) {
    e.preventDefault();
    e.currentTarget.style.outline = '';
    e.currentTarget.style.outlineOffset = '';
    if (!dragItem) return;
    const fromSection = dragItem.dataset.section;
    if (fromSection === sectionName) return;
    const item = dragItem.dataset.habit;
    await fetch('/api/todos/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, to_section: sectionName })
    });
    loadDashboard();
}

// --- cardHTML (shared between habits and todos) ---
function cardHTML(title, items, color, type, sectionName, dim) {
    const cardId = `card-${type}-${sectionName.replace(/\s+/g,'-')}`;
    const itemsHTML = items.map((rawItem, idx) => {
        const item = typeof rawItem === 'string' ? { text: rawItem, done: false } : rawItem;
        const text = item.text;
        const done = item.done;
        return `<div class="card-item" draggable="true" data-section="${esc(sectionName)}" data-idx="${idx}" data-habit="${esc(text)}"
              ondragstart="habitDragStart(event)" ondragover="habitDragOver(event)" ondrop="habitDrop(event,'${type}')" ondragend="habitDragEnd(event)" ondragleave="habitDragLeave(event)">
            <span class="drag-handle">&#8942;&#8942;</span>
            <span class="habit-check ${done?'done':''}" onclick="toggleTodo('${escJs(text)}')" style="cursor:pointer" title="Check off">
                ${done ? '&#10003;' : '&#9675;'}
            </span>
            <span class="item-text todo-view" style="${done?'text-decoration:line-through;opacity:0.5':''}">${item.url ? `<a href="${esc(item.url)}" target="_blank" rel="noopener" style="color:inherit">${esc(text)}</a>` : esc(text)}</span>
            <input class="habit-rename todo-edit" style="display:none" value="${esc(text)}" data-original="${esc(text)}" data-section="${esc(sectionName)}" data-type="${type}"
                onblur="commitRename(this)" onkeydown="if(event.key==='Enter'){this.blur()}else if(event.key==='Escape'){this.value=this.dataset.original;this.blur()}">
            ${type === 'todo' ? `<button class="delete-btn" onclick="showMoveMenu(this,'${escJs(text)}')" title="Move" style="font-size:14px">&#8595;</button>` : ''}
            <button class="delete-btn" onclick="confirmDelete('${escJs(text)}','${type}')" title="Remove">&times;</button>
        </div>`;
    }).join('');

    const addId = `add-${type}-${sectionName.replace(/\s+/g,'-')}`;
    const addForm = `
        <div class="add-trigger" onclick="toggleAdd('${addId}')">+ Add</div>
        <div class="add-form" id="${addId}">
            <input type="text" placeholder="New item..." onkeydown="if(event.key==='Enter')addItem('${type}','${escJs(sectionName)}',this)">
            <button onclick="addItem('${type}','${escJs(sectionName)}',this.previousElementSibling)">Add</button>
        </div>`;

    const dropAttrs = type === 'todo' ? `ondragover="cardDragOver(event)" ondragleave="cardDragLeave(event)" ondrop="cardDrop(event,'${escJs(sectionName)}')"` : '';
    return `<div class="card${dim?' dimmed':''}" style="border-left-color:${color}" id="${cardId}" ${dropAttrs}>
        <div class="card-title" style="color:${color}">${title}<span class="edit-toggle" onclick="toggleEditMode('${cardId}')">edit</span></div>
        ${itemsHTML}${addForm}</div>`;
}

// --- habitCount, habitStartLabel, habitCardHTML ---
function habitCount(habit) {
    let count = 0;
    for (const date in D.habits_log) {
        if (D.habits_log[date][habit]) count++;
    }
    return count;
}

function habitStartLabel(item) {
    const starts = D.habit_starts || {};
    const d = starts[item];
    if (!d) return '';
    const days = Math.floor((new Date() - new Date(d + 'T00:00:00')) / 86400000);
    if (days === 0) return 'today · ';
    if (days === 1) return '1d · ';
    return `${days}d · `;
}

function habitCardHTML(title, items, color, sectionName) {
    const today = todayStr();
    const todayLog = (D.habits_log || {})[today] || {};

    const listId = `habit-list-${sectionName.replace(/\s+/g,'-')}`;
    const itemsHTML = items.map((item, idx) => {
        const done = !!todayLog[item];
        const total = habitCount(item);
        const target = 60;

        return `<div class="card-item" draggable="true" data-section="${esc(sectionName)}" data-idx="${idx}" data-habit="${esc(item)}"
                ondragstart="habitDragStart(event)" ondragover="habitDragOver(event)" ondrop="habitDrop(event,'habit')" ondragend="habitDragEnd(event)" ondragleave="habitDragLeave(event)">
            <span class="drag-handle">&#8942;&#8942;</span>
            <span class="habit-check ${done?'done':''}" onclick="toggleHabit('${esc(item)}')" title="Toggle today">
                ${done ? '&#10003;' : '&#9675;'}
            </span>
            <span class="item-text habit-view" style="${done?'text-decoration:line-through;opacity:0.5':''}">${esc(item)}</span>
            <input class="habit-rename habit-edit" style="display:none" value="${esc(item)}" data-original="${esc(item)}" data-section="${esc(sectionName)}"
                onblur="commitRename(this)" onkeydown="if(event.key==='Enter'){this.blur()}else if(event.key==='Escape'){this.value=this.dataset.original;this.blur()}">
            <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${habitStartLabel(item)}${total}/${target}</span>
            <button class="delete-btn" onclick="confirmDelete('${esc(item)}','habit')" title="Remove">&times;</button>
        </div>`;
    }).join('');

    const addId = `add-habit-${sectionName.replace(/\s+/g,'-')}`;
    const addForm = `
        <div class="add-trigger" onclick="toggleAdd('${addId}')">+ Add</div>
        <div class="add-form" id="${addId}">
            <input type="text" placeholder="New habit..." onkeydown="if(event.key==='Enter')addItem('habit','${esc(sectionName)}',this)">
            <button onclick="addItem('habit','${esc(sectionName)}',this.previousElementSibling)">Add</button>
        </div>`;

    return `<div class="card" style="border-left-color:${color}" id="${listId}">
        <div class="card-title" style="color:${color}">${title}<span class="edit-toggle" onclick="toggleEditMode('${listId}')">edit</span></div>
        ${itemsHTML}${addForm}</div>`;
}

// --- Modal system ---
function confirmDelete(item, type) {
    pendingDelete = { item, type };
    document.getElementById('modal-text').innerHTML = `Remove <b>${esc(item)}</b>?`;
    document.getElementById('modal').classList.add('open');
}

async function executeDelete() {
    if (!pendingDelete) return;
    if (pendingDelete.type === 'kitchen-done') {
        await fetch('/api/kitchen/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        // Check off any kitchen-related todo item
        const kitchenTodo = D.todos.flatMap(s => s.items)
            .find(i => {
                const text = typeof i === 'string' ? i : i.text;
                const done = typeof i === 'string' ? false : i.done;
                return text.toLowerCase().includes('grocer') && !done;
            });
        if (kitchenTodo) {
            const text = typeof kitchenTodo === 'string' ? kitchenTodo : kitchenTodo.text;
            await fetch('/api/todos/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item: text })
            });
        }
    } else if (pendingDelete.type === 'hrt-confirm') {
        const hrtDate = document.getElementById('hrt-date')?.value || todayStr();
        await fetch('/api/hrt/done', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: hrtDate })
        });
    } else if (pendingDelete.type === 'habit') {
        await fetch('/api/habits/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: pendingDelete.item })
        });
    } else if (pendingDelete.type === 'habit-dot') {
        await fetch('/api/habits/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ habit: pendingDelete.habit, date: pendingDelete.date })
        });
    } else if (pendingDelete.type === 'buy') {
        await fetch('/api/buy/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: pendingDelete.item })
        });
    } else if (pendingDelete.type === 'edge') {
        await fetch('/api/edges/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: pendingDelete.item })
        });
    } else if (pendingDelete.type === 'growth') {
        await fetch('/api/growth/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: pendingDelete.item })
        });
    } else if (pendingDelete.type === 'active') {
        await fetch('/api/active/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: pendingDelete.item })
        });
    } else if (pendingDelete.type === 'run') {
        await fetch('/api/runs/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: pendingDelete.date })
        });
    } else if (pendingDelete.type === 'kitchen-trip') {
        await fetch('/api/kitchen/trips/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: pendingDelete.date })
        });
    } else if (pendingDelete.type === 'activity') {
        await fetch('/api/activity/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: pendingDelete.date, type: pendingDelete.actType })
        });
    } else if (pendingDelete.type === 'contact-history') {
        await fetch('/api/contacts/history/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: pendingDelete.name, date: pendingDelete.date, method: pendingDelete.method })
        });
    } else {
        await fetch(`/api/${pendingDelete.type}s/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item: pendingDelete.item })
        });
    }
    closeModal();
    loadDashboard();
}

function closeModal() {
    pendingDelete = null;
    document.getElementById('modal').classList.remove('open');
    document.getElementById('modal').querySelector('.confirm').textContent = 'Yes, remove';
}

// --- toggleAdd, addItem, showMoveMenu, moveTodo ---
function toggleAdd(id) {
    const el = document.getElementById(id);
    el.classList.toggle('open');
    if (el.classList.contains('open')) el.querySelector('input').focus();
}

async function addItem(type, section, inputEl) {
    const text = inputEl.value.trim();
    if (!text) return;
    const res = await fetch(`/api/${type}s/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: text, section: section })
    });
    if (res.ok) {
        inputEl.value = '';
        loadDashboard();
    } else {
        const data = await res.json();
        alert(data.error || 'Failed to add');
    }
}

function showMoveMenu(btn, item) {
    // Remove any existing move menu
    document.querySelectorAll('.move-menu').forEach(m => m.remove());
    const sections = D.todos.filter(s => !s.name.toLowerCase().startsWith('done')).map(s => s.name);
    const menu = document.createElement('div');
    menu.className = 'move-menu';
    menu.style.cssText = 'position:absolute;right:0;top:100%;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.12);z-index:100;min-width:160px;padding:4px 0;font-size:13px';
    sections.forEach(s => {
        const opt = document.createElement('div');
        opt.textContent = s;
        opt.style.cssText = 'padding:6px 14px;cursor:pointer;color:var(--text)';
        opt.onmouseenter = () => opt.style.background = 'var(--bg)';
        opt.onmouseleave = () => opt.style.background = 'none';
        opt.onclick = () => { menu.remove(); moveTodo(item, s); };
        menu.appendChild(opt);
    });
    btn.parentElement.style.position = 'relative';
    btn.parentElement.appendChild(menu);
    // Close on outside click
    setTimeout(() => document.addEventListener('click', function close(e) {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); }
    }), 0);
}

async function moveTodo(item, toSection) {
    await fetch('/api/todos/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, to_section: toSection })
    });
    loadDashboard();
}

// --- Toggle functions ---
async function toggleTodo(item) {
    await fetch('/api/todos/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item })
    });
    loadDashboard();
}

async function toggleHabit(habit) {
    await fetch('/api/habits/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habit })
    });
    loadDashboard();
}

async function toggleHabitDate(habit, date) {
    await fetch('/api/habits/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habit, date })
    });
    loadDashboard();
}

function confirmHabitDot(habit, date) {
    pendingDelete = { type: 'habit-dot', habit, date };
    document.getElementById('modal-text').innerHTML = `Remove <b>${esc(habit)}</b> on ${date}?`;
    document.getElementById('modal').classList.add('open');
}

function toggleChore(chore) {
    const today = todayStr();
    const choreLog = JSON.parse(localStorage.getItem('choreLog') || '{}');
    if (!choreLog[today]) choreLog[today] = {};
    if (choreLog[today][chore]) {
        delete choreLog[today][chore];
    } else {
        choreLog[today][chore] = true;
    }
    // Clean up old days (keep last 3)
    const dates = Object.keys(choreLog).sort();
    while (dates.length > 3) { delete choreLog[dates.shift()]; }
    localStorage.setItem('choreLog', JSON.stringify(choreLog));
    render();
}

// --- addEdge ---
async function addEdge(inputEl) {
    const text = inputEl.value.trim();
    if (!text) return;
    const res = await fetch('/api/edges/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: text })
    });
    if (res.ok) {
        inputEl.value = '';
        loadDashboard();
    } else {
        const data = await res.json();
        alert(data.error || 'Failed to add');
    }
}

// --- Constants ---
const ACT_TYPES = {
    run:              { label: 'Run',     color: 'var(--green)' },
    kitchen:          { label: 'Grocery', color: '#4A90D9' },
    'laundry-sheets': { label: 'Sheets',  color: '#E06060' },
    'wash-eyemasks':  { label: 'Eye masks', color: '#5BB8C9' },
    'change-pillowcase': { label: 'Pillowcase', color: '#D4A0A0' },
    'wash-hair':      { label: 'Hair wash', color: '#8B7EC8' },
    estradiol:        { label: 'Estradiol', color: '#E091C7' },
};

const APP_STATUSES = ['applied', '1st round interview', '2nd round interview', 'offer', 'rejected', 'withdrawn'];
const APP_STATUS_CLASS = (s) => {
    s = s.toLowerCase();
    if (s.includes('interview')) return 'interviewing';
    if (s.includes('offer')) return 'offer';
    if (s.includes('reject')) return 'rejected';
    if (s.includes('withdrawn')) return 'withdrawn';
    return 'applied';
};

// --- Dev Notes (per-tab friction log) ---
// Lives at the bottom of any page that has a div with class "dev-notes-area"
// or a div whose id starts with "dev-notes-". The div needs `data-tab="<key>"`.
// Notes are loaded from D.dev_notes (the page's data endpoint must populate it).

function renderDevNotes() {
    const els = document.querySelectorAll('[id^="dev-notes-"]');
    els.forEach(el => {
        const tab = el.dataset.tab || el.id.replace('dev-notes-', '');
        const notes = D.dev_notes || [];
        const rows = notes.map(n => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--border);font-size:13px">
            <div style="flex:1">${esc(n.text)}</div>
            <div style="font-size:11px;color:var(--text-muted);white-space:nowrap">${esc(n.created || '')}</div>
            <button onclick="removeDevNote('${escJs(tab)}','${escJs(n.id)}')" title="Remove" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;padding:0 4px">&times;</button>
        </div>`).join('');
        el.innerHTML = `<details style="margin-top:24px">
            <summary style="font-size:13px;font-weight:600;cursor:pointer;color:var(--text-muted)">Dev notes${notes.length ? ` (${notes.length})` : ''}</summary>
            <div class="card" style="border-left-color:var(--text-muted);margin-top:8px;padding:10px">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">Friction, change ideas, things to fix on this page.</div>
                ${rows}
                <div style="display:flex;gap:6px;margin-top:10px;border-top:${notes.length ? '1px solid var(--border)' : 'none'};padding-top:${notes.length ? '8px' : '0'}">
                    <input type="text" id="devnote-input-${esc(tab)}" placeholder="What's bugging you about this page?" style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;outline:none;background:var(--bg)" onkeydown="if(event.key==='Enter')addDevNote('${escJs(tab)}')">
                    <button onclick="addDevNote('${escJs(tab)}')" style="padding:6px 14px;border:none;border-radius:6px;background:var(--text);color:#fff;font-size:12px;font-weight:600;cursor:pointer">Add</button>
                </div>
            </div>
        </details>`;
    });
}

async function addDevNote(tab) {
    const input = document.getElementById(`devnote-input-${tab}`);
    const text = input.value.trim();
    if (!text) return;
    const res = await fetch('/api/devnote/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, text })
    });
    if (res.ok) {
        input.value = '';
        loadDashboard();
    }
}

async function removeDevNote(tab, id) {
    await fetch('/api/devnote/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, id })
    });
    loadDashboard();
}
