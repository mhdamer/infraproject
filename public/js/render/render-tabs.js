'use strict';

/**
 * render-tabs.js — يبني القائمة الجانبية من SHEET_ORDER
 * ★ SHARAEEN: 6 تبويبات فقط (بدون DS_TAB, بدوون factory)
 */
const TAB_ICONS = {
    'السجل العام':        '💰',
    'المقاولين والمجهزين': '👷',
    'السلف المستلمة':    '📥',
    'السحب والتمويل':    '💸',
    'خلاصة المشروع':     '📊',
    'المديونية':         '📋',
    'القوائم':           '📑'
};

function renderTabs() {
    const nav = $('sheetTabs'); if (!nav) return;
    nav.replaceChildren();

    SHEET_ORDER.filter(authCanView).forEach(name => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.sheet = name;
        button.className = 'w-full text-right rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 flex items-center gap-2';

        const icon = TAB_ICONS[name] || '📄';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'text-base';
        iconSpan.textContent = icon;

        const labelSpan = document.createElement('span');
        labelSpan.textContent = name;

        button.appendChild(iconSpan);
        button.appendChild(labelSpan);

        const isCurrent = name === activeSheet;
        button.setAttribute('aria-pressed', String(isCurrent));
        if (isCurrent) button.classList.add('tab-active');

        button.addEventListener('click', () => {
            activeSheet = name;
            page = 1;
            sortColumn = -1;
            render();
            if (typeof refreshFromSheets === 'function' && name !== DB) refreshFromSheets();
            if (typeof closeSidebar === 'function') closeSidebar();
        });
        nav.appendChild(button);
    });
}
