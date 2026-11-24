'use strict';

/**
 * ui-events.js — أحداث الواجهة
 * v1.1 — حماية من العناصر المفقودة قبل/بعد الحقن
 */

function onEl(id, event, handler) {
    const el = $(id);
    if (el) el.addEventListener(event, handler);
    return el;
}

// ===== قائمة الترس =====
const gearSet = open => {
    const menu = $('gearMenu');
    const btn = $('gearButton');
    if (menu && btn) {
        menu.classList.toggle('hidden', !open);
        btn.setAttribute('aria-expanded', String(open));
    }
};

const gearBtn = $('gearButton');
if (gearBtn) {
    gearBtn.addEventListener('click', e => {
        e.stopPropagation();
        gearSet($('gearMenu')?.classList.contains('hidden'));
    });
}

document.addEventListener('click', e => {
    const wrap = $('gearWrap');
    if (wrap && !wrap.contains(e.target)) gearSet(false);
});

// ===== الشريط الجانبي =====
const sidebar = $('sidebar');
const sidebarBackdrop = $('sidebarBackdrop');

function openSidebar() {
    if (!sidebar || !sidebarBackdrop) return;
    sidebar.classList.remove('translate-x-full');
    sidebar.classList.add('translate-x-0');
    sidebarBackdrop.classList.remove('hidden');
}

function closeSidebar() {
    if (!sidebar || !sidebarBackdrop) return;
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('translate-x-full');
    sidebarBackdrop.classList.add('hidden');
}

onEl('toggleSidebarBtn', 'click', openSidebar);
onEl('closeSidebarBtn', 'click', closeSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);

// ===== 1. قائمة الإشعارات =====
onEl('notifBtn', 'click', (e) => {
    e.stopPropagation();
    const menu = $('notifMenu');
    const notes = $('notesMenu');
    if (!menu) return;
    const isOpening = menu.classList.contains('hidden');
    if (notes) { notes.classList.add('hidden'); notes.classList.remove('flex'); }
    if (isOpening) { menu.classList.remove('hidden'); menu.classList.add('flex'); }
    else { menu.classList.add('hidden'); menu.classList.remove('flex'); }
});

// ===== 2. قائمة الملاحظات =====
onEl('notesBtn', 'click', (e) => {
    e.stopPropagation();
    const menu = $('notesMenu');
    const notif = $('notifMenu');
    if (!menu) return;
    const isOpening = menu.classList.contains('hidden');
    if (notif) { notif.classList.add('hidden'); notif.classList.remove('flex'); }
    if (isOpening) { menu.classList.remove('hidden'); menu.classList.add('flex'); }
    else { menu.classList.add('hidden'); menu.classList.remove('flex'); }
    if (isOpening) {
        try { localStorage.setItem('al_farah_last_notes_read', Date.now()); } catch (e) {}
        $('notesBadge')?.classList.add('hidden');
        if (typeof renderNotes === 'function') renderNotes();
    }
});

document.addEventListener('click', (e) => {
    const nw = $('notifWrap'), nm = $('notifMenu');
    if (nw && nm && !nw.contains(e.target)) { nm.classList.add('hidden'); nm.classList.remove('flex'); }
    const ow = $('notesWrap'), om = $('notesMenu');
    if (ow && om && !ow.contains(e.target)) { om.classList.add('hidden'); om.classList.remove('flex'); }
});

onEl('addNoteBtn', 'click', () => {
    const input = $('newNoteInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const notes = loadNotes();
    notes.unshift({
        id: Date.now(),
        user: session.username,
        role: session.role,
        name: session.name || session.username,
        text: text,
        time: Date.now()
    });
    saveNotes(notes);
    input.value = '';
    if (typeof renderNotes === 'function') renderNotes();
    toast('تمت إضافة الملاحظة');
});

onEl('newNoteInput', 'keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        $('addNoteBtn')?.click();
    }
});

// ===== إدارة حالة الاتصال بالإنترنت =====
function updateOfflineStatus() {
    const banner = $('offlineBanner');
    const local = $('localStatus');
    if (!navigator.onLine) {
        banner?.classList.remove('hidden');
        if (local) { local.textContent = 'غير متصل (حفظ محلي)'; local.classList.add('text-rose-400'); }
    } else {
        banner?.classList.add('hidden');
        if (local) { local.textContent = 'متصل بالإنترنت'; local.classList.remove('text-rose-400'); }
    }
}

