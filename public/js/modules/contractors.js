'use strict';

/**
 * contractors.js — سجل المقاولين/المجهزين وذرعاتهم.
 * رقم الذرعة هو رقم فاتورة المجهز؛ لا يتم ربطه برقم وصل السجل العام.
 */

let currentContractor = null;
let contractorRows = [];
let receivedRows = [];

function ensureContractorProfileHeaders() {
    if (!workbookData[CT]) workbookData[CT] = { headers: [], rows: [] };
    const sheet = workbookData[CT];
    ['اسم المقاول', 'نوع العمل', 'العمل', 'الكود'].forEach(name => {
        if (findHeaderIndex(sheet.headers, [name]) < 0) sheet.headers.push(name);
    });
    (sheet.rows || []).forEach(row => {
        while (row.length < sheet.headers.length) row.push('');
    });
    return sheet;
}

function isContractorDharaRow(row, headers = sheetHeaders(CT)) {
    const fields = ['رقم الذرعة', 'المادة/العمل', 'الكمية', 'السعر دينار', 'السعر الكلي دينار', 'السعر دولار', 'السعر الكلي دولار'];
    return fields.some(name => {
        const ix = findHeaderIndex(headers, [name]);
        return ix >= 0 && String(row[ix] ?? '').trim() !== '';
    });
}

function isContractorPlaceholder(name) {
    return ['المقاول/المتعهد', 'المقاول/متعهد', 'المقاولالمتعهد'].includes(normalizeText(name).replace(/[\sـ]/g, ''));
}

function contractorSectionMarker(row, headers = sheetHeaders(CT)) {
    const normalized = row.map(value => normalizeText(value).replace(/[\sـ]/g, '')).filter(Boolean);
    if (normalized.length !== 1) return '';
    if (['المقاولين', 'المقاولون', 'المقاولينالمجهزين'].includes(normalized[0])) return 'المقاولين';
    if (['المجهزين', 'المجهز', 'الموردين', 'المورد'].includes(normalized[0])) return 'المجهزين';
    return '';
}

function contractorDirectorySections() {
    const headers = sheetHeaders(CT);
    const nameIx = findHeaderIndex(headers, ['اسم المقاول']);
    const typeIx = findHeaderIndex(headers, ['نوع العمل']);
    const codeIx = findHeaderIndex(headers, ['الكود']);
    const workIx = findHeaderIndex(headers, ['العمل']);
    const sections = { 'المقاولين': [], 'المجهزين': [] };
    let section = '';
    sheetRows(CT).forEach(row => {
        const marker = contractorSectionMarker(row, headers);
        if (marker) { section = marker; return; }
        const name = nameIx >= 0 ? String(row[nameIx] ?? '').trim() : '';
        if (!name || isContractorPlaceholder(name) || isContractorDharaRow(row, headers)) return;
        const kind = typeIx >= 0 ? normalizeText(row[typeIx]) : '';
        const target = /مجهز|مورد/.test(kind) ? 'المجهزين' : /مقاول/.test(kind) ? 'المقاولين' : (section || 'المقاولين');
        if (target) sections[target].push({ row, nameIx, typeIx, workIx, codeIx });
    });
    return sections;
}

function renderContractorDirectory() {
    const body = $('contractorDirectoryBody');
    if (!body) return;
    body.replaceChildren();
    const sections = contractorDirectorySections();
    const hasSections = Object.values(sections).some(items => items.length);
    if (!hasSections) {
        const tr = document.createElement('tr'); const td = document.createElement('td');
        td.colSpan = 5; td.className = 'px-3 py-4 text-center text-slate-400'; td.textContent = 'لا توجد أسماء مسجلة بعد.';
        tr.appendChild(td); body.appendChild(tr); return;
    }
    ['المقاولين', 'المجهزين'].forEach(sectionName => {
        const items = sections[sectionName];
        if (!items.length) return;
        const heading = document.createElement('tr');
        heading.className = 'contractor-section-heading';
        const headingCell = document.createElement('th');
        headingCell.colSpan = 5;
        headingCell.scope = 'rowgroup';
        headingCell.className = 'px-3 py-2 text-right font-bold text-white bg-slate-800 border-y border-slate-600';
        headingCell.textContent = sectionName;
        heading.appendChild(headingCell); body.appendChild(heading);
        items.forEach(({ row, nameIx, typeIx, workIx, codeIx }) => {
            const tr = document.createElement('tr'); tr.className = 'border-t border-slate-700/60';
            [nameIx, typeIx, workIx, codeIx].forEach((ix, col) => {
                const td = document.createElement('td'); td.className = 'px-3 py-2 text-center';
                td.textContent = ix >= 0 ? String(row[ix] ?? '—') : '—';
                if (col === 0) td.classList.add('font-semibold', 'text-slate-100');
                tr.appendChild(td);
            });
            const action = document.createElement('td'); action.className = 'px-3 py-2 text-center whitespace-nowrap';
            if (canMutateActiveSheet()) {
                const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'تعديل';
                edit.className = 'rounded border border-sky-800 bg-sky-950/60 px-2 py-1 text-xs text-sky-300';
                edit.addEventListener('click', () => showAdd(row, 'contractor'));
                const del = document.createElement('button'); del.type = 'button'; del.textContent = 'حذف';
                del.className = 'ms-1 rounded border border-rose-900 bg-rose-950/50 px-2 py-1 text-xs text-rose-300';
                del.addEventListener('click', () => deleteSheetRow(row));
                action.append(edit, del);
            }
            tr.appendChild(action); body.appendChild(tr);
        });
    });
}

