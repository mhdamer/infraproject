'use strict';

/**
 * summary.js — تبويب «خلاصة المشروع» (Dashboard)
 * v1.2 — توحيد الرصيد الشهري وإظهار الدين حسب العملة
 */

let summaryCharts = { pie: null, bar: null, line: null };

function populateSummaryFilters() {
    // لا فلاتر خاصة — التبويب للعرض فقط.
}

function summaryTotals() {
    const glHeaders = sheetHeaders(GL);
    const amountIx = findHeaderIndex(glHeaders, ['المبلغ']);
    const typeIx = findHeaderIndex(glHeaders, ['النوع']);
    const currencyIx = findHeaderIndex(glHeaders, ['العملة']);
    const dateIx = findHeaderIndex(glHeaders, ['التاريخ']);
    const siteIx = findHeaderIndex(glHeaders, ['الموقع']);

    let expenseIQD = 0, incomeIQD = 0;
    const monthly = new Map();
    const bySite = new Map();
    const monthData = iso => {
        if (!iso) return null;
        const key = iso.slice(0, 7);
        if (!monthly.has(key)) monthly.set(key, { expense: 0, income: 0, funding: 0, withdrawal: 0, advances: 0 });
        return monthly.get(key);
    };

    sheetRows(GL).forEach(row => {
        const cur = currencyIx >= 0 ? String(row[currencyIx] ?? 'IQD').trim().toUpperCase() : 'IQD';
        if (cur === 'USD') return;
        const amount = amountIx >= 0 ? parseNumber(row[amountIx]) : 0;
        const type = typeIx >= 0 ? String(row[typeIx] ?? '').trim() : '';
        const month = monthData(dateIx >= 0 ? toIsoDate(row[dateIx]) : '');
        if (type === 'صرف') {
            expenseIQD += amount;
            if (month) month.expense += amount;
            const site = siteIx >= 0 ? String(row[siteIx] ?? '').trim() : '';
            if (site) bySite.set(site, (bySite.get(site) || 0) + amount);
        } else if (type === 'قبض' || type === 'تحويل') {
            incomeIQD += amount;
            if (month) month.income += amount;
        }
    });

    let advancesIQD = 0;
    const advHeaders = sheetHeaders(ADV);
    const advAmountIx = findHeaderIndex(advHeaders, ['المبلغ']);
    const advCurIx = findHeaderIndex(advHeaders, ['العملة']);
    const advDateIx = findHeaderIndex(advHeaders, ['التاريخ']);
    sheetRows(ADV).forEach(row => {
        const cur = advCurIx >= 0 ? String(row[advCurIx] ?? 'IQD').trim().toUpperCase() : 'IQD';
        if (cur === 'USD') return;
        const amount = advAmountIx >= 0 ? parseNumber(row[advAmountIx]) : 0;
        advancesIQD += amount;
        const month = monthData(advDateIx >= 0 ? toIsoDate(row[advDateIx]) : '');
        if (month) month.advances += amount;
    });

    const wdHeaders = sheetHeaders(WD);
    const partners = ['محمد اللامي', 'أحمد شاكر'];
    const partnerStats = {};
    partners.forEach(p => {
        const ix = typeof wdBlockIndexes === 'function'
            ? wdBlockIndexes(p, wdHeaders)
            : (p === partners[0]
                ? { funding: 1, draw: 2, date: 3 }
                : { funding: 7, draw: 8, date: 9 });
        let funding = 0, draw = 0;
        sheetRows(WD).forEach(row => {
            const rowFunding = parseNumber(row[ix.funding]);
            const rowDraw = parseNumber(row[ix.draw]);
            funding += rowFunding;
            draw += rowDraw;
            const month = monthData(ix.date >= 0 ? toIsoDate(row[ix.date]) : '');
            if (month) {
                month.funding += rowFunding;
                month.withdrawal += rowDraw;
            }
        });
        partnerStats[p] = { funding, draw, net: funding - draw };
    });

    let totalFunding = partners.reduce((sum, p) => sum + partnerStats[p].funding, 0);
    let totalWithdrawals = partners.reduce((sum, p) => sum + partnerStats[p].draw, 0);

    let totalDebtsIQD = 0, totalDebtsUSD = 0;
    if (typeof getDebtViewData === 'function') {
        const { headers, rows } = getDebtViewData();
        const remIQD = findHeaderIndex(headers, ['المتبقي دينار']);
        const remUSD = findHeaderIndex(headers, ['المتبقي $']);
        if (remIQD >= 0) totalDebtsIQD = rows.reduce((sum, row) => sum + parseNumber(row[remIQD]), 0);
        if (remUSD >= 0) totalDebtsUSD = rows.reduce((sum, row) => sum + parseNumber(row[remUSD]), 0);
    }

    // نتيجة المشروع حسب الطلب: السلف الواردة (ADV) ناقص المصاريف (GL).
    let projectProfitLoss = advancesIQD - expenseIQD;
    if (projectAccountingSnapshot && Number.isFinite(Number(projectAccountingSnapshot.projectProfitLoss))) {
        expenseIQD = Number(projectAccountingSnapshot.expensesIQD) || 0;
        advancesIQD = Number(projectAccountingSnapshot.advancesIQD) || 0;
        projectProfitLoss = Number(projectAccountingSnapshot.projectProfitLoss);
        partners.forEach(partner => {
            const remote = projectAccountingSnapshot.partners && projectAccountingSnapshot.partners[partner];
            if (!remote) return;
            partnerStats[partner] = {
                funding: Number(remote.funding) || 0,
                draw: Number(remote.draw) || 0,
                net: (Number(remote.funding) || 0) - (Number(remote.draw) || 0),
                shareRatio: Number.isFinite(Number(remote.shareRatio)) && Number(remote.shareRatio) >= 0 && Number(remote.shareRatio) <= 1
                    ? Number(remote.shareRatio) : (typeof wdProjectShareRatio === 'function' ? wdProjectShareRatio(partner) : 0.5)
            };
        });
        totalFunding = partners.reduce((sum, partner) => sum + partnerStats[partner].funding, 0);
        totalWithdrawals = partners.reduce((sum, partner) => sum + partnerStats[partner].draw, 0);
    } else {
        partners.forEach(partner => {
            partnerStats[partner].shareRatio = typeof wdProjectShareRatio === 'function' ? wdProjectShareRatio(partner) : 0.5;
        });
    }
    const netProfit = projectProfitLoss;
    return {
        expenseIQD, incomeIQD, advancesIQD, totalFunding, totalWithdrawals,
        totalDebtsIQD, totalDebtsUSD, netProfit, projectProfitLoss, monthly, bySite, partnerStats,
        balance: totalFunding + advancesIQD - expenseIQD - totalWithdrawals
    };
}

