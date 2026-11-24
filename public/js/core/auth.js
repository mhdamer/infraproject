'use strict';

/**
 * auth.js — المصادقة عبر Cloudflare Worker + HttpOnly Cookie
 * v1.1 — حماية العناصر المفقودة قبل حقن القوالب
 */

const SESSION_KEY = 'sharaeen_session_v1';
const REMEMBER_KEY = 'sharaeen_remember_me';
const LOGIN_NAME_KEY = 'sharaeen_login_name';
let session = loadSession();

function loadSession() {
    try {
        const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
        return s && s.username && s.role ? s : null;
    } catch (e) {
        return null;
    }
}

function authToken() { return ''; }
function authIsAdmin() { return !!session; }

function authCanView(name) { return !!session; }

function authFirstSheet() { return AppConfig.SHEETS.GENERAL_LEDGER; }

function authErrorText(msg) {
    const m = String(msg);
    if (m === 'Unauthorized') return 'انتهت الجلسة، سجّل الدخول من جديد.';
    if (m === 'Forbidden') return 'ليست لديك صلاحية لهذه العملية.';
    if (m === 'PasswordChangeRequired') return 'يجب تغيير كلمة المرور المؤقتة أولاً.';
    return m;
}

function authCheckError(msg) {
    if (String(msg) === 'Unauthorized') setTimeout(() => authLogout(true), 1500);
}

function authLogout() {
    fetch('/api/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { localStorage.removeItem(REMEMBER_KEY); } catch (e) {}
    session = null;
    location.reload();
}

function authTokenExpiry() { return 0; }

let sessionWatcherTimer = null;

function authCheckSession() {
    fetch('/api/session', { credentials: 'include' })
        .then(res => {
            if (res.status === 401) {
                authStopWatcher();
                try { saveWorkbook(); } catch (e) {}
                try { toast('انتهت جلستك. حفظنا تعديلاتك محلياً.', 'error'); } catch (e) {}
                setTimeout(() => authLogout(), 800);
            }
        })
        .catch(() => {});
}

function authStartWatcher() {
    authStopWatcher();
    if (!session) return;
    sessionWatcherTimer = setInterval(authCheckSession, 5 * 60 * 1000);
}

function authStopWatcher() {
    if (sessionWatcherTimer) {
        clearInterval(sessionWatcherTimer);
        sessionWatcherTimer = null;
    }
}

function applyPermissions() {
    const admin = authIsAdmin();
    const chip = $('userChip');
    if (chip) {
        chip.classList.remove('hidden');
        chip.classList.add('flex');
        const chipName = $('userChipName');
        if (chipName) {
            const userIcon = `<svg class="w-4 h-4 inline-block align-text-bottom me-1" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clip-rule="evenodd" /></svg>`;
            chipName.replaceChildren();
            const iconWrap = document.createElement('span');
            iconWrap.innerHTML = userIcon;
            chipName.appendChild(iconWrap);
            chipName.appendChild(document.createTextNode(' ' + (session.name || session.username) + (admin ? ' (مدير)' : '')));
        }
    }
    ['settingsButton', 'exportExcel', 'syncSheet', 'auditLogButton', 'exportBackup', 'importBackup'].forEach(id => {
        const el = $(id);
        if (el) el.classList.toggle('hidden', !admin);
    });
    if (!authCanView(activeSheet)) activeSheet = authFirstSheet();
    authStartWatcher();
}

async function authLogin(username, password, rememberMe) {
    let response;
    try {
        response = await fetch('/api/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, rememberMe: !!rememberMe })
        });
    } catch (e) {
        throw new Error('تعذر الاتصال بالخادم.');
    }
    let data;
    try { data = await response.json(); } catch (e) {
        throw new Error('رد غير مفهوم من الخادم.');
    }
    if (response.status === 401 || (data && data.error === 'Invalid credentials'))
        throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
    if (response.status === 429)
        throw new Error('عدد محاولات الدخول كبير. حاول بعد قليل.');
    if (!response.ok || !data || data.error)
        throw new Error((data && data.error) || 'فشل تسجيل الدخول.');
    return data;
}

