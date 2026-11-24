'use strict';
window.TEMPLATES_PANELS = window.TEMPLATES_PANELS || {};
window.TEMPLATES_PANELS.contractors = `
    <!-- لوحة المقاولين والمتعهدين -->
    <div id="contractorsPanel" class="hidden space-y-5">
      
      <!-- بطاقة البحث + زر الإضافة -->
      <section class="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm md:p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex-1 min-w-[280px]">
            <label class="block text-sm font-semibold text-slate-300 mb-2">ابحث باسم المقاول أو المجهز</label>
            <div class="flex gap-2">
              <input id="contractorSearch" type="text" list="contractorSearchList" autocomplete="off" placeholder="اكتب الاسم أو اختر من القائمة..." class="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 transition focus:border-emerald-500 focus:outline-none">
              <datalist id="contractorSearchList"></datalist>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button id="addContractorBtn" type="button" class="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:from-emerald-500 hover:to-emerald-400">➕ إضافة مقاول/مجهز</button>
            <button id="addDharaBtn" type="button" class="rounded-xl border border-sky-800 bg-sky-950/60 px-5 py-2.5 text-xs font-bold text-sky-300 transition hover:bg-sky-900">➕ إضافة ذرعة/فاتورة</button>
          </div>
        </div>
        <p class="mt-3 text-xs text-slate-400">رقم الذرعة هو رقم فاتورة المقاول/المجهز، ولا يرتبط برقم وصل الدفع في السجل العام.</p>
        <div class="mt-4 overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-950/40">
          <table class="w-full min-w-[640px] border-collapse text-right text-sm">
            <thead class="bg-slate-900/95 text-slate-300"><tr>
              <th class="px-3 py-2 text-center">اسم المقاول/المجهز</th><th class="px-3 py-2 text-center">نوع العمل</th><th class="px-3 py-2 text-center">العمل</th><th class="px-3 py-2 text-center">الكود</th><th class="px-3 py-2 text-center">إجراءات</th>
            </tr></thead>
            <tbody id="contractorDirectoryBody"><tr><td colspan="5" class="px-3 py-4 text-center text-slate-400">لا توجد أسماء مسجلة</td></tr></tbody>
          </table>
        </div>
      </section>

      <!-- اللوحة المقسومة -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        <!-- العمود الأيمن: جدول الذرعات -->
        <section class="lg:col-span-2 rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm md:p-6">
          <h3 class="text-lg font-bold text-white mb-4">📋 ذرعات المقاول</h3>
          <div class="scroll-thin overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-950/50">
            <table class="w-full min-w-max border-collapse text-right text-sm">
              <thead class="bg-slate-900/95 text-slate-300">
                <tr>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">رقم الذرعة/الفاتورة</th>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">العمل/المادة</th>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">الكمية</th>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">الوحدة</th>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">السعر دينار</th>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">السعر دولار</th>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">السعر الكلي دينار</th>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">السعر الكلي دولار</th>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">تاريخ الذرعة</th>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">مرفق</th>
                  <th class="px-4 py-3 text-center font-semibold border-b border-slate-700/60">إجراءات</th>
                </tr>
              </thead>
              <tbody id="contractorDharaBody" class="divide-y divide-slate-700/60">
                <tr><td colspan="8" class="px-4 py-10 text-center text-slate-400">اختر مقاولاً أو مجهزاً من الأعلى لعرض فواتيره/ذرعاته</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- العمود الأيسر: بطاقات المستلمات + القائمة -->
        <aside class="space-y-4">
          <section class="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
            <h3 class="text-sm font-bold text-slate-300 mb-4">💰 ملخص الحساب</h3>
            <div class="space-y-3">
              <div class="flex justify-between items-baseline">
                <span class="text-xs text-slate-400">مجموع الذرعات</span>
                <span id="contractorTotalDhara" class="text-lg font-extrabold text-i1">—</span>
              </div>
              <div class="flex justify-between items-baseline border-t border-slate-700/60 pt-3">
                <span class="text-xs text-slate-400">مجموع المستلم</span>
                <span id="contractorTotalReceived" class="text-lg font-extrabold text-emerald-400">—</span>
              </div>
              <div class="flex justify-between items-baseline border-t border-slate-700/60 pt-3">
                <span class="text-xs text-slate-400">المتبقي له</span>
                <span id="contractorRemaining" class="text-lg font-extrabold text-amber-400">—</span>
              </div>
            </div>
          </section>

          <section class="rounded-2xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-md backdrop-blur-sm">
            <h3 class="text-sm font-bold text-slate-300 mb-4">📥 الدفعات من السجل العام</h3>
            <div id="contractorReceivedList" class="space-y-2 max-h-80 overflow-y-auto scroll-thin">
              <p class="text-xs text-slate-400 text-center py-4">لا توجد مستلمات بعد</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
`;
