'use strict';

/**
 * debts.js — جدول مشتق لا يخزن قيوداً مستقلة.
 * v1.1 — تنظيف debtCurrencyFilter الميت
 */

const DEBT_VIEW_HEADERS = [
    'اسم المقاول',
    'المبلغ المطلوب دينار', 'المبلغ المستلم دينار', 'المتبقي دينار',
    'المبلغ المطلوب $', 'المبلغ المستلم $', 'المتبقي $'
];

function populateDebtsFilters() {}

function getDebtViewData() {
    const contractorHeaders = sheetHeaders(CT);
    const ledgerHeaders = sheetHeaders(GL);
    const nameIx = findHeaderIndex(contractorHeaders, ['اسم المقاول']);
    const dharaIqdIx = findHeaderIndex(contractorHeaders, ['السعر الكلي دينار', 'مجموع الطلب دينار', 'المبلغ المطلوب دينار']);
    const dharaUsdIx = findHeaderIndex(contractorHeaders, ['السعر الكلي دولار', 'مجموع الطلب $', 'المبلغ المطلوب $']);
    const qtyIx = findHeaderIndex(contractorHeaders, ['الكمية']);
    const priceIqdIx = findHeaderIndex(contractorHeaders, ['السعر دينار']);
    const priceUsdIx = findHeaderIndex(contractorHeaders, ['السعر دولار', ' السعر دولار']);

    const recipientIx = findHeaderIndex(ledgerHeaders, ['المستلم', 'المستفيد', 'اسم المستلم']);
    const amountIx = findHeaderIndex(ledgerHeaders, ['المبلغ']);
    const amountUsdIx = findHeaderIndex(ledgerHeaders, ['المبلغ $', 'المبلغ دولار', 'المبلغ بالدولار']);
    const currencyIx = findHeaderIndex(ledgerHeaders, ['العملة', 'نوع العملة']);

    const grouped = new Map();
    const get = name => {
        const key = normalizeText(name);
        if (!key) return null;
        if (!grouped.has(key)) grouped.set(key, { name: String(name).trim(), requiredIQD: 0, receivedIQD: 0, requiredUSD: 0, receivedUSD: 0 });
        return grouped.get(key);
    };

    if (nameIx >= 0) {
        sheetRows(CT).forEach(row => {
            const name = String(row[nameIx] ?? '').trim();
            if (typeof isContractorPlaceholder === 'function' && isContractorPlaceholder(name)) return;
            const item = get(name);
            if (!item) return;
            let requiredIQD = dharaIqdIx >= 0 ? parseNumber(row[dharaIqdIx]) : 0;
            let requiredUSD = dharaUsdIx >= 0 ? parseNumber(row[dharaUsdIx]) : 0;
            if (!requiredIQD && qtyIx >= 0 && priceIqdIx >= 0) requiredIQD = parseNumber(row[qtyIx]) * parseNumber(row[priceIqdIx]);
            if (!requiredUSD && qtyIx >= 0 && priceUsdIx >= 0) requiredUSD = parseNumber(row[qtyIx]) * parseNumber(row[priceUsdIx]);
            item.requiredIQD += requiredIQD;
            item.requiredUSD += requiredUSD;
        });
    }

    if (recipientIx >= 0) {
        sheetRows(GL).forEach(row => {
            const recipient = normalizeText(row[recipientIx]);
            const item = grouped.get(recipient);
            if (!item) return;
            const currency = currencyIx >= 0 ? normalizeText(row[currencyIx]) : '';
            const hasUsdColumn = amountUsdIx >= 0;
            if (hasUsdColumn) item.receivedUSD += parseNumber(row[amountUsdIx]);
            if (amountIx >= 0) {
                const amount = parseNumber(row[amountIx]);
                if (/usd|دولار|\$/.test(currency)) item.receivedUSD += amount;
                else if (/iqd|دينار|د\.ع/.test(currency) || !currency) item.receivedIQD += amount;
            }
        });
    }

    const rows = [...grouped.values()]
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
        .map(item => [
            item.name,
            item.requiredIQD, item.receivedIQD, item.requiredIQD - item.receivedIQD,
            item.requiredUSD, item.receivedUSD, item.requiredUSD - item.receivedUSD
        ]);
    return { headers: DEBT_VIEW_HEADERS.slice(), rows };
}

function debtMatch(row, headers) {
    // لا فلتر خاص بالمديونية حالياً.
    return true;
}

function renderDebtsMetrics() {
    const { headers, rows } = getDebtViewData();
    const sum = name => {
        const ix = findHeaderIndex(headers, [name]);
        return rows.reduce((total, row) => total + (ix < 0 ? 0 : parseNumber(row[ix])), 0);
    };
    const reqIQD = sum('المبلغ المطلوب دينار');
    const gotIQD = sum('المبلغ المستلم دينار');
    const remIQD = sum('المتبقي دينار');
    const remUSD = sum('المتبقي $');

    if ($('metricExpenses')) $('metricExpenses').textContent = formatMoney(reqIQD);
    if ($('metricAdvances')) $('metricAdvances').textContent = formatMoney(gotIQD);
    if ($('metricFunding')) $('metricFunding').textContent = formatMoney(remIQD);
    if ($('metricBalance')) $('metricBalance').textContent = formatMoneyForHeader('$', remUSD);

    const labels = document.querySelectorAll('#mainMetrics p.text-sm');
    if (labels[0]) labels[0].textContent = 'المطلوب (د.ع)';
    if (labels[1]) labels[1].textContent = 'المستلم من السجل العام (د.ع)';
    if (labels[2]) labels[2].textContent = 'المتبقي (د.ع)';
    if (labels[3]) labels[3].textContent = 'المتبقي ($)';
}