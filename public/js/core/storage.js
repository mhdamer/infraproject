'use strict';

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function loadInitialWorkbook() {
    // بيانات الشيت لا تحفظ محلياً؛ EMBEDDED_WORKBOOK مجرد هيكل بدء تشغيل غير مرجعي.
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    return ensureWorkbookShape(clone(EMBEDDED_WORKBOOK));
}

/**
 * ★ SHARAEEN: تأكد من وجود كل شيت — لكن بدون شروط فواز/سبيس
 */
function ensureWorkbookShape(wb) {
    const legacyHeaders = new Set(['مدقق', 'محذوف', 'النسخة']);
    Object.values(AppConfig.SHEETS).forEach(name => {
        if (!wb[name] || !Array.isArray(wb[name].headers) || !Array.isArray(wb[name].rows)) {
            wb[name] = { headers: [], rows: [] };
            return;
        }
        const headers = wb[name].headers;
        const keepIndexes = headers.map((header, index) => legacyHeaders.has(String(header).trim()) ? -1 : index).filter(index => index >= 0);
        if (keepIndexes.length !== headers.length) {
            wb[name].headers = keepIndexes.map(index => headers[index]);
            wb[name].rows = wb[name].rows.map(row => keepIndexes.map(index => row[index] ?? ''));
        }
    });
    return wb;
}

function loadApiUrl() { return AppConfig.API_URL; }

function saveWorkbook() {
    // يمنع التخزين المحلي لبيانات Excel؛ تبقى الجلسة/المصادقة في مخزنها المستقل.
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    const el = $('localStatus');
    if (el) el.textContent = 'البيانات مباشرة من Google Sheets';
}