function populateContractorsFilters() {
    const dl = $('contractorSearchList');
    if (!dl) return;
    dl.replaceChildren();
    const headers = sheetHeaders(CT);
    const nameIx = findHeaderIndex(headers, ['اسم المقاول']);
    if (nameIx < 0) return;
    const names = [...new Set(sheetRows(CT).map(row => String(row[nameIx] ?? '').trim()).filter(name => name && !isContractorPlaceholder(name) && !['المقاولين', 'المقاولون', 'المجهز', 'المجهزين', 'المورد', 'الموردين'].includes(normalizeText(name))))]
        .sort((a, b) => a.localeCompare(b, 'ar'));
    names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        dl.appendChild(option);
    });
}

function getContractorLedgerPayments(contractorName, contractorCode, ledgerHeaders = sheetHeaders(GL), ledgerRows = sheetRows(GL)) {
    const codeIx = findHeaderIndex(ledgerHeaders, ['الكود']);
    const recipientIx = findHeaderIndex(ledgerHeaders, ['المستلم', 'المستفيد', 'اسم المستلم']);
    const wantedCode = normalizeText(contractorCode);
    const wantedName = normalizeText(contractorName);
    return ledgerRows.filter(row => {
        const codeMatches = wantedCode && codeIx >= 0 && normalizeText(row[codeIx]) === wantedCode;
        const nameMatches = wantedName && recipientIx >= 0 && normalizeText(row[recipientIx]) === wantedName;
        return codeMatches || nameMatches;
    });
}

function renderContractorsPanel() {
    const searchEl = $('contractorSearch');
    if (!searchEl) return;
    currentContractor = searchEl.value.trim();
    renderContractorDirectory();

    if (!currentContractor) {
        contractorRows = [];
        receivedRows = [];
        renderContractorTable();
        renderReceivedList();
        renderContractorSummary();
        return;
    }

    const headers = sheetHeaders(CT);
    const nameIx = findHeaderIndex(headers, ['اسم المقاول']);
    contractorRows = nameIx < 0 ? [] : sheetRows(CT).filter(row =>
        String(row[nameIx] ?? '').trim() === currentContractor && isContractorDharaRow(row, headers)
    );

    const ledgerHeaders = sheetHeaders(GL);
    const contractorCodeIx = findHeaderIndex(headers, ['الكود']);
    const profile = nameIx < 0 ? null : sheetRows(CT).find(row =>
        String(row[nameIx] ?? '').trim() === currentContractor && !isContractorDharaRow(row, headers)
    );
    const contractorCode = profile && contractorCodeIx >= 0 ? profile[contractorCodeIx] : '';
    receivedRows = getContractorLedgerPayments(currentContractor, contractorCode, ledgerHeaders, sheetRows(GL));

    renderContractorTable();
    renderReceivedList();
    renderContractorSummary();
}

