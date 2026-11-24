'use strict';

/**
 * print.js — محرك الطباعة الأساسي فقط
 * ★ SHARAEEN: بقيت printDoc + prEsc + sanitizeImageUrl + prNum + prDate فقط
 * (النماذج الخاصة — ذرعة/استمارة — ستُضاف لاحقاً في contractors.js إن لزم)
 */

const prEsc = s => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');

function sanitizeImageUrl(url) {
    if (!url) return '';
    const s = String(url).trim();
    if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/i.test(s)) return s;
    if (/^https?:\/\/[^\s"'<>]{1,2000}$/i.test(s)) return s;
    return '';
}

const prHas = v => String(v ?? '').trim() !== '';
const prNz = v => prHas(v) && parseNumber(v) !== 0;
const prNum = v => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(parseNumber(v));

function prDate(v) {
    const t = toIsoDate(v);
    if (!t) return String(v ?? '');
    const [y, m, d] = t.split('-');
    return d + '/' + m + '/' + y;
}

function prArabicIntegerWords(value) {
    const n = Math.floor(Math.abs(Number(value) || 0));
    if (!n) return 'صفر';
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    const scales = ['', 'ألف', 'مليون', 'مليار', 'تريليون'];
    const triad = number => {
        const h = Math.floor(number / 100), r = number % 100;
        const parts = [];
        if (h) parts.push(hundreds[h]);
        if (r >= 10 && r < 20) parts.push(teens[r - 10]);
        else if (r >= 20) parts.push((r % 10 ? ones[r % 10] + ' و' : '') + tens[Math.floor(r / 10)]);
        else if (r > 0) parts.push(ones[r]);
        return parts.join(' و');
    };
    const chunks = [];
    let remaining = n, scale = 0;
    while (remaining > 0 && scale < scales.length) {
        const group = remaining % 1000;
        if (group) {
            if (scale === 0) chunks.unshift(triad(group));
            else if (group === 1) chunks.unshift(scales[scale]);
            else if (group === 2) chunks.unshift(scales[scale] + 'ان');
            else if (group <= 10) {
                const plural = scale === 1 ? 'آلاف' : scale === 2 ? 'ملايين' : scale === 3 ? 'مليارات' : 'تريليونات';
                chunks.unshift(triad(group) + ' ' + plural);
            } else chunks.unshift(triad(group) + ' ' + scales[scale] + 'اً');
        }
        remaining = Math.floor(remaining / 1000);
        scale++;
    }
    return chunks.join(' و');
}

function prAmountInWords(value) {
    const amount = parseNumber(value);
    const scaled = Math.round(Math.abs(amount) * 1000);
    const dinars = Math.floor(scaled / 1000);
    const fils = scaled % 1000;
    const pieces = [];
    if (dinars || !fils) pieces.push(prArabicIntegerWords(dinars) + (dinars === 2 ? ' ديناران عراقيان' : dinars === 1 ? ' دينار عراقي' : ' دينار عراقي'));
    if (fils) pieces.push(prArabicIntegerWords(fils) + ' فلساً');
    return (amount < 0 ? 'سالب ' : '') + pieces.join(' و') + ' فقط لا غير';
}

function prDoc(size, css, body) {
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طباعة</title>'
        + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap">'
        + '<style>@page{size:' + size + ';margin:0}*{box-sizing:border-box}html,body{margin:0}'
        + "body{font-family:'Cairo','Tahoma','Arial',sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}"
        + 'table{border-collapse:collapse;width:100%}.pg{page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}table.wrap>thead>tr>td,table.wrap>tfoot>tr>td{height:10mm;padding:0;border:0}table.wrap>tbody>tr>td{padding:0 10mm;border:0;vertical-align:top}' + css
        + '</style></head><body>' + body.split('<section class="pg">').join('<table class="wrap pg"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>').split('</section>').join('</td></tr></tbody></table>') + '</body></html>';
}

function printDoc(html) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(f);
    const w = f.contentWindow;
    const d = f.contentDocument;
    let done = false;
    const go = () => {
        if (done) return;
        done = true;
        try { w.focus(); w.print(); }
        catch (e) { toast('تعذرت الطباعة من هذا المتصفح.', 'error'); }
        setTimeout(() => f.remove(), 60000);
    };
    d.open();
    w.addEventListener('load', () => {
        (d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 250));
    });
    d.write(html);
    d.close();
    setTimeout(go, 3500);
}

