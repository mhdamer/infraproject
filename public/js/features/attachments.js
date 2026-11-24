'use strict';

/**
 * attachments.js — رفع/عرض/حذف المرفقات
 * v1.2 — حماية من العناصر المفقودة + رفض غير PDF
 */

const ATT_H = 'المرفق';
const ATT_MAX = 10 * 1024 * 1024;
const attIx = headers => headers.findIndex(h => ['المرفق', 'مرفق'].includes(String(h).trim()));
const attUrl = (row, headers) => {
    const i = attIx(headers);
    const v = i < 0 ? '' : String(row[i] ?? '').trim();
    if (!v) return '';
    const m = v.match(/\/d\/([-\w]{25,})/) || v.match(/([-\w]{25,})/);
    return m ? '/api/attachments/' + m[1] : '';
};
const recOf = (headers, row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']));

function ensureAttHeader() { /* لا ننشئ أعمدة — المرفق موجود في المصدر */ }

let attTarget = null;

function attCell(sheet, row) {
    const td = document.createElement('td');
    td.className = 'whitespace-nowrap border-b border-slate-800/80 px-3 py-3 text-center';
    const url = attUrl(row, sheetHeaders(sheet));
    const mk = (txt, cls, title, fn) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = txt;
        b.title = title;
        b.className = cls;
        b.addEventListener('click', fn);
        return b;
    };
    const base = 'rounded border px-2 py-1 text-xs font-semibold ';
    if (url) {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = '📎 عرض';
        a.title = 'فتح ملف PDF المرفق';
        a.className = base + 'border-emerald-900 bg-emerald-950/70 text-emerald-300 hover:bg-emerald-900/40';
        td.appendChild(a);
        td.appendChild(document.createTextNode(' '));
        td.appendChild(mk('↻', base + 'border-slate-700 text-slate-200 hover:bg-slate-800', 'استبدال الملف', () => attPick(sheet, row)));
        td.appendChild(document.createTextNode(' '));
        td.appendChild(mk('✕', base + 'border-rose-900 text-rose-300 hover:bg-rose-950', 'حذف المرفق', () => attRemove(sheet, row)));
    } else {
        td.appendChild(mk('＋ PDF', base + 'border-slate-700 text-slate-200 hover:bg-slate-800', 'إرفاق ملف PDF', () => attPick(sheet, row)));
    }
    return td;
}

function attPick(sheet, row) {
    const headers = sheetHeaders(sheet);
    if (!headers.length) return toast('لا توجد أعمدة في هذا التبويب بعد؛ اجلب البيانات أولاً.', 'error');
    if (attIx(headers) < 0) return toast('عمود «المرفق» غير موجود في هذا التبويب.', 'error');
    const input = $('attInput');
    if (!input) return toast('حقل الرفع غير موجود. أعد تحميل الصفحة.', 'error');
    attTarget = { sheet, row };
    input.click();
}

// ★ حماية: ربط حدث الرفع فقط إن وُجد attInput
document.addEventListener('DOMContentLoaded', () => {
    const input = $('attInput');
    if (!input) return;
    input.addEventListener('change', e => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (f && attTarget) attUpload(attTarget.sheet, attTarget.row, f);
    });
});

const attB64 = file => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = () => rej(new Error('تعذرت قراءة الملف.'));
    fr.readAsDataURL(file);
});

async function attUpload(sheet, row, file) {
    if (!file) return;
    if (file.size === 0) return toast('الملف فارغ.', 'error');
    if (file.size > ATT_MAX) return toast('حجم الملف كبير جداً (الحد 10 ميجابايت).', 'error');
    if (file.type && file.type !== 'application/pdf') return toast('يُسمح بملفات PDF فقط.', 'error');

    const headers = sheetHeaders(sheet);
    const ai = attIx(headers);
    if (ai < 0) return toast('عمود «المرفق» غير موجود في هذا التبويب. أضفه إلى المصدر أولاً.', 'error');

    while (row.length < headers.length) row.push('');
    const oldRow = row.slice();
    attBusy++;
    toast('جارٍ رفع الملف...');

    try {
        const data = await attB64(file);
        const payload = {
            action: 'attach', sheet, sheetName: sheet, headers,
            oldRecord: recOf(headers, oldRow), fileName: file.name,
            mime: 'application/pdf', data
        };
        lastWriteAt = Date.now();
        const res = await sendSheetData(payload);
        if (res?.data?.error) throw new Error(res.data.error);
        const url = res?.data?.url || '';
        if (!url) throw new Error('لم يُعِد الخادم رابط المرفق.');
        row[ai] = url;
        saveWorkbook();
        render();
        toast('تم رفع المرفق وربطه بالسجل.');
    } catch (error) {
        toast('فشل رفع المرفق: ' + (error.message || ''), 'error');
    } finally {
        attBusy--;
    }
}

async function attRemove(sheet, row) {
    if (!confirm('حذف المرفق من هذا السجل؟')) return;
    const headers = sheetHeaders(sheet);
    const ai = attIx(headers);
    if (ai < 0) return;
    const oldRow = row.slice();
    row[ai] = '';
    saveWorkbook();
    render();
    try {
        await sendSheetData({ action: 'detach', sheet, sheetName: sheet, headers, oldRecord: recOf(headers, oldRow) });
        toast('تم حذف المرفق.');
    } catch (error) {
        toast('حُذف محلياً لكن فشل الإرسال: ' + (error.message || ''), 'error');
    }
}