'use strict';

/**
 * project-advances.js — سلف العمل المقيّدة في السجل العام.
 * أصل السلفة يوسم في التفاصيل بـ«سلفة عمل:»، ووصل التصفية يذكر «سلفة عمل رقم …».
 */
let projectAdvancesRemoteReady = false;
let projectAdvancesLoadPromise = null;
let editingProjectAdvance = null;

function ensureProjectAdvancesSheet() {
    if (!workbookData[GL]) workbookData[GL] = { headers: [], rows: [] };
    if (!Array.isArray(workbookData[GL].headers)) workbookData[GL].headers = [];
    if (!Array.isArray(workbookData[GL].rows)) workbookData[GL].rows = [];
    return workbookData[GL];
}

function projectAdvanceIndexes(headers = sheetHeaders(GL)) {
    return {
        number: findHeaderIndex(headers, ['رقم الوصل', 'رقم السلفة', 'ت']),
        amount: findHeaderIndex(headers, ['المبلغ', 'مبلغ السلفة']),
        details: findHeaderIndex(headers, ['التفاصيل', 'البيان', 'تفاصيل السلفة']),
        date: findHeaderIndex(headers, ['التاريخ', 'تاريخ السلفة'])
    };
}

function projectAsciiDigits(value) {
    const digits = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
    return String(value ?? '').replace(/[٠-٩]/g, digit => digits[digit]);
}

