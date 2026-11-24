'use strict';

/**
 * excel-io.js — تصدير Excel بالصيغ + استيراد + نسخ احتياطي
 * v1.2 — استيراد الأوراق النشطة فقط؛ سلف العمل جزء من السجل العام
 */

function sanitizeForExcel(val) {
    if (typeof val === 'string' && /^[=+\-@]/.test(val)) return "'" + val;
    return val;
}

function getColLetter(index) {
    let letter = '';
    while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
    }
    return letter;
}

const XL_BORDER = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
};

const XL_HEADER_STYLE = {
    font: { bold: true, color: { argb: 'FF1E293B' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } },
    border: XL_BORDER,
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
};

const XL_CELL_STYLE = {
    border: XL_BORDER,
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
};

function isMoneyHeader(h) {
    const t = normalizeText(String(h ?? ''));
    if (/^تاريخ/.test(t)) return false;
    return /مبلغ|قيمة|استقطاع|سعر|كلف|خصم|غرامة|مدفوع|المصروف|المتبقي|الباقي|السعر الكلي|مجموع/.test(t);
}

function toExcelDate(val) {
    if (val === null || val === undefined || val === '') return null;
    let y, m, d;
    if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        y = val.getFullYear(); m = val.getMonth(); d = val.getDate();
    } else if (typeof val === 'number' || /^\d+(\.\d+)?$/.test(String(val).trim())) {
        const num = Number(val);
        if (!(num > 1000)) return null;
        return new Date(Date.UTC(1970, 0, 1) + (Math.floor(num) - 25569) * 86400000);
    } else {
        const s = String(val).trim();
        const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (iso) { y = +iso[1]; m = +iso[2] - 1; d = +iso[3]; }
        else {
            const t = new Date(s);
            if (isNaN(t.getTime())) return null;
            y = t.getFullYear(); m = t.getMonth(); d = t.getDate();
        }
    }
    return new Date(Date.UTC(y, m, d));
}
function dateToSerial(dt) {
    if (!(dt instanceof Date) || isNaN(dt.getTime())) return '';
    return Math.round(dt.getTime() / 86400000) + 25569;
}

