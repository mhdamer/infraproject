'use strict';

if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    const registerServiceWorker = () => {
        navigator.serviceWorker.register('./service-worker.js').then(registration => {
            // التحقق من وجود تحديث جديد
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // هناك تحديث جديد جاهز
                        showUpdateToast(registration);
                    }
                });
            });
        }).catch(error => {
            console.log('Service Worker registration failed:', error);
        });
    };
    if (document.readyState === 'complete') registerServiceWorker();
    else window.addEventListener('load', registerServiceWorker, { once: true });

    // إعادة تحميل الصفحة عندما يسيطر الـ Service Worker الجديد
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload();
        }
    });
}

// دالة إظهار إشعار التحديث
function showUpdateToast(registration) {
    // إنشاء إشعار مخصص
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 z-[999] rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-2xl animate-bounce cursor-pointer';
    toast.innerHTML = '✨ تحديث جديد متوفر! اضغط هنا للتحديث';
    
    toast.addEventListener('click', () => {
        if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
    });

    document.body.appendChild(toast);
}