'use strict';

const SMART_FILTERS_KEY = 'sharaeen_smart_filters_v1';

function getSmartFilters(sheet) {
    try {
        const all = JSON.parse(localStorage.getItem(SMART_FILTERS_KEY) || '{}');
        return all[sheet] || {};
    } catch (e) { return {}; }
}

function saveSmartFilters(sheet, filters) {
    try {
        const all = JSON.parse(localStorage.getItem(SMART_FILTERS_KEY) || '{}');
        all[sheet] = filters;
        localStorage.setItem(SMART_FILTERS_KEY, JSON.stringify(all));
    } catch (e) {}
}

function renderSmartFiltersUI(sheet) {
    const container = $('smartFiltersBody');
    if (!container) return;

    const headers = sheetHeaders(sheet);
    const rows = sheetRows(sheet);
    const activeFilters = getSmartFilters(sheet);

    container.replaceChildren();

    headers.forEach((h, i) => {
        const hName = String(h).trim();
        if (!hName || hName === ATT_H || hName === AUDIT_H || hName === DELETED_H || hName === VERSION_H) return;

        const hasData = rows.some(r => String(r[i] ?? '').trim() !== '');
        if (!hasData) return;

        const label = document.createElement('label');
        label.className = 'block text-xs font-semibold text-slate-300';
        label.textContent = hName;

        let input;
        const isDate = hName.includes('تاريخ');

        if (isDate) {
            input = document.createElement('input');
            input.type = 'date';
        } else {
            const uniqueValues = [...new Set(rows.map(r => String(r[i] ?? '').trim()).filter(Boolean))];
            if (uniqueValues.length > 0 && uniqueValues.length <= 20) {
                input = document.createElement('select');
                const defOpt = document.createElement('option');
                defOpt.value = '';
                defOpt.textContent = 'الكل';
                input.appendChild(defOpt);
                uniqueValues.sort((a, b) => a.localeCompare(b, 'ar')).forEach(v => {
                    const o = document.createElement('option');
                    o.value = v;
                    o.textContent = v;
                    input.appendChild(o);
                });
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'بحث...';
            }
        }

        input.dataset.colIndex = i;
        input.dataset.colName = hName;
        input.className = 'mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none';
        if (activeFilters[i] !== undefined) {
            input.value = activeFilters[i];
        }

        input.addEventListener('input', () => {
            const newFilters = getSmartFilters(sheet);
            newFilters[i] = input.value;
            saveSmartFilters(sheet, newFilters);
            page = 1;
            renderTable();
            renderMetrics();
        });

        label.appendChild(input);
        container.appendChild(label);
    });
}

function smartFilterMatch(row, headers) {
    const activeFilters = getSmartFilters(activeSheet);
    let match = true;
    for (const [idxStr, filterVal] of Object.entries(activeFilters)) {
        if (!filterVal) continue;
        const idx = Number(idxStr);
        const cellVal = String(row[idx] ?? '').trim();

        const hName = String(headers[idx] ?? '');
        if (hName.includes('تاريخ')) {
            const isoCell = toIsoDate(cellVal);
            const isoFilter = toIsoDate(filterVal);
            if (isoCell && isoFilter && isoCell < isoFilter) { match = false; break; }
        } else {
            if (normalizeText(cellVal) !== normalizeText(filterVal)) { match = false; break; }
        }
    }
    return match;
}

function openSmartFilterModal() {
    renderSmartFiltersUI(activeSheet);
    $('smartFilterModal').classList.remove('hidden');
    $('smartFilterModal').classList.add('flex');
}

function clearSmartFilters() {
    saveSmartFilters(activeSheet, {});
    renderSmartFiltersUI(activeSheet);
    page = 1;
    renderTable();
    renderMetrics();
    toast('تم مسح الفلاتر.');
}

document.addEventListener('DOMContentLoaded', () => {
    if ($('smartFilterBtn')) {
        $('smartFilterBtn').addEventListener('click', openSmartFilterModal);
    }
    if ($('closeSmartFilter') && $('smartFilterModal')) {
        $('closeSmartFilter').addEventListener('click', () => {
            $('smartFilterModal').classList.add('hidden');
            $('smartFilterModal').classList.remove('flex');
        });
    }
    if ($('closeSmartFilterBottom') && $('smartFilterModal')) {
        $('closeSmartFilterBottom').addEventListener('click', () => {
            $('smartFilterModal').classList.add('hidden');
            $('smartFilterModal').classList.remove('flex');
        });
    }
    if ($('clearSmartFiltersBtn')) {
        $('clearSmartFiltersBtn').addEventListener('click', clearSmartFilters);
    }
});