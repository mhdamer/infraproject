'use strict';

/**
 * withdrawals.js — تبويب «السحب والتمويل»
 * v1.3 — كشف ديناميكي لحدود كتلتي الشريكين + إصلاح مشكلة التداخل
 */

const WD_PARTNERS = ['محمد اللامي', 'أحمد شاكر'];
let wdActivePartner = WD_PARTNERS[0];
let wdShareRatios = { 'محمد اللامي': 0.5, 'أحمد شاكر': 0.5 };
let wdAccountingSnapshot = null;

function wdSetProjectAccounting(snapshot) {
    wdAccountingSnapshot = snapshot || null;
    const ratios = snapshot && snapshot.partners;
    if (ratios) WD_PARTNERS.forEach(name => {
        const value = Number(ratios[name]?.shareRatio);
        if (Number.isFinite(value) && value >= 0 && value <= 1) wdShareRatios[name] = value;
    });
}
function wdProjectShareRatio(partner) { return Number(wdShareRatios[partner] ?? 0.5); }
function wdProjectShareAmount(partner = wdActivePartner) {
    const result = Number(wdAccountingSnapshot?.projectProfitLoss ?? (typeof summaryTotals === 'function' ? summaryTotals().projectProfitLoss : 0)) || 0;
    return result * wdProjectShareRatio(partner);
}

/**
 * ★ الكشف الديناميكي: نبحث عن جميع أعمدة "ت" في الرأس.
 * الشريك الأول = العمود الأول من "ت"، الشريك الثاني = العمود الثاني.
 * هذا يحل مشكلة الاعتماد على أرقام ثابتة (0 و 6) قد لا تطابق الواقع.
 */
function wdBlockIndexes(partner, headers = sheetHeaders(WD)) {
    const tColumns = [];
    headers.forEach((h, i) => { if (String(h).trim() === 'ت') tColumns.push(i); });
    const partnerIndex = WD_PARTNERS.indexOf(partner);
    const start = tColumns[partnerIndex] ?? (partnerIndex === 0 ? 0 : (tColumns[0] >= 0 ? tColumns[0] + 5 : 6));
    return { start, serial: start, funding: start + 1, draw: start + 2, date: start + 3, notes: start + 4 };
}

function wdSetPartner(name) {
    if (!WD_PARTNERS.includes(name)) return;
    wdActivePartner = name;
    if (typeof render === 'function') render();
}

function wdPartnerHasData(row, partner, headers = sheetHeaders(WD)) {
    const ix = wdBlockIndexes(partner, headers);
    return [ix.serial, ix.funding, ix.draw, ix.date].some(i => {
        const v = row[i];
        return v !== '' && v !== null && v !== undefined && v !== false;
    });
}

function wdVisibleColumnIndexes(headers = sheetHeaders(WD)) {
    const ix = wdBlockIndexes(wdActivePartner, headers);
    return [ix.serial, ix.funding, ix.draw, ix.date, ix.notes];
}

function wdTotals(partner = wdActivePartner) {
    const headers = sheetHeaders(WD);
    const ix = wdBlockIndexes(partner, headers);
    let funding = 0, draw = 0;
    sheetRows(WD).forEach(row => {
        funding += parseNumber(row[ix.funding]);
        draw += parseNumber(row[ix.draw]);
    });
    return { funding, draw, net: funding - draw };
}

function wdMatch(row, headers) {
    if (activeSheet !== WD) return true;
    return wdPartnerHasData(row, wdActivePartner, headers);
}

function populateWithdrawalsFilters() {}

function renderWdPartnerPicker() {
    const picker = $('withdrawalPartnerPicker');
    if (!picker) return;
    const show = activeSheet === WD;
    picker.classList.toggle('hidden', !show);
    picker.classList.toggle('flex', show);
    const setBtn = (id, name) => {
        const btn = $(id);
        if (!btn) return;
        btn.className = 'rounded-lg border px-3 py-2 text-xs font-bold transition ' +
            (wdActivePartner === name
                ? 'border-emerald-600 bg-emerald-950/60 text-emerald-300'
                : 'border-transparent text-slate-300 hover:bg-slate-800');
    };
    setBtn('wdPartnerMohamed', 'محمد اللامي');
    setBtn('wdPartnerAhmed', 'أحمد شاكر');
    const share = $('withdrawalProjectShare');
    if (share) {
        const ratio = wdProjectShareRatio(wdActivePartner);
        share.textContent = `حصة ${wdActivePartner} بالمشروع (${new Intl.NumberFormat('ar-IQ', { maximumFractionDigits: 2 }).format(ratio * 100)}%): ${formatMoney(wdProjectShareAmount(wdActivePartner))}`;
    }
}

function renderWithdrawalsMetrics() {
    const { funding, draw, net } = wdTotals(wdActivePartner);
    if ($('metricExpenses')) $('metricExpenses').textContent = formatMoney(funding);
    if ($('metricAdvances')) $('metricAdvances').textContent = formatMoney(draw);
    if ($('metricFunding')) $('metricFunding').textContent = formatMoney(net);
    if ($('metricBalance')) {
        $('metricBalance').textContent = net >= 0 ? 'موجب' : 'سالب';
        $('metricBalance').className = 'mt-3 text-3xl font-extrabold tracking-tight ' + (net >= 0 ? 'text-emerald-400' : 'text-rose-400');
    }
    const labels = document.querySelectorAll('#mainMetrics p.text-sm');
    if (labels[0]) labels[0].textContent = 'التمويل — ' + wdActivePartner;
    if (labels[1]) labels[1].textContent = 'السحب — ' + wdActivePartner;
    if (labels[2]) labels[2].textContent = 'الصافي — ' + wdActivePartner;
    if (labels[3]) labels[3].textContent = 'الحالة';
}

document.addEventListener('DOMContentLoaded', () => {
    $('wdPartnerMohamed')?.addEventListener('click', () => wdSetPartner('محمد اللامي'));
    $('wdPartnerAhmed')?.addEventListener('click', () => wdSetPartner('أحمد شاكر'));
});