function parseProjectAdvanceReference(details) {
    const text = projectAsciiDigits(details);
    const match = text.match(/(?:السلفة|سلفة)(?:\s+(?:ال)?عمل|\s+التشغيلية)?\s*(?:ذات\s*)?(?:رقم(?:\s*الوصل)?\s*)?(?:[:#-]\s*)?(\d+)/i);
    return match ? match[1] : '';
}

function isProjectWorkAdvanceRecord(record, headers = sheetHeaders(GL)) {
    const ix = projectAdvanceIndexes(headers);
    const details = Array.isArray(record)
        ? String(record[ix.details] ?? '')
        : String(record?.[headers[ix.details]] ?? record?.['التفاصيل'] ?? record?.['البيان'] ?? '');
    const text = normalizeText(details).replace(/[ـ\s]/g, '');
    if (/^سلفةعمل[:：|—–-]/.test(text) || /^سلفةتشغيلية[:：|—–-]/.test(text)) return true;
    return /سلفة(?:ال)?عمل|سلفةالتشغيلية/.test(text) && !parseProjectAdvanceReference(details);
}

function projectAdvanceNumberKey(value) {
    return normalizeText(projectAsciiDigits(value)).replace(/[\sـ-]/g, '');
}

function projectAdvanceReferenceMatches(details, number) {
    const ref = parseProjectAdvanceReference(details);
    return !!ref && projectAdvanceNumberKey(ref) === projectAdvanceNumberKey(number);
}

function projectAdvanceRows(headers = sheetHeaders(GL), rows = sheetRows(GL)) {
    const ix = projectAdvanceIndexes(headers);
    if ([ix.number, ix.amount, ix.details].some(index => index < 0)) return [];
    return rows.filter(row => isProjectWorkAdvanceRecord(row, headers) && String(row[ix.number] ?? '').trim());
}

function projectAdvanceUsage(number, omittedLedgerRow = null) {
    const headers = sheetHeaders(GL);
    const detailsIx = findHeaderIndex(headers, ['التفاصيل', 'البيان']);
    const amountIx = findHeaderIndex(headers, ['المبلغ']);
    const typeIx = findHeaderIndex(headers, ['النوع', 'نوع الحركة']);
    if (detailsIx < 0 || amountIx < 0) return 0;
    return sheetRows(GL).reduce((sum, row) => {
        const movement = typeIx >= 0 ? normalizeText(row[typeIx]) : '';
        if (movement && /قبض|تحويل|تمويل/.test(movement)) return sum;
        if (row === omittedLedgerRow || isProjectWorkAdvanceRecord(row, headers) || !projectAdvanceReferenceMatches(row[detailsIx], number)) return sum;
        return sum + Math.max(0, parseNumber(row[amountIx]));
    }, 0);
}

function projectAdvanceRemaining(row, headers = sheetHeaders(GL)) {
    const ix = projectAdvanceIndexes(headers);
    const number = ix.number >= 0 ? row[ix.number] : '';
    const amount = ix.amount >= 0 ? parseNumber(row[ix.amount]) : 0;
    const used = projectAdvanceUsage(number);
    return { used, remaining: Math.max(0, amount - used), overrun: Math.max(0, used - amount) };
}

async function loadProjectAdvances(force = false) {
    if (!force && sheetHeaders(GL).length && Array.isArray(workbookData[GL]?.rows)) { projectAdvancesRemoteReady = true; return true; }
    if (projectAdvancesLoadPromise) return projectAdvancesLoadPromise;
    projectAdvancesLoadPromise = (async () => {
        try {
            // زر سلف العمل موجود في السجل العام؛ لا نحمّل أي تبويب آخر.
            const data = await fetchSheetData(GL);
            const part = responseToRows(data, GL);
            const ix = projectAdvanceIndexes(part.headers);
            if ([ix.number, ix.amount, ix.details, ix.date].some(index => index < 0))
                throw new Error('يجب أن تتضمن عناوين السجل العام رقم الوصل والمبلغ والتفاصيل والتاريخ.');
            workbookData[GL] = { headers: part.headers, rows: part.rows };
            fixDates();
            saveWorkbook();
            projectAdvancesRemoteReady = true;
            return true;
        } catch (error) {
            projectAdvancesRemoteReady = false;
            throw error;
        } finally {
            projectAdvancesLoadPromise = null;
        }
    })();
    return projectAdvancesLoadPromise;
}

function setProjectAdvancesNotice(message, error = false) {
    const notice = $('projectAdvancesNotice');
    if (!notice) return;
    notice.textContent = message;
    notice.className = 'rounded-xl border p-3 text-xs leading-6 ' + (error
        ? 'border-rose-800/70 bg-rose-950/30 text-rose-200'
        : 'border-emerald-800/70 bg-emerald-950/30 text-emerald-200');
}

function projectAdvanceInput(id) { return $(id)?.value.trim() || ''; }

function resetProjectAdvanceForm() {
    editingProjectAdvance = null;
    ['projectAdvanceNumber', 'projectAdvanceAmount', 'projectAdvanceDetails'].forEach(id => { if ($(id)) $(id).value = ''; });
    if ($('projectAdvanceDate')) $('projectAdvanceDate').value = new Date().toISOString().slice(0, 10);
    if ($('saveProjectAdvance')) $('saveProjectAdvance').textContent = 'إضافة سلفة عمل';
    if ($('cancelProjectAdvanceEdit')) $('cancelProjectAdvanceEdit').classList.add('hidden');
    if ($('projectAdvanceFormMessage')) $('projectAdvanceFormMessage').textContent = '';
}

function renderProjectAdvances() {
    const body = $('projectAdvancesBody');
    if (!body) return;
    body.replaceChildren();
    const headers = sheetHeaders(GL);
    const ix = projectAdvanceIndexes(headers);
    const rows = projectAdvanceRows(headers, sheetRows(GL));
    rows.forEach(row => {
        const tr = document.createElement('tr');
        const { used, remaining, overrun } = projectAdvanceRemaining(row, headers);
        const details = ix.details >= 0 ? String(row[ix.details] ?? '').replace(/^\s*سلفة\s*عمل\s*[:：|—–-]\s*/i, '') : '';
        const values = [
            ix.number >= 0 ? String(row[ix.number] ?? '') : '',
            ix.amount >= 0 ? formatMoney(row[ix.amount]) : '',
            details,
            ix.date >= 0 ? String(row[ix.date] ?? '') : '',
            formatMoney(used),
            overrun ? 'تجاوز ' + formatMoney(overrun) : formatMoney(remaining)
        ];
        values.forEach((value, index) => {
            const td = document.createElement('td');
            td.className = 'p-3 text-slate-100 ' + (index === 5 ? (overrun ? 'font-bold text-rose-300' : remaining === 0 ? 'font-bold text-emerald-300' : 'font-bold text-amber-200') : '');
            td.textContent = value || '—';
            tr.appendChild(td);
        });
        const actions = document.createElement('td');
        actions.className = 'whitespace-nowrap p-2';
        const edit = document.createElement('button');
        edit.type = 'button'; edit.textContent = 'تعديل';
        edit.className = 'me-1 rounded border border-sky-800 px-2 py-1 text-xs text-sky-300 hover:bg-sky-950';
        edit.addEventListener('click', () => beginProjectAdvanceEdit(row));
        const remove = document.createElement('button');
        remove.type = 'button'; remove.textContent = 'حذف';
        remove.className = 'rounded border border-rose-800 px-2 py-1 text-xs text-rose-300 hover:bg-rose-950';
        remove.addEventListener('click', () => deleteProjectAdvance(row));
        actions.append(edit, remove); tr.appendChild(actions); body.appendChild(tr);
    });
    $('projectAdvancesEmpty')?.classList.toggle('hidden', rows.length > 0);
}

async function showProjectAdvances() {
    if (!authCanView(GL)) return toast('ليست لديك صلاحية لقراءة السجل العام.', 'error');
    const modal = $('projectAdvancesModal');
    modal?.classList.remove('hidden'); modal?.classList.add('flex');
    resetProjectAdvanceForm();
    ensureProjectAdvancesSheet();
    renderProjectAdvances();
    setProjectAdvancesNotice('جارٍ قراءة سلف العمل ووصولات تصفيتها من السجل العام…');
    loadProjectAdvances(true).then(() => {
        setProjectAdvancesNotice('أصل السلفة مسجل في السجل العام بتفاصيل تبدأ «سلفة عمل:». لتصفيتها، سجّل وصل الصرف في السجل العام واكتب في التفاصيل «سلفة عمل رقم 123» برقم وصل أصل السلفة؛ ينخفض المتبقي تلقائياً حتى يصل إلى صفر.');
        renderProjectAdvances();
    }).catch(error => {
        setProjectAdvancesNotice('تعذر قراءة السجل العام. تحقق من الاتصال وعناوين رقم الوصل والمبلغ والتفاصيل والتاريخ. سبب الخطأ: ' + (error.message || 'تعذر الاتصال.'), true);
        toast('لم أتمكن من تحميل سلف العمل من السجل العام.', 'error');
    });
}

function hideProjectAdvances() {
    $('projectAdvancesModal')?.classList.add('hidden');
    $('projectAdvancesModal')?.classList.remove('flex');
}

function beginProjectAdvanceEdit(row) {
    const headers = sheetHeaders(GL);
    const ix = projectAdvanceIndexes(headers);
    editingProjectAdvance = row;
    $('projectAdvanceNumber').value = ix.number >= 0 ? String(row[ix.number] ?? '') : '';
    $('projectAdvanceAmount').value = ix.amount >= 0 ? String(row[ix.amount] ?? '') : '';
    $('projectAdvanceDetails').value = ix.details >= 0 ? String(row[ix.details] ?? '').replace(/^\s*سلفة\s*عمل\s*[:：|—–-]\s*/i, '') : '';
    $('projectAdvanceDate').value = ix.date >= 0 ? toIsoDate(row[ix.date]) : '';
    $('saveProjectAdvance').textContent = 'حفظ تعديل سلفة العمل';
    $('cancelProjectAdvanceEdit').classList.remove('hidden');
    $('projectAdvanceFormMessage').textContent = 'تعديل سلفة العمل رقم ' + $('projectAdvanceNumber').value + ' في السجل العام';
    $('projectAdvanceNumber').focus();
}

function projectAdvanceRecord(row, headers) {
    return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']));
}

async function saveProjectAdvance() {
    if (!projectAdvancesRemoteReady) return toast('لم يتم تأكيد تحميل السجل العام؛ لا يمكن حفظ سلفة عمل محلياً فقط.', 'error');
    const number = projectAdvanceInput('projectAdvanceNumber');
    const amountText = projectAdvanceInput('projectAdvanceAmount');
    const details = projectAdvanceInput('projectAdvanceDetails');
    const date = projectAdvanceInput('projectAdvanceDate');
    const amount = parseNumber(amountText);
    if (!number || !amountText || amount <= 0 || !details || !date)
        return toast('أدخل رقم الوصل والمبلغ والتفاصيل والتاريخ بصورة صحيحة.', 'error');

    const headers = sheetHeaders(GL);
    const ix = projectAdvanceIndexes(headers);
    const rows = sheetRows(GL);
    const duplicate = rows.find(row => projectAdvanceNumberKey(row[ix.number]) === projectAdvanceNumberKey(number) && row !== editingProjectAdvance);
    if (duplicate) return toast('رقم الوصل مستخدم مسبقاً في السجل العام؛ اختر رقماً غير مستخدم.', 'error');
    if (editingProjectAdvance) {
        const oldNumber = String(editingProjectAdvance[ix.number] ?? '').trim();
        const used = projectAdvanceUsage(oldNumber);
        if (used > 0 && projectAdvanceNumberKey(oldNumber) !== projectAdvanceNumberKey(number))
            return toast('لا يمكن تغيير رقم الوصل لأصل سلفة عليه وصولات تصفية مرتبطة.', 'error');
        if (projectAdvanceNumberKey(oldNumber) === projectAdvanceNumberKey(number) && amount < used)
            return toast('مبلغ السلفة لا يمكن أن يقل عن المصروف المرتبط بها (' + formatMoney(used) + ').', 'error');
    }

    const next = headers.map((header, index) => {
        if (index === ix.number) return number;
        if (index === ix.amount) return amount;
        if (index === ix.details) return 'سلفة عمل: ' + details;
        if (index === ix.date) return date;
        return editingProjectAdvance?.[index] ?? '';
    });
    const old = editingProjectAdvance ? editingProjectAdvance.slice() : null;
    let row = editingProjectAdvance;
    const action = row ? 'update' : 'add';
    if (row) row.splice(0, row.length, ...next);
    else { row = next; rows.push(row); }
    saveWorkbook(); renderProjectAdvances();
    const btn = $('saveProjectAdvance'); btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';
    try {
        const result = await sendSheetData({
            action, sheet: GL, sheetName: GL, headers, record: projectAdvanceRecord(row, headers), data: row,
            entryType: 'ledger', oldRecord: old ? projectAdvanceRecord(old, headers) : null, oldData: old
        });
        if (result?.status === 'sent-unverified') throw new Error('لم يصل تأكيد من Google Sheets.');
        toast(action === 'add' ? 'تم تسجيل سلفة العمل في السجل العام.' : 'تم تعديل سلفة العمل في السجل العام.');
        resetProjectAdvanceForm(); renderProjectAdvances();
        if (typeof render === 'function') render();
    } catch (error) {
        if (action === 'add') rows.splice(rows.indexOf(row), 1);
        else row.splice(0, row.length, ...old);
        saveWorkbook(); renderProjectAdvances();
        toast('لم يتأكد حفظ سلفة العمل في السجل العام: ' + (error.message || ''), 'error');
    } finally {
        btn.disabled = false;
        if (btn.textContent === 'جارٍ الحفظ…') btn.textContent = editingProjectAdvance ? 'حفظ تعديل سلفة العمل' : 'إضافة سلفة عمل';
    }
}

async function deleteProjectAdvance(row) {
    if (!projectAdvancesRemoteReady) return toast('لم يتم تأكيد تحميل السجل العام.', 'error');
    const headers = sheetHeaders(GL);
    const ix = projectAdvanceIndexes(headers);
    const { used } = projectAdvanceRemaining(row, headers);
    if (used > 0) return toast('لا يمكن حذف أصل سلفة عمل عليه وصولات تصفية. أزل ربط وصولات الصرف به أولاً.', 'error');
    if (!confirm('هل تريد حذف سلفة العمل رقم «' + String(row[ix.number] ?? '') + '» من السجل العام؟')) return;
    const rows = sheetRows(GL);
    const index = rows.indexOf(row);
    if (index < 0) return;
    const removed = rows.splice(index, 1)[0];
    const oldRecord = projectAdvanceRecord(removed, headers);
    saveWorkbook(); renderProjectAdvances();
    try {
        const result = await sendSheetData({ action: 'delete', sheet: GL, sheetName: GL, headers, record: oldRecord, oldRecord, oldData: removed, data: removed });
        if (result?.status === 'sent-unverified') throw new Error('لم يصل تأكيد من Google Sheets.');
        toast('تم حذف سلفة العمل من السجل العام.');
        if (typeof render === 'function') render();
    } catch (error) {
        rows.splice(Math.min(index, rows.length), 0, removed);
        saveWorkbook(); renderProjectAdvances();
        toast('لم يتأكد حذف سلفة العمل: ' + (error.message || ''), 'error');
    }
}

async function validateProjectAdvanceReceipt(record, editingLedgerRow) {
    if (isProjectWorkAdvanceRecord(record, sheetHeaders(GL))) return true;
    const advanceNumber = parseProjectAdvanceReference(record['التفاصيل'] || record['البيان']);
    if (!advanceNumber) return true;
    if (/قبض|تحويل|تمويل/.test(normalizeText(record['النوع'] || record['نوع الحركة'] || ''))) {
        toast('ربط سلفة العمل مخصص لوصل الصرف، وليس لوصل قبض أو تحويل.', 'error');
        return false;
    }
    try {
        await loadProjectAdvances();
    } catch (error) {
        toast('تعذر التحقق من سلف العمل في السجل العام؛ لم يُحفظ الوصل كي لا يضيع الربط. ' + (error.message || ''), 'error');
        return false;
    }
    const headers = sheetHeaders(GL);
    const ix = projectAdvanceIndexes(headers);
    const advance = projectAdvanceRows(headers, sheetRows(GL)).find(row => projectAdvanceNumberKey(row[ix.number]) === projectAdvanceNumberKey(advanceNumber));
    if (!advance) {
        toast('لا توجد سلفة عمل في السجل العام برقم الوصل ' + advanceNumber + '. لم يُحفظ وصل التصفية.', 'error');
        return false;
    }
    const usedBeforeThisReceipt = projectAdvanceUsage(advanceNumber, editingLedgerRow);
    const balance = Math.max(0, parseNumber(advance[ix.amount]) - usedBeforeThisReceipt);
    const requested = parseNumber(record['المبلغ']);
    if (requested <= 0 || requested > balance) {
        toast('مبلغ وصل التصفية أكبر من المتبقي لسلفة العمل (' + formatMoney(balance) + '). لم يُحفظ الوصل.', 'error');
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    $('projectAdvancesBtn')?.addEventListener('click', showProjectAdvances);
    $('closeProjectAdvances')?.addEventListener('click', hideProjectAdvances);
    $('doneProjectAdvances')?.addEventListener('click', hideProjectAdvances);
    $('cancelProjectAdvanceEdit')?.addEventListener('click', resetProjectAdvanceForm);
    $('saveProjectAdvance')?.addEventListener('click', saveProjectAdvance);
    $('projectAdvanceNumber')?.addEventListener('keydown', event => { if (event.key === 'Enter') saveProjectAdvance(); });
    $('projectAdvancesModal')?.addEventListener('click', event => { if (event.target.id === 'projectAdvancesModal') hideProjectAdvances(); });
});
