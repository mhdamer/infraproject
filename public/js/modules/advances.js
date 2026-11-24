'use strict';

/**
 * advances.js — تبويب "السلف المستلمة"
 */

function populateAdvancesFilters() {
    // الفلاتر العامة (اسم + نوع) تكفي
}

function advMatch(row, headers) {
    if (activeSheet !== ADV) return true;
    // لا فلترة إضافية — الفلتر النصي + فلتر المصدر (contractorFilter) يكفيان
    return true;
}

// مؤشرات السلف (3 بطاقات)
function renderAdvancesMetrics() {
    const headers = sheetHeaders(ADV);
    const rows = sheetRows(ADV);
    const amountIx = findHeaderIndex(headers, ['المبلغ']);
    const curIx = findHeaderIndex(headers, ['العملة']);

    let totalIQD = 0, totalUSD = 0, count = 0;
    rows.forEach(r => {
        const cur = curIx >= 0 ? String(r[curIx] ?? '').trim() : 'IQD';
        const amt = amountIx >= 0 ? parseNumber(r[amountIx]) : 0;
        if (cur === 'USD') totalUSD += amt;
        else totalIQD += amt;
        count++;
    });

    if ($('metricExpenses')) {
        $('metricExpenses').textContent = formatMoney(totalIQD);
    }
    if ($('metricAdvances')) {
        $('metricAdvances').textContent = formatMoney(totalUSD);
    }
    if ($('metricFunding')) {
        $('metricFunding').textContent = new Intl.NumberFormat('en-US').format(count);
    }
    if ($('metricBalance')) $('metricBalance').textContent = '—';

    // تغيير labels
    const labels = document.querySelectorAll('#mainMetrics p.text-sm');
    if (labels[0]) labels[0].textContent = 'إجمالي السلف (دينار)';
    if (labels[1]) labels[1].textContent = 'إجمالي السلف ($)';
    if (labels[2]) labels[2].textContent = 'عدد السلف';
    if (labels[3]) labels[3].textContent = '—';
}