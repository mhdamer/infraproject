'use strict';

/**
 * render-panels.js — colMenu + notifications + notes
 * ★ SHARAEEN: colMenu للمقاولين فقط، notifications مبسّط، notes كما هو
 */

let currentHiddenCols = new Set();
const HIDDEN_COLS_KEY_PREFIX = 'sharaeen_hidden_cols_';

function loadHiddenCols(sheet) {
    try {
        const raw = localStorage.getItem(HIDDEN_COLS_KEY_PREFIX + sheet);
        currentHiddenCols = raw ? new Set(JSON.parse(raw)) : new Set();
    } catch (e) { currentHiddenCols = new Set(); }
}
function saveHiddenCols(sheet) {
    try { localStorage.setItem(HIDDEN_COLS_KEY_PREFIX + sheet, JSON.stringify([...currentHiddenCols])); } catch (e) {}
}
const isColHidden = h => currentHiddenCols.has(normalizeText(h));

function renderGenericColMenu() {
    const list = $('colMenuList');
    if (!list) return;
    list.replaceChildren();
    const headers = sheetHeaders(activeSheet);
    let hiddenCount = 0;
    headers.forEach(h => {
        const name = String(h ?? '').trim();
        if (!name || name === ATT_H || name === AUDIT_H || name === DELETED_H || name === VERSION_H) return;
        const key = normalizeText(name);
        const isHidden = currentHiddenCols.has(key);
        if (isHidden) hiddenCount++;
        const label = document.createElement('label');
        label.className = 'flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-slate-200 hover:bg-slate-800';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !isHidden;
        cb.className = 'h-4 w-4 cursor-pointer accent-emerald-500';
        cb.addEventListener('change', () => {
            if (cb.checked) currentHiddenCols.delete(key);
            else currentHiddenCols.add(key);
            saveHiddenCols(activeSheet);
            renderTable();
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(name));
        list.appendChild(label);
    });
    if ($('colMenuBtn')) $('colMenuBtn').textContent = hiddenCount ? '☰ الأعمدة (' + hiddenCount + ' مخفي)' : '☰ الأعمدة';
}

if ($('colMenuBtn')) {
    $('colMenuBtn').addEventListener('click', e => {
        e.stopPropagation();
        const menu = $('colMenu');
        if (menu) {
            menu.classList.toggle('hidden');
            $('colMenuBtn').setAttribute('aria-expanded', String(!menu.classList.contains('hidden')));
        }
    });
}

if ($('colShowAll')) {
    $('colShowAll').addEventListener('click', () => {
        currentHiddenCols.clear();
        saveHiddenCols(activeSheet);
        renderTable();
    });
}

document.addEventListener('click', e => {
    const wrap = $('colMenuWrap');
    if (wrap && !wrap.contains(e.target) && $('colMenu')) $('colMenu').classList.add('hidden');
});

/**
 * إشعارات التدقيق — مبسّطة للشيتات الخمسة
 */
function renderNotifications() {
    if ($('notifWrap')) $('notifWrap').classList.add('hidden');
    return;
    if (!authIsAdmin()) { if ($('notifWrap')) $('notifWrap').classList.add('hidden'); return; }
    if ($('notifWrap')) $('notifWrap').classList.remove('hidden');
    const list = $('notifList');
    const badge = $('notifBadge');
    if (!list || !badge) return;

    let pending = [];
    ALL_SHEETS.forEach(sheet => {
        const h = sheetHeaders(sheet);
        const ai = h.findIndex(x => String(x).trim() === AUDIT_H);
        const di = h.findIndex(x => String(x).trim() === DELETED_H);
        if (ai < 0) return;
        sheetRows(sheet).forEach(r => {
            if (di >= 0 && (r[di] === true || String(r[di]).toLowerCase() === 'true')) return;
            if (!rfpFlag(r[ai])) {
                const g = (names) => { const i = findHeaderIndex(h, names); return i >= 0 ? String(r[i] ?? '').trim() : ''; };
                let id = 'سجل';
                if (sheet === GL) id = g(['رقم الوصل', 'البيان']) || 'قيد';
                else if (sheet === CT) id = g(['اسم المقاول']);
                else if (sheet === ADV) id = g(['المصدر']) || 'سلفة';
                else if (sheet === WD) id = g(['الشريك']) || 'حركة';
                else if (sheet === DB) id = g(['الاسم']);
                pending.push({ type: 'audit', sheet, id });
            }
        });
    });

    list.replaceChildren();
    if (!pending.length) {
        badge.classList.add('hidden');
        const empty = document.createElement('div');
        empty.className = 'p-4 text-center text-sm text-slate-300';
        empty.textContent = 'لا توجد إشعارات تدقيق';
        list.appendChild(empty);
        return;
    }
    badge.textContent = pending.length > 99 ? '99+' : pending.length;
    badge.classList.remove('hidden');
    pending.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'flex w-full flex-col items-start gap-1 border-b border-slate-700/60 px-4 py-3 text-right transition hover:bg-slate-800/80';
        const s1 = document.createElement('span');
        s1.className = 'text-xs font-bold text-emerald-400';
        s1.textContent = item.sheet;
        const s2 = document.createElement('span');
        s2.className = 'text-sm text-slate-100';
        s2.textContent = 'يحتاج تدقيق: ' + item.id;
        btn.appendChild(s1); btn.appendChild(s2);
        btn.addEventListener('click', () => { if (typeof window.goToNotification === 'function') window.goToNotification(item.sheet, item.id); });
        list.appendChild(btn);
    });
}

