'use strict';
let pageErrorShown = false;
window.addEventListener('error', e => {
    if (pageErrorShown) return;
    pageErrorShown = true;
    toast('خطأ في الصفحة: ' + e.message, 'error');
});

authInit(() => {
    fixDates(); render(); saveWorkbook();
    if (typeof refreshFromSheets === 'function' && activeSheet !== DB) refreshFromSheets();
});
