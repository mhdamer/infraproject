'use strict';

const TEMPLATES_MODALS = {
    modals: `
    <!-- 0. نافذة القوائم (تبويب القوائم) -->
    <div id="listsAddModal" class="fixed inset-0 z-[60] hidden items-center justify-center overflow-hidden bg-slate-950/80 p-4 backdrop-blur-sm">
      <div class="my-auto w-full max-w-lg space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl md:p-8 max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-slate-700/60 pb-4">
            <h3 class="text-xl font-bold text-white">➕ إضافة عنصر للقوائم</h3>
            <button id="closeListsModal" type="button" class="text-2xl text-slate-300 transition hover:text-white">×</button>
        </div>
        <div class="space-y-4">
            <label class="block text-xs font-semibold text-slate-300">نوع القائمة
                <select id="listType" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
                    <option value="مقاولين">مقاولين</option>
                    <option value="متعهدين">متعهدين</option>
                    <option value="شركاء">شركاء</option>
                    <option value="أنواع أعمال">أنواع أعمال</option>
                </select>
            </label>
            <label class="block text-xs font-semibold text-slate-300">القيمة
                <input id="listValue" type="text" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
            </label>
            <div class="grid grid-cols-2 gap-4">
                <label class="block text-xs font-semibold text-slate-300">بادئة (اختياري)
                    <input id="listPrefix" type="text" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
                </label>
                <label class="block text-xs font-semibold text-slate-300">لاحقة (اختياري)
                    <input id="listSuffix" type="text" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none">
                </label>
            </div>
        </div>
        <div class="flex justify-end gap-3 border-t border-slate-700/60 pt-4">
            <button id="cancelListsModal" type="button" class="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">إلغاء</button>
            <button id="saveListsModal" type="button" class="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:from-emerald-500 hover:to-emerald-400">حفظ</button>
        </div>
      </div>
    </div>

    <!-- 1. نافذة الفلترة المتقدمة -->
    <div id="smartFilterModal" class="fixed inset-0 z-50 hidden items-center justify-center overflow-hidden bg-slate-950/80 p-4 backdrop-blur-sm">
      <div class="my-auto w-full max-w-lg space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl md:p-8 max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-slate-700/60 pb-4">
            <h3 class="text-xl font-bold text-white">⚙️ فلترة متقدمة</h3>
            <button id="closeSmartFilter" class="text-2xl text-slate-300 transition hover:text-white">×</button>
        </div>
        <div class="max-h-[60vh] overflow-y-auto pr-2">
            <div id="smartFiltersBody" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>
        </div>
        <div class="flex justify-between items-center border-t border-slate-700/60 pt-4">
            <button id="clearSmartFiltersBtn" class="rounded-xl border border-rose-800 bg-rose-950/50 px-5 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-900 transition">مسح الفلاتر</button>
            <button id="closeSmartFilterBottom" type="button" class="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500">تم</button>
        </div>
      </div>
    </div>

    <!-- 2. نافذة الإعدادات -->
    <div id="settingsModal" class="fixed inset-0 z-50 hidden items-center justify-center overflow-hidden bg-slate-950/80 p-4 backdrop-blur-sm">
      <div class="my-auto w-full max-w-2xl space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl md:p-8 max-h-[92vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-slate-700/60 pb-4"><h3 class="text-xl font-bold text-white">إعدادات ربط Google Sheets</h3><button id="closeSettings" class="text-2xl text-slate-300 transition hover:text-white">×</button></div>
        <div class="rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 text-xs leading-relaxed text-amber-200/90"><b>تنبيه أمني:</b> عنوان API ومعرّف الجدول يظهران في ملف HTML العام.</div>
        <label class="block text-xs font-semibold text-slate-300">رابط Web App / API<input id="apiUrlInput" type="url" dir="ltr" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left text-sm text-white focus:border-emerald-500 focus:outline-none"></label>
        <div class="rounded-xl bg-slate-950 p-4 text-xs text-slate-300 border border-slate-700/60"><div>معرّف جدول البيانات:</div><code id="spreadsheetIdText" dir="ltr" class="mt-1 block break-all text-emerald-400"></code></div>
        <div class="flex justify-end gap-3 pt-2"><button id="cancelSettings" class="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">إلغاء</button><button id="saveSettings" class="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:from-emerald-500 hover:to-emerald-400">حفظ الرابط</button></div>
      </div>
    </div>

    <!-- نافذة طباعة وصولات الصرف -->
    <div id="receiptPrintModal" class="fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
      <div class="my-auto w-full max-w-xl space-y-5 rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl md:p-8">
        <div class="flex items-center justify-between border-b border-slate-700/60 pb-4">
          <h3 class="text-xl font-bold text-white">طباعة وصل صرف</h3>
          <button id="closeReceiptPrint" type="button" aria-label="إغلاق" class="text-2xl text-slate-300 hover:text-white">×</button>
        </div>
        <div class="space-y-4">
          <label class="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200">
            <input type="radio" name="receiptPrintMode" value="single" checked class="accent-emerald-500"><span>طباعة وصل واحد حسب ت (العدد)</span>
          </label>
          <label class="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200">
            <input type="radio" name="receiptPrintMode" value="range" class="accent-emerald-500"><span>طباعة مجموعة وصولات من ت إلى ت</span>
          </label>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="block text-sm font-semibold text-slate-300">من ت (العدد)
              <input id="receiptNumberFrom" type="text" inputmode="numeric" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none">
            </label>
            <label id="receiptToWrap" class="hidden block text-sm font-semibold text-slate-300">إلى ت
              <input id="receiptNumberTo" type="text" inputmode="numeric" class="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none">
            </label>
          </div>
          <p id="receiptPrintMessage" class="hidden rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200"></p>
          <p class="text-xs leading-6 text-slate-400">تُطبع الوصولات المطابقة للأرقام الموجودة في السجل العام، وصل واحد في كل صفحة، على ورق A5 أفقي بخط Calibri.</p>
        </div>
        <div class="flex justify-end gap-3 border-t border-slate-700/60 pt-4">
          <button id="cancelReceiptPrint" type="button" class="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">إلغاء</button>
          <button id="confirmReceiptPrint" type="button" class="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-xs font-bold text-white hover:from-emerald-500 hover:to-emerald-400">عرض للطباعة</button>
        </div>
      </div>
    </div>

    <!-- سلف العمل وأرصدة تصفيتها المشتقة من السجل العام -->
    <div id="projectAdvancesModal" class="fixed inset-0 z-[75] hidden items-center justify-center overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="projectAdvancesTitle">
      <div class="my-auto flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div class="flex items-center justify-between border-b border-slate-700/60 p-4 md:px-6">
          <div><h3 id="projectAdvancesTitle" class="text-lg font-bold text-white">سلف العمل</h3><p class="mt-1 text-xs text-slate-400">تُسجل السلفة في السجل العام وتُخصم منها وصولات التصفية المرتبطة برقم وصلها.</p></div>
          <button id="closeProjectAdvances" type="button" aria-label="إغلاق سجل سلف العمل" class="rounded-lg px-3 py-1 text-2xl text-slate-300 hover:bg-slate-800 hover:text-white">×</button>
        </div>
        <div class="space-y-4 overflow-y-auto p-4 md:p-6">
          <p id="projectAdvancesNotice" class="rounded-xl border border-amber-800/70 bg-amber-950/30 p-3 text-xs leading-6 text-amber-200">تُحفظ أصول سلف العمل ووصولات تصفيتها في «السجل العام»؛ أصل السلفة يُوسم تلقائياً بكلمة «سلفة عمل».</p>
          <div class="grid grid-cols-1 gap-3 rounded-xl border border-slate-700 bg-slate-950/50 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <label class="block text-xs font-semibold text-slate-300">رقم وصل سلفة العمل<input id="projectAdvanceNumber" type="text" inputmode="numeric" class="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"></label>
            <label class="block text-xs font-semibold text-slate-300">مبلغ سلفة العمل<input id="projectAdvanceAmount" type="number" min="0.01" step="any" class="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"></label>
            <label class="block text-xs font-semibold text-slate-300">تفاصيل سلفة العمل<input id="projectAdvanceDetails" type="text" class="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"></label>
            <label class="block text-xs font-semibold text-slate-300">تاريخ سلفة العمل<input id="projectAdvanceDate" type="date" class="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"></label>
            <div class="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-4">
              <button id="saveProjectAdvance" type="button" class="min-h-11 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-500">إضافة سلفة</button>
              <button id="cancelProjectAdvanceEdit" type="button" class="hidden min-h-11 rounded-lg border border-slate-600 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">إلغاء التعديل</button>
              <span id="projectAdvanceFormMessage" class="text-xs text-slate-400"></span>
            </div>
          </div>
          <div class="overflow-x-auto rounded-xl border border-slate-700">
            <table class="min-w-[850px] w-full border-collapse text-right text-sm"><thead class="bg-slate-800 text-slate-200"><tr><th class="p-3">رقم الوصل</th><th class="p-3">مبلغ سلفة العمل</th><th class="p-3">التفاصيل</th><th class="p-3">التاريخ</th><th class="p-3">المصروف</th><th class="p-3">المتبقي</th><th class="p-3">إجراءات</th></tr></thead><tbody id="projectAdvancesBody" class="divide-y divide-slate-700/70"></tbody></table>
          </div>
          <p id="projectAdvancesEmpty" class="hidden py-8 text-center text-sm text-slate-400">لا توجد سلف عمل مسجلة في السجل العام.</p>
        </div>
        <div class="flex justify-end border-t border-slate-700/60 p-4"><button id="doneProjectAdvances" type="button" class="rounded-lg border border-slate-600 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">إغلاق</button></div>
      </div>
    </div>

    <!-- 3. نافذة الإضافة والتعديل -->
    <div id="addModal" class="fixed inset-0 z-50 hidden items-center justify-center overflow-hidden bg-slate-950/80 p-4 backdrop-blur-sm">
      <div class="flex flex-col my-auto w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl max-h-[90dvh]">
        <div class="flex items-center justify-between border-b border-slate-700/60 p-5 md:px-6 md:py-4 shrink-0">
            <h3 id="addTitle" class="text-xl font-bold text-white">إضافة جديد</h3>
            <div class="flex items-center gap-4">
                <button id="minimizeAdd" type="button" class="text-2xl font-bold text-slate-400 hover:text-emerald-400 transition" title="تصغير النافذة للعودة لاحقاً">−</button>
                <button id="closeAdd" class="text-2xl text-slate-300 transition hover:text-white" title="إغلاق وإلغاء">×</button>
            </div>
        </div>
        <div class="flex-1 p-5 md:p-6 space-y-5 overflow-y-auto">
            <div id="addFields" class="grid grid-cols-1 sm:grid-cols-2 gap-4"></div>
            <div id="dupWarn" class="hidden whitespace-pre-line rounded-xl border border-rose-800 bg-rose-950/40 p-4 text-xs leading-relaxed text-rose-300"></div>
            <label class="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <input id="addToSheet" type="checkbox" checked class="h-4 w-4 rounded border-slate-700 accent-emerald-500">
                إرسال السجل إلى Google Sheets أيضاً
            </label>
        </div>
        <div class="border-t border-slate-700/60 p-5 md:px-6 md:py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <button id="printBtns" type="button" class="hidden rounded-xl border border-sky-800 bg-sky-950/60 px-5 py-2.5 text-xs font-bold text-sky-300 hover:bg-sky-900">🖨 طباعة</button>
            <button id="deleteRowBtn" type="button" class="hidden rounded-xl border border-rose-800 bg-rose-950/50 px-5 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-900">🗑 حذف السجل</button>
            <div class="ms-auto flex gap-3">
                <button id="cancelAdd" class="rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700">إلغاء</button>
                <button id="saveAdd" class="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:from-emerald-500 hover:to-emerald-400">حفظ السجل</button>
            </div>
        </div>
      </div>
    </div>

    `
};
