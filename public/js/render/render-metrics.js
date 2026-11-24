'use strict';

/**
 * render-metrics.js — إظهار/إخفاء panels حسب التبويب النشط
 * v1.1 — إصلاح: mainMetrics يظهر في GL/ADV/WD/DB (كل تبويب يعرض مؤشراته)
 */

function renderMetrics() {
    const isSummary     = activeSheet === AppConfig.SHEETS.SUMMARY;
    const isContractors = activeSheet === AppConfig.SHEETS.CONTRACTORS;
    const isDebts       = activeSheet === AppConfig.SHEETS.DEBTS;
    const isWithdrawals = activeSheet === AppConfig.SHEETS.WITHDRAWALS;
    const isGeneral     = activeSheet === AppConfig.SHEETS.GENERAL_LEDGER;
    const isAdvances    = activeSheet === AppConfig.SHEETS.ADVANCES;

    if ($('summaryPanel'))     $('summaryPanel').classList.toggle('hidden', !isSummary);
    if ($('contractorsPanel')) $('contractorsPanel').classList.toggle('hidden', !isContractors);

    // ★ إصلاح: كل تبويب بيانات يعرض مؤشراته العلوية
    const showMainMetrics = isGeneral || isAdvances || isWithdrawals || isDebts;
    if ($('mainMetrics')) $('mainMetrics').classList.toggle('hidden', !showMainMetrics);

    // genericCard يظهر فقط في GL/ADV/WD/DB
    const showGenericCard = !isContractors && !isSummary;
    if ($('genericCard')) $('genericCard').classList.toggle('hidden', !showGenericCard);

    if (isSummary) {
        if (typeof renderSummary === 'function') renderSummary();
        return;
    }
    if (isContractors) {
        if (typeof renderContractorsPanel === 'function') renderContractorsPanel();
        return;
    }

    if (isGeneral) renderGeneralMetrics();
    if (isDebts && typeof renderDebtsMetrics === 'function') renderDebtsMetrics();
    if (isAdvances && typeof renderAdvancesMetrics === 'function') renderAdvancesMetrics();
    if (isWithdrawals && typeof renderWithdrawalsMetrics === 'function') renderWithdrawalsMetrics();
}

function renderGeneralMetrics() {
    const headers = sheetHeaders(GL);
    const rows = sheetRows(GL);
    const amountIx = findHeaderIndex(headers, ['المبلغ']);
    const typeIx   = findHeaderIndex(headers, ['النوع']);
    const curIx    = findHeaderIndex(headers, ['العملة']);

    let expIQD = 0;
    rows.forEach(r => {
        if (typeIx >= 0 && String(r[typeIx] ?? '').trim() !== 'صرف') return;
        const amt = amountIx >= 0 ? parseNumber(r[amountIx]) : 0;
        const cur = curIx >= 0 ? String(r[curIx] ?? '').trim() : 'IQD';
        if (cur !== 'USD') expIQD += amt;
    });

    const advHeaders = sheetHeaders(ADV);
    const advAmountIx = findHeaderIndex(advHeaders, ['المبلغ']);
    const advCurIx = findHeaderIndex(advHeaders, ['العملة']);
    let advTotal = 0;
    sheetRows(ADV).forEach(r => {
        const cur = advCurIx >= 0 ? String(r[advCurIx] ?? '').trim() : 'IQD';
        if (cur !== 'USD') advTotal += advAmountIx >= 0 ? parseNumber(r[advAmountIx]) : 0;
    });

    const wdHeaders = sheetHeaders(WD);
    const wdAmountIx = findHeaderIndex(wdHeaders, ['المبلغ']);
    const wdTypeIx = findHeaderIndex(wdHeaders, ['النوع']);
    const wdCurIx = findHeaderIndex(wdHeaders, ['العملة']);
    let fundingTotal = 0;
    sheetRows(WD).forEach(r => {
        if (wdTypeIx >= 0 && String(r[wdTypeIx] ?? '').trim() !== 'تمويل') return;
        const cur = wdCurIx >= 0 ? String(r[wdCurIx] ?? '').trim() : 'IQD';
        if (cur !== 'USD') fundingTotal += wdAmountIx >= 0 ? parseNumber(r[wdAmountIx]) : 0;
    });

    const balance = fundingTotal - (expIQD + advTotal);
    if ($('metricExpenses')) $('metricExpenses').textContent = formatMoney(expIQD);
    if ($('metricAdvances')) $('metricAdvances').textContent = formatMoney(advTotal);
    if ($('metricFunding'))  $('metricFunding').textContent  = formatMoney(fundingTotal);
    if ($('metricBalance')) {
        $('metricBalance').textContent = formatMoney(balance);
        $('metricBalance').className = 'mt-3 text-3xl font-extrabold tracking-tight ' + (balance >= 0 ? 'text-emerald-400' : 'text-rose-400');
    }
    const labels = document.querySelectorAll('#mainMetrics p.text-sm');
    if (labels[0]) labels[0].textContent = 'إجمالي المصروفات';
    if (labels[1]) labels[1].textContent = 'إجمالي السلف';
    if (labels[2]) labels[2].textContent = 'إجمالي التمويل';
    if (labels[3]) labels[3].textContent = 'الرصيد الحالي';
}