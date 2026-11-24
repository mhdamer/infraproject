'use strict';

/**
 * audit-log.js — سجل تدقيق محلي
 * ★ SHARAEEN: مفتاح جديد + priorities جديدة
 */

const AUDIT_LOG_KEY = 'sharaeen_audit_log_v1';
const AUDIT_LOG_MAX = 200;

const AUDIT_ACTION_LABEL = {
    add: 'إضافة',
    update: 'تعديل',
    delete: 'حذف',
    attach: 'إرفاق PDF',
    detach: 'حذف مرفق',
    sync: 'مزامنة',
    mark: 'تأشير'
};

const AUDIT_STATUS_LABEL = {
    success: '✔',
    failed: '✖'
};

function auditLogLoad() {
    try {
        const raw = localStorage.getItem(AUDIT_LOG_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
}

function auditLogSave(arr) {
    try { localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(arr.slice(0, AUDIT_LOG_MAX))); } catch (e) {}
}

function auditLog(action, sheet, detail, status) {
    if (!action || !sheet) return;
    const entry = {
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        time: Date.now(),
        user: (typeof session !== 'undefined' && session) ? (session.username || '') : '',
        name: (typeof session !== 'undefined' && session) ? (session.name || session.username || '') : '',
        action: String(action),
        sheet: String(sheet),
        detail: String(detail || ''),
        status: String(status || 'success')
    };
    const log = auditLogLoad();
    log.unshift(entry);
    auditLogSave(log);
}

/**
 * ★ SHARAEEN: priorities جديدة
 */
function auditExtractDetail(payload) {
    if (!payload) return '';
    const rec = payload.record || payload.oldRecord || null;
    if (!rec || typeof rec !== 'object') return '';
    const priorities = [
        'اسم المقاول', 'المصدر', 'الشريك', 'الاسم',
        'رقم الوصل', 'رقم الذرعة', 'ت'
    ];
    for (const key of priorities) {
        const v = rec[key];
        if (v !== undefined && v !== null && String(v).trim() !== '') {
            return key + ': ' + String(v).trim().slice(0, 80);
        }
    }
    for (const k of Object.keys(rec)) {
        const v = rec[k];
        if (v === '' || v === null || v === undefined || v === false || v === true) continue;
        return k + ': ' + String(v).slice(0, 60);
    }
    return '';
}

function auditFormatTime(ts) {
    try {
        const d = new Date(ts);
        return d.toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
               d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(ts); }
}

function auditEnsureModal() {
    let modal = document.getElementById('auditModal');
    if (modal && document.body.contains(modal)) return modal;

    modal = document.createElement('div');
    modal.id = 'auditModal';
    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'auditTitle');

    modal.innerHTML = `
      <div class="my-auto w-full max-w-5xl space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl md:p-8">
        <div class="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 id="auditTitle" class="text-xl font-bold text-white">📜 سجل التدقيق</h3>
            <p class="mt-1 text-xs text-slate-400">آخر 200 عملية — من أضاف/عدّل/حذف ومتى (محلي فقط)</p>
          </div>
          <button id="auditClose" type="button" class="text-2xl text-slate-400 transition hover:text-white" aria-label="إغلاق">×</button>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <label class="block text-xs font-semibold text-slate-300">النوع
            <select id="auditFilterAction" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
              <option value="">الكل</option>
              <option value="add">إضافة</option>
              <option value="update">تعديل</option>
              <option value="delete">حذف</option>
              <option value="attach">إرفاق PDF</option>
              <option value="detach">حذف مرفق</option>
              <option value="sync">مزامنة</option>
              <option value="mark">تأشير</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-slate-300">التبويب
            <select id="auditFilterSheet" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
              <option value="">الكل</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-slate-300">بحث
            <input id="auditFilterSearch" type="search" placeholder="اسم أو معرّف..." class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
          </label>
        </div>

        <div class="scroll-thin max-h-[55vh] overflow-auto rounded-xl border border-slate-800 bg-slate-950/50">
          <table class="w-full text-right text-sm">
            <thead class="sticky top-0 z-10 bg-slate-900/90 text-slate-400 backdrop-blur">
              <tr>
                <th class="whitespace-nowrap px-4 py-3 text-center font-semibold border-b border-slate-800">الوقت</th>
                <th class="whitespace-nowrap px-4 py-3 text-center font-semibold border-b border-slate-800">المستخدم</th>
                <th class="whitespace-nowrap px-4 py-3 text-center font-semibold border-b border-slate-800">الإجراء</th>
                <th class="whitespace-nowrap px-4 py-3 text-center font-semibold border-b border-slate-800">التبويب</th>
                <th class="px-4 py-3 text-right font-semibold border-b border-slate-800">التفاصيل</th>
                <th class="whitespace-nowrap px-4 py-3 text-center font-semibold border-b border-slate-800">الحالة</th>
              </tr>
            </thead>
            <tbody id="auditBody" class="divide-y divide-slate-800/80"></tbody>
          </table>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <p id="auditStats" class="text-xs font-medium text-slate-400"></p>
          <div class="flex flex-wrap gap-2">
            <button id="auditExport" type="button" class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700">⭳ تصدير CSV</button>
            <button id="auditClear" type="button" class="rounded-xl border border-rose-800 bg-rose-950/40 px-4 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-900">🗑 مسح السجل</button>
            <button id="auditCloseBottom" type="button" class="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-400">إغلاق</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeEl = modal.querySelector('#auditClose');
    if (closeEl) closeEl.addEventListener('click', () => auditClose());
    const closeBottomEl = modal.querySelector('#auditCloseBottom');
    if (closeBottomEl) closeBottomEl.addEventListener('click', () => auditClose());
    modal.addEventListener('click', e => { if (e.target === modal) auditClose(); });

    ['auditFilterAction', 'auditFilterSheet'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => auditRenderBody());
    });
    const search = document.getElementById('auditFilterSearch');
    if (search) search.addEventListener('input', debounce(() => auditRenderBody(), 200));

    const exp = modal.querySelector('#auditExport');
    if (exp) exp.addEventListener('click', () => auditExportCsv());
    const clr = modal.querySelector('#auditClear');
    if (clr) clr.addEventListener('click', () => {
        if (!confirm('مسح سجل التدقيق بالكامل؟ (لا يؤثر على البيانات)')) return;
        auditLogSave([]);
        auditRenderBody();
        toast('تم مسح سجل التدقيق.');
    });

    return modal;
}

function auditOpen() {
    const modal = auditEnsureModal();
    const sheetSel = document.getElementById('auditFilterSheet');
    if (sheetSel) {
        const log = auditLogLoad();
        const sheets = [...new Set(log.map(e => e.sheet))].sort((a, b) => a.localeCompare(b, 'ar'));
        const prior = sheetSel.value;
        sheetSel.replaceChildren();
        const all = document.createElement('option');
        all.value = '';
        all.textContent = 'الكل';
        sheetSel.appendChild(all);
        sheets.forEach(s => {
            const o = document.createElement('option');
            o.value = s;
            o.textContent = s;
            sheetSel.appendChild(o);
        });
        sheetSel.value = sheets.includes(prior) ? prior : '';
    }
    auditRenderBody();
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function auditClose() {
    const modal = document.getElementById('auditModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function auditRenderBody() {
    const body = document.getElementById('auditBody');
    if (!body) return;
    body.replaceChildren();
    const log = auditLogLoad();
    const faEl = document.getElementById('auditFilterAction');
    const fsEl = document.getElementById('auditFilterSheet');
    const fqEl = document.getElementById('auditFilterSearch');
    const fa = faEl ? faEl.value : '';
    const fs = fsEl ? fsEl.value : '';
    const fq = normalizeText(fqEl ? fqEl.value : '');

    const filtered = log.filter(e => {
        if (fa && e.action !== fa) return false;
        if (fs && e.sheet !== fs) return false;
        if (fq) {
            const blob = normalizeText([e.user, e.name, e.sheet, e.detail].join(' '));
            if (!blob.includes(fq)) return false;
        }
        return true;
    });

    if (!filtered.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.className = 'px-4 py-10 text-center text-sm text-slate-400';
        td.textContent = log.length ? 'لا توجد عمليات تطابق الفلاتر.' : 'السجل فارغ.';
        tr.appendChild(td);
        body.appendChild(tr);
    } else {
        filtered.forEach(e => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-900/80';

            const time = document.createElement('td');
            time.className = 'whitespace-nowrap px-4 py-2 text-center text-xs text-slate-400';
            time.textContent = auditFormatTime(e.time);

            const usr = document.createElement('td');
            usr.className = 'px-4 py-2 text-center text-xs text-slate-200';
            usr.textContent = e.name || e.user || '—';

            const act = document.createElement('td');
            act.className = 'px-4 py-2 text-center';
            const badge = document.createElement('span');
            const colorMap = {
                add: 'bg-emerald-950/60 text-emerald-300 border-emerald-900',
                update: 'bg-sky-950/60 text-sky-300 border-sky-900',
                delete: 'bg-rose-950/60 text-rose-300 border-rose-900',
                attach: 'bg-violet-950/60 text-violet-300 border-violet-900',
                detach: 'bg-orange-950/60 text-orange-300 border-orange-900',
                sync: 'bg-slate-800 text-slate-300 border-slate-700',
                mark: 'bg-amber-950/60 text-amber-300 border-amber-900'
            };
            badge.className = 'inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ' + (colorMap[e.action] || 'bg-slate-800 text-slate-300 border-slate-700');
            badge.textContent = AUDIT_ACTION_LABEL[e.action] || e.action;
            act.appendChild(badge);

            const sh = document.createElement('td');
            sh.className = 'px-4 py-2 text-center text-xs text-slate-300';
            sh.textContent = e.sheet;

            const det = document.createElement('td');
            det.className = 'max-w-[280px] truncate px-4 py-2 text-right text-xs text-slate-200';
            det.title = e.detail || '';
            det.textContent = e.detail || '—';

            const st = document.createElement('td');
            st.className = 'px-4 py-2 text-center';
            st.textContent = AUDIT_STATUS_LABEL[e.status] || e.status;

            tr.append(time, usr, act, sh, det, st);
            body.appendChild(tr);
        });
    }

    const stats = document.getElementById('auditStats');
    if (stats) {
        const total = log.length;
        const shown = filtered.length;
        const addN = log.filter(e => e.action === 'add').length;
        const updN = log.filter(e => e.action === 'update').length;
        const delN = log.filter(e => e.action === 'delete').length;
        stats.textContent = `المعروض: ${shown} من ${total} · إضافة: ${addN} · تعديل: ${updN} · حذف: ${delN}`;
    }
}

function auditExportCsv() {
    const log = auditLogLoad();
    if (!log.length) return toast('السجل فارغ.', 'error');
    const esc = v => {
        let s = String(v ?? '');
        if (/^[=+\-@]/.test(s)) s = "'" + s;
        return '"' + s.replace(/"/g, '""') + '"';
    };
    const lines = ['"الوقت","المستخدم","الإجراء","التبويب","التفاصيل","الحالة"'];
    log.forEach(e => {
        lines.push([
            esc(auditFormatTime(e.time)),
            esc(e.name || e.user || ''),
            esc(AUDIT_ACTION_LABEL[e.action] || e.action),
            esc(e.sheet),
            esc(e.detail || ''),
            esc(AUDIT_STATUS_LABEL[e.status] === '✔' ? 'نجح' : 'فشل')
        ].join(','));
    });
    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'سجل-التدقيق-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('تم تصدير سجل التدقيق.');
}