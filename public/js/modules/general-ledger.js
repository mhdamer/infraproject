'use strict';

/**
 * general-ledger.js — تبويب "السجل العام"
 */

// فلاتر خاصة بالسجل العام
let glDateFrom = '';
let glDateTo = '';

function populateGeneralFilters() {
    // لا فلاتر إضافية — الفلاتر العامة (بحث + اسم + نوع) تكفي
}

function glMatch(row, headers) {
    if (activeSheet !== GL) return true;
    const dateIx = findHeaderIndex(headers, ['التاريخ']);
    const typeIx = findHeaderIndex(headers, ['النوع']);
    const curIx = findHeaderIndex(headers, ['العملة']);

    // فلتر التاريخ
    if (glDateFrom && dateIx >= 0) {
        const v = toIsoDate(row[dateIx]);
        if (v && v < glDateFrom) return false;
    }
    if (glDateTo && dateIx >= 0) {
        const v = toIsoDate(row[dateIx]);
        if (v && v > glDateTo) return false;
    }

    // فلتر النوع (عبر unitFilter)
    const typeSel = $('unitFilter') ? $('unitFilter').value : '';
    if (typeSel && typeIx >= 0 && String(row[typeIx] ?? '').trim() !== typeSel) return false;

    return true;
}

// إضافة صرف — يفتح showAdd مع pre-fill
function addGeneralEntry() {
    activeSheet = GL;
    showAdd();
    // pre-fill: النوع = صرف
    setTimeout(() => {
        const box = $('addFields');
        if (!box) return;
        const typeIx = findHeaderIndex(sheetHeaders(GL), ['النوع']);
        const typeEl = box.querySelector('[data-col="' + typeIx + '"]');
        if (typeEl) typeEl.value = 'صرف';
        const curIx = findHeaderIndex(sheetHeaders(GL), ['العملة']);
        const curEl = box.querySelector('[data-col="' + curIx + '"]');
        if (curEl) curEl.value = 'IQD';
    }, 50);
}

// ربط زر "إضافة صرف" — إن وُجد
// (addRow العام يكفي، لكننا نوفّر زراً إضافياً في المستقبل إن لزم)