function renderContractorTable() {
    const body = $('contractorDharaBody');
    if (!body) return;
    body.replaceChildren();
    if (!currentContractor || !contractorRows.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 11;
        td.className = 'px-4 py-10 text-center text-slate-400';
        td.textContent = !currentContractor
            ? 'اختر مقاولاً أو مجهزاً لعرض فواتيره/ذرعاته'
            : 'لا توجد فواتير/ذرعات لهذا المورد. اضغط «إضافة ذرعة» لإضافة فاتورة.';
        tr.appendChild(td);
        body.appendChild(tr);
        return;
    }

    const headers = sheetHeaders(CT);
    const ix = names => findHeaderIndex(headers, names);
    const invoiceIx = ix(['رقم الذرعة']);
    const workIx = ix(['المادة/العمل', 'العمل/المادة']);
    const qtyIx = ix(['الكمية']);
    const unitIx = ix(['الوحدة']);
    const priceIx = ix(['السعر دينار']);
    const priceUsdIx = ix(['السعر دولار', ' السعر دولار']);
    const totalIx = ix(['السعر الكلي دينار']);
    const totalUsdIx = ix(['السعر الكلي دولار']);
    const dateIx = ix(['تاري الذرعة', 'تاريخ الذرعة']);

    contractorRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'transition hover:bg-slate-800/80';
        const addCell = (value, cls = 'px-4 py-3 text-center border-b border-slate-700/60') => {
            const td = document.createElement('td');
            td.className = cls;
            td.textContent = value;
            tr.appendChild(td);
        };
        addCell(invoiceIx >= 0 ? String(row[invoiceIx] ?? '—') : '—', 'px-4 py-3 text-center border-b border-slate-700/60 font-semibold text-sky-200');
        addCell(workIx >= 0 ? String(row[workIx] ?? '—') : '—', 'px-4 py-3 text-right border-b border-slate-700/60');
        addCell(qtyIx >= 0 ? formatCell('الكمية', row[qtyIx]) : '—');
        addCell(unitIx >= 0 ? String(row[unitIx] ?? '—') : '—');
        addCell(priceIx >= 0 ? formatMoneyForHeader('السعر دينار', parseNumber(row[priceIx])) : '—');
        addCell(priceUsdIx >= 0 ? formatMoneyForHeader('السعر دولار', parseNumber(row[priceUsdIx])) : '—');
        const total = totalIx >= 0 ? parseNumber(row[totalIx]) : (parseNumber(row[qtyIx]) * parseNumber(row[priceIx]));
        addCell(formatMoney(total), 'px-4 py-3 text-center border-b border-slate-700/60 font-bold text-emerald-400');
        const totalUsd = totalUsdIx >= 0 ? parseNumber(row[totalUsdIx]) : (parseNumber(row[qtyIx]) * parseNumber(row[priceUsdIx]));
        addCell(formatMoneyForHeader('السعر الكلي دولار', totalUsd), 'px-4 py-3 text-center border-b border-slate-700/60 font-bold text-emerald-300');
        addCell(dateIx >= 0 ? formatCell('تاريخ الذرعة', row[dateIx]) : '—');
        tr.appendChild(attCell(CT, row));

        const act = document.createElement('td');
        act.className = 'px-4 py-3 text-center border-b border-slate-700/60';
        if (canMutateActiveSheet()) {
            const edit = document.createElement('button');
            edit.type = 'button'; edit.textContent = 'تعديل';
            edit.className = 'rounded border border-sky-800 bg-sky-950/60 px-2 py-1 text-xs font-semibold text-sky-300';
            edit.addEventListener('click', () => showAdd(row, 'dhara'));
            const del = document.createElement('button');
            del.type = 'button'; del.textContent = 'حذف';
            del.className = 'ms-1 rounded border border-rose-900 bg-rose-950/50 px-2 py-1 text-xs font-semibold text-rose-300';
            del.setAttribute('aria-label', 'حذف الفاتورة/الذرعة');
            del.addEventListener('click', () => deleteSheetRow(row));
            act.append(edit, del);
        }
        tr.appendChild(act);
        body.appendChild(tr);
    });
}

function getContractorPayments() {
    const headers = sheetHeaders(GL);
    const amountIx = findHeaderIndex(headers, ['المبلغ']);
    const amountUsdIx = findHeaderIndex(headers, ['المبلغ $', 'المبلغ دولار']);
    const currencyIx = findHeaderIndex(headers, ['العملة', 'نوع العملة']);
    let iqd = 0, usd = 0;
    receivedRows.forEach(row => {
        const currency = currencyIx >= 0 ? normalizeText(row[currencyIx]) : '';
        if (amountUsdIx >= 0) usd += parseNumber(row[amountUsdIx]);
        if (amountIx < 0) return;
        if (/usd|دولار|\$/.test(currency)) usd += parseNumber(row[amountIx]);
        else iqd += parseNumber(row[amountIx]);
    });
    return { iqd, usd };
}