function receiptPrintRows() {
    const headers = sheetHeaders(GL);
    const numberIx = findHeaderIndex(headers, ['ت', 'رقم الوصل']);
    if (numberIx < 0) return [];
    return sheetRows(GL).map(row => ({ row, number: String(row[numberIx] ?? '').trim() }))
        .filter(item => item.number !== '');
}

function showReceiptPrintModal() {
    const modal = $('receiptPrintModal');
    if (!modal) return;
    const current = $('receiptNumberFrom');
    const msg = $('receiptPrintMessage');
    if (current) current.value = '';
    if (msg) { msg.textContent = ''; msg.classList.add('hidden'); }
    modal.classList.remove('hidden'); modal.classList.add('flex');
    current?.focus();
}

function hideReceiptPrintModal() {
    const modal = $('receiptPrintModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

function receiptField(row, headers, names) {
    const ix = findHeaderIndex(headers, names);
    return ix >= 0 ? String(row[ix] ?? '').trim() : '';
}

/* ===== وصل الصرف — مطابق لقالب receipt-template.png (1194×896) =====
   كل القياسات بوحدة u = عرض الصفحة / 1194 فتبقى النسب ثابتة عند الطباعة. */
const RECEIPT_PROJECT_TEXT = 'مشروع:1/ج/2026 و 1/د/2026';
const RECEIPT_SIGNATURES = [
    { title: 'المستلم', name: '' },
    { title: 'المحاسب', name: 'محمد عامر مازن' },
    { title: 'امانة الصندوق', name: 'عدي الكعبي' },
    { title: 'مدير المشروع', name: 'احمد شاكر حمود' },
    { title: 'المدير المفوض', name: 'محمد قاسم كاظم' }
];

// يصغّر الخط تلقائياً عند طول النص كي لا يخرج عن السطر المنقط
function receiptFitSize(text, maxSize, widthU, charEm) {
    const len = Math.max(1, String(text || '').length);
    return Math.max(12, Math.min(maxSize, Math.floor(widthU / (len * (charEm || 0.46)))));
}

function buildDisbursementReceipt(item, headers) {
    const row = item.row;
    const amount = receiptField(row, headers, ['المبلغ']);
    const date = receiptField(row, headers, ['التاريخ']);
    const recipient = receiptField(row, headers, ['المستلم', 'المستفيد', 'اسم المستلم']);
    const details = receiptField(row, headers, ['التفاصيل', 'البيان']);
    const amountText = amount ? prNum(amount) : '';
    const words = amount ? prAmountInWords(amount) : '';
    const logoUrl = new URL('./images/receipt-logo.png', window.location.href).href;
    const wordsSize = receiptFitSize(words, 24, 800);
    const recipientSize = receiptFitSize(recipient, 24, 800);
    const sigs = RECEIPT_SIGNATURES.map((s, i) =>
        '<div class="rc-sig" style="left:calc(' + ([1096, 886, 650, 427, 176][i] - 105) + ' * var(--u))"><b>' + prEsc(s.title) + '</b><span>' + prEsc(s.name) + '</span></div>'
    ).join('');
    return '<section class="rc-page">'
        + '<div class="rc-border"></div>'
        + '<img class="rc-logo" src="' + prEsc(logoUrl) + '" alt="">'
        + '<div class="rc-company">شركة المقاولين المتكاملة الكويتية للمقاولات</div>'
        + '<div class="rc-title">مستند صرف</div>'
        + '<div class="rc-amount-label">المبلـــــغ</div>'
        + '<div class="rc-amount">' + prEsc(amountText) + '</div>'
        + '<div class="rc-project">' + prEsc(RECEIPT_PROJECT_TEXT) + '</div>'
        + '<div class="rc-field rc-number"><span class="rc-lbl">العدد :</span> <span class="rc-val">' + prEsc(item.number) + '</span></div>'
        + '<div class="rc-field rc-date"><span class="rc-lbl">التاريخ :</span> <span class="rc-val">' + prEsc(prDate(date)) + '</span></div>'
        + '<div class="rc-label rc-l1">لامر السيد :</div>'
        + '<div class="rc-dots rc-d1"></div>'
        + '<div class="rc-value rc-v1" style="font-size:calc(' + recipientSize + ' * var(--u))">' + prEsc(recipient) + '</div>'
        + '<div class="rc-label rc-l2">مبلغاً وقدره :</div>'
        + '<div class="rc-dots rc-d2"></div>'
        + '<div class="rc-value rc-v2" style="font-size:calc(' + wordsSize + ' * var(--u))">' + prEsc(words) + '</div>'
        + '<div class="rc-label rc-l3">التفاصيل :</div>'
        + '<div class="rc-dots rc-d3"></div>'
        + '<div class="rc-dots rc-d4"></div>'
        + '<div class="rc-details"><i class="rc-spacer"></i>' + prEsc(details) + '</div>'
        + sigs
        + '</section>';
}

function receiptPrintHtml(items) {
    const css = `
.rc-page{--u:calc(197.3mm / 1194);position:relative;width:197.3mm;height:148mm;margin:0;overflow:hidden;background:#fff;page-break-after:always;break-after:page;direction:rtl;font-family:Tahoma,'Segoe UI',Arial,sans-serif;color:#0d1f35}
.rc-page:last-child{page-break-after:auto;break-after:auto}
.rc-page>*{position:absolute;margin:0}
.rc-border{inset:calc(3 * var(--u));border:calc(5 * var(--u)) solid #3a4b5c}
.rc-logo{left:calc(36 * var(--u));top:calc(8 * var(--u));width:calc(108 * var(--u));height:calc(158 * var(--u));object-fit:contain}
.rc-company{left:calc(172 * var(--u));top:calc(51 * var(--u));width:calc(838 * var(--u));height:calc(68 * var(--u));display:flex;align-items:center;justify-content:center;background:#1c3458;color:#fff;font-size:calc(36 * var(--u));font-weight:700;line-height:1;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rc-title{left:calc(250 * var(--u));top:calc(130 * var(--u));width:calc(300 * var(--u));white-space:nowrap;text-align:center;font-size:calc(36 * var(--u));font-weight:700;line-height:calc(52 * var(--u));color:#0d1f35}
.rc-amount-label{left:calc(84 * var(--u));top:calc(172 * var(--u));width:calc(265 * var(--u));text-align:center;font-size:calc(21 * var(--u));line-height:calc(30 * var(--u))}
.rc-amount{left:calc(84 * var(--u));top:calc(208 * var(--u));width:calc(265 * var(--u));height:calc(54 * var(--u));border:calc(2.5 * var(--u)) solid #1c3458;display:flex;align-items:center;justify-content:center;direction:ltr;font-size:calc(30 * var(--u));font-weight:700;line-height:1;white-space:nowrap}
.rc-project{left:auto;right:calc(34 * var(--u));top:calc(212 * var(--u));width:calc(600 * var(--u));text-align:right;font-size:calc(38 * var(--u));font-weight:700;line-height:calc(52 * var(--u));color:#0d1f35;white-space:nowrap}
.rc-field{width:calc(400 * var(--u));text-align:right;font-size:calc(26 * var(--u));line-height:calc(40 * var(--u));white-space:nowrap}
.rc-lbl{font-weight:400}
.rc-val{font-weight:700;font-size:calc(25 * var(--u))}
.rc-number{right:calc(54 * var(--u));top:calc(294 * var(--u))}
.rc-date{right:calc(41 * var(--u));top:calc(361 * var(--u))}
.rc-label{right:calc(34 * var(--u));width:calc(190 * var(--u));text-align:right;font-size:calc(32 * var(--u));line-height:calc(44 * var(--u));white-space:nowrap}
.rc-l1{top:calc(428 * var(--u))}
.rc-l2{right:calc(16 * var(--u));top:calc(499 * var(--u))}
.rc-l3{right:calc(36 * var(--u));top:calc(564 * var(--u))}
.rc-dots{border-top:calc(4 * var(--u)) dotted #111;height:0}
.rc-d1{left:calc(95 * var(--u));width:calc(905 * var(--u));top:calc(458 * var(--u))}
.rc-d2{left:calc(100 * var(--u));width:calc(875 * var(--u));top:calc(527 * var(--u))}
.rc-d3{left:calc(97 * var(--u));width:calc(913 * var(--u));top:calc(592 * var(--u))}
.rc-d4{left:calc(93 * var(--u));width:calc(1065 * var(--u));top:calc(663 * var(--u))}
.rc-value{right:calc(204 * var(--u));left:calc(100 * var(--u));text-align:right;font-weight:700;line-height:calc(30 * var(--u));white-space:nowrap;overflow:hidden}
.rc-v1{top:calc(425 * var(--u))}
.rc-v2{top:calc(494 * var(--u))}
.rc-details{left:calc(93 * var(--u));width:calc(1065 * var(--u));top:calc(540 * var(--u));font-size:calc(22 * var(--u));font-weight:700;line-height:calc(71 * var(--u));text-align:right;height:calc(142 * var(--u));overflow:hidden;padding-bottom:calc(6 * var(--u))}
.rc-spacer{float:right;width:calc(168 * var(--u));height:calc(71 * var(--u))}
.rc-sig{top:calc(764 * var(--u));width:calc(210 * var(--u));text-align:center;font-size:calc(20 * var(--u));line-height:calc(30 * var(--u))}
.rc-sig b,.rc-sig span{display:block;font-weight:400;white-space:nowrap}
`;
    const headers = sheetHeaders(GL);
    const pages = items.map(item => buildDisbursementReceipt(item, headers)).join('');
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>وصولات صرف</title><style>@page{size:197.3mm 148mm;margin:0}*{box-sizing:border-box}html,body{width:197.3mm;margin:0;padding:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}' + css + '</style></head><body>' + pages + '</body></html>';
}
function submitReceiptPrint() {
    const from = String($('receiptNumberFrom')?.value ?? '').trim();
    const to = String($('receiptNumberTo')?.value ?? '').trim();
    const mode = document.querySelector('input[name="receiptPrintMode"]:checked')?.value || 'single';
    const message = $('receiptPrintMessage');
    const showError = text => { message.textContent = text; message.classList.remove('hidden'); };
    message.classList.add('hidden');
    if (!from) return showError('أدخل رقم الوصل.');
    if (mode === 'range' && !to) return showError('أدخل رقم نهاية النطاق.');
    const fromNumber = parseNumber(from), toNumber = parseNumber(to);
    if (mode === 'range' && (!Number.isFinite(fromNumber) || !Number.isFinite(toNumber) || toNumber < fromNumber)) return showError('تحقق من أرقام النطاق؛ رقم النهاية يجب أن يكون أكبر من أو مساوياً للبداية.');
    const source = receiptPrintRows();
    const matching = source.filter(item => {
        if (mode === 'single') return normalizeText(item.number) === normalizeText(from);
        const n = parseNumber(item.number);
        return Number.isFinite(n) && n >= fromNumber && n <= toNumber;
    }).sort((a, b) => parseNumber(a.number) - parseNumber(b.number));
    if (!matching.length) return showError(mode === 'single' ? 'لم يتم العثور على رقم الوصل في السجل العام.' : 'لا توجد وصولات ضمن هذا النطاق في السجل العام.');
    hideReceiptPrintModal();
    printDoc(receiptPrintHtml(matching));
}

function bindReceiptPrintEvents() {
    const button = $('printReceiptsBtn');
    if (button && !button.dataset.receiptPrintBound) {
        button.dataset.receiptPrintBound = '1';
        button.addEventListener('click', showReceiptPrintModal);
    }
    const closeButton = $('closeReceiptPrint');
    if (closeButton && !closeButton.dataset.receiptPrintBound) {
        closeButton.dataset.receiptPrintBound = '1';
        closeButton.addEventListener('click', hideReceiptPrintModal);
    }
    const cancelButton = $('cancelReceiptPrint');
    if (cancelButton && !cancelButton.dataset.receiptPrintBound) {
        cancelButton.dataset.receiptPrintBound = '1';
        cancelButton.addEventListener('click', hideReceiptPrintModal);
    }
    const confirmButton = $('confirmReceiptPrint');
    if (confirmButton && !confirmButton.dataset.receiptPrintBound) {
        confirmButton.dataset.receiptPrintBound = '1';
        confirmButton.addEventListener('click', submitReceiptPrint);
    }
    document.querySelectorAll('input[name="receiptPrintMode"]').forEach(input => {
        if (input.dataset.receiptPrintBound) return;
        input.dataset.receiptPrintBound = '1';
        input.addEventListener('change', () => {
            $('receiptToWrap')?.classList.toggle('hidden', input.value !== 'range' || !input.checked);
            if (input.value === 'single' && input.checked && $('receiptNumberTo')) $('receiptNumberTo').value = '';
        });
    });
    const numberInput = $('receiptNumberFrom');
    if (numberInput && !numberInput.dataset.receiptPrintBound) {
        numberInput.dataset.receiptPrintBound = '1';
        numberInput.addEventListener('keydown', event => { if (event.key === 'Enter') submitReceiptPrint(); });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindReceiptPrintEvents, { once: true });
} else {
    bindReceiptPrintEvents();
}