function showForcedPasswordChange() {
    return new Promise((resolve) => {
        let modal = document.getElementById('forcePwModal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'forcePwModal';
        modal.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-md';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        modal.innerHTML = `
          <div class="w-full max-w-md space-y-5 rounded-2xl border border-rose-800/60 bg-slate-900 p-8 shadow-2xl">
            <div class="border-b border-slate-700/60 pb-4">
              <h3 class="text-lg font-bold text-rose-300">⚠ تغيير كلمة المرور إلزامي</h3>
              <p class="mt-2 text-xs text-slate-300">اختر كلمة مرور جديدة (8 أحرف على الأقل) قبل المتابعة.</p>
            </div>
            <div class="space-y-3">
              <label class="block text-xs font-semibold text-slate-300">كلمة المرور المؤقتة الحالية
                <input id="fpOld" type="password" autocomplete="current-password" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
              </label>
              <label class="block text-xs font-semibold text-slate-300">كلمة المرور الجديدة (8+)
                <input id="fpNew" type="password" autocomplete="new-password" minlength="8" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
              </label>
              <label class="block text-xs font-semibold text-slate-300">تأكيد كلمة المرور
                <input id="fpConfirm" type="password" autocomplete="new-password" minlength="8" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
              </label>
            </div>
            <p id="fpError" class="hidden rounded-lg border border-rose-800 bg-rose-950/50 p-2 text-xs text-rose-300"></p>
            <button id="fpSubmit" type="button" class="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50">تغيير كلمة المرور والمتابعة</button>
          </div>
        `;
        document.body.appendChild(modal);

        const oldEl = modal.querySelector('#fpOld');
        const newEl = modal.querySelector('#fpNew');
        const confEl = modal.querySelector('#fpConfirm');
        const errEl = modal.querySelector('#fpError');
        const btn = modal.querySelector('#fpSubmit');
        const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };

        btn.addEventListener('click', async () => {
            errEl.classList.add('hidden');
            const oldPw = oldEl.value;
            const newPw = newEl.value;
            if (!oldPw || !newPw) return showErr('أدخل كلمتي المرور.');
            if (newPw.length < 8) return showErr('كلمة المرور الجديدة 8 أحرف على الأقل.');
            if (newPw !== confEl.value) return showErr('كلمتا المرور غير متطابقتين.');
            if (newPw === oldPw) return showErr('اختر كلمة مرور مختلفة.');

            btn.disabled = true;
            btn.textContent = 'جارٍ التغيير...';
            try {
                const res = await fetch('/api/change-password', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw })
                });
                const data = await res.json();
                if (!res.ok || data.error) throw new Error(authErrorText(data.error || 'فشل'));
                toast('تم تغيير كلمة المرور.');
                modal.remove();
                resolve();
            } catch (err) {
                showErr(err.message || 'فشل تغيير كلمة المرور.');
                btn.disabled = false;
                btn.textContent = 'تغيير كلمة المرور والمتابعة';
            }
        });

        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') e.preventDefault();
        });
        oldEl.focus();
    });
}

async function authInit(start) {
    const screen = $('loginScreen');
    const finish = () => {
        screen.classList.add('hidden');
        screen.classList.remove('flex');
        applyPermissions();
        start();
    };
    const logoutBtn = $('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => { authStopWatcher(); authLogout(); });

    try {
        const savedName = localStorage.getItem(LOGIN_NAME_KEY);
        const userInput = $('loginUser');
        if (savedName && userInput && !userInput.value) userInput.value = savedName;
    } catch (e) {}

    let shouldAutoLogin = false;
    try { shouldAutoLogin = localStorage.getItem(REMEMBER_KEY) === '1'; } catch (e) {}

    if (shouldAutoLogin) {
        try {
            const res = await fetch('/api/session', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                session = {
                    username: data.username,
                    role: data.role,
                    name: data.name,
                    tabs: data.tabs || [],
                    mustChangePassword: !!data.mustChangePassword
                };
                if (session.mustChangePassword) {
                    await showForcedPasswordChange();
                    session.mustChangePassword = false;
                }
                try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
                finish();
                return;
            }
        } catch (e) {}
        try { localStorage.removeItem(REMEMBER_KEY); } catch (e) {}
    }

    const err = $('loginError');
    const btn = $('loginBtn');
    const submit = async () => {
        const u = $('loginUser').value.trim();
        const p = $('loginPass').value;
        const remember = $('loginRemember') ? $('loginRemember').checked : false;
        if (!u || !p) { err.textContent = 'أدخل اسم المستخدم وكلمة المرور.'; err.classList.remove('hidden'); return; }
        btn.disabled = true; btn.textContent = 'جارٍ التحقق...'; err.classList.add('hidden');
        try {
            const d = await authLogin(u, p, remember);
            session = {
                username: d.username,
                role: d.role,
                name: d.name,
                tabs: d.tabs || [],
                mustChangePassword: !!d.mustChangePassword
            };
            $('loginPass').value = '';

            try { localStorage.setItem(LOGIN_NAME_KEY, d.username || u); } catch (e) {}
            try {
                if (remember) localStorage.setItem(REMEMBER_KEY, '1');
                else localStorage.removeItem(REMEMBER_KEY);
            } catch (e) {}

            if (session.mustChangePassword) {
                await showForcedPasswordChange();
                session.mustChangePassword = false;
            }
            try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
            finish();
        } catch (error) {
            err.textContent = error.message || 'فشل تسجيل الدخول.';
            err.classList.remove('hidden');
        } finally {
            btn.disabled = false; btn.textContent = 'دخول';
        }
    };
    btn.addEventListener('click', submit);
    ['loginUser', 'loginPass'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') submit(); }));
    $('loginUser').focus();
}

