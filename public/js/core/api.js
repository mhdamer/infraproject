'use strict';

/**
 * api.js — طبقة الاتصال بالـ API لمشروع الشارعين
 * v1.2 — قراءة بيانات التبويب النشط وربط سلف العمل بالسجل العام
 */

let apiBusy = false;

function getApiUrl(path) {
    const base = AppConfig.API_URL.replace(/\/$/, '');
    return base + path;
}

async function fetchSheetData(sheetName = activeSheet) {
    if (!navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت.');
    if (!session) throw new Error('سجّل الدخول أولاً.');

    const url = new URL(getApiUrl('/sheets'), window.location.origin);
    url.searchParams.set('sheet', sheetName);
    url.searchParams.set('_', String(Date.now()));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(url.toString(), {
            method: 'GET', credentials: 'include',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });
        if (response.status === 401) { authCheckError('Unauthorized'); throw new Error('انتهت الجلسة.'); }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) {
        if (err.name === 'AbortError') throw new Error('انتهت مهلة الجلب.');
        throw err;
    } finally { clearTimeout(timer); }
}

function responseToRows(data, sheetName) {
    if (data && data.error) {
        authCheckError(data.error);
        throw new Error(authErrorText(data.error));
    }
    const existingHeaders = sheetHeaders(sheetName);
    let headers = Array.isArray(data?.headers) ? data.headers.map(String) : existingHeaders;
    let rows = data?.rows || data?.records || data?.data || data;
    if (!Array.isArray(rows)) throw new Error('صيغة رد غير معروفة.');
    if (rows.length && Array.isArray(rows[0])) {
        let foundHeaderRow = false;
        const rowHas = (row, value) => row.some(cell => normalizeText(cell) === normalizeText(value));
        const validHeader = candidate => {
            if (sheetName === GL) return (rowHas(candidate, 'رقم الوصل') || rowHas(candidate, 'ت')) && rowHas(candidate, 'المبلغ') && rowHas(candidate, 'التاريخ');
            if (sheetName === CT) return rowHas(candidate, 'اسم المقاول') && rowHas(candidate, 'رقم الذرعة');
            if (sheetName === ADV) return rowHas(candidate, 'ت') && rowHas(candidate, 'المبلغ') && rowHas(candidate, 'التفاصيل') && rowHas(candidate, 'التاريخ');
            if (sheetName === WD) return rowHas(candidate, 'التمويل') && rowHas(candidate, 'السحب') && rowHas(candidate, 'التاريخ');
            if (sheetName === DB) return rowHas(candidate, 'الاسم') && (rowHas(candidate, 'المبلغ المطلوب دينار') || rowHas(candidate, 'المبلغ المطلوب $'));
            return true;
        };
        if (!validHeader(headers)) {
            const at = rows.findIndex(row => validHeader(row.map(String)));
            if (at >= 0) {
                headers = rows[at].map(String);
                rows = rows.slice(at + 1);
                foundHeaderRow = true;
            }
        }
        if (!foundHeaderRow && !data?.headers && rows[0].some(v => existingHeaders.some(h => normalizeText(h) === normalizeText(v)))) {
            headers = rows[0].map(String);
            rows = rows.slice(1);
        }
        if (sheetName === ADV || sheetName === WD) {
            const footer = rows.findIndex(row => row.some(value => /اجمالي السلف|اجمالي السلف المستلمة|مجمل التمويل|مجمل السحب|فرق التمويل عن السحب|الصافي من حصته/.test(String(value ?? ''))));
            if (footer >= 0) rows = rows.slice(0, footer);
        }
        return { headers, rows: rows.map(r => headers.map((_, i) => r[i] ?? '')) };
    }
    if (rows.length && typeof rows[0] === 'object' && rows[0] !== null) {
        if (!headers.length) headers = Object.keys(rows[0]);
        return { headers, rows: rows.map(r => headers.map(h => r[h] ?? '')) };
    }
    return { headers, rows: [] };
}

