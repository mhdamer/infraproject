'use strict';
window.TEMPLATES_PANELS = window.TEMPLATES_PANELS || {};
window.TEMPLATES_PANELS.summary = `
    <!-- لوحة خلاصة المشروع (Dashboard) -->
    <div id="summaryPanel" class="hidden space-y-5">
      
      <!-- مؤشرات مالية للمشروع -->
      <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
          <p class="text-sm font-semibold text-slate-300">إجمالي المصروفات</p>
          <p id="summaryExpenses" class="mt-2.5 text-3xl font-extrabold tracking-tight text-i1">—</p>
        </article>
        <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
          <p class="text-sm font-semibold text-slate-300">ربح / (خسارة) المشروع</p>
          <p id="summaryProjectResult" class="mt-2.5 text-3xl font-extrabold tracking-tight text-emerald-400">—</p>
        </article>
        <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
          <p class="text-sm font-semibold text-slate-300">إجمالي السلف</p>
          <p id="summaryAdvances" class="mt-2.5 text-3xl font-extrabold tracking-tight text-i2">—</p>
        </article>
        <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
          <p class="text-sm font-semibold text-slate-300">إجمالي السحب</p>
          <p id="summaryWithdrawals" class="mt-2.5 text-3xl font-extrabold tracking-tight text-rose-400">—</p>
        </article>
        <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
          <p class="text-sm font-semibold text-slate-300">إجمالي التمويل</p>
          <p id="summaryFunding" class="mt-2.5 text-3xl font-extrabold tracking-tight text-emerald-400">—</p>
        </article>
        <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
          <p class="text-sm font-semibold text-slate-300">الرصيد الحالي</p>
          <p id="summaryBalance" class="mt-2.5 text-3xl font-extrabold tracking-tight text-i4">—</p>
        </article>
        <article class="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
          <p class="text-sm font-semibold text-slate-300">إجمالي المديونية</p>
          <p id="summaryDebts" class="mt-2.5 text-3xl font-extrabold tracking-tight text-amber-400">—</p>
        </article>
      </section>

      <!-- 3 رسوم بيانية -->
      <section class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
          <h3 class="mb-4 text-sm font-bold text-slate-300">توزيع المصروفات حسب الموقع</h3>
          <div class="relative h-72 w-full"><canvas id="chartExpensesPie"></canvas></div>
        </article>
        <article class="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
          <h3 class="mb-4 text-sm font-bold text-slate-300">المصروف مقابل التمويل (شهرياً)</h3>
          <div class="relative h-72 w-full"><canvas id="chartMonthlyBar"></canvas></div>
        </article>
      </section>
      <section class="grid gap-4 xl:grid-cols-1">
        <article class="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
          <h3 class="mb-4 text-sm font-bold text-slate-300">الرصيد التراكمي شهرياً</h3>
          <div class="relative h-72 w-full"><canvas id="chartBalanceLine"></canvas></div>
        </article>
      </section>

      <!-- جدول الحصص -->
      <section class="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm md:p-6">
        <h3 class="text-lg font-bold text-white mb-4">📊 خلاصة حصص الشركاء</h3>
        <div class="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-950/50">
          <table class="w-full min-w-max border-collapse text-right text-sm">
            <thead class="bg-slate-900/95 text-slate-300">
              <tr>
                <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">الشريك</th>
                <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">النسبة</th>
                <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">التمويل</th>
                <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">السحب</th>
                <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">فرق التمويل عن السحب</th>
                <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">حصة الشريك بالمشروع</th>
                <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">المستحق له / عليه</th>
              </tr>
            </thead>
            <tbody id="summarySharesBody" class="divide-y divide-slate-700/60">
              <tr><td colspan="7" class="px-4 py-8 text-center text-slate-400">لا توجد بيانات</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
`;