// ═══ استيراد Excel ═══
async function parseWorkbookFile(file) {
    if (!window.ExcelJS) throw new Error('مكتبة ExcelJS غير متاحة...');
    try {
        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const incoming = {};
        let recognized = 0;

        workbook.eachSheet((worksheet) => {
            const sheetName = worksheet.name;
            if (!ALL_SHEETS.includes(sheetName)) return;
            const allRows = [];
            worksheet.eachRow({ includeEmpty: false }, row => allRows.push(row));
            const textRow = row => Array.from({ length: worksheet.columnCount }, (_, i) => String(row.getCell(i + 1).text || '').trim());
            const headerTests = {
                [GL]: r => r.includes('رقم الوصل') && r.includes('المبلغ') && r.includes('التاريخ'),
                [CT]: r => r.includes('اسم المقاول') && r.includes('رقم الذرعة') && r.some(x => x.includes('المادة/العمل')),
                [ADV]: r => r.includes('المبلغ') && r.includes('التفاصيل') && r.includes('التاريخ'),
                [WD]: r => r.includes('التمويل') && r.includes('السحب') && r.includes('التاريخ'),
                [DB]: r => r.includes('الاسم') && r.some(x => x === 'المبلغ المطلوب دينار' || x === 'المبلغ المطلوب $'),
            }[sheetName];
            const headerAt = allRows.findIndex(row => headerTests && headerTests(textRow(row)));
            const headers = headerAt < 0 ? [] : textRow(allRows[headerAt]);
            while (headers.length && !headers[headers.length - 1]) headers.pop();
            const rows = [];
            let debtUsdSection = false;

            const readValues = row => headers.map((_, i) => {
                const cell = row.getCell(i + 1);
                let val = cell.value;
                if (val && typeof val === 'object') {
                    if (val.result !== undefined) val = val.result;
                    else if (val.text !== undefined) val = val.text;
                    else if (val instanceof Date) val = val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
                }
                if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) val = val.slice(0, 10);
                return val ?? '';
            });

            if (headerAt >= 0 && sheetName === DB) {
                const fullHeaders = ['ت', 'الاسم', 'المبلغ المطلوب دينار', 'المبلغ المستلم دينار', 'الباقي/ دينار', 'ملاحظات', 'المبلغ المطلوب $', 'المبلغ المستلم $', 'الباقي $', 'ملاحظات $'];
                headers.splice(0, headers.length, ...fullHeaders);
                for (const row of allRows.slice(headerAt + 1)) {
                    const labels = textRow(row);
                    if (labels.includes('المبلغ المطلوب $')) { debtUsdSection = true; continue; }
                    if (labels.includes('المجموع الكلي')) continue;
                    const source = Array.from({ length: 6 }, (_, i) => {
                        const cell = row.getCell(i + 1); let val = cell.value;
                        if (val && typeof val === 'object') val = val.result ?? val.text ?? val;
                        if (val instanceof Date) val = val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
                        return val ?? '';
                    });
                    const mapped = Array(10).fill('');
                    if (debtUsdSection) [mapped[0], mapped[1], mapped[6], mapped[7], mapped[8], mapped[9]] = source;
                    else [mapped[0], mapped[1], mapped[2], mapped[3], mapped[4], mapped[5]] = source;
                    const substantiveIndexes = [1, 2, 3, 5, 6, 7, 9];
                    if (substantiveIndexes.some(i => String(mapped[i] ?? '').trim() !== '')) rows.push(mapped);
                }
            } else if (headerAt >= 0) {
                for (const row of allRows.slice(headerAt + 1)) {
                    const labels = textRow(row);
                    if (labels.includes('مجمل التمويل') || labels.includes('مجمل السحب') || labels.includes('فرق التمويل عن السحب') || labels.includes('الصافي من حصته') || labels.includes('اجمالي السلف المستلمة') || labels.includes('المجموع الكلي')) break;
                    const rowData = readValues(row);
                    if (rowData.some(v => String(v).trim() !== '')) rows.push(rowData);
                }
            }
            incoming[sheetName] = { headers, rows };
            recognized++;
        });

        if (!recognized) throw new Error('لم أجد أوراقاً معروفة في المصنف.');

        Object.entries(incoming).forEach(([name, part]) => {
            const old = workbookData[name] || { headers: [], rows: [] };
            if (!part.headers.length) { workbookData[name] = old; return; }
            const legacyHeaders = new Set([AUDIT_H, DELETED_H, VERSION_H]);
            const keepIndexes = part.headers.map((header, index) => legacyHeaders.has(String(header).trim()) ? -1 : index).filter(index => index >= 0);
            const targetHeaders = keepIndexes.map(index => part.headers[index]);
            if (name === CT) ['اسم المقاول', 'نوع العمل', 'العمل', 'الكود'].forEach(header => {
                if (findHeaderIndex(targetHeaders, [header]) < 0) targetHeaders.push(header);
            });
            const importedIndexes = targetHeaders.map(header => findHeaderIndex(part.headers, [header]));
            const importedRows = part.rows.map(row => importedIndexes.map(index => index < 0 ? '' : row[index] ?? ''));
            const sameSchema = old.headers.length === targetHeaders.length && old.headers.every((h, i) => normalizeText(h) === normalizeText(targetHeaders[i]));
            const mapped = importedRows;
            const merged = sameSchema ? mergeRows(name, targetHeaders, old.rows || [], mapped) : mapped;
            workbookData[name] = { headers: targetHeaders, rows: merged };
        });

        saveWorkbook(); page = 1; render();
        const count = Object.keys(incoming).reduce((sum, name) => sum + (incoming[name].rows || []).length, 0);
        toast(`تم استيراد ${new Intl.NumberFormat('en-US').format(count)} صف.`);
    } catch (error) {
        throw new Error('تعذر قراءة ملف Excel: ' + error.message);
    }
}