async function refreshFromSheets() {
    if (activeSheet === DB) {
        render();
        return toast('المديونية محسوبة مباشرة من الذرعات والمدفوعات في السجل العام.');
    }
    if (apiBusy) return toast('عملية أخرى قيد التنفيذ، يرجى الانتظار...', 'error');
    apiBusy = true;
    const button = $('refreshSheet');
    if (button) { button.disabled = true; button.textContent = 'جارٍ الجلب...'; }

    const hadData = sheetRows(activeSheet).length > 0;
    if (!hadData) {
        tableSkeletonLoading = true;
        try { renderTable(); } catch (e) {}
    }
    try {
        const data = await fetchSheetData(activeSheet);
        if (data && data.projectAccounting) {
            projectAccountingSnapshot = data.projectAccounting;
            if (typeof wdSetProjectAccounting === 'function') wdSetProjectAccounting(data.projectAccounting);
        }
        const part = responseToRows(data, activeSheet);

        if (!part.headers.length) throw new Error('لم يرجع API عناوين الأعمدة.');
        if (part.headers.some(h => String(h).trim() === ATT_H)) ensureAttHeader(activeSheet);

        const legacySystemHeaders = new Set([AUDIT_H, DELETED_H, VERSION_H]);
        const sourceHeaderIndexes = part.headers.map((h, i) => legacySystemHeaders.has(String(h).trim()) ? -1 : i).filter(i => i >= 0);
        let headers = part.headers.length
            ? sourceHeaderIndexes.map(i => part.headers[i])
            : sheetHeaders(activeSheet).filter(h => !legacySystemHeaders.has(String(h).trim()));

        let mapped = [];
        if (part.headers.length) {
            mapped = part.rows.map(row => headers.length === sourceHeaderIndexes.length
                ? sourceHeaderIndexes.map(i => row[i] ?? '')
                : headers.map(h => {
                    const ix = part.headers.findIndex(x => normalizeText(x) === normalizeText(h));
                    return ix < 0 ? '' : row[ix] ?? '';
                }));
        }

        const previousHeaders = sheetHeaders(activeSheet);
        const compatibleHeaders = previousHeaders.length === headers.length && previousHeaders.every((h, i) => normalizeText(h) === normalizeText(headers[i]));
        const isFooterOrBlank = row => {
            const cells = row.map(v => String(v ?? '').trim());
            if (!cells.some(Boolean)) return true;
            return cells.some(v => /^(المجموع الكلي|اجمالي السلف المستلمة|إجمالي السلف المستلمة|مجمل التمويل|المجموع|الإجمالي)$/i.test(v));
        };
        // الشيت هو المصدر الوحيد: استبدال بيانات التبويب الحالي، وعدم دمج cache قديم.
        workbookData[activeSheet] = { headers, rows: mapped.filter(row => !isFooterOrBlank(row)) };
        if (activeSheet === CT && typeof ensureContractorProfileHeaders === 'function') ensureContractorProfileHeaders();

        fixDates();
        saveWorkbook();
        toast(`تم استبدال بيانات التبويب ببيانات الشيت (${new Intl.NumberFormat('en-US').format(workbookData[activeSheet].rows.length)} سجل).`);
    } catch (error) {
        toast(error.message || 'تعذر الجلب.', 'error');
    } finally {
        tableSkeletonLoading = false;
        if (button) { button.disabled = false; button.textContent = 'جلب من Google Sheets'; }
        try { render(); } catch (e) {}
        apiBusy = false;
    }
}