window.addEventListener('offline', () => {
    updateOfflineStatus();
    toast('انقطع الاتصال بالإنترنت. يعمل التطبيق الآن محلياً.', 'error');
});

window.addEventListener('online', () => {
    updateOfflineStatus();
    toast('تم استعادة الاتصال بالإنترنت. استخدم أزرار الجلب أو المزامنة عند الحاجة.');
});

document.addEventListener('DOMContentLoaded', updateOfflineStatus);

// ===== بقية الأحداث =====
function showSettings() {
    const el = $('apiUrlInput'); if (el) el.value = apiUrl;
    const s = $('spreadsheetIdText'); if (s) s.textContent = AppConfig.SPREADSHEET_ID;
    $('settingsModal')?.classList.remove('hidden');
    $('settingsModal')?.classList.add('flex');
}

function hideSettings() {
    $('settingsModal')?.classList.add('hidden');
    $('settingsModal')?.classList.remove('flex');
}

onEl('searchInput', 'input', debounce(() => {
    page = 1;
    if (typeof renderTable === 'function') renderTable();
    if (typeof renderMetrics === 'function') renderMetrics();
}, 250));

onEl('contractorFilter', 'change', () => { page = 1; if (typeof renderTable === 'function') renderTable(); if (typeof renderMetrics === 'function') renderMetrics(); });
onEl('unitFilter', 'change', () => { page = 1; if (typeof renderTable === 'function') renderTable(); if (typeof renderMetrics === 'function') renderMetrics(); });
onEl('pageSize', 'change', () => { page = 1; if (typeof renderTable === 'function') renderTable(); if (typeof renderMetrics === 'function') renderMetrics(); });
onEl('prevPage', 'click', () => { page = Math.max(1, page - 1); if (typeof renderTable === 'function') renderTable(); if (typeof renderMetrics === 'function') renderMetrics(); });
onEl('nextPage', 'click', () => { page++; if (typeof renderTable === 'function') renderTable(); if (typeof renderMetrics === 'function') renderMetrics(); });

onEl('excelInput', 'change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { await parseWorkbookFile(file); } catch (error) { toast(error.message || 'تعذر قراءة ملف Excel.', 'error'); } finally { event.target.value = ''; }
});

onEl('exportExcel', 'click', () => exportWorkbook());
onEl('refreshSheet', 'click', () => refreshFromSheets());
onEl('syncSheet', 'click', () => syncCurrentSheet());
onEl('settingsButton', 'click', showSettings);
onEl('closeSettings', 'click', hideSettings);
onEl('cancelSettings', 'click', hideSettings);

onEl('saveSettings', 'click', () => {
    try {
        const value = $('apiUrlInput').value.trim();
        const u = new URL(value);
        if (u.protocol !== 'https:' || u.hostname !== 'script.google.com' || !u.pathname.endsWith('/exec'))
            throw new Error('أدخل رابطاً صالحاً');
        apiUrl = u.toString();
        localStorage.setItem('al_farah_api_url', apiUrl);
        hideSettings();
        toast('تم حفظ رابط API في هذا المتصفح.');
    } catch (error) {
        toast(error.message, 'error');
    }
});

document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
        hideSettings();
        closeSidebar();
        $('notifMenu')?.classList.add('hidden'); $('notifMenu')?.classList.remove('flex');
        $('notesMenu')?.classList.add('hidden'); $('notesMenu')?.classList.remove('flex');
        if (typeof auditClose === 'function') auditClose();
        if (typeof hideAdd === 'function') hideAdd();
    }
});

// ===== اقتراح 5: زر فتح سجل التدقيق =====
onEl('auditLogButton', 'click', () => {
    gearSet(false);
    if (typeof auditOpen === 'function') auditOpen();
});

// ===== اقتراح 6: نسخ احتياطي كامل + استيراد =====
onEl('exportBackup', 'click', async () => {
    gearSet(false);
    if (typeof exportFullBackup === 'function') await exportFullBackup();
});

onEl('backupInput', 'change', async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (typeof importFullBackup === 'function') await importFullBackup(file);
});