function summaryDestroyCharts() {
    ['pie', 'bar', 'line'].forEach(key => {
        if (summaryCharts[key]) {
            try { summaryCharts[key].destroy(); } catch (e) {}
            summaryCharts[key] = null;
        }
    });
}

function summaryRenderCharts(totals) {
    if (typeof Chart === 'undefined') return;
    summaryDestroyCharts();

    const pieLabels = [...totals.bySite.keys()];
    const pieData = pieLabels.map(key => totals.bySite.get(key));
    const pieEl = document.getElementById('chartExpensesPie');
    if (pieEl && pieLabels.length) {
        summaryCharts.pie = new Chart(pieEl.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: pieLabels,
                datasets: [{ data: pieData, backgroundColor: ['#10b981', '#0ea5e9', '#8b5cf6', '#f43f5e', '#f59e0b', '#f97316', '#64748b'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } } }
        });
    }

    const months = [...totals.monthly.keys()].filter(Boolean).sort();
    const barExpense = months.map(month => totals.monthly.get(month).expense);
    const barFunding = months.map(month => totals.monthly.get(month).funding);
    const barEl = document.getElementById('chartMonthlyBar');
    if (barEl && months.length) {
        summaryCharts.bar = new Chart(barEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    { label: 'مصروف', data: barExpense, backgroundColor: '#f43f5e' },
                    { label: 'تمويل', data: barFunding, backgroundColor: '#10b981' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1' } } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }
        });
    }

    let running = 0;
    const lineData = months.map(month => {
        const values = totals.monthly.get(month);
        running += values.funding + values.advances - values.expense - values.withdrawal;
        return running;
    });
    const lineEl = document.getElementById('chartBalanceLine');
    if (lineEl && months.length) {
        summaryCharts.line = new Chart(lineEl.getContext('2d'), {
            type: 'line',
            data: {
                labels: months,
                datasets: [{ label: 'الرصيد التراكمي', data: lineData, borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,.15)', fill: true, tension: 0.3 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1' } } }, scales: { x: { ticks: { color: '#94a3b8' } }, y: { ticks: { color: '#94a3b8' } } } }
        });
    }
}

