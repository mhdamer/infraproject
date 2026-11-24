'use strict';

function render() {
    if (!authCanView(activeSheet)) activeSheet = authFirstSheet();
    if (activeSheet === CT && typeof ensureContractorProfileHeaders === 'function') ensureContractorProfileHeaders();
    renderTabs();
    renderMetrics();
    renderNotifications();
    renderNotes();
    populateFilters();
    renderTable();
}

function toast(message, kind = 'success') {
    const el = $('toast'); if (!el) return;
    el.textContent = message;
    el.className = 'toast fixed bottom-4 left-4 z-[60] max-w-[calc(100vw-2rem)] rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl ' + (kind === 'error' ? 'bg-rose-800' : 'bg-slate-800');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}

/**
 * ★ SHARAEEN: populateFilters — يملأ فلاتر المقاولين والأنواع فقط
 * في تبويب المقاولين والمتعهدين، أو يخفيها في باقي التبويبات
 */
function populateFilters() {
    if (!$('contractorFilter') || !$('unitFilter')) return;
    const debtView = activeSheet === DB && typeof getDebtViewData === 'function' ? getDebtViewData() : null;
    const headers = debtView ? debtView.headers : sheetHeaders(activeSheet);
    const rows = debtView ? debtView.rows : sheetRows(activeSheet);

    // في السجل العام: contractorFilter = "المستفيد"، unitFilter = "النوع"
    // في المقاولين: contractorFilter = "اسم المقاول"، unitFilter = "النوع"
    // في السلف: contractorFilter = "المصدر"، unitFilter = ""
    // في السحب: contractorFilter = "الشريك"، unitFilter = "النوع"
    // في المديونية: contractorFilter = "الاسم"، unitFilter = ""
    let nameNames = ['اسم المقاول', 'المستفيد', 'المصدر', 'الشريك', 'الاسم'];
    let typeNames = ['النوع'];
    let nameIx = findHeaderIndex(headers, nameNames);
    let typeIx = findHeaderIndex(headers, typeNames);

    fillSelect($('contractorFilter'), nameIx, rows, 'كل الأسماء');
    fillSelect($('unitFilter'), typeIx, rows, 'كل الأنواع');
    $('contractorFilter').disabled = nameIx < 0;
    $('unitFilter').disabled = typeIx < 0;

    // إخفاء الفلاتر إن لم تكن منطبقة على التبويب
    ['contractorFilter', 'unitFilter'].forEach(id => {
        const el = $(id);
        if (el) el.classList.toggle('hidden', false);
    });

    if (typeof populateContractorsFilters === 'function') populateContractorsFilters();
    if (typeof populateSummaryFilters === 'function') populateSummaryFilters();
}

function fillSelect(select, ix, rows, defaultText) {
    if (!select) return;
    const prior = select.value;
    select.replaceChildren();
    const first = document.createElement('option');
    first.value = ''; first.textContent = defaultText;
    select.appendChild(first);
    if (ix >= 0) {
        [...new Set(rows.map(r => String(r[ix] ?? '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'ar'))
            .forEach(value => {
                const o = document.createElement('option'); o.value = value; o.textContent = value; select.appendChild(o);
            });
    }
    select.value = [...select.options].some(o => o.value === prior) ? prior : '';
}
