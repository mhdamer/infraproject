'use strict';

/**
 * row-editor.js — إضافة/تعديل/حذف السجلات
 * v1.2 — إصلاحات: push بدل unshift + wdBlockIndexes الديناميكي + partnerBlock صريح
 */

// =============== إصلاح التواريخ ===============
function fixDates() {
    Object.keys(workbookData).forEach(name => {
        const sh = workbookData[name];
        if (!sh || !Array.isArray(sh.headers)) return;
        sh.headers.forEach((h, c) => {
            if (!String(h).includes('تاريخ')) return;
            (sh.rows || []).forEach(r => {
                const v = r[c];
                if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
                    const d = new Date(v);
                    if (!isNaN(d))
                        r[c] = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                }
            });
        });
    });
}

function boolFlag(v) {
    if (v === true || v === 1) return true;
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'نعم';
}

function computeRowAuto(row, headers, changed) {
    const ix = n => findHeaderIndex(headers, [n]);

    if (activeSheet === CT) {
        const q = ix('الكمية'), pIQD = ix('السعر دينار'), tIQD = ix('السعر الكلي دينار');
        const pUSD = ix(' السعر دولار'), tUSD = ix('السعر الكلي دولار');
        if (![q, pIQD, pUSD].includes(changed)) return;
        if (tIQD >= 0) row[tIQD] = Math.round(parseNumber(row[q]) * parseNumber(row[pIQD]) * 100) / 100;
        if (tUSD >= 0) row[tUSD] = Math.round(parseNumber(row[q]) * parseNumber(row[pUSD]) * 100) / 100;
        return;
    }
    if (activeSheet === ADV) return;
    if (activeSheet === WD) return;
    if (activeSheet === GL) return;
    if (activeSheet === DB) {
        const reqIQD = ix('المبلغ المطلوب دينار'), gotIQD = ix('المبلغ المستلم دينار'), remIQD = ix('الباقي/ دينار');
        const reqUSD = ix('المبلغ المطلوب $'), gotUSD = ix('المبلغ المستلم $'), remUSD = ix('الباقي $');
        const changedIsReqOrGot = [reqIQD, gotIQD, reqUSD, gotUSD].includes(changed);
        if (!changedIsReqOrGot) return;
        if (remIQD >= 0) row[remIQD] = Math.round((parseNumber(row[reqIQD]) - parseNumber(row[gotIQD])) * 100) / 100;
        if (remUSD >= 0) row[remUSD] = Math.round((parseNumber(row[reqUSD]) - parseNumber(row[gotUSD])) * 100) / 100;
        return;
    }
}

function getLedgerCodeLocationOptions(headers = sheetHeaders(GL), rows = sheetRows(GL)) {
    const codeIx = findHeaderIndex(headers, ['الكود']);
    const locationIx = findHeaderIndex(headers, ['الموقع']);
    if (codeIx < 0) return [];
    const seen = new Set();
    return rows.map(row => ({
        code: String(row[codeIx] ?? '').trim(),
        location: locationIx >= 0 ? String(row[locationIx] ?? '').trim() : ''
    })).filter(item => {
        if (!item.code) return false;
        const key = normalizeText(item.code) + '\u0000' + normalizeText(item.location);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).sort((a, b) => a.code.localeCompare(b.code, 'ar', { numeric: true }) || a.location.localeCompare(b.location, 'ar'));
}

function setupLedgerCodeLocationPicker() {
    if (activeSheet !== GL) return;
    const box = $('addFields');
    const headers = sheetHeaders(GL);
    const codeIx = findHeaderIndex(headers, ['الكود']);
    const locationIx = findHeaderIndex(headers, ['الموقع']);
    const codeInput = box?.querySelector(`[data-col="${codeIx}"]`);
    const locationInput = box?.querySelector(`[data-col="${locationIx}"]`);
    if (!codeInput || !locationInput) return;

    const label = codeInput.closest('label');
    if (!label) return;
    label.classList.add('relative');
    const panel = document.createElement('div');
    panel.className = 'hidden absolute right-0 top-full z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-600 bg-slate-900 p-1 text-right shadow-2xl';
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('aria-label', 'الأكواد والمواقع المسجلة في السجل العام');
    label.appendChild(panel);

    const options = getLedgerCodeLocationOptions(headers, sheetRows(GL));
    const close = () => panel.classList.add('hidden');
    const showMatches = () => {
        const query = normalizeText(codeInput.value);
        const matches = options.filter(item => !query || normalizeText(item.code).includes(query) || normalizeText(item.location).includes(query)).slice(0, 20);
        panel.replaceChildren();
        matches.forEach(item => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'block w-full rounded-md px-3 py-2 text-right text-xs text-slate-100 hover:bg-slate-700 focus:bg-slate-700';
            option.setAttribute('role', 'option');
            option.textContent = item.location ? `${item.code} — ${item.location}` : item.code;
            option.addEventListener('mousedown', event => event.preventDefault());
            option.addEventListener('click', () => {
                codeInput.value = item.code;
                locationInput.value = item.location;
                codeInput.dispatchEvent(new Event('input', { bubbles: true }));
                locationInput.dispatchEvent(new Event('input', { bubbles: true }));
                close();
            });
            panel.appendChild(option);
        });
        panel.classList.toggle('hidden', matches.length === 0);
    };
    codeInput.setAttribute('autocomplete', 'off');
    codeInput.setAttribute('aria-haspopup', 'listbox');
    codeInput.addEventListener('focus', showMatches);
    codeInput.addEventListener('input', showMatches);
    codeInput.addEventListener('blur', () => setTimeout(close, 120));
    codeInput.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
}

