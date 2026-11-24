'use strict';

document.getElementById('loginContainer').innerHTML = TEMPLATES_CORE.loginScreen;
document.getElementById('mainHeader').innerHTML = TEMPLATES_CORE.header;
document.getElementById('metricsContainer').innerHTML = TEMPLATES_CORE.metrics;
document.getElementById('genericCardContainer').innerHTML = TEMPLATES_CORE.genericCard;

document.getElementById('panelsContainer').innerHTML =
    (window.TEMPLATES_PANELS.contractors || '') +
    (window.TEMPLATES_PANELS.summary || '');

document.getElementById('modalsContainer').innerHTML = TEMPLATES_MODALS.modals;