async function sendSheetData(payload) {
    lastWriteAt = Date.now();
    if (!session) throw new Error('سجّل الدخول أولاً.');
    if (payload && (AppConfig.READONLY_SHEETS || []).includes(payload.sheet || payload.sheetName))
        throw new Error('هذا التبويب للاطلاع فقط — لا يمكن التعديل.');

    const AUDIT_ACTIONS = ['add', 'update', 'delete', 'attach', 'detach', 'sync', 'mark'];
    const shouldAudit = !!(payload && payload.sheet && AUDIT_ACTIONS.indexOf(payload.action) >= 0 && typeof auditLog === 'function');
    const auditDetail = shouldAudit ? auditExtractDetail(payload) : '';

    let response;
    try {
        response = await fetch(getApiUrl('/proxy'), {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify(payload), cache: 'no-store'
        });
    } catch (err) {
        if (shouldAudit) auditLog(payload.action, payload.sheet, auditDetail, 'failed');
        if (!navigator.onLine) throw new Error('لا يوجد اتصال.');
        return { status: 'sent-unverified' };
    }
    let data = null;
    try { data = await response.json(); } catch (e) {
        if (shouldAudit) auditLog(payload.action, payload.sheet, auditDetail, 'failed');
        return { status: 'sent-unverified' };
    }
    if (data && data.error) {
        if (shouldAudit) auditLog(payload.action, payload.sheet, auditDetail, 'failed');
        authCheckError(data.error);
        if (data.error === 'Conflict') {
            toast('⚠️ ' + data.detail + ' استخدم زر «جلب من Google Sheets» للمراجعة.', 'error');
            throw new Error(data.detail);
        }
        throw new Error(authErrorText(data.error) + (data.detail ? ' — ' + data.detail : ''));
    }
    if (shouldAudit) auditLog(payload.action, payload.sheet, auditDetail, 'success');
    return { status: 'success', data };
}

/**
 * ★ SHARAEEN: مفاتيح المزامنة لكل شيت
 */
function getMergeKeysForSheet(sheet) {
    if (sheet === AppConfig.SHEETS.CONTRACTORS)      return ['اسم المقاول', 'رقم الذرعة', 'المادة/العمل'];
    if (sheet === AppConfig.SHEETS.ADVANCES)         return ['ت', 'التاريخ', 'المبلغ'];
    if (sheet === AppConfig.SHEETS.WITHDRAWALS)      return ['التاريخ', 'التمويل', 'السحب'];
    if (sheet === AppConfig.SHEETS.DEBTS)            return ['الاسم', 'ت'];
    if (sheet === AppConfig.SHEETS.GENERAL_LEDGER)   return findHeaderIndex(sheetHeaders(sheet), ['رقم الوصل']) < 0 ? ['ت', 'التاريخ', 'المبلغ'] : ['رقم الوصل', 'التاريخ', 'المبلغ'];
    return sheetHeaders(sheet).slice(0, 2);
}

async function syncCurrentSheet() {
    if (apiBusy) return toast('عملية أخرى قيد التنفيذ، يرجى الانتظار...', 'error');
    if ((AppConfig.READONLY_SHEETS || []).includes(activeSheet))
        return toast('هذا التبويب للاطلاع فقط — لا يمكن المزامنة.', 'error');

    const headers = sheetHeaders(activeSheet);
    const rows = sheetRows(activeSheet);
    if (!headers.length) return toast('لا عناوين.', 'error');

    apiBusy = true;
    const button = $('syncSheet');
    if (button) { button.disabled = true; button.textContent = 'جارٍ الإرسال...'; }
    try {
        const isFooter = row => row.some(v => /^(المجموع الكلي|اجمالي السلف المستلمة|إجمالي السلف المستلمة|مجمل التمويل|المجموع|الإجمالي)$/i.test(String(v ?? '').trim()));
        const cleanRows = rows.filter(row => row.some(v => String(v ?? '').trim() !== '') && !isFooter(row));
        if (!cleanRows.length) return toast('لا توجد سجلات فعلية لإرسالها.', 'error');
        const records = cleanRows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
        const result = await sendSheetData({
            action: 'sync', sheet: activeSheet, sheetName: activeSheet,
            headers, records, data: cleanRows, mergeKeys: getMergeKeysForSheet(activeSheet)
        });
        const info = result?.data && (result.data.added !== undefined)
            ? ` (${result.data.added} جديد، ${result.data.updated} محدَّث)` : '';
        toast(result.status === 'sent-unverified' ? 'أُرسل الطلب؛ تحقق.' : 'تم الإرسال' + info + '.');
    } catch (error) {
        toast(error.message || 'فشل الإرسال.', 'error');
    } finally {
        if (button) { button.disabled = false; button.textContent = 'مزامنة التبويب'; }
        apiBusy = false;
    }
}