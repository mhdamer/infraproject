'use strict';

function sheetColumnLabel(number) {
    let label = '';
    while (number > 0) {
        const remainder = (number - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        number = Math.floor((number - 1) / 26);
    }
    return label;
}

function renderTable() {
    const isReadOnly = (AppConfig.READONLY_SHEETS || []).includes(activeSheet);
    const isHiddenLegacyHeader = h => [AUDIT_H, DELETED_H, VERSION_H].includes(String(h ?? '').trim());

    const debtView = activeSheet === DB && typeof getDebtViewData === 'function' ? getDebtViewData() : null;
    const headers = debtView ? debtView.headers : sheetHeaders(activeSheet);
    let allRows = debtView ? debtView.rows : sheetRows(activeSheet);
    if (activeSheet === CT && typeof isContractorDharaRow === 'function') allRows = allRows.filter(row => isContractorDharaRow(row, headers));
    if (activeSheet === ADV || activeSheet === WD) {
        const footerPattern = activeSheet === ADV ? /اجمالي السلف|اجمالي السلف المستلمة/ : /مجمل التمويل|مجمل السحب|فرق التمويل عن السحب|الصافي من حصته|حصته بالمشروع/;
        allRows = allRows.filter(row => !row.some(value => footerPattern.test(String(value ?? ''))));
    }
    const hasAttachmentColumn = attIx(headers) >= 0;
    const displayOrder = {
        [GL]: ['رقم الوصل', 'المبلغ', 'التفاصيل', 'التاريخ', 'المستلم', 'الكود', 'الموقع', 'المرفق'],
        [CT]: ['اسم المقاول', 'رقم الذرعة', 'المادة/العمل', 'الكمية', 'الوحدة', 'السعر دينار', 'السعر دولار', 'السعر الكلي دينار', 'السعر الكلي دولار', 'تاري الذرعة', 'المرفق'],
        [ADV]: ['ت', 'المبلغ', 'التفاصيل', 'التاريخ'],
        [DB]: ['اسم المقاول', 'المبلغ المطلوب دينار', 'المبلغ المستلم دينار', 'المتبقي دينار', 'المبلغ المطلوب $', 'المبلغ المستلم $', 'المتبقي $']
    }[activeSheet];
    const orderedHeaderIndexes = displayOrder
        ? displayOrder.map(name => {
            const aliases = activeSheet === GL && name === 'رقم الوصل' ? ['رقم الوصل', 'ت'] : [name];
            return findHeaderIndex(headers, aliases);
        }).filter((i, p, a) => i >= 0 && a.indexOf(i) === p)
        : [];
    // الأعمدة الموجودة التي لم تسمّها الصورة تبقى متاحة بعد الأعمدة ذات الأولوية.
    const exactSheets = [GL, CT, ADV, DB];
    let visibleHeaders = (exactSheets.includes(activeSheet) ? orderedHeaderIndexes : [...orderedHeaderIndexes, ...headers.map((_, i) => i).filter(i => !orderedHeaderIndexes.includes(i))])
        .filter(i => String(headers[i] ?? '').trim() && !isHiddenLegacyHeader(headers[i]));
    if (activeSheet === WD && typeof wdVisibleColumnIndexes === 'function') {
        const partnerColumns = new Set(wdVisibleColumnIndexes(headers));
        visibleHeaders = visibleHeaders.filter(index => partnerColumns.has(index));
    }

    // 2. إخفاء/إظهار أزرار الإضافة والاستيراد
    const canEdit = typeof canMutateActiveSheet === 'function' && canMutateActiveSheet();
    if ($('addRow')) $('addRow').classList.toggle('hidden', isReadOnly || !canEdit);
    if ($('printReceiptsBtn')) $('printReceiptsBtn').classList.toggle('hidden', activeSheet !== GL);
    if ($('projectAdvancesBtn')) $('projectAdvancesBtn').classList.toggle('hidden', activeSheet !== GL || !authCanView(GL));
    if (typeof renderWdPartnerPicker === 'function') renderWdPartnerPicker();
    const importLabel = $('excelInput') ? $('excelInput').closest('label') : null;
    if (importLabel) importLabel.classList.toggle('hidden', isReadOnly || !canEdit);

    // 3. colMenu — للمقاولين فقط
    const showColMenu = activeSheet === AppConfig.SHEETS.CONTRACTORS;
    if ($('colMenuWrap')) $('colMenuWrap').classList.toggle('hidden', !showColMenu);
    if (showColMenu) { loadHiddenCols(activeSheet); renderGenericColMenu(); }

    if ($('tableWrap')) $('tableWrap').classList.remove('hidden');
    if ($('pagerBar')) $('pagerBar').classList.remove('hidden');

    if ($('activeTitle')) $('activeTitle').textContent = activeSheet;
    if ($('tableTitle')) $('tableTitle').textContent = activeSheet;

    const n = allRows.length;
    if ($('sheetDescription')) {
        if (isReadOnly) {
            $('sheetDescription').textContent = `عرض للاطلاع فقط — ${new Intl.NumberFormat('en-US').format(n)} سجل.`;
        } else {
            $('sheetDescription').textContent = n
                ? `${new Intl.NumberFormat('en-US').format(n)} سجل في هذا التبويب`
                : 'لا توجد صفوف بيانات في هذا التبويب.';
        }
    }

    const head = $('tableHead');
    const body = $('tableBody');
    if (!head || !body) return;
    if ($('tableWrap')) $('tableWrap').classList.add('spreadsheet-grid');

    head.replaceChildren();
    body.replaceChildren();

    const theadRow = document.createElement('tr');
    const rowCorner = document.createElement('th');
    rowCorner.className = 'sheet-row-corner';
    rowCorner.textContent = '';
    theadRow.appendChild(rowCorner);

    // 5. رأس الأعمدة
    visibleHeaders.forEach(index => {
        const h = headers[index];
        if (String(h).trim() === ATT_H || isHiddenLegacyHeader(h) || (activeSheet === CT && String(h).trim() === 'رقم الوصل')) return;
        if (isColHidden(h)) return;

        const th = document.createElement('th');
        th.className = 'whitespace-nowrap border-b border-slate-700/60 px-3 py-3 text-center font-bold bg-slate-900/95';

        const isNameCol = /اسم المقاول|المستفيد|المصدر|الشريك|^الاسم$/i.test(normalizeText(h));
        if (isNameCol) {
            th.classList.add('sticky', 'right-0', 'z-20', 'shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.3)]');
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hover:text-emerald-300';
        const label = typeof sheetHeaderLabel === 'function' ? sheetHeaderLabel(activeSheet, headers, index) : String(h || '');
        btn.textContent = label + (sortColumn === index ? (sortDirection === 1 ? ' ↑' : ' ↓') : ' ↕');
        btn.addEventListener('click', () => {
            if (sortColumn === index) sortDirection *= -1;
            else { sortColumn = index; sortDirection = 1; }
            page = 1;
            renderTable();
        });
        th.appendChild(btn);
        theadRow.appendChild(th);
    });

    // 6. عمود المرفق عند توفره في مخطط الورقة
    if (!isReadOnly && hasAttachmentColumn) {
        const tha = document.createElement('th');
        tha.className = 'whitespace-nowrap border-b border-slate-700/60 px-3 py-3 text-center font-bold bg-slate-900/95';
        tha.textContent = 'مرفق PDF';
        theadRow.appendChild(tha);
    }

    // 7. عمود الإجراءات
    if (!isReadOnly && headers.length) {
        const th = document.createElement('th');
        th.className = 'whitespace-nowrap border-b border-slate-700/60 px-3 py-3 text-center font-bold bg-slate-900/95 sticky left-0 z-20 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.3)]';
        th.textContent = 'إجراءات';
        theadRow.appendChild(th);
    }

    if (headers.length) {
        const lettersRow = document.createElement('tr');
        lettersRow.className = 'sheet-letters-row';
        const corner = document.createElement('th');
        corner.className = 'sheet-row-corner';
        corner.textContent = '';
        lettersRow.appendChild(corner);
        Array.from(theadRow.children).slice(1).forEach((_, index) => {
            const th = document.createElement('th');
            th.className = 'sheet-column-letter';
            th.textContent = sheetColumnLabel(index + 1);
            lettersRow.appendChild(th);
        });
        head.append(lettersRow, theadRow);
    }

    // 8. Skeleton
    if (typeof tableSkeletonLoading !== 'undefined' && tableSkeletonLoading && !allRows.length && headers.length) {
        const skelCols = Math.max(theadRow.children.length, 4);
        for (let i = 0; i < 5; i++) {
            const tr = document.createElement('tr');
            tr.className = 'skeleton-row';
            for (let j = 0; j < skelCols; j++) {
                const td = document.createElement('td');
                td.className = 'border-b border-slate-700/60';
                const bar = document.createElement('div');
                bar.className = 'skeleton-bar';
                td.appendChild(bar);
                tr.appendChild(td);
            }
            body.appendChild(tr);
        }
        if ($('emptyState')) $('emptyState').classList.add('hidden');
        if ($('dataTable')) $('dataTable').classList.remove('hidden');
        if ($('tableInfo')) $('tableInfo').textContent = 'جارٍ جلب البيانات...';
        if ($('pageInfo')) $('pageInfo').textContent = '— / —';
        if ($('prevPage')) $('prevPage').disabled = true;
        if ($('nextPage')) $('nextPage').disabled = true;
        return;
    }

    // 9. الفلترة
    const q = $('searchInput') ? normalizeText($('searchInput').value) : '';
    const contractor = $('contractorFilter') ? $('contractorFilter').value : '';
    const unit = $('unitFilter') ? $('unitFilter').value : '';
    const contractorIx = findHeaderIndex(headers, ['اسم المقاول', 'المستفيد', 'المصدر', 'الشريك', 'الاسم']);
    const unitIx = findHeaderIndex(headers, ['النوع']);
    const qTokens = q.split(/\s+/).filter(Boolean);

    let filtered = allRows.filter(row => {
        const textMatch = qTokens.length === 0 || qTokens.every(token =>
            row.some(v => normalizeText(v).includes(token))
        );
        const contractorMatch = !contractor || String(row[contractorIx] ?? '') === contractor;
        const unitMatch = !unit || String(row[unitIx] ?? '') === unit;
        const smartMatch = typeof smartFilterMatch === 'function' ? smartFilterMatch(row, headers) : true;

        // الوحدات الخاصة
        const isGl = typeof glMatch === 'function' ? glMatch(row, headers) : true;
        const isAdv = typeof advMatch === 'function' ? advMatch(row, headers) : true;
        const isWd = typeof wdMatch === 'function' ? wdMatch(row, headers) : true;
        const isCt = typeof ctMatch === 'function' ? ctMatch(row, headers) : true;
        const isDebt = typeof debtMatch === 'function' ? debtMatch(row, headers) : true;

        return textMatch && contractorMatch && unitMatch && smartMatch && isGl && isAdv && isWd && isCt && isDebt;
    });

    // 10. الترتيب
    if (sortColumn >= 0) {
        filtered = filtered.slice().sort((a, b) => {
            const av = sortValue(a[sortColumn]);
            const bv = sortValue(b[sortColumn]);
            const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ar', { numeric: true });
            return cmp * sortDirection;
        });
    }

    // 11. الصفحات
    const size = $('pageSize') ? (Number($('pageSize').value) || 10) : 50;
    const pageCount = Math.max(1, Math.ceil(filtered.length / size));
    page = Math.min(page, pageCount);
    currentRows = filtered;
    const start = filtered.length ? (page - 1) * size : 0;
    const shown = filtered.slice(start, start + size);

    // 12. رسم الصفوف
    shown.forEach((row, rowOffset) => {
        const tr = document.createElement('tr');
        tr.className = 'transition hover:bg-slate-800/80 group';
        const rowNumber = document.createElement('th');
        rowNumber.className = 'sheet-row-number';
        rowNumber.scope = 'row';
        rowNumber.textContent = String(start + rowOffset + 2);
        tr.appendChild(rowNumber);

        // خلايا الأعمدة
        visibleHeaders.forEach(index => {
            const header = headers[index];
            if (!String(header ?? '').trim() || String(header).trim() === ATT_H || isHiddenLegacyHeader(header) || (activeSheet === CT && String(header).trim() === 'رقم الوصل')) return;
            if (isColHidden(header)) return;

            const td = document.createElement('td');
            td.className = 'max-w-[280px] whitespace-nowrap border-b border-slate-700/60 px-3 py-3 text-center text-slate-100';

            const isNameCol = /اسم المقاول|المستفيد|المصدر|الشريك|^الاسم$/i.test(normalizeText(header));
            if (isNameCol) {
                td.classList.add('sticky', 'right-0', 'z-10', 'bg-slate-900', 'group-hover:bg-slate-800/90', 'shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.3)]');
            }

            const hName = String(header).trim();

            // ✅ badge ملوّن لعمود "النوع" في السجل العام والسحب
            if ((activeSheet === GL || activeSheet === WD) && hName === 'النوع') {
                const val = String(row[index] ?? '').trim();
                const badge = document.createElement('span');
                let cls = 'bg-slate-800 text-slate-300 border-slate-700';
                if (val === 'صرف' || val === 'سحب') cls = 'bg-rose-950/60 text-rose-300 border-rose-900';
                else if (val === 'قبض' || val === 'تمويل') cls = 'bg-emerald-950/60 text-emerald-300 border-emerald-900';
                else if (val === 'تحويل') cls = 'bg-sky-950/60 text-sky-300 border-sky-900';
                badge.className = 'inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ' + cls;
                badge.textContent = val || '—';
                td.appendChild(badge);
                tr.appendChild(td);
                return;
            }

            // ✅ badge ملوّن لعمود "العملة"
            if (hName === 'العملة') {
                const val = String(row[index] ?? '').trim();
                const badge = document.createElement('span');
                const cls = val === 'USD' ? 'bg-sky-950/60 text-sky-300 border-sky-900' : 'bg-slate-800 text-slate-300 border-slate-700';
                badge.className = 'inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold ' + cls;
                badge.textContent = val || '—';
                td.appendChild(badge);
                tr.appendChild(td);
                return;
            }

            // ✅ عمود المتبقي في المديونية — أحمر إذا سالب
            if (activeSheet === AppConfig.SHEETS.DEBTS && (hName.includes('المتبقي') || hName.includes('الباقي'))) {
                const val = parseNumber(row[index]);
                td.textContent = formatMoneyForHeader(header, val);
                td.className += ' ' + (val < 0 ? 'text-rose-400 font-bold' : 'text-slate-100');
                tr.appendChild(td);
                return;
            }

            td.textContent = formatCell(header, row[index]);

            if (isReadOnly) {
                td.title = 'انقر لنسخ القيمة';
                td.classList.add('cursor-pointer', 'hover:bg-slate-800/50');
                td.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(String(row[index] ?? ''));
                        toast('تم نسخ: ' + String(row[index] ?? '').slice(0, 40));
                    } catch (e) { toast('تعذر النسخ', 'error'); }
                });
            }
            tr.appendChild(td);
        });

        // عمود المرفق عند توفره في مخطط الورقة
        if (!isReadOnly && hasAttachmentColumn) tr.appendChild(attCell(activeSheet, row));

        // عمود الإجراءات
        if (!isReadOnly) {
            const act = document.createElement('td');
            act.className = 'border-b border-slate-700/60 px-3 py-3 text-center sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800/90 shadow-[4px_0_6px_-2px_rgba(0,0,0,0.3)]';
            if (typeof canMutateActiveSheet === 'function' && canMutateActiveSheet()) {
                const eb = document.createElement('button');
                eb.type = 'button';
                eb.textContent = 'تعديل';
                eb.className = 'rounded border border-sky-800 bg-sky-950/60 px-2 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-900';
                eb.addEventListener('click', () => showAdd(row));
                act.appendChild(eb);
                const db = document.createElement('button');
                db.type = 'button';
                db.textContent = 'حذف';
                db.className = 'ms-1 rounded border border-rose-900 bg-rose-950/50 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-900';
                db.setAttribute('aria-label', 'حذف السجل');
                db.addEventListener('click', () => deleteSheetRow(row));
                act.appendChild(db);
            }
            tr.appendChild(act);
        }
        body.appendChild(tr);
    });

    // 13. حالة فارغة + معلومات
    const empty = filtered.length === 0;
    if ($('emptyState')) $('emptyState').classList.toggle('hidden', !empty);
    if ($('dataTable')) $('dataTable').classList.toggle('hidden', !headers.length || empty);
    if ($('emptyHint')) {
        $('emptyHint').textContent = allRows.length
            ? 'لا توجد سجلات تطابق البحث أو عوامل التصفية الحالية.'
            : headers.length ? 'لا يحتوي هذا التبويب على سجلات بعد.' : 'ورقة فارغة.';
    }

    const end = Math.min(start + size, filtered.length);
    if ($('tableInfo')) {
        $('tableInfo').textContent = `عرض ${new Intl.NumberFormat('en-US').format(filtered.length ? start + 1 : 0)}–${new Intl.NumberFormat('en-US').format(end)} من ${new Intl.NumberFormat('en-US').format(filtered.length)} سجل`;
    }
    if ($('pageInfo')) {
        $('pageInfo').textContent = `${new Intl.NumberFormat('en-US').format(page)} / ${new Intl.NumberFormat('en-US').format(pageCount)}`;
    }
    if ($('prevPage')) { $('prevPage').disabled = page <= 1; $('prevPage').classList.toggle('opacity-40', page <= 1); }
    if ($('nextPage')) { $('nextPage').disabled = page >= pageCount; $('nextPage').classList.toggle('opacity-40', page >= pageCount); }
}
