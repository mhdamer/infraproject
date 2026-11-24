import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './tailwind.css';

const LEGACY_SCRIPTS = [
  'js/core/config.js',
  'js/core/storage.js',
  'js/core/state.js',
  'js/core/utils.js',
  'js/templates/templates-core.js',
  'js/templates/templates-panel-contractors.js',
  'js/templates/templates-panel-summary.js',
  'js/templates/templates-modals.js',
  'js/templates/inject-templates.js',
  'js/render/render-main.js',
  'js/render/render-tabs.js',
  'js/render/render-table.js',
  'js/render/render-metrics.js',
  'js/render/render-panels.js',
  'js/modules/row-editor.js',
  'js/modules/general-ledger.js',
  'js/modules/contractors.js',
  'js/modules/advances.js',
  'js/modules/withdrawals.js',
  'js/modules/summary.js',
  'js/modules/debts.js',
  'js/features/ui-icons.js',
  'js/features/smart-filters.js',
  'js/features/audit-log.js',
  'js/features/excel-io.js',
  'js/features/print.js',
  'js/features/attachments.js',
  'js/core/api.js',
  'js/core/auth.js',
  'js/modules/project-advances.js',
  'js/core/ui-events.js',
  'js/core/main.js',
  'js/core/pwa.js'
];

function loadLegacyScripts() {
  return LEGACY_SCRIPTS.reduce((loaded, path) => loaded.then(() => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}${path}`;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`تعذر تحميل مكوّن التطبيق: ${path}`));
    document.body.appendChild(script);
  })), Promise.resolve());
}

function AppShell() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLegacyScripts()
      .then(() => setLoading(false))
      .catch((loadError) => {
        setError(loadError.message);
        setLoading(false);
      });
  }, []);

  return (
    <>
      {loading && (
        <div className="fixed bottom-6 right-6 z-[90] rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200" role="status">
          جارٍ تحميل التطبيق...
        </div>
      )}
      {error && (
        <div className="fixed bottom-6 right-6 z-[90] max-w-lg rounded-xl border border-rose-800 bg-rose-950 px-4 py-3 text-sm text-rose-200" role="alert">
          {error} أعد تحميل الصفحة للمحاولة مجددًا.
        </div>
      )}
      <div id="loginContainer" />
      <div id="sidebarBackdrop" className="fixed inset-0 z-40 hidden bg-slate-950/80 backdrop-blur-sm transition-opacity" />
      <aside id="sidebar" className="fixed inset-y-0 right-0 z-50 w-72 translate-x-full transform border-l border-slate-700/60 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl transition-transform duration-300 ease-in-out">
        <div className="mb-6 flex items-center justify-between border-b border-slate-700/60 pb-4">
          <div className="flex items-center gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-600 text-white">⌂</div><span className="text-lg font-bold text-slate-100">الأقسام</span></div>
          <button id="closeSidebarBtn" className="rounded-lg p-1 text-xl text-slate-300 transition hover:bg-slate-800 hover:text-white">✕</button>
        </div>
        <nav id="sheetTabs" className="scroll-thin flex h-[calc(100vh-100px)] flex-col gap-1.5 overflow-y-auto pb-10" />
      </aside>
      <header id="mainHeader" className="sticky top-0 z-30 border-b border-slate-700/60 bg-slate-950/80 px-4 py-3 backdrop-blur-xl md:px-8" />
      <main className="mx-auto max-w-[1800px] space-y-6 px-4 py-8 md:px-8">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-300"><span>لوحة التحكم</span><span className="text-slate-500">/</span><span id="activeTitle" className="text-emerald-400" /></div></div>
        </section>
        <div id="metricsContainer" />
        <div id="panelsContainer" />
        <div id="genericCardContainer" />
      </main>
      <div id="modalsContainer" />
      <input id="attInput" type="file" accept="application/pdf,.pdf" className="sr-only" />
      <div id="offlineBanner" className="fixed bottom-0 left-0 right-0 z-[70] hidden bg-rose-600/90 py-3 text-center text-sm font-bold text-white backdrop-blur-sm">⚠️ أنت غير متصل.</div>
      <div id="toast" className="fixed bottom-6 left-6 z-[80] hidden max-w-[calc(100vw-3rem)] rounded-xl border border-slate-700 bg-slate-800/95 px-5 py-4 text-sm font-bold text-white shadow-2xl backdrop-blur-md" role="status" />
    </>
  );
}

createRoot(document.getElementById('root')).render(<AppShell />);