function setupAutoFields() {
    const box = $('addFields');
    if (!box) return;
    const headers = sheetHeaders(activeSheet);
    if (activeSheet === GL) setupLedgerCodeLocationPicker();

    if (activeSheet === CT) {
        const computedNames = ['السعر الكلي دينار', 'السعر الكلي دولار', 'مجموع الطلب دينار', 'مجموع المدفوع دينار', 'المتبقي دينار', 'مجموع الطلب $', 'مجموع المدفوع $', 'الباقي $'];
        [...new Set(computedNames.map(n => findHeaderIndex(headers, [n])).filter(ix => ix >= 0))].forEach(ix => {
            if (ix < 0) return;
            const e = box.querySelector('[data-col="' + ix + '"]');
            if (e) {
                e.readOnly = true;
                e.tabIndex = -1;
                e.classList.add('opacity-70', 'cursor-not-allowed');
                e.placeholder = 'يُحسب تلقائياً';
            }
        });
    }

    if (activeSheet === DB) {
        ['الباقي/ دينار', 'الباقي $'].forEach(name => {
            const ix = findHeaderIndex(headers, [name]);
            if (ix < 0) return;
            const e = box.querySelector('[data-col="' + ix + '"]');
            if (e) {
                e.readOnly = true;
                e.tabIndex = -1;
                e.classList.add('opacity-70', 'cursor-not-allowed');
                e.placeholder = 'يُحسب تلقائياً';
            }
        });
    }
}

let editingRow = null;
let editingOld = null;
let activeEditorMode = 'standard';
let activeWithdrawalEditStart = 0;
let initialWithdrawalEditStart = 0;

function canMutateActiveSheet() {
    return !!session && authCanView(activeSheet) && !(AppConfig.READONLY_SHEETS || []).includes(activeSheet);
}

function appendCustomField(box, labelText, fieldName, type = 'text', value = '') {
    const label = document.createElement('label');
    label.className = 'block text-xs font-semibold text-slate-300';
    label.appendChild(document.createTextNode(labelText));
    const input = type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
    if (type !== 'textarea') input.type = type;
    else input.rows = 3;
    if (type === 'number') input.step = 'any';
    input.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none';
    input.dataset.customField = fieldName;
    input.value = value ?? '';
    label.appendChild(input);
    box.appendChild(label);
    return input;
}