function renderContractorSummary() {
    const headers = sheetHeaders(CT);
    const totalIx = findHeaderIndex(headers, ['السعر الكلي دينار']);
    const qtyIx = findHeaderIndex(headers, ['الكمية']);
    const priceIx = findHeaderIndex(headers, ['السعر دينار']);
    const total = contractorRows.reduce((sum, row) => {
    if (totalIx >= 0 && parseNumber(row[totalIx])) return sum + parseNumber(row[totalIx]);
    if (qtyIx < 0 || priceIx < 0) return sum;
    return sum + parseNumber(row[qtyIx]) * parseNumber(row[priceIx]);
}, 0);
    const payments = getContractorPayments();
    const remaining = total - payments.iqd;
    if ($('contractorTotalDhara')) $('contractorTotalDhara').textContent = formatMoney(total);
    if ($('contractorTotalReceived')) $('contractorTotalReceived').textContent = formatMoney(payments.iqd);
    if ($('contractorRemaining')) {
        $('contractorRemaining').textContent = formatMoney(remaining);
        $('contractorRemaining').className = 'text-lg font-extrabold ' + (remaining >= 0 ? 'text-amber-400' : 'text-rose-400');
    }
}

function renderReceivedList() {
    const list = $('contractorReceivedList');
    if (!list) return;
    list.replaceChildren();
    if (!receivedRows.length) {
        const p = document.createElement('p');
        p.className = 'text-xs text-slate-400 text-center py-4';
        p.textContent = currentContractor ? 'لا توجد دفعات لهذا المقاول في السجل العام' : 'اختر مقاولاً لعرض الدفعات المسجلة';
        list.appendChild(p);
        return;
    }

    const headers = sheetHeaders(GL);
    const dateIx = findHeaderIndex(headers, ['التاريخ']);
    const amountIx = findHeaderIndex(headers, ['المبلغ']);
    const detailsIx = findHeaderIndex(headers, ['التفاصيل', 'البيان']);
    const codeIx = findHeaderIndex(headers, ['الكود']);
    const locationIx = findHeaderIndex(headers, ['الموقع']);
    receivedRows.forEach(row => {
        const card = document.createElement('div');
        card.className = 'rounded-lg border border-slate-700/50 bg-slate-950/50 p-3 space-y-1';
        const line = document.createElement('div');
        line.className = 'flex justify-between items-baseline';
        const date = document.createElement('span');
        date.className = 'text-xs text-slate-400';
        date.textContent = dateIx >= 0 ? formatCell('التاريخ', row[dateIx]) : '—';
        const amount = document.createElement('span');
        amount.className = 'text-sm font-bold text-emerald-400';
        amount.textContent = amountIx >= 0 ? formatMoney(parseNumber(row[amountIx])) : '—';
        line.append(date, amount);
        card.appendChild(line);
        if (detailsIx >= 0 && String(row[detailsIx] ?? '').trim()) {
            const detail = document.createElement('p');
            detail.className = 'text-xs text-slate-300 leading-relaxed';
            detail.textContent = String(row[detailsIx]).slice(0, 100);
            card.appendChild(detail);
        }
        const code = codeIx >= 0 ? String(row[codeIx] ?? '').trim() : '';
        const location = locationIx >= 0 ? String(row[locationIx] ?? '').trim() : '';
        if (code || location) {
            const reference = document.createElement('p');
            reference.className = 'text-[11px] text-slate-400';
            reference.textContent = [code ? `الكود: ${code}` : '', location ? `الموقع: ${location}` : ''].filter(Boolean).join(' — ');
            card.appendChild(reference);
        }
        list.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const search = $('contractorSearch');
    if (search) {
        search.addEventListener('input', debounce(renderContractorsPanel, 250));
        search.addEventListener('change', renderContractorsPanel);
    }
    const addContractor = $('addContractorBtn');
    if (addContractor) addContractor.addEventListener('click', () => showAdd(null, 'contractor'));
    const addDhara = $('addDharaBtn');
    if (addDhara) addDhara.addEventListener('click', () => {
        if (!currentContractor) return toast('اختر مقاولاً أولاً، أو أضفه من زر «إضافة مقاول/مجهز».', 'error');
        showAdd(null, 'dhara');
        setTimeout(() => {
            const nameIx = findHeaderIndex(sheetHeaders(CT), ['اسم المقاول']);
            const nameEl = $('addFields')?.querySelector(`[data-col="${nameIx}"]`);
            if (nameEl) nameEl.value = currentContractor;
            const dateIx = findHeaderIndex(sheetHeaders(CT), ['تاري الذرعة', 'تاريخ الذرعة']);
            const dateEl = $('addFields')?.querySelector(`[data-col="${dateIx}"]`);
            if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
        }, 0);
    });
});
