'use strict';

function notifyNumber(value) {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0));
}
function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value == null || value === '') return 0;
    const arabicDigits = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.', '٬': ',' };
    const cleaned = String(value).replace(/[٠-٩٫٬]/g, c => arabicDigits[c]).replace(/[،,\s]/g, '').replace(/[^0-9.\-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
}
function normalizeText(value) {
    const digits = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    return String(value ?? '').toLocaleLowerCase('ar').replace(/[٠-٩]/g, c => digits[c]).replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[أإآ]/g, 'ا').trim();
}
function formatMoney(value) {
    return notifyNumber(value) + ' د.ع';
}
function formatMoneyForHeader(header, value) {
    return String(header ?? '').includes('$') ? '$ ' + notifyNumber(value) : formatMoney(value);
}
function formatCell(header, value) {
    if (value === null || value === undefined || value === '') return '—';
    const h = normalizeText(header);
    if (typeof value === 'number') {
        if (/مبلغ|قيمة|استقطاع|سعر|كلف|الكلفة|خصم|الباقي|المتبقي|مجموع/.test(h)) return formatMoneyForHeader(header, value);
        if (/مساح/.test(h)) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value) + ' م²';
        return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
    }
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        const [y, m, d] = text.split('-').map(Number);
        return new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
    }
    if (/مبلغ|قيمة|استقطاع|سعر|كلف|الكلفة|خصم|الباقي|المتبقي|مجموع/.test(h) && /^[\d٠-٩][\d٠-٩,.،٬٫\s-]*$/.test(text)) return formatMoneyForHeader(header, parseNumber(text));
    if (/مساح/.test(h) && /^[\d٠-٩][\d٠-٩,.،٬٫\s-]*$/.test(text)) return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(parseNumber(text)) + ' م²';
    return text;
}
function findHeaderIndex(headers, names) {
    const targets = names.map(normalizeText);
    return headers.findIndex(h => targets.includes(normalizeText(h)));
}
function sheetRows(name) {
    const sheet = workbookData[name];
    return sheet && Array.isArray(sheet.rows) ? sheet.rows : [];
}
function sheetHeaders(name) {
    const sheet = workbookData[name];
    return sheet && Array.isArray(sheet.headers) ? sheet.headers : [];
}
function sortValue(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    const text = String(value ?? '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(text);
    const n = parseNumber(text);
    if (text.trim() && Number.isFinite(n) && /^[\d٠-٩,.،٬٫\s-]+$/.test(text)) return n;
    return normalizeText(text);
}

/**
 * rowKey موحّد لكل الشيتات — يستخدم أسماء الأعمدة الفعلية
 */
function rowKey(sheetName, headers, row) {
    const pick = (names) => {
        const ix = findHeaderIndex(headers, names);
        return ix < 0 ? '' : normalizeText(row[ix]);
    };
    if (sheetName === AppConfig.SHEETS.CONTRACTORS) return [pick(['اسم المقاول']), pick(['رقم الذرعة']), pick(['المادة/العمل', 'العمل/المادة'])].join('|');
    if (sheetName === AppConfig.SHEETS.ADVANCES) return [pick(['التاريخ']), pick(['المبلغ']), pick(['التفاصيل']), pick(['ت'])].join('|');
    if (sheetName === AppConfig.SHEETS.WITHDRAWALS) {
        const pickBoth = names => headers.map((h, i) => names.map(normalizeText).includes(normalizeText(h)) ? normalizeText(row[i]) : '').filter(Boolean).join(',');
        return [pickBoth(['ت']), pickBoth(['التمويل']), pickBoth(['السحب']), pickBoth(['التاريخ']), pickBoth(['الملاحظات', 'ملاحظات'])].join('|');
    }
    if (sheetName === AppConfig.SHEETS.DEBTS) return [pick(['الاسم']), pick(['ت']), pick(['ملاحظات'])].join('|');
    if (sheetName === AppConfig.SHEETS.GENERAL_LEDGER) {
        const receipt = pick(['رقم الوصل', 'ت']);
        return receipt ? 'receipt|' + receipt : ['fallback', pick(['التاريخ']), pick(['المبلغ']), pick(['التفاصيل']), pick(['المستلم'])].join('|');
    }
    return '';
}
function isMeaningfulKey(key) {
    return key && key.replace(/[|]/g, '').length > 0;
}

function mergeRows(sheetName, headers, existing, incoming) {
    const result = existing.map(r => r.slice());
    incoming.forEach(row => {
        let index = -1;
        const key = rowKey(sheetName, headers, row);
        if (isMeaningfulKey(key)) index = result.findIndex(old => rowKey(sheetName, headers, old) === key);
        if (index < 0) index = result.findIndex(old => JSON.stringify(old) === JSON.stringify(row));
        if (index >= 0) result[index] = row;
        else result.push(row);
    });
    return result;
}
function toIsoDate(v) {
    const t = String(v ?? '').trim();
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
    return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
}

const AUDIT_H = 'مدقق';
const DELETED_H = 'محذوف';
const VERSION_H = 'النسخة';

const NOTES_KEY = 'sharaeen_notes_v1';
function loadNotes() {
    try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); }
    catch (e) { return []; }
}
function saveNotes(notes) {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch (e) {}
}

function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        const self = this;
        timer = setTimeout(() => {
            timer = null;
            try { fn.apply(self, args); } catch (e) { console.error(e); }
        }, delay == null ? 250 : delay);
    };
}