function calculatePartnerSettlement(projectProfitLoss, funding, withdrawals, shareRatio) {
    const projectShare = Number(projectProfitLoss || 0) * Number(shareRatio || 0);
    const fundingDifference = Number(funding || 0) - Number(withdrawals || 0);
    return { projectShare, fundingDifference, amountDue: fundingDifference - projectShare };
}

function renderSummary() {
    const totals = summaryTotals();
    if ($('summaryExpenses')) $('summaryExpenses').textContent = formatMoney(totals.expenseIQD);
    if ($('summaryAdvances')) $('summaryAdvances').textContent = formatMoney(totals.advancesIQD);
    if ($('summaryProjectResult')) {
        $('summaryProjectResult').textContent = formatMoney(Math.abs(totals.projectProfitLoss)) + (totals.projectProfitLoss < 0 ? ' خسارة' : ' ربح');
        $('summaryProjectResult').className = 'mt-2.5 text-3xl font-extrabold tracking-tight ' + (totals.projectProfitLoss < 0 ? 'text-rose-400' : 'text-emerald-400');
    }
    if ($('summaryWithdrawals')) $('summaryWithdrawals').textContent = formatMoney(totals.totalWithdrawals);
    if ($('summaryFunding')) $('summaryFunding').textContent = formatMoney(totals.totalFunding);
    if ($('summaryBalance')) {
        $('summaryBalance').textContent = formatMoney(totals.balance);
        $('summaryBalance').className = 'mt-2.5 text-3xl font-extrabold tracking-tight ' + (totals.balance >= 0 ? 'text-emerald-400' : 'text-rose-400');
    }
    if ($('summaryDebts')) {
        $('summaryDebts').textContent = formatMoney(totals.totalDebtsIQD) + ' د.ع / ' + formatMoney(totals.totalDebtsUSD) + ' $';
        $('summaryDebts').className = 'mt-2.5 text-xl font-bold tracking-tight text-amber-400';
    }

    const body = $('summarySharesBody');
    if (body) {
        body.replaceChildren();
        const partners = Object.keys(totals.partnerStats);
        let totalProfitShare = 0, totalNet = 0;
        partners.forEach(partner => {
            const stats = totals.partnerStats[partner];
            const ratio = Number(stats.shareRatio ?? 0.5);
            const settlement = calculatePartnerSettlement(totals.projectProfitLoss, stats.funding, stats.draw, ratio);
            const profitShare = settlement.projectShare;
            const net = settlement.amountDue;
            totalProfitShare += profitShare;
            totalNet += net;
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50';
            [partner, new Intl.NumberFormat('ar-IQ', { maximumFractionDigits: 2 }).format(ratio * 100) + '%', formatMoney(stats.funding), formatMoney(stats.draw), formatMoney(stats.net), formatMoney(profitShare), formatMoney(Math.abs(net)) + (net > 0 ? ' مستحق للشريك' : net < 0 ? ' مستحق على الشريك' : ' متوازن')].forEach((value, index) => {
                const td = document.createElement('td');
                td.className = 'px-4 py-3 text-center ' + (index === 6 ? (net >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold') : 'text-slate-100');
                td.textContent = value;
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
        const totalRow = document.createElement('tr');
        totalRow.className = 'bg-slate-800/80 font-bold';
        ['المجموع', new Intl.NumberFormat('ar-IQ', { maximumFractionDigits: 2 }).format(partners.reduce((sum, p) => sum + Number(totals.partnerStats[p].shareRatio || 0), 0) * 100) + '%', formatMoney(totals.totalFunding), formatMoney(totals.totalWithdrawals), '', formatMoney(totalProfitShare), formatMoney(Math.abs(totalNet)) + (totalNet > 0 ? ' مستحق للشركاء' : totalNet < 0 ? ' مستحق على الشركاء' : ' متوازن')].forEach(value => {
            const td = document.createElement('td');
            td.className = 'px-4 py-3 text-center border-t border-slate-700/60 text-slate-100';
            td.textContent = value;
            totalRow.appendChild(td);
        });
        body.appendChild(totalRow);
    }

    summaryRenderCharts(totals);
}
