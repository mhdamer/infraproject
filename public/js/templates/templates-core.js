'use strict';

const TEMPLATES_CORE = {
    // 1. شاشة تسجيل الدخول
    loginScreen: `
      <div id="loginScreen" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
        <div class="w-full max-w-sm space-y-6 rounded-2xl border border-slate-700/60 bg-slate-900/80 p-8 shadow-2xl shadow-black/50">
          <div class="text-center">
            <div class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-3xl text-white shadow-lg shadow-emerald-900/50">⌂</div>
            <h2 class="mt-4 text-2xl font-extrabold tracking-tight text-white">مشروع الشارعين</h2>
            <p class="mt-1 text-sm text-slate-300">سجّل الدخول للمتابعة</p>
          </div>
          <div class="space-y-4">
            <label class="block text-sm font-semibold text-slate-300">اسم المستخدم
              <input id="loginUser" type="text" autocomplete="username" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none">
            </label>
            <label class="block text-sm font-semibold text-slate-300">كلمة المرور
              <input id="loginPass" type="password" autocomplete="current-password" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none">
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-300">
              <input id="loginRemember" type="checkbox" class="h-4 w-4 rounded border-slate-700 accent-emerald-500 cursor-pointer">
              <span>تذكرني</span>
            </label>
          </div>
          <p id="loginError" class="hidden rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-center text-sm font-medium text-rose-300"></p>
          <button id="loginBtn" type="button" class="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:from-emerald-500 hover:to-emerald-400">دخول</button>
        </div>
      </div>
    `,

    // 2. الترويسة العلوية
    header: `
      <div class="mx-auto flex max-w-[1800px] flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div class="flex items-center gap-4">
          <button id="toggleSidebarBtn" class="rounded-xl border border-slate-700/60 bg-slate-900 p-2.5 text-slate-300 shadow-sm transition hover:bg-slate-800" title="القائمة">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>
          <div>
            <h1 class="text-lg font-extrabold text-white tracking-tight">مشروع الشارعين</h1>
            <p class="text-xs font-medium text-slate-300 hidden sm:block">لوحة التحكم المالية والحسابات</p>
          </div>
        </div>
        <div id="themeControls" class="flex flex-wrap items-center gap-2">
          <div id="notesWrap" class="relative hidden">
            <button id="notesBtn" class="relative rounded-xl border border-slate-700/60 bg-slate-900 p-2.5 text-slate-300 shadow-sm transition hover:bg-slate-800" title="الملاحظات">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
              <span id="notesBadge" class="absolute -top-1.5 -right-1.5 hidden flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-950"></span>
            </button>
            <div id="notesMenu" class="scroll-thin absolute left-0 top-full z-50 mt-2 hidden max-h-[80vh] w-80 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
              <div class="sticky top-0 z-10 border-b border-slate-700/60 bg-slate-900/95 p-4 backdrop-blur">
                  <div class="text-sm font-bold text-white mb-3">الملاحظات</div>
                  <div class="flex gap-2">
                      <input id="newNoteInput" type="text" placeholder="اكتب ملاحظة..." class="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none">
                      <button id="addNoteBtn" class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500">إضافة</button>
                  </div>
              </div>
              <div id="notesList" class="flex-1 overflow-y-auto"></div>
            </div>
          </div>
          <div id="notifWrap" class="relative hidden">
            <button id="notifBtn" class="relative rounded-xl border border-slate-700/60 bg-slate-900 p-2.5 text-slate-300 shadow-sm transition hover:bg-slate-800" title="الإشعارات">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              <span id="notifBadge" class="absolute -top-1.5 -right-1.5 hidden flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-slate-950"></span>
            </button>
            <div id="notifMenu" class="scroll-thin absolute left-0 top-full z-50 mt-2 hidden max-h-[80vh] w-80 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
              <div class="sticky top-0 z-10 border-b border-slate-700/60 bg-slate-900/95 p-4 text-sm font-bold text-white backdrop-blur">إشعارات التدقيق</div>
              <div id="notifList" class="flex-1 overflow-y-auto"></div>
            </div>
          </div>
          <div class="h-8 w-px bg-slate-700 mx-1 hidden sm:block"></div>
          <span id="userChip" class="hidden items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 shadow-sm">
            <span id="userChipName"></span>
            <button id="logoutBtn" type="button" class="text-rose-400 hover:text-rose-300">خروج</button>
          </span>

          <div id="gearWrap" class="relative">
            <button id="gearButton" type="button" aria-haspopup="true" aria-expanded="false" class="rounded-xl border border-slate-700/60 bg-slate-900 px-3 py-2 text-base leading-none text-slate-300 shadow-sm transition hover:bg-slate-800">⚙</button>
            <div id="gearMenu" class="absolute left-0 top-full z-50 mt-2 hidden w-64 space-y-2 rounded-2xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
              <span id="localStatus" class="block px-2 text-xs font-medium text-slate-300">البيانات مباشرة من Google Sheets</span>
              <div class="h-px bg-slate-700 my-1"></div>
              <button id="refreshSheet" type="button" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">جلب من Google Sheets</button>
              <button id="syncSheet" type="button" class="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500">مزامنة التبويب</button>
              <button id="settingsButton" type="button" class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">إعدادات الربط</button>
              <div class="h-px bg-slate-700 my-1"></div>
              <button id="auditLogButton" type="button" class="hidden w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">📜 سجل التدقيق</button>
              <button id="exportBackup" type="button" class="hidden w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700">⭳ نسخة احتياطية كاملة</button>
              <label id="importBackup" class="hidden block cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-xs font-semibold text-slate-200 hover:bg-slate-700">⭱ استيراد نسخة احتياطية<input id="backupInput" type="file" accept=".json,application/json" class="sr-only"></label>
            </div>
          </div>
        </div>
      </div>
    `,

    // 3. المؤشرات المالية — 4 بطاقات فقط
    metrics: `
      <div id="mainMetrics">
        <p id="metricsScope" class="-mb-1 text-xs font-medium text-slate-300"></p>
        <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="المؤشرات المالية">
          <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-6 shadow-md backdrop-blur-sm transition-all hover:-translate-y-1">
            <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-rose-500/5 blur-2xl transition group-hover:bg-rose-500/10"></div>
            <p class="text-sm font-semibold text-slate-300">إجمالي المصروفات</p>
            <p id="metricExpenses" class="mt-3 text-3xl font-extrabold tracking-tight text-i1">—</p>
            <p class="mt-1 text-xs font-medium text-slate-400">مجموع «صرف» في السجل العام</p>
          </article>
          <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-6 shadow-md backdrop-blur-sm transition-all hover:-translate-y-1">
            <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-sky-500/5 blur-2xl transition group-hover:bg-sky-500/10"></div>
            <p class="text-sm font-semibold text-slate-300">إجمالي السلف</p>
            <p id="metricAdvances" class="mt-3 text-3xl font-extrabold tracking-tight text-i2">—</p>
            <p class="mt-1 text-xs font-medium text-slate-400">مجموع «السلف المستلمة»</p>
          </article>
          <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-6 shadow-md backdrop-blur-sm transition-all hover:-translate-y-1">
            <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-500/5 blur-2xl transition group-hover:bg-amber-500/10"></div>
            <p class="text-sm font-semibold text-slate-300">إجمالي التمويل</p>
            <p id="metricFunding" class="mt-3 text-3xl font-extrabold tracking-tight text-i3">—</p>
            <p class="mt-1 text-xs font-medium text-slate-400">مجموع «تمويل» في السحب والتمويل</p>
          </article>
          <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-6 shadow-md backdrop-blur-sm transition-all hover:-translate-y-1">
            <div class="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/5 blur-2xl transition group-hover:bg-emerald-500/10"></div>
            <p class="text-sm font-semibold text-slate-300">الرصيد الحالي</p>
            <p id="metricBalance" class="mt-3 text-3xl font-extrabold tracking-tight text-i4">—</p>
            <p class="mt-1 text-xs font-medium text-slate-400">التمويل − (المصروف + السلف + السحب)</p>
          </article>
        </section>
      </div>
    `,

    // 4. الجدول العام
    genericCard: `
    <section id="genericCard" class="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm md:p-6">
      <div class="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div><h3 id="tableTitle" class="text-lg font-bold text-white">سجل الحسابات</h3><p id="sheetDescription" class="mt-1 text-sm font-medium text-slate-300"></p></div>
        <div class="flex flex-wrap gap-2">
          <div id="withdrawalPartnerPicker" class="hidden items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 p-1">
            <span class="px-2 text-xs font-semibold text-slate-400">الشريك:</span>
            <button id="wdPartnerMohamed" type="button" data-wd-partner="محمد اللامي" class="rounded-lg border border-transparent px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">محمد اللامي</button>
            <button id="wdPartnerAhmed" type="button" data-wd-partner="أحمد شاكر" class="rounded-lg border border-transparent px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-slate-800">أحمد شاكر</button>
            <span id="withdrawalProjectShare" class="me-2 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-200" aria-live="polite">حصة الشريك بالمشروع: —</span>
          </div>
          <div id="colMenuWrap" class="relative hidden">
            <button id="colMenuBtn" type="button" aria-haspopup="true" aria-expanded="false" class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700">☰ الأعمدة</button>
            <div id="colMenu" class="scroll-thin absolute left-0 z-30 mt-2 hidden max-h-80 w-64 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-3 text-right shadow-2xl">
              <div class="mb-3 flex items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
                <span class="text-xs font-bold text-slate-200">إظهار / إخفاء الأعمدة</span>
                <button id="colShowAll" type="button" class="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-emerald-400 transition hover:bg-slate-700">إظهار الكل</button>
              </div>
              <div id="colMenuList" class="space-y-1.5"></div>
            </div>
          </div>
          <button id="addRow" class="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-400">+ إضافة جديد</button>
          <button id="printReceiptsBtn" type="button" class="hidden rounded-xl border border-sky-800 bg-sky-950/60 px-4 py-2 text-xs font-bold text-sky-300 transition hover:bg-sky-900">🖨 طباعة وصل صرف</button>
          <button id="projectAdvancesBtn" type="button" class="hidden rounded-xl border border-amber-700 bg-amber-950/50 px-4 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-900" aria-label="فتح سجل سلف العمل من السجل العام">سلف العمل</button>
          <label class="cursor-pointer rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700">استيراد ملف Excel<input id="excelInput" type="file" accept=".xlsx,.xls,.csv" class="sr-only"></label>
          <button id="exportExcel" class="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700">تصدير Excel</button>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(180px,230px)_minmax(180px,230px)_auto] gap-3">
        <div class="flex gap-2">
            <label class="relative flex-1"><span class="sr-only">البحث</span><span class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span><input id="searchInput" type="search" placeholder="ابحث في جميع أعمدة التبويب..." class="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pe-10 ps-4 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-emerald-500 focus:outline-none"></label>
            <button id="smartFilterBtn" type="button" class="rounded-xl border border-emerald-700 bg-emerald-950/40 px-4 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-900/60" title="فلترة متقدمة">⚙️ فلترة</button>
        </div>
        <select id="contractorFilter" class="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-emerald-500 focus:outline-none"><option value="">كل الأسماء</option></select>
        <select id="unitFilter" class="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 transition focus:border-emerald-500 focus:outline-none"><option value="">كل الأنواع</option></select>
        <label class="flex items-center gap-2 text-xs font-semibold text-slate-300">صفوف الصفحة<select id="pageSize" class="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 transition focus:border-emerald-500 focus:outline-none"><option value="10">10</option><option value="20">20</option><option value="50" selected>50</option></select></label>
      </div>

      <div id="tableWrap" class="scroll-thin mt-5 overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-950/50 relative">
        <table id="dataTable" class="w-full min-w-max border-collapse text-right text-sm">
          <thead id="tableHead" class="sticky top-0 z-10 bg-slate-900/95 text-slate-300 backdrop-blur"></thead>
          <tbody id="tableBody" class="divide-y divide-slate-700/60"></tbody>
        </table>
        <div id="emptyState" class="hidden px-6 py-16 text-center"><div class="text-4xl">▤</div><p class="mt-4 text-lg font-bold text-slate-200">لا توجد سجلات في هذا التبويب</p><p id="emptyHint" class="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-400"></p></div>
      </div>

      <div id="pagerBar" class="mt-4 flex flex-col justify-between gap-4 text-sm font-medium text-slate-300 sm:flex-row sm:items-center">
        <span id="tableInfo">—</span>
        <div class="flex items-center gap-3">
          <button id="prevPage" class="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50">السابق</button>
          <span id="pageInfo" class="min-w-16 text-center text-slate-200">—</span>
          <button id="nextPage" class="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50">التالي</button>
        </div>
      </div>
    </section>
    `
};