window.goToNotification = (sheet, idText) => {
    activeSheet = sheet;
    page = 1;
    if ($('searchInput')) $('searchInput').value = String(idText || '');
    render();
    if ($('notifMenu')) $('notifMenu').classList.add('hidden');
};

/**
 * الملاحظات (نفس الفرح)
 */
function renderNotes() {
    if (!session) return;
    if ($('notesWrap')) $('notesWrap').classList.remove('hidden');
    const list = $('notesList');
    const badge = $('notesBadge');
    if (!list || !badge) return;
    const notes = loadNotes();
    const lastRead = Number(localStorage.getItem('sharaeen_last_notes_read') || 0);
    const unread = notes.filter(n => n.time > lastRead && n.user !== session.username).length;
    if (unread > 0 && $('notesMenu') && $('notesMenu').classList.contains('hidden')) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.classList.remove('hidden');
    } else badge.classList.add('hidden');

    list.replaceChildren();
    if (!notes.length) {
        const empty = document.createElement('div');
        empty.className = 'p-4 text-center text-sm text-slate-300';
        empty.textContent = 'لا توجد ملاحظات';
        list.appendChild(empty);
        return;
    }
    notes.forEach(item => {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col gap-1 border-b border-slate-700/60 px-4 py-3 hover:bg-slate-800/80 transition';
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center';
        const nameEl = document.createElement('span');
        nameEl.className = 'text-xs font-bold text-amber-300';
        nameEl.textContent = (item.role === 'admin' ? 'المدير' : (item.name || item.user)) + ' :';
        const timeEl = document.createElement('span');
        timeEl.className = 'text-[10px] text-slate-400';
        try { timeEl.textContent = new Date(item.time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }); } catch (e) {}
        row.appendChild(nameEl); row.appendChild(timeEl);
        const textEl = document.createElement('div');
        textEl.className = 'text-sm text-slate-100';
        textEl.textContent = String(item.text ?? '');
        wrapper.appendChild(row); wrapper.appendChild(textEl);
        if (authIsAdmin() || item.user === session.username) {
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'text-[10px] text-rose-400 self-end hover:underline mt-1';
            delBtn.textContent = 'حذف';
            delBtn.addEventListener('click', () => { if (typeof window.deleteNote === 'function') window.deleteNote(item.id); });
            wrapper.appendChild(delBtn);
        }
        list.appendChild(wrapper);
    });
}

window.deleteNote = (id) => {
    if (!confirm('حذف هذه الملاحظة؟')) return;
    const notes = loadNotes().filter(n => n.id !== id);
    saveNotes(notes);
    renderNotes();
};