function showAdd(row, requestedMode) {
    if (!canMutateActiveSheet())
        return toast('هذا التبويب للاطلاع فقط — لا يمكن الإضافة أو التعديل.', 'error');

    if (activeSheet === CT && typeof ensureContractorProfileHeaders === 'function') ensureContractorProfileHeaders();
    activeEditorMode = requestedMode || (activeSheet === CT ? 'dhara' : activeSheet === ADV ? 'advance' : activeSheet === WD ? 'withdrawal' : 'standard');

    editingRow = (Array.isArray(row) ? row : null);
    editingOld = editingRow ? editingRow.slice() : null;

    const headers = sheetHeaders(activeSheet);
    if (!headers.length) return toast('هذا التبويب لا يحتوي على أعمدة.', 'error');

    const titles = { contractor: 'إضافة مقاول/مجهز', dhara: 'إضافة ذرعة/فاتورة', advance: 'إضافة سلفة مستلمة', withdrawal: 'إضافة سحب أو تمويل' };
    $('addTitle').textContent = editingRow ? 'تعديل — ' + activeSheet : (titles[activeEditorMode] || 'إضافة سجل جديد — ' + activeSheet);
    $('saveAdd').textContent = editingRow ? 'حفظ التعديل' : 'حفظ السجل';
    $('deleteRowBtn').classList.toggle('hidden', !(editingRow && canMutateActiveSheet()));
    const sheetsLabel = $('addToSheet')?.closest('label');
    if (sheetsLabel) sheetsLabel.classList.toggle('hidden', activeEditorMode !== 'standard');

    const box = $('addFields');
    box.replaceChildren();

    if (activeEditorMode === 'withdrawal') {
        // ★ SHARAEEN: استخدام wdBlockIndexes الديناميكي بدل 0/6
        const headerIndexes = (name) => headers.map((h, i) => String(h).trim() === name ? i : -1).filter(i => i >= 0);
        const funding = headerIndexes('التمويل'), draw = headerIndexes('السحب'), dates = headerIndexes('التاريخ');
        const notes = [...headerIndexes('الملاحظات'), ...headerIndexes('ملاحظات')].sort((a, b) => a - b);
        const partners = (typeof WD_PARTNERS !== 'undefined') ? WD_PARTNERS : ['محمد اللامي', 'أحمد شاكر'];
        const getStart = (name) => (typeof wdBlockIndexes === 'function')
            ? wdBlockIndexes(name).start
            : (partners.indexOf(name) === 0 ? 2 : 7);
        activeWithdrawalEditStart = (typeof wdActivePartner !== 'undefined') ? getStart(wdActivePartner) : getStart(partners[0]);
        initialWithdrawalEditStart = activeWithdrawalEditStart;

        const partnerSelect = document.createElement('select');
        partnerSelect.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none';
        partnerSelect.dataset.customField = 'partner';
        partners.forEach(name => {
            const option = document.createElement('option');
            option.value = String(getStart(name));
            option.textContent = name;
            partnerSelect.appendChild(option);
        });
        partnerSelect.value = String(activeWithdrawalEditStart);
        const partnerLabel = document.createElement('label');
        partnerLabel.className = 'block text-xs font-semibold text-slate-300';
        partnerLabel.append('الشريك'); partnerLabel.appendChild(partnerSelect); box.appendChild(partnerLabel);

        const partnerBlock = partners.findIndex(name => getStart(name) === activeWithdrawalEditStart);
        const movement = document.createElement('select');
        movement.className = partnerSelect.className;
        movement.dataset.customField = 'movement';
        [['funding', 'تمويل'], ['draw', 'سحب']].forEach(([value, label]) => {
            const option = document.createElement('option'); option.value = value; option.textContent = label; movement.appendChild(option);
        });
        movement.value = editingRow && draw[partnerBlock] >= 0 && parseNumber(editingRow[draw[partnerBlock]]) ? 'draw' : 'funding';
        const movementLabel = document.createElement('label');
        movementLabel.className = 'block text-xs font-semibold text-slate-300';
        movementLabel.append('نوع الحركة'); movementLabel.appendChild(movement); box.appendChild(movementLabel);
        const amountIndex = movement.value === 'draw' ? draw[partnerBlock] : funding[partnerBlock];
        const amountInput = appendCustomField(box, 'المبلغ', 'amount', 'number', editingRow && amountIndex >= 0 ? editingRow[amountIndex] : '');
        appendCustomField(box, 'التفاصيل', 'details', 'textarea', editingRow && notes[partnerBlock] >= 0 ? editingRow[notes[partnerBlock]] : '');
        appendCustomField(box, 'التاريخ', 'date', 'date', editingRow && dates[partnerBlock] >= 0 ? toIsoDate(editingRow[dates[partnerBlock]]) : new Date().toISOString().slice(0, 10));
        partnerSelect.addEventListener('change', () => { activeWithdrawalEditStart = Number(partnerSelect.value); });
        movement.addEventListener('change', () => { amountInput.value = ''; });
    } else {
    headers.forEach((h, i) => {
        const hName = String(h).trim();
        if (!hName) return;
        if (activeEditorMode === 'contractor' && !['اسم المقاول', 'نوع العمل', 'العمل', 'الكود'].includes(hName)) return;
        if (activeEditorMode === 'advance' && !['ت', 'المبلغ', 'التفاصيل', 'التاريخ'].includes(hName)) return;
        if (activeEditorMode === 'dhara' && !['اسم المقاول', 'رقم الذرعة', 'المادة/العمل', 'الكمية', 'الوحدة', 'السعر دينار', 'السعر دولار', 'السعر الكلي دينار', 'السعر الكلي دولار', 'تاري الذرعة', 'تاريخ الذرعة', ATT_H, 'مرفق'].includes(hName)) return;
        if (activeSheet === GL && !['رقم الوصل', 'المبلغ', 'التفاصيل', 'التاريخ', 'المستلم', 'الكود', 'الموقع', ATT_H, 'مرفق'].includes(hName) && !(hName === 'ت' && findHeaderIndex(headers, ['رقم الوصل']) < 0)) return;
        if (activeSheet === GL && hName === 'ت' && findHeaderIndex(headers, ['رقم الوصل']) >= 0) return;

        if ([ATT_H, 'مرفق'].includes(hName)) {
            const hi = document.createElement('input');
            hi.type = 'hidden';
            hi.dataset.col = i;
            hi.dataset.h = hName;
            hi.value = editingRow ? String(editingRow[i] ?? '') : '';
            box.appendChild(hi);
            return;
        }
        if ([AUDIT_H, DELETED_H, VERSION_H].includes(hName)) return;

        const label = document.createElement('label');
        label.className = 'block text-xs font-semibold text-slate-300';
        let fieldLabel = typeof sheetHeaderLabel === 'function' ? sheetHeaderLabel(activeSheet, headers, i) : hName;
        if (activeEditorMode === 'contractor' && hName === 'اسم المقاول') fieldLabel = 'اسم المقاول/المجهز';
        label.appendChild(document.createTextNode(fieldLabel));

        let input;

        if (activeEditorMode === 'contractor' && hName === 'نوع العمل') {
            input = document.createElement('select');
            input.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none';
            const currentRaw = editingRow ? String(editingRow[i] ?? '').trim() : '';
            const current = normalizeText(currentRaw);
            [['مقاول', 'مقاول'], ['مجهز', 'مجهز']].forEach(([value, labelText]) => {
                const option = document.createElement('option'); option.value = value; option.textContent = labelText; input.appendChild(option);
            });
            if (currentRaw && !/مقاول|مجهز|مورد/.test(current)) {
                const legacy = document.createElement('option'); legacy.value = currentRaw; legacy.textContent = currentRaw; input.appendChild(legacy);
            }
            input.value = /مجهز|مورد/.test(current) ? 'مجهز' : (currentRaw && !/مقاول/.test(current) ? currentRaw : 'مقاول');
        }
        else if (hName === 'النوع') {
            input = document.createElement('select');
            input.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none';
            const options = activeSheet === WD ? ['سحب', 'تمويل'] : ['صرف', 'قبض', 'تحويل'];
            options.forEach(opt => { const o = document.createElement('option'); o.value = opt; o.textContent = opt; input.appendChild(o); });
            if (editingRow && editingRow[i]) input.value = String(editingRow[i]);
        }
        else if (hName === 'العملة') {
            input = document.createElement('select');
            input.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none';
            ['IQD', 'USD'].forEach(opt => { const o = document.createElement('option'); o.value = opt; o.textContent = opt; input.appendChild(o); });
            input.value = (editingRow && editingRow[i]) ? String(editingRow[i]) : 'IQD';
        }
        else if (activeSheet === ADV && hName === 'المصدر') {
            input = document.createElement('input');
            input.type = 'text';
            input.setAttribute('list', 'sourceList');
            input.placeholder = 'اسم المقاول/الشريك';
            input.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none';
            if (!box.querySelector('#sourceList')) {
                const dl = document.createElement('datalist');
                dl.id = 'sourceList';
                const ctNameIx = findHeaderIndex(sheetHeaders(CT), ['اسم المقاول']);
                const seen = new Set();
                sheetRows(CT).forEach(r => {
                    const v = String(r[ctNameIx] ?? '').trim();
                    if (v && !seen.has(v)) { seen.add(v); const o = document.createElement('option'); o.value = v; dl.appendChild(o); }
                });
                const wdPartnerIx = findHeaderIndex(sheetHeaders(WD), ['الشريك']);
                sheetRows(WD).forEach(r => {
                    const v = String(r[wdPartnerIx] ?? '').trim();
                    if (v && !seen.has(v)) { seen.add(v); const o = document.createElement('option'); o.value = v; dl.appendChild(o); }
                });
                box.appendChild(dl);
            }
        }
        else if (activeSheet === WD && hName === 'الشريك') {
            input = document.createElement('input');
            input.type = 'text';
            input.setAttribute('list', 'partnerList');
            input.placeholder = 'محمد اللامي / أحمد شاكر';
            input.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none';
            if (!box.querySelector('#partnerList')) {
                const dl = document.createElement('datalist');
                dl.id = 'partnerList';
                ['محمد اللامي', 'أحمد شاكر'].forEach(v => { const o = document.createElement('option'); o.value = v; dl.appendChild(o); });
                box.appendChild(dl);
            }
        }
        else if (activeSheet === GL && hName === 'الكود') {
            input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'اكتب أو اختر كوداً؛ ستظهر المواقع المسجلة معه';
            input.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none';
        }
        else if (hName.includes('تاريخ') || hName.includes('تاري')) {
            input = document.createElement('input');
            input.type = 'date';
            input.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none';
        }
        else {
            input = document.createElement('input');
            input.type = /مبلغ|السعر|كمية|مجموع|المتبقي|الباقي|عدد/.test(normalizeText(hName)) ? 'number' : 'text';
            if (input.type === 'number') input.step = 'any';
            input.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none';
        }

        input.dataset.col = i;
        input.dataset.h = hName;

        if (editingRow && editingRow[i] !== undefined && editingRow[i] !== null) {
            input.value = String(editingRow[i]);
        }

        label.appendChild(input);
        box.appendChild(label);
    });
    }

    setupAutoFields();

    box.oninput = (e) => {
        const h = e.target.dataset.h;
        if (h === 'الكمية' || h === 'السعر دينار' || h === 'السعر دولار') {
            const priceName = h === 'السعر دولار' ? 'السعر دولار' : 'السعر دينار';
            const totalName = h === 'السعر دولار' ? 'السعر الكلي دولار' : 'السعر الكلي دينار';
            const tIx = findHeaderIndex(headers, [totalName]);
            const qIx = findHeaderIndex(headers, ['الكمية']);
            const pIx = findHeaderIndex(headers, [priceName]);
            if (tIx >= 0 && qIx >= 0 && pIx >= 0) {
                const q = box.querySelector('[data-col="' + qIx + '"]');
                const p = box.querySelector('[data-col="' + pIx + '"]');
                const t = box.querySelector('[data-col="' + tIx + '"]');
                if (t && q && p) {
                    const total = parseNumber(q.value) * parseNumber(p.value);
                    t.value = total ? String(Math.round(total * 100) / 100) : '';
                }
            }
        }
        if (['المبلغ المطلوب دينار', 'المبلغ المستلم دينار', 'المبلغ المطلوب $', 'المبلغ المستلم $'].includes(h)) {
            ['الباقي/ دينار', 'الباقي $'].forEach(name => {
                const rIx = findHeaderIndex(headers, [name]);
                if (rIx < 0) return;
                const reqName = name === 'الباقي/ دينار' ? 'المبلغ المطلوب دينار' : 'المبلغ المطلوب $';
                const gotName = name === 'الباقي/ دينار' ? 'المبلغ المستلم دينار' : 'المبلغ المستلم $';
                const req = box.querySelector('[data-col="' + findHeaderIndex(headers, [reqName]) + '"]');
                const got = box.querySelector('[data-col="' + findHeaderIndex(headers, [gotName]) + '"]');
                const rem = box.querySelector('[data-col="' + rIx + '"]');
                if (req && got && rem) {
                    rem.value = String(Math.round((parseNumber(req.value) - parseNumber(got.value)) * 100) / 100);
                }
            });
        }
    };

    $('addModal').classList.remove('hidden');
    $('addModal').classList.add('flex');
}