// ═══ تصدير Excel ═══
async function exportWorkbook() {
    if (!window.ExcelJS) return toast('مكتبة ExcelJS غير متاحة. تحقق من الإنترنت.', 'error');

    const name = activeSheet;
    const debtView = name === DB && typeof getDebtViewData === 'function' ? getDebtViewData() : null;
    const headers = (debtView ? debtView.headers : sheetHeaders(name) || []).slice();
    const rows = debtView ? debtView.rows : sheetRows(name);

    const isEmptyVal = (v) => v === null || v === undefined || v === false || String(v).trim() === '';
    while (headers.length > 0) {
        const last = headers.length - 1;
        if (rows.some(r => !isEmptyVal(r[last]))) break;
        headers.pop();
    }
    if (!headers.length) return toast('هذا التبويب لا يحتوي على أعمدة لتصديرها.', 'error');

    const idx = {};
    const cols = {};
    const setIx = (key, names) => {
        idx[key] = findHeaderIndex(headers, names);
        if (idx[key] >= 0) cols[key] = getColLetter(idx[key]);
    };

    if (name === CT) {
        setIx('qty', ['الكمية']);
        setIx('priceIQD', ['السعر دينار']);
        setIx('totalIQD', ['السعر الكلي دينار']);
        setIx('priceUSD', ['السعر دولار']);
        setIx('totalUSD', ['السعر الكلي دولار']);
        setIx('ctName', ['اسم المقاول']);
    } else if (name === ADV) {
        setIx('amount', ['المبلغ']);
        setIx('cumulative', ['المجموع التراكمي']);
    } else if (name === DB) {
        setIx('reqIQD', ['المبلغ المطلوب دينار']);
        setIx('gotIQD', ['المبلغ المستلم دينار']);
        setIx('remIQD', ['المتبقي دينار', 'الباقي/ دينار']);
        setIx('reqUSD', ['المبلغ المطلوب $']);
        setIx('gotUSD', ['المبلغ المستلم $']);
        setIx('remUSD', ['المتبقي $', 'الباقي $']);
    }

    const dateColIndices = new Set();
    headers.forEach((h, i) => {
        if (String(h).includes('تاريخ')) dateColIndices.add(i);
    });

    const moneyColIndices = new Set();
    headers.forEach((h, i) => {
        if (!dateColIndices.has(i) && isMoneyHeader(h)) moneyColIndices.add(i);
    });

    const workbook = new ExcelJS.Workbook();
    workbook.calcProperties = { fullCalcOnLoad: true };
    workbook.views = [{ rightToLeft: true }];
    const worksheet = workbook.addWorksheet(name.slice(0, 31), { views: [{ rightToLeft: true }] });

    const headerRow = worksheet.addRow(headers.map(h => sanitizeForExcel(h)));
    headerRow.height = 30;
    headerRow.eachCell((cell) => { cell.style = XL_HEADER_STYLE; });
    headerRow.commit();

    rows.forEach((row, rIdx) => {
        const excelRow = rIdx + 2;

        const rowValues = headers.map((h, cIdx) => {
            const rawVal = row[cIdx];
            const isDateCol = dateColIndices.has(cIdx);

            if (isDateCol) return toExcelDate(rawVal) || null;

            if (name === CT) {
                if (cIdx === idx.totalIQD && cols.qty && cols.priceIQD) return { formula: `${cols.qty}${excelRow}*${cols.priceIQD}${excelRow}`, result: parseNumber(rawVal) };
                if (cIdx === idx.totalUSD && cols.qty && cols.priceUSD) return { formula: `${cols.qty}${excelRow}*${cols.priceUSD}${excelRow}`, result: parseNumber(rawVal) };
            }

            if (name === ADV && cIdx === idx.cumulative && cols.amount) {
                return { formula: `SUM($${cols.amount}$2:${cols.amount}${excelRow})`, result: parseNumber(rawVal) };
            }

            if (name === DB) {
                if (cIdx === idx.remIQD && cols.reqIQD && cols.gotIQD) {
                    return { formula: `${cols.reqIQD}${excelRow}-${cols.gotIQD}${excelRow}`, result: parseNumber(rawVal) };
                }
                if (cIdx === idx.remUSD && cols.reqUSD && cols.gotUSD) {
                    return { formula: `${cols.reqUSD}${excelRow}-${cols.gotUSD}${excelRow}`, result: parseNumber(rawVal) };
                }
            }

            return rawVal === undefined ? null : sanitizeForExcel(rawVal);
        });

        const dataRow = worksheet.addRow(rowValues);
        dataRow.height = 25;

        dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const ci = colNumber - 1;
            const isDateCol = dateColIndices.has(ci);
            const isMoneyCol = moneyColIndices.has(ci);

            cell.style = {
                border: XL_CELL_STYLE.border,
                alignment: { ...XL_CELL_STYLE.alignment },
                numFmt: isDateCol ? 'dd/mm/yyyy' : (isMoneyCol ? '#,##0' : 'General')
            };

            const cv = cell.value;
            const isFormula = cv && typeof cv === 'object' && cv.formula;
            const currentVal = isFormula ? cv.result : cv;

            if (isMoneyCol && !isDateCol) {
                let numVal = null;
                if (typeof currentVal === 'number' && !isNaN(currentVal)) numVal = currentVal;
                else if (currentVal !== '' && currentVal !== null && currentVal !== undefined) {
                    const n = parseNumber(currentVal);
                    if (!isNaN(n)) numVal = n;
                }
                if (isFormula) cv.result = numVal !== null ? numVal : '';
                else cell.value = numVal;
            }
        });
        dataRow.commit();
    });

    const lastRow = rows.length + 1;
    if (lastRow >= 2) {
        if (name === DB) {
            ['remIQD', 'remUSD'].forEach(k => {
                if (cols[k]) {
                    worksheet.addConditionalFormatting({
                        ref: `${cols[k]}2:${cols[k]}${lastRow}`,
                        rules: [{ type: 'expression', formulae: [`AND(ISNUMBER(${cols[k]}2),${cols[k]}2<0)`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' }, bold: true } } }]
                    });
                }
            });
        }
        if (name === CT && cols.totalIQD) {
            worksheet.addConditionalFormatting({
                ref: `${cols.totalIQD}2:${cols.totalIQD}${lastRow}`,
                rules: [{ type: 'expression', formulae: [`AND(ISNUMBER(${cols.totalIQD}2),${cols.totalIQD}2>0)`], style: { font: { color: { argb: 'FF047857' }, bold: true } } }]
            });
        }
    }

    worksheet.columns.forEach((column) => { column.width = 22; });

    try {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/[\\/*?:[\]]/g, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        toast(`تم تصدير تبويب «${name}» بنجاح.`);
    } catch (err) {
        toast('تعذر تصدير الملف: ' + err.message, 'error');
    }
}

// ═══ النسخ الاحتياطي الكامل ═══
const BACKUP_EXCLUDE = ['sharaeen_session_v1', 'sharaeen_last_notes_read'];

async function exportFullBackup() {
    try {
        const data = {};
        let count = 0;
        const seen = new Set();
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith('sharaeen_')) continue;
            if (BACKUP_EXCLUDE.indexOf(k) >= 0) continue;
            if (seen.has(k)) continue;
            seen.add(k);
            const v = localStorage.getItem(k);
            if (v !== null) { data[k] = v; count++; }
        }
        if (!count) return toast('لا توجد بيانات لتصديرها.', 'error');
        const backup = {
            version: '1.0',
            app: 'حسابات مشروع الشارعين',
            exportedAt: new Date().toISOString(),
            entries: count,
            data: data
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'نسخة-احتياطية-الشارعين-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        toast(`تم تصدير ${count} مفتاح بيانات.`);
    } catch (e) {
        toast('تعذر التصدير: ' + (e.message || ''), 'error');
    }
}

async function importFullBackup(file) {
    if (!file) return;
    try {
        const text = await file.text();
        let backup;
        try { backup = JSON.parse(text); } catch (e) { return toast('الملف ليس JSON صالحاً.', 'error'); }
        if (!backup || typeof backup !== 'object' || !backup.data || typeof backup.data !== 'object') {
            return toast('ملف النسخة الاحتياطية غير صالح.', 'error');
        }
        const keys = Object.keys(backup.data);
        if (!keys.length) return toast('النسخة الاحتياطية فارغة.', 'error');

        if (!confirm(`⚠ استيراد ${keys.length} مفتاح بيانات؟\n\nسيتم استبدال البيانات الحالية بالكامل.`)) return;

        let imported = 0;
        for (const k of keys) {
            if (BACKUP_EXCLUDE.indexOf(k) >= 0) continue;
            try { localStorage.setItem(k, String(backup.data[k])); imported++; } catch (e) {}
        }
        toast(`تم استيراد ${imported} مفتاح. سيُعاد تحميل الصفحة.`);
        setTimeout(() => location.reload(), 1800);
    } catch (e) {
        toast('تعذر الاستيراد: ' + (e.message || ''), 'error');
    }
}
