'use strict';

const $ = (id) => document.getElementById(id);
let workbookData = loadInitialWorkbook();

// ★ SHARAEEN: التبويب الافتراضي = السجل العام
let activeSheet = AppConfig.SHEETS.GENERAL_LEDGER;

let currentRows = [];
let page = 1;
let sortColumn = -1;
let sortDirection = 1;
let toastTimer;

let lastWriteAt = 0;
let attBusy = 0;
let apiUrl = loadApiUrl();

let tableSkeletonLoading = false;
let projectAccountingSnapshot = null;