function hideAdd() {
    const modal = $('addModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    editingRow = null;
    editingOld = null;
}

async function saveWithdrawalForm() {
    const box = $('addFields');
    const headers = sheetHeaders(WD);
    const partners = (typeof WD_PARTNERS !== 'undefined') ? WD_PARTNERS : ['محمد اللامي', 'أحمد شاكر'];
    const getStart = (name) => (typeof wdBlockIndexes === 'function')
        ? wdBlockIndexes(name).start
        : (partners.indexOf(name) === 0 ? 2 : 7);

    // ★ SHARAEEN: partnerStart هو فهرس العمود الفعلي (2 أو 7)
    const partnerStart = Number(box.querySelector('[data-custom-field="partner"]')?.value || 0);
    const partnerBlock = partners.findIndex(name => getStart(name) === partnerStart);
    if (partnerBlock < 0) return toast('لم يتم التعرف على الشريك.', 'error');

    const movement = box.querySelector('[data-custom-field="movement"]')?.value || 'funding';
    const amount = parseNumber(box.querySelector('[data-custom-field="amount"]')?.value);
    const details = String(box.querySelector('[data-custom-field="details"]')?.value || '').trim();
    const date = String(box.querySelector('[data-custom-field="date"]')?.value || '').trim();
    if (!amount || !date) return toast('أدخل المبلغ والتاريخ قبل الحفظ.', 'error');

    const indices = name => headers.map((h, i) => String(h).trim() === name ? i : -1).filter(i => i >= 0);
    const serials = indices('ت'), funding = indices('التمويل'), draw = indices('السحب'), dates = indices('التاريخ');
    const noteIndexes = [...indices('الملاحظات'), ...indices('ملاحظات')].sort((a, b) => a - b);
    const targetSerial = serials[partnerBlock], targetFunding = funding[partnerBlock], targetDraw = draw[partnerBlock];
    const targetDate = dates[partnerBlock], targetNotes = noteIndexes[partnerBlock];
    if ([targetSerial, targetFunding, targetDraw, targetDate].some(ix => ix === undefined || ix < 0))
        return toast('تعذر مطابقة أعمدة الشريك في الشيت.', 'error');

    const newRow = editingRow ? editingRow.slice() : Array(headers.length).fill('');
    if (editingRow && initialWithdrawalEditStart !== partnerStart) {
        // ★ SHARAEEN: حساب البلوك القديم ديناميكياً
        const oldBlock = partners.findIndex(name => getStart(name) === initialWithdrawalEditStart);
        if (oldBlock >= 0) {
            [serials[oldBlock], funding[oldBlock], draw[oldBlock], dates[oldBlock], noteIndexes[oldBlock]].forEach(ix => { if (ix !== undefined && ix >= 0) newRow[ix] = ''; });
        }
    }
    let serial = editingRow && initialWithdrawalEditStart === partnerStart ? newRow[targetSerial] : '';
    if (!serial) {
        const used = sheetRows(WD).map(row => parseNumber(row[targetSerial])).filter(Number.isFinite);
        serial = Math.max(0, ...used) + 1;
    }
    newRow[targetSerial] = serial;
    newRow[targetFunding] = movement === 'funding' ? amount : '';
    newRow[targetDraw] = movement === 'draw' ? amount : '';
    newRow[targetDate] = date;
    if (targetNotes !== undefined && targetNotes >= 0) newRow[targetNotes] = details;

    if (!workbookData[WD]) workbookData[WD] = { headers, rows: [] };
    let rowIndex = -1;
    if (editingRow) {
        rowIndex = sheetRows(WD).indexOf(editingRow);
        if (rowIndex < 0) return toast('لم أعد أجد الحركة المراد تعديلها.', 'error');
        editingRow.splice(0, editingRow.length, ...newRow);
    } else workbookData[WD].rows.push(newRow);  // ★ push بدل unshift
    saveWorkbook(); render();

    const save = $('saveAdd');
    save.disabled = true; save.textContent = 'جارٍ الحفظ...';
    const toRecord = row => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
    try {
        const result = await sendSheetData({
            action: editingRow ? 'update' : 'add', sheet: WD, sheetName: WD,
            headers, record: toRecord(newRow), data: newRow, entryType: 'withdrawal',
            partnerBlock: partnerStart,  // فهرس بداية كتلة الشريك الفعلية
            oldPartnerBlock: initialWithdrawalEditStart,
            oldRecord: editingOld ? toRecord(editingOld) : null, oldData: editingOld
        });
        if (result?.status === 'sent-unverified') throw new Error('لم يصل تأكيد من Google Sheets. حدّث الصفحة للتحقق.');
        toast(editingRow ? 'تم حفظ تعديل الحركة.' : 'تم حفظ الحركة.');
        hideAdd();
    } catch (error) {
        if (editingRow && editingOld) editingRow.splice(0, editingRow.length, ...editingOld);
        saveWorkbook(); render();
        toast('لم يتأكد حفظ الحركة: ' + (error.message || ''), 'error');
    } finally {
        save.disabled = false; save.textContent = 'حفظ السجل';
    }
}

async function saveNewRow() {
    const box = $('addFields');
    if (!box) return;
    if (activeEditorMode === 'withdrawal') return saveWithdrawalForm();
    const headers = sheetHeaders(activeSheet);
    const record = {};
    const recordByIndex = [];

    box.querySelectorAll('[data-h]').forEach(el => {
        const h = el.dataset.h;
        if (!h) return;
        const ix = Number(el.dataset.col);
        let value = el.type === 'checkbox' ? el.checked : el.value.trim();
        if (el.type === 'number' && value !== '') value = Number(value);
        recordByIndex[ix] = value;
        if (!Object.prototype.hasOwnProperty.call(record, h)) record[h] = value;
    });

    if (activeEditorMode === 'contractor' && !String(record['اسم المقاول'] || '').trim())
        return toast('اكتب اسم المقاول/المجهز.', 'error');
    if (activeEditorMode === 'contractor' && !String(record['العمل'] || '').trim())
        return toast('اكتب العمل الذي ينفذه المقاول أو يجهزه.', 'error');
    if (activeEditorMode === 'dhara' && !editingRow && (!String(record['اسم المقاول'] || '').trim() || !String(record['رقم الذرعة'] || '').trim()))
        return toast('حدد المقاول/المجهز واكتب رقم الذرعة/الفاتورة.', 'error');
    if (activeEditorMode === 'advance' && !String(record['المبلغ'] || '').trim())
        return toast('اكتب مبلغ السلفة المستلمة.', 'error');
    if (activeSheet === GL && typeof validateProjectAdvanceReceipt === 'function') {
        const validAdvanceLink = await validateProjectAdvanceReceipt(record, editingRow);
        if (!validAdvanceLink) return;
    }

    if (!workbookData[activeSheet]) workbookData[activeSheet] = { headers, rows: [] };
    if (editingRow) {
        const oldRecord = Object.fromEntries(headers.map((h, i) => [h, editingOld[i] ?? '']));
        headers.forEach((h, i) => { editingRow[i] = recordByIndex[i] !== undefined ? recordByIndex[i] : editingRow[i]; });
        saveWorkbook();
        render();

        $('saveAdd').disabled = true;
        $('saveAdd').textContent = 'جارٍ الحفظ...';
        try {
            const result = await sendSheetData({
                action: 'update', sheet: activeSheet, sheetName: activeSheet,
                headers, record: Object.fromEntries(headers.map((h, i) => [h, editingRow[i] ?? ''])), oldRecord, oldData: editingOld, data: editingRow, entryType: activeEditorMode
            });
            if (result?.status === 'sent-unverified') throw new Error('لم يصل تأكيد من Google Sheets. حدّث الصفحة للتحقق من حفظ التعديل.');
            toast('تم حفظ التعديل.');
            hideAdd();
        } catch (error) {
            toast('تعدّل محلياً لكن فشل الإرسال: ' + (error.message || ''), 'error');
        } finally {
            $('saveAdd').disabled = false;
            $('saveAdd').textContent = 'حفظ التعديل';
        }
    } else {
        const newRow = headers.map((_, i) => recordByIndex[i] !== undefined ? recordByIndex[i] : '');
        // ★ SHARAEEN: push بدل unshift — الجديد ينزل في الأسفل مثل الخادم
        workbookData[activeSheet].rows.push(newRow);
        saveWorkbook();
        render();

        $('saveAdd').disabled = true;
        $('saveAdd').textContent = 'جارٍ الحفظ...';
        try {
            const result = await sendSheetData({
                action: 'add', sheet: activeSheet, sheetName: activeSheet,
                headers, record, data: newRow, entryType: activeEditorMode
            });
            if (result?.status === 'sent-unverified') throw new Error('لم يصل تأكيد من Google Sheets. حدّث الصفحة للتحقق من حفظ السجل.');
            if (activeEditorMode === 'contractor' && $('contractorSearch')) {
                $('contractorSearch').value = String(record['اسم المقاول'] || '').trim();
                if (typeof renderContractorsPanel === 'function') renderContractorsPanel();
            }
            toast('تم حفظ السجل الجديد.');
            hideAdd();
        } catch (error) {
            toast('حُفظ محلياً لكن فشل الإرسال: ' + (error.message || ''), 'error');
        } finally {
            $('saveAdd').disabled = false;
            $('saveAdd').textContent = 'حفظ السجل';
        }
    }
}

async function deleteCurrentRow() {
    if (!editingRow) return;
    await deleteSheetRow(editingRow);
}

async function deleteSheetRow(row) {
    if (!canMutateActiveSheet()) return toast('ليس لديك صلاحية تعديل هذه الصفحة.', 'error');
    if (!confirm('هل تريد حذف هذا السجل من Google Sheets؟')) return;
    const sheet = activeSheet;
    const headers = sheetHeaders(sheet);
    const rows = sheetRows(sheet);
    const index = rows.indexOf(row);
    if (index < 0) return toast('لم أعد أجد هذا السجل في البيانات الحالية.', 'error');
    const removed = rows[index];
    const oldData = removed.slice();
    const isWithdrawal = sheet === WD;

    // ★ SHARAEEN: فهرس العمود الفعلي للشريك النشط (2 أو 7)
    const partnerBlock = isWithdrawal && typeof wdActivePartner !== 'undefined' && typeof wdBlockIndexes === 'function'
        ? wdBlockIndexes(wdActivePartner).start
        : 0;

    if (isWithdrawal) {
        const hasSelectedMovement = oldData.slice(partnerBlock, partnerBlock + 5).some(value => value !== '' && value !== null && value !== false);
        if (!hasSelectedMovement) return toast('لا توجد حركة لهذا الشريك في هذا السطر.', 'error');
        for (let i = partnerBlock; i < partnerBlock + 5; i++) removed[i] = '';
    } else rows.splice(index, 1);

    const oldRecord = Object.fromEntries(headers.map((h, i) => [h, oldData[i] ?? '']));
    saveWorkbook(); render();
    const button = $('deleteRowBtn');
    if (button) { button.disabled = true; button.textContent = 'جارٍ الحذف...'; }
    try {
        const result = await sendSheetData({
            action: 'delete', sheet, sheetName: sheet, headers,
            oldRecord, oldData, data: oldData, record: oldRecord,
            ...(isWithdrawal ? { partnerBlock } : {})
        });
        if (result?.status === 'sent-unverified') throw new Error('أُرسل طلب الحذف لكن لم يصل تأكيد من الخادم. حدّث الصفحة للتحقق.');
        toast('تم حذف السجل.');
        hideAdd();
    } catch (error) {
        if (isWithdrawal) removed.splice(0, removed.length, ...oldData);
        else rows.splice(Math.min(index, rows.length), 0, removed);
        saveWorkbook(); render();
        toast('لم يكتمل الحذف: ' + (error.message || ''), 'error');
    } finally {
        if (button) { button.disabled = false; button.textContent = '🗑 حذف السجل'; }
    }
}

if ($('saveAdd')) $('saveAdd').addEventListener('click', saveNewRow);
if ($('deleteRowBtn')) $('deleteRowBtn').addEventListener('click', deleteCurrentRow);
if ($('closeAdd')) $('closeAdd').addEventListener('click', hideAdd);
if ($('cancelAdd')) $('cancelAdd').addEventListener('click', hideAdd);
if ($('minimizeAdd')) {
    $('minimizeAdd').addEventListener('click', () => {
        const modal = $('addModal');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    });
}
if ($('addRow')) {
    $('addRow').addEventListener('click', () => showAdd());
}

function editCell(td, row, index, header) {
    if (!canMutateActiveSheet())
        return toast('هذا التبويب للاطلاع فقط.', 'error');
    if (td.querySelector('input,select')) return;

    const hName = String(header).trim();
    if (['السعر الكلي دينار', 'السعر الكلي دولار', 'مجموع الطلب دينار', 'مجموع المدفوع دينار', 'المتبقي دينار', 'مجموع الطلب $', 'مجموع المدفوع $', 'الباقي $', 'الباقي/ دينار'].includes(hName))
        return toast('هذا الحقل يُحسب تلقائياً.', 'error');

    const headers = sheetHeaders(activeSheet);
    const oldRow = row.slice();
    const isDate = hName.includes('تاريخ') || hName.includes('تاري');

    const input = document.createElement('input');
    input.type = isDate ? 'date' : 'text';
    input.value = String(row[index] ?? '');
    input.className = 'w-full min-w-[120px] rounded border border-emerald-500 bg-slate-900 px-2 py-1 text-center text-sm text-white';
    td.replaceChildren(input);
    input.focus();
    if (!isDate) input.select();

    let done = false;
    const finish = async (save) => {
        if (done) return;
        done = true;
        if (!save) return renderTable();
        const raw = input.value.trim();
        const n = raw.replace(/,/g, '');
        const v = (!isDate && raw !== '' && !isNaN(n) && !/^0\d/.test(n)) ? Number(n) : raw;
        if (String(v) === String(row[index] ?? '')) return renderTable();
        row[index] = v;
        computeRowAuto(row, headers, index);
        saveWorkbook();
        render();
        try {
            const record = Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']));
            const oldRecord = Object.fromEntries(headers.map((h, i) => [h, oldRow[i] ?? '']));
            await sendSheetData({ action: 'update', sheet: activeSheet, sheetName: activeSheet, headers, record, oldRecord, data: row });
            toast('تم حفظ التعديل.');
        } catch (error) {
            toast('تعدّل محلياً لكن فشل الإرسال: ' + (error.message || ''), 'error');
        }
    };
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(false));
    if (isDate) input.addEventListener('change', () => finish(true));
}
