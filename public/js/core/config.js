'use strict';
/**
 * config.js — إعدادات مشروع الشارعين
 * v1.1 — مطابق لمصنف مشروع الشارعين المرفق، بست أوراق فعلية.
 */
const AppConfig = {
    API_URL: 'https://shareen.aameralmnjjed93.workers.dev/api',
    SPREADSHEET_ID: '1HjRIfUlIAneVm0jZpEqAhopOApqZIhc76zrhW4sfZ_I',
    SHEETS: {
        GENERAL_LEDGER: 'السجل العام',
        CONTRACTORS:    'المقاولين والمجهزين',
        ADVANCES:       'السلف المستلمة',
        WITHDRAWALS:    'السحب والتمويل',
        SUMMARY:        'خلاصة المشروع',
        DEBTS:          'المديونية'
    },
    READONLY_SHEETS: ['خلاصة المشروع', 'المديونية'],

    // 🔌 تقرير خارجي — معطّل (تبويب مخفي)
    FACTORY_REPORT_SHEET: '',
    FACTORY_REPORT_URL: '',
    FACTORY_REPORT_TAB_NAME: 'تقرير المعمل',

    // ✅ أزرار "جلب من Sheets" و"مزامنة" مفعّلة
    ALLOW_MANUAL_SYNC: true
};

// ✅ لا يوجد مصنف مضمّن — نعتمد على Google Sheets فقط
const EMBEDDED_WORKBOOK = {};

const STORAGE_KEY = 'sharaeen_workbook_v1';

// أوراق العمل والاستيراد: أربع قابلة للتحرير، والمديونية مشتقة للعرض فقط.
const ALL_SHEETS = [
    AppConfig.SHEETS.GENERAL_LEDGER,
    AppConfig.SHEETS.CONTRACTORS,
    AppConfig.SHEETS.ADVANCES,
    AppConfig.SHEETS.WITHDRAWALS,
    AppConfig.SHEETS.DEBTS
];

// ترتيب التبويبات في القائمة الجانبية (6 — مع خلاصة المشروع)
const SHEET_ORDER = [
    AppConfig.SHEETS.GENERAL_LEDGER,
    AppConfig.SHEETS.CONTRACTORS,
    AppConfig.SHEETS.ADVANCES,
    AppConfig.SHEETS.WITHDRAWALS,
    AppConfig.SHEETS.SUMMARY,
    AppConfig.SHEETS.DEBTS
];

// ثوابت اختصارات
const CT  = AppConfig.SHEETS.CONTRACTORS;
const ADV = AppConfig.SHEETS.ADVANCES;
const WD  = AppConfig.SHEETS.WITHDRAWALS;
const GL  = AppConfig.SHEETS.GENERAL_LEDGER;
const DB  = AppConfig.SHEETS.DEBTS;
const SM  = AppConfig.SHEETS.SUMMARY;
