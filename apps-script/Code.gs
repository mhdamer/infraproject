// ============================================================
// Apps Script — خادم مشروع الشارعين (نسخة 1.1)
// إصلاحات: sync يحترم صفوف الإجمالي + ترقيم ت من جهة الخادم
// ============================================================
const SPREADSHEET_ID = '1HjRIfUlIAneVm0jZpEqAhopOApqZIhc76zrhW4sfZ_I';
const ATT_HEADER = 'مرفق';
const ATT_FOLDER_NAME = 'مرفقات مشروع الشارعين';

// ===== المستخدمون والصلاحيات =====
const TOKEN_TTL_MS = 14 * 24 * 3600 * 1000;

function secret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('AUTH_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('AUTH_SECRET', s); }
  return s;
}
function sign_(txt) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(txt, secret_()));
}
function hashPw_(salt, pw) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw + '|' + secret_()));
}

function getUsers_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('USERS');
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  const adminEmail = props.getProperty('ADMIN_EMAIL') || (Session.getActiveUser && Session.getActiveUser().getEmail()) || '';
  const randomPw = Utilities.getUuid().slice(0, 12) + '!Aa1';
  const salt = Utilities.getUuid();
  const users = {
    admin: { role: 'admin', name: 'المدير', salt: salt, hash: hashPw_(salt, randomPw), tabs: [], email: adminEmail, mustChangePassword: true }
  };
  props.setProperty('USERS', JSON.stringify(users));
  if (adminEmail) {
    try {
      MailApp.sendEmail({ to: adminEmail, subject: 'كلمة مرور مدير مشروع الشارعين', htmlBody: '<p>كلمة المرور المؤقتة: <b>' + randomPw + '</b></p>' });
    } catch (e) { props.setProperty('ADMIN_PW_FALLBACK', randomPw); }
  } else { props.setProperty('ADMIN_PW_FALLBACK', randomPw); }
  return users;
}

function setUsers_(users) { PropertiesService.getScriptProperties().setProperty('USERS', JSON.stringify(users)); }
function normUser_(s) { return String(s || '').trim().toLowerCase(); }
function primaryUsername_() {
  const users=getUsers_(), keys=Object.keys(users);
  return keys.find(k=>users[k].role==='admin') || keys[0] || '';
}

function makeToken_(username) {
  const body = Utilities.base64EncodeWebSafe(username + '|' + (Date.now() + TOKEN_TTL_MS));
  return body + '.' + sign_(body);
}

function authUser_(token) {
  try {
    if (!token) return null;
    const parts = String(token).split('.');
    if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) return null;
    const dec = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString().split('|');
    if (Number(dec[1]) < Date.now()) return null;
    if (dec[0] !== primaryUsername_()) return null;
    const u = getUsers_()[dec[0]];
    if (!u) return null;
    return { username: dec[0], role: u.role, name: u.name || dec[0], tabs: u.tabs || [] };
  } catch (e) { return null; }
}

function loginOut_(p) {
  const cache = CacheService.getScriptCache();
  const username = normUser_(p.username);
  if (username !== primaryUsername_()) return { error: 'Invalid credentials' };
  const attemptsKey = 'login_attempts_' + username;
  const attempts = Number(cache.get(attemptsKey) || 0);
  if (attempts >= 5) return { error: 'تم حظر المحاولات مؤقتاً لمدة 15 دقيقة.' };
  const u = getUsers_()[username];
  if (!u || u.hash !== hashPw_(u.salt, String(p.password || ''))) {
    cache.put(attemptsKey, attempts + 1, 900);
    Utilities.sleep(800);
    return { error: 'Invalid credentials' };
  }
  cache.remove(attemptsKey);
  return {
    status: 'success', action: 'login', token: makeToken_(username),
    role: u.role, username: username, name: u.name || username,
    tabs: u.tabs || [], mustChangePassword: !!u.mustChangePassword
  };
}

function sheetAllowed_(user, name) { return !!user; }


function changePassword_(p, me) {
  if (!me) return { error: 'Unauthorized' };
  const users = getUsers_();
  const u = users[me.username];
  if (!u) return { error: 'User not found' };
  if (u.hash !== hashPw_(u.salt, String(p.oldPassword || ''))) return { error: 'Invalid credentials' };
  const np = String(p.newPassword || '');
  if (np.length < 8) return { error: 'كلمة المرور الجديدة 8 أحرف على الأقل.' };
  if (np === String(p.oldPassword || '')) return { error: 'كلمة المرور الجديدة يجب أن تختلف عن القديمة.' };
  u.salt = Utilities.getUuid();
  u.hash = hashPw_(u.salt, np);
  u.mustChangePassword = false;
  users[me.username] = u;
  setUsers_(users);
  return { status: 'success', action: 'change_password' };
}

function ss_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function attRoot_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ATT_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const it = DriveApp.getFoldersByName(ATT_FOLDER_NAME);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(ATT_FOLDER_NAME);
  props.setProperty('ATT_FOLDER_ID', f.getId());
  return f;
}
function attFolder_(sheetName) {
  const root = attRoot_();
  const name = String(sheetName || '').trim().replace(/[\\/]/g, '-');
  if (!name) return root;
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}
function fileIdFromUrl_(u) { const m = String(u || '').match(/[-\w]{25,}/); return m ? m[0] : ''; }
function trashByUrl_(u) {
  const id = fileIdFromUrl_(u);
  if (!id) return;
  try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
}

function serveAttachment(p, user) {
  try {
    if (!p.fileId || !/^[-\w]{25,}$/.test(String(p.fileId))) return { error: 'معرف الملف (fileId) غير صالح.' };
    const file = DriveApp.getFileById(p.fileId);
    const blob = file.getBlob();
    return { status: 'success', mime: 'application/pdf', fileName: file.getName(), base64: Utilities.base64Encode(blob.getBytes()) };
  } catch (e) {
    return { error: 'تعذر فتح الملف من Google Drive: ' + e.message };
  }
}

function out(obj, cb) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function cellOut_(v, tz) { if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd'); return v; }
function norm_(v, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  if (v === null || v === undefined || v === false) return '';
  const s = String(v).trim();
  if (/^false$/i.test(s)) return '';
  const n = s.replace(/,/g, '');
  if (s !== '' && !isNaN(Number(n))) return String(Number(n));
  return s;
}

function ensureHeaders_(sheet, wanted) {
  if (!sheet) return;
  if (!wanted || !wanted.length) return;
  const want = wanted.map(h => String(h).trim()).filter(Boolean);
  const lastCol = sheet.getLastColumn();
  const cur = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim()) : [];
  if (!cur.some(h => h)) { sheet.getRange(1, 1, 1, want.length).setValues([want]); return; }
  const missing = want.filter(h => cur.indexOf(h) < 0);
  if (missing.length) { sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]); }
}

function computedCols_(sheet) {
  const lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
  const out = Array(lastCol).fill(false);
  if (lastRow < 2 || lastCol < 1) return out;
  sheet.getRange(2, 1, lastRow - 1, lastCol).getFormulas().forEach(r => r.forEach((f, c) => { if (f) out[c] = true; }));
  return out;
}

function firstFreeRow_(sheet, computed) {
  const lastRow = sheet.getLastRow(), lastCol = sheet.getLastColumn();
  if (lastRow < 2) return 2;
  const vals = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (let r = 0; r < vals.length; r++) {
    let empty = true;
    for (let c = 0; c < lastCol; c++) {
      if (computed[c]) continue;
      if (!(vals[r][c] === '' || vals[r][c] === false || vals[r][c] === null)) { empty = false; break; }
    }
    if (empty) return r + 2;
  }
  return -1;
}

function writeRow_(sheet, rowNum, values, computed) {
  const bad = [];
  const formulaCells = sheet.getRange(rowNum, 1, 1, values.length).getFormulas()[0].map(Boolean);
  let c = 0;
  while (c < values.length) {
    if (formulaCells[c]) { c++; continue; }
    let e = c;
    while (e + 1 < values.length && !formulaCells[e + 1]) e++;
    try { sheet.getRange(rowNum, c + 1, 1, e - c + 1).setValues([values.slice(c, e + 1)]); }
    catch (err) {
      values.slice(c, e + 1).forEach((v, k) => {
        try { sheet.getRange(rowNum, c + k + 1).setValue(v); } catch (x) { bad.push(c + k + 1); }
      });
    }
    c = e + 1;
  }
  return bad;
}

function fillDownFormulas_(sheet, rowNum, computed) {
  if (rowNum < 3) return;
  computed.forEach((isC, c) => {
    if (!isC) return;
    const cell = sheet.getRange(rowNum, c + 1);
    if (cell.getFormula() || String(cell.getValue()) !== '') return;
    const prev = sheet.getRange(rowNum - 1, c + 1).getFormulaR1C1();
    if (prev) cell.setFormulaR1C1(prev);
  });
}

const ROW_KEYS = ['رقم الوصل','رقم الذرعة','الاسم','اسم المقاول','المصدر','الشريك','ت'];

function colMatch_(h, cell, want, tz) {
  if (h === ATT_HEADER) return true;
  const a = norm_(cell, tz);
  if (h === 'السعر الكلي' && a === '') return true;
  return a === norm_(want, tz);
}

function findRow_(data, headers, old, tz, computed, headerRow, oldData) {
  const offset = Math.max(0, (headerRow || 1) - 1);
  const positional = Array.isArray(oldData) ? oldData : null;
  const oldObj = old || {};
  const present = positional ? positional.map((v,i)=>v!==''&&v!==null&&v!==false ? i : -1).filter(i=>i>=0)
    : headers.map((h,i)=>Object.prototype.hasOwnProperty.call(oldObj,h) && String(oldObj[h]??'').trim()!=='' ? i : -1).filter(i=>i>=0);
  if (!present.length) return -1;
  const rowValue=(arr,i)=>positional ? positional[i] : oldObj[headers[i]];
  for (let r=offset;r<data.length;r++) {
    const row=data[r];
    if (!row || row.every(v=>v===''||v===null||v===false)) continue;
    if (present.every(c=> c < headers.length && colMatch_(headers[c], row[c], rowValue(row,c), tz))) return r;
  }
  return -1;
}

// تخطيط الصفوف الفعلي
function layout_(name) {
  const layouts = {
    'السجل العام': {header:1, start:2, footer:20},
    'المقاولين والمجهزين': {header:1, start:2},
    'السلف المستلمة': {header:2, start:3, footer:10},
    'السحب والتمويل': {header:3, start:4, footer:13},
    'خلاصة المشروع': {header:2, start:3, footer:21},
    'المديونية': {header:2, start:3, footer:13, usdHeader:14, usdStart:15, usdFooter:17},
    'سلف المشروع': {header:1, start:2}
  };
  return layouts[name] || {header:1, start:2};
}
function rowComputed_(sheet,row,lastCol) {
  return sheet.getRange(row,1,1,lastCol).getFormulas()[0].map(Boolean);
}
function rowBlank_(sheet, row, lastCol, computed) {
  const vals = sheet.getRange(row,1,1,lastCol).getValues()[0];
  const formulas = computed || rowComputed_(sheet,row,lastCol);
  return vals.every((v,c)=> formulas[c] ? true : (v === '' || v === null || v === false));
}
function insertTemplateRow_(sheet, at, model, lastCol) {
  sheet.insertRowsBefore(at,1);
  const source = model >= at ? model + 1 : model;
  if (source >= 1 && source <= sheet.getMaxRows() && source !== at) {
    sheet.getRange(source,1,1,lastCol).copyTo(sheet.getRange(at,1,1,lastCol), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sheet.getRange(source,1,1,lastCol).copyTo(sheet.getRange(at,1,1,lastCol), SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
  }
}
function footerRow_(sheet, name, cfg) {
  const last = sheet.getLastRow();
  const labels = {
    'السجل العام': 'المجموع الكلي',
    'السلف المستلمة': 'اجمالي السلف المستلمة',
    'السحب والتمويل': 'مجمل التمويل',
    'خلاصة المشروع': 'المجموع الكلي'
  };
  const label = labels[name];
  if (label) {
    const maxCol = Math.max(1, sheet.getLastColumn());
    const rows = sheet.getRange(1,1,last,maxCol).getDisplayValues();
    for (let r=rows.length-1;r>=0;r--) if(rows[r].some(v=>String(v).trim()===label)) return r+1;
  }
  return cfg.footer || last+1;
}
function updateSumFooter_(sheet,name,footer,start,end) {
  if (end < start) end=start;
  if (name==='السجل العام') sheet.getRange(footer,2).setFormula('=SUM(B'+start+':B'+end+')');
  if (name==='السلف المستلمة') sheet.getRange(footer,2).setFormula('=SUM(B'+start+':B'+end+')');
  if (name==='السحب والتمويل') {
    [[2,4],[3,5],[8,10],[9,11]].forEach(([col,_date])=>{
      const letter=String.fromCharCode(64+col);
      sheet.getRange(footer,col).setFormula('=SUM('+letter+start+':'+letter+end+')');
    });
  }
}
function addAtDataRow_(sheet, bounds, values, computed, name) {
  const lastCol = Math.max(sheet.getLastColumn(), values.length);
  const footer = footerRow_(sheet,name,bounds);
  for (let r=bounds.start;r<footer;r++) {
    if (r>sheet.getMaxRows()) break;
    if(rowBlank_(sheet,r,lastCol)) {
      const rowComputed=rowComputed_(sheet,r,lastCol);
      const bad=writeRow_(sheet,r,values,rowComputed);
      fillDownFormulas_(sheet,r,rowComputed);
      updateSumFooter_(sheet,name,footer,bounds.start,footer-1);
      return {row:r,bad};
    }
  }
  const model=Math.max(bounds.start,footer-1);
  insertTemplateRow_(sheet,footer,model,lastCol);
  const rowComputed=rowComputed_(sheet,footer,lastCol);
  const bad=writeRow_(sheet,footer,values,rowComputed);
  fillDownFormulas_(sheet,footer,rowComputed);
  updateSumFooter_(sheet,name,footer+1,bounds.start,footer);
  return {row:footer,bad};
}
function ctIsProfile_(row,headers) {
  const inv=headers.indexOf('رقم الذرعة');
  return !!String(row[0]||'').trim() && (inv<0 || !String(row[inv]||'').trim());
}
function ctProfileFormulas_(sheet,row,headers) {
  const cols={'مجموع الطلب دينار':'O','مجموع المدفوع دينار':'P','المتبقي دينار':'Q','مجموع الطلب $':'R','مجموع المدفوع $':'S','الباقي $':'T'};
  Object.keys(cols).forEach(h=>{
    const c=headers.indexOf(h); if(c<0)return;
    let f='=0';
    if(h==='مجموع الطلب دينار') f='=SUMIF($A:$A,$A'+row+',$H:$H)';
    else if(h==='مجموع المدفوع دينار') f='=SUMIF($A:$A,$A'+row+',$M:$M)';
    else if(h==='المتبقي دينار') f='='+cols['مجموع الطلب دينار']+row+'-'+cols['مجموع المدفوع دينار']+row;
    else if(h==='مجموع الطلب $') f='=SUMIF($A:$A,$A'+row+',$I:$I)';
    else if(h==='مجموع المدفوع $') f='=0';
    else if(h==='الباقي $') f='='+cols['مجموع الطلب $']+row+'-'+cols['مجموع المدفوع $']+row;
    sheet.getRange(row,c+1).setFormula(f);
  });
}
function ensureContractorWorkHeader_(sheet,requiredWidth) {
  const width=Math.max(1,sheet.getLastColumn(),Number(requiredWidth)||0);
  if(width>sheet.getMaxColumns())sheet.insertColumnsAfter(sheet.getMaxColumns(),width-sheet.getMaxColumns());
  const headers=sheet.getRange(1,1,1,width).getValues()[0].map(String);
  if(headers.indexOf('العمل')>=0)return headers;
  const index=(headers.length && !String(headers[headers.length-1]||'').trim())?headers.length-1:headers.length;
  const column=index+1;
  if(column>sheet.getMaxColumns())sheet.insertColumnAfter(sheet.getMaxColumns());
  sheet.getRange(1,column).setValue('العمل');
  headers[index]='العمل';
  return headers;
}
function addContractor_(sheet,p) {
  const data=p.data||[];
  const isProfile=p.entryType==='contractor';
  let lastCol=Math.max(sheet.getLastColumn(),data.length);
  let headers=isProfile?ensureContractorWorkHeader_(sheet,lastCol):sheet.getRange(1,1,1,lastCol).getValues()[0].map(String);
  lastCol=Math.max(lastCol,headers.length);
  const values=isProfile&&p.record?headers.map((h,i)=>p.record[h]!==undefined?p.record[h]:(data[i]??'')):(data.length?data.slice(0,headers.length):headers.map(h=>p.record&&p.record[h]!==undefined?p.record[h]:''));
  const nameIx=headers.indexOf('اسم المقاول');
  const name=String((nameIx>=0&&values[nameIx])||(p.record&&p.record['اسم المقاول'])||'').trim();
  if(nameIx<0||!name) throw new Error('اسم المقاول مطلوب أو عموده غير موجود');
  const lastRow=sheet.getLastRow();
  if(isProfile){
    const kindIx=headers.indexOf('نوع العمل');
    const kind=String((kindIx>=0&&values[kindIx])||'').trim();
    const target=/مجهز|مورد/.test(kind)?'المجهزين':(/مقاول/.test(kind)?'المقاولين':'');
    let currentSection=''; let at=lastRow+1; let profileTemplate=0; let foundTarget=false;
    for(let r=2;r<=lastRow;r++){
      const row=sheet.getRange(r,1,1,lastCol).getDisplayValues()[0];
      const nonempty=row.map(v=>String(v||'').trim()).filter(Boolean);
      const label=nonempty.length===1?nonempty[0].replace(/[\sـ]/g,''):'';
      if(['المقاولين','المقاولون'].includes(label)){currentSection='المقاولين';if(target==='المقاولين'){foundTarget=true;at=r+1;}else if(foundTarget){at=r;break;}continue;}
      if(['المجهزين','الموردين','المجهز'].includes(label)){if(foundTarget&&target==='المقاولين'){at=r;break;}currentSection='المجهزين';if(target==='المجهزين'){foundTarget=true;at=r+1;}continue;}
      const valuesAtRow=sheet.getRange(r,1,1,lastCol).getValues()[0];
      if(currentSection && ctIsProfile_(valuesAtRow,headers)){
        if(target && currentSection===target){foundTarget=true;at=r+1;profileTemplate=r;}
        else if(foundTarget && target && currentSection!==target){at=r;break;}
      }
    }
    if(!target){at=lastRow+1;for(let r=2;r<=lastRow;r++)if(ctIsProfile_(sheet.getRange(r,1,1,lastCol).getValues()[0],headers))profileTemplate=r;}
    if(target&&!foundTarget) at=lastRow+1;
    if(!profileTemplate) for(let r=2;r<=lastRow;r++){const candidate=sheet.getRange(r,1,1,lastCol).getValues()[0];if(ctIsProfile_(candidate,headers)){const marker=sheet.getRange(r,1,1,lastCol).getDisplayValues()[0].map(v=>String(v||'').trim()).filter(Boolean);if(marker.length!==1||!['المقاولين','المقاولون','المجهز','المجهزين','المورد','الموردين'].includes(marker[0].replace(/[\sـ]/g,'')))profileTemplate=r;}}
    if(at>sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),at-sheet.getMaxRows());
    if(profileTemplate && profileTemplate<at) insertTemplateRow_(sheet,at,profileTemplate,lastCol);
    const bad=writeRow_(sheet,at,values,rowComputed_(sheet,at,lastCol));
    ctProfileFormulas_(sheet,at,headers);
    return {row:at,bad};
  }
  const starts=[];
  for(let r=2;r<=lastRow;r++){
    const row=sheet.getRange(r,1,1,lastCol).getValues()[0];
    if(ctIsProfile_(row,headers)) starts.push({row:r,name:String(row[nameIx]||'').trim()});
  }
  const start=starts.find(x=>x.name===name);
  if(!start) throw new Error('المقاول المحدد غير موجود؛ أضف ملفه التعريفي أولاً');
  const next=starts.find(x=>x.row>start.row), end=next?next.row-1:lastRow;
  const computed=rowComputed_(sheet,start.row+1,lastCol);
  for(let r=start.row+1;r<=end;r++) if(rowBlank_(sheet,r,lastCol)) {
    const bad=writeRow_(sheet,r,values,rowComputed_(sheet,r,lastCol));
    ctProfileFormulas_(sheet,start.row,headers);
    return {row:r,bad};
  }
  const at=next?next.row:lastRow+1;
  if(at>sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(),at-sheet.getMaxRows());
  const invoiceIx=headers.indexOf('رقم الذرعة');
  let greenTemplate=0;
  for(let r=2;r<=lastRow;r++){
    const candidate=sheet.getRange(r,1,1,lastCol).getValues()[0];
    if(!ctIsProfile_(candidate,headers) && invoiceIx>=0 && String(candidate[invoiceIx]||'').trim()){greenTemplate=r;break;}
  }
  insertTemplateRow_(sheet,at,greenTemplate,lastCol);
  const bad=writeRow_(sheet,at,values,rowComputed_(sheet,at,lastCol));
  ctProfileFormulas_(sheet,start.row,headers);
  return {row:at,bad};
}
function withdrawalBlocks_(headers) {
  const starts=[];
  headers.forEach((h,i)=>{if(String(h).trim()==='ت') starts.push(i);});
  if(starts.length<2) throw new Error('تعذر العثور على رأسي كتل الشركاء في صف العناوين.');
  return starts.slice(0,2);
}
function addWithdrawal_(sheet,values,cfg,requestedStart) {
  const headers=sheet.getRange(cfg.header,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const starts=withdrawalBlocks_(headers);
  const from=Number(requestedStart);
  if(!starts.includes(from)) throw new Error('كتلة الشريك المحددة لا تطابق عناوين الشيت.');
  const footer=footerRow_(sheet,'السحب والتمويل',cfg);
  const serialIx=from;
  let maxSerial=0;
  for(let r=cfg.start;r<footer;r++){
    const v=Number(sheet.getRange(r,serialIx+1).getValue());
    if(Number.isFinite(v)&&v>maxSerial)maxSerial=v;
  }
  values[serialIx]=maxSerial+1;
  const blankBlock=r=>sheet.getRange(r,from+1,1,5).getValues()[0].every(v=>v===''||v===null||v===false);
  for(let r=cfg.start;r<footer;r++) if(blankBlock(r)) {
    for(let c=from;c<from+5;c++) sheet.getRange(r,c+1).setValue(values[c]??'');
    updateSumFooter_(sheet,'السحب والتمويل',footer,cfg.start,footer-1); return {row:r,bad:[]};
  }
  const at=footer, model=Math.max(cfg.start,footer-1);
  insertTemplateRow_(sheet,at,model,sheet.getLastColumn());
  for(let c=from;c<from+5;c++) sheet.getRange(at,c+1).setValue(values[c]??'');
  updateSumFooter_(sheet,'السحب والتمويل',footer+1,cfg.start,footer);
  return {row:at,bad:[]};
}

function refreshDerivedSheets_() {
  const ss=ss_(), gl=ss.getSheetByName('السجل العام'), summary=ss.getSheetByName('خلاصة المشروع');
  if (gl && summary) {
    const vals=gl.getDataRange().getValues(), sums=new Map();
    for(let r=1;r<vals.length;r++){ const details=String(vals[r][2]||''); if(isWorkAdvanceDetails_(details))continue; const site=String(vals[r][6]||'').trim(), amount=Number(String(vals[r][1]||0).replace(/,/g,''))||0; if(site) sums.set(site,(sums.get(site)||0)+amount); }
  const sites=Array.from(sums.keys()).sort((a,b)=>a.localeCompare(b,'ar',{numeric:true}));
    const findSummaryFooter=()=>{for(let r=3;r<=summary.getLastRow();r++)if(String(summary.getRange(r,3).getDisplayValue()).trim()==='المجموع الكلي للمصاريف')return r;return 21;};
    let footer=findSummaryFooter();
    const capacity=footer-3, extra=Math.max(0,sites.length-capacity);
    if(extra){const model=Math.max(3,footer-1), width=Math.max(3,summary.getLastColumn());summary.insertRowsBefore(footer,extra);for(let k=0;k<extra;k++)summary.getRange(model,1,1,width).copyTo(summary.getRange(footer+k,1,1,width),SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);footer+=extra;}
    const width=Math.max(3,summary.getLastColumn()); if(footer>3)summary.getRange(3,2,footer-3,2).clearContent();
    sites.forEach((site,i)=>summary.getRange(3+i,2,1,2).setValues([[sums.get(site),site]]));
    summary.getRange(footer,3).setValue('المجموع الكلي للمصاريف'); summary.getRange(footer,2).setFormula('=SUM(B3:B'+(footer-1)+')');
    CacheService.getScriptCache().remove('sheet_data_خلاصة المشروع');
  }
  const ct=ss.getSheetByName('المقاولين والمجهزين'), debt=ss.getSheetByName('المديونية');
  if(!ct||!debt) return;
  const rows=ct.getDataRange().getValues(), contractors=new Map(), ctHeaders=ct.getRange(1,1,1,ct.getLastColumn()).getValues()[0].map(String);
  const nameIx=ctHeaders.indexOf('اسم المقاول'), invIx=ctHeaders.indexOf('رقم الذرعة'), codeIx=ctHeaders.indexOf('الكود');
  const profileCodes=new Map();
  for(let r=1;r<rows.length;r++){
    const x=rows[r],name=String(x[nameIx]||'').trim(),inv=String(x[invIx]||'').trim(),code=codeIx>=0?String(x[codeIx]||'').trim():'';
    if(name&&!inv){if(code)profileCodes.set(name,code);ctProfileFormulas_(ct,r+1,ctHeaders);}
  }
  for(let r=1;r<rows.length;r++){
    const x=rows[r],name=String(x[nameIx]||'').trim(),inv=String(x[invIx]||'').trim();if(!name||!inv)continue;
    const code=profileCodes.get(name)||(codeIx>=0?String(x[codeIx]||'').trim():'');
    const q=contractors.get(name)||{code,iqd:0,usd:0};q.iqd+=Number(x[7])||0;q.usd+=Number(x[8])||0;if(!q.code)q.code=code;contractors.set(name,q);
  }
  const ledger=gl?gl.getDataRange().getValues():[],paidByCode=new Map(),paidByName=new Map();
  for(let r=1;r<ledger.length;r++){const x=ledger[r],amount=Number(x[1])||0,code=String(x[5]||'').trim(),recipient=String(x[4]||'').trim();if(code)paidByCode.set(code,(paidByCode.get(code)||0)+amount);if(recipient)paidByName.set(recipient,(paidByName.get(recipient)||0)+amount);}
  const allNames=Array.from(contractors.keys()).sort((a,b)=>a.localeCompare(b,'ar'));
  const rowText=r=>debt.getRange(r,1,1,Math.max(6,debt.getLastColumn())).getDisplayValues()[0].map(x=>String(x).trim());
  const findTotal=(from,to)=>{for(let r=from;r<=to;r++)if(rowText(r).some(v=>/المجموع|الإجمالي|الاجمالي/.test(v)))return r;return 0;};
  const findHeader=(from,to)=>{for(let r=from;r<=to;r++){const t=rowText(r);if(t.some(x=>/المورد|اسم المقاول|المبلغ المطلوب/.test(x))&&t.some(x=>/المستلم|المتبقي|المبلغ/.test(x)))return r;}return 0;};
  const block=(header,start,currency)=>{
    let total=findTotal(start,debt.getLastRow()); if(!total)throw new Error('تعذر العثور على صف الإجمالي لقسم '+currency);
    const names=allNames.filter(n=>currency==='IQD'?contractors.get(n).iqd>0:contractors.get(n).usd>0);
    const notesByName=new Map(); for(let r=start;r<total;r++){const n=String(debt.getRange(r,2).getValue()||'').trim();if(n)notesByName.set(n,debt.getRange(r,6).getValue());}
    let capacity=total-start;
    if(names.length>capacity){const add=names.length-capacity,model=Math.max(start,total-1),width=Math.max(6,debt.getLastColumn());debt.insertRowsBefore(total,add);for(let k=0;k<add;k++)insertTemplateRow_(debt,total+k,model,width);total+=add;}
    for(let i=0;i<names.length;i++){
      const name=names[i],c=contractors.get(name),row=start+i,req=currency==='IQD'?c.iqd:c.usd;
      const received=currency==='IQD'?(c.code&&paidByCode.has(c.code)?paidByCode.get(c.code):(paidByName.get(name)||0)):0;
      const note=notesByName.get(name); debt.getRange(row,1,1,5).setValues([[i+1,name,req,received,req-received]]); if(note!==undefined&&note!=='')debt.getRange(row,6).setValue(note);
    }
    for(let r=start+names.length;r<total;r++)debt.getRange(r,1,1,5).clearContent();
    debt.getRange(total,3).setFormula('=SUM(C'+start+':C'+(total-1)+')');debt.getRange(total,4).setFormula('=SUM(D'+start+':D'+(total-1)+')');debt.getRange(total,5).setFormula('=SUM(E'+start+':E'+(total-1)+')');
  };
  const iqTotal=findTotal(3,debt.getLastRow())||13;
  const usdHeader=findHeader(iqTotal+1,debt.getLastRow())||14;
  block(2,3,'IQD');
  const iqTotalNow=findTotal(3,debt.getLastRow())||iqTotal; const usdHeaderNow=findHeader(iqTotalNow+1,debt.getLastRow())||usdHeader;
  block(usdHeaderNow,usdHeaderNow+1,'USD');
  CacheService.getScriptCache().remove('sheet_data_المديونية');
}

function amountNumber_(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text=String(value===null||value===undefined?'':value).replace(/[,٬]/g,'').trim();
  const n=Number(text.replace(/٪|%/g,''));
  if (!Number.isFinite(n)) return 0;
  return /٪|%/.test(text) ? n/100 : n;
}
function isWorkAdvanceDetails_(value) {
  const text=String(value||'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if(/^\s*(?:سلفة\s+عمل|سلفة\s+تشغيلية)\s*[:：|—–-]/i.test(text))return true;
  return /سلفة\s+(?:ال)?عمل|سلفة\s+التشغيلية/.test(text) && !/(?:رقم(?:\s*الوصل)?\s*)[0-9]+/.test(text);
}
function projectAccounting_() {
  const ss=ss_();
  const partners=['محمد اللامي','أحمد شاكر'];
  const wd=ss.getSheetByName('السحب والتمويل');
  let shares={'محمد اللامي':0.5,'أحمد شاكر':0.5};
  const stats={}; partners.forEach(name=>stats[name]={funding:0,draw:0,shareRatio:shares[name]});
  if(wd){
    const cfg=layout_('السحب والتمويل'); const lastCol=wd.getLastColumn();
    if(lastCol>0){
      const headers=wd.getRange(cfg.header,1,1,lastCol).getValues()[0].map(String);
      let starts=[]; try{starts=withdrawalBlocks_(headers);}catch(e){}
      const top=wd.getRange(1,1,2,lastCol).getValues();
      const ratios=[];
      partners.forEach((name,index)=>{
        const start=starts[index]===undefined?(index===0?2:7):starts[index];
        let ratio=null;
        for(let c=start;c<Math.min(lastCol,start+5);c++){
          const candidate=top[1][c];
          if(candidate!==''&&candidate!==null&&candidate!==false){const n=amountNumber_(candidate);if(n>0&&n<=100){ratio=n>1?n/100:n;break;}}
        }
        ratios[index]=ratio;
      });
      if(ratios[0]!==null&&ratios[1]!==null){const sum=ratios[0]+ratios[1];if(sum>0){shares[partners[0]]=ratios[0]/sum;shares[partners[1]]=ratios[1]/sum;}}
      else if(ratios[0]!==null){shares[partners[0]]=ratios[0];shares[partners[1]]=Math.max(0,1-ratios[0]);}
      else if(ratios[1]!==null){shares[partners[1]]=ratios[1];shares[partners[0]]=Math.max(0,1-ratios[1]);}
      partners.forEach(name=>stats[name].shareRatio=shares[name]);
      const wdBlockStarts=withdrawalBlocks_(headers), footer=footerRow_(wd,'السحب والتمويل',cfg);
      const rows=footer>cfg.start?wd.getRange(cfg.start,1,footer-cfg.start,lastCol).getValues():[];
      rows.forEach(row=>partners.forEach((name,index)=>{const base=wdBlockStarts[index];stats[name].funding+=amountNumber_(row[base+1]);stats[name].draw+=amountNumber_(row[base+2]);}));
    }
  }
  let expensesIQD=0, advancesIQD=0;
  const gl=ss.getSheetByName('السجل العام');
  if(gl){const cfg=layout_('السجل العام'),lastCol=gl.getLastColumn(),lastRow=gl.getLastRow();if(lastCol&&lastRow>=cfg.start){
    const headers=gl.getRange(cfg.header,1,1,lastCol).getValues()[0].map(String);
    const amountIx=headers.indexOf('المبلغ'),typeIx=headers.indexOf('النوع'),currencyIx=headers.indexOf('العملة'),detailsIx=headers.indexOf('التفاصيل')>=0?headers.indexOf('التفاصيل'):headers.indexOf('البيان');
    const footer=footerRow_(gl,'السجل العام',cfg), count=Math.max(0,Math.min(lastRow,footer-1)-cfg.start+1);
    if(count&&amountIx>=0)gl.getRange(cfg.start,1,count,lastCol).getValues().forEach(row=>{
      const cur=currencyIx>=0?String(row[currencyIx]||'').toUpperCase():'';
      const type=typeIx>=0?String(row[typeIx]||'').trim():'';
      if(cur==='USD'||cur.includes('دولار')||cur.includes('$'))return;
      if((!type||type==='صرف') && !(detailsIx>=0&&isWorkAdvanceDetails_(row[detailsIx])))expensesIQD+=amountNumber_(row[amountIx]);
    });
  }}
  const adv=ss.getSheetByName('السلف المستلمة');
  if(adv){const cfg=layout_('السلف المستلمة'),lastCol=adv.getLastColumn(),lastRow=adv.getLastRow();if(lastCol&&lastRow>=cfg.start){
    const headers=adv.getRange(cfg.header,1,1,lastCol).getValues()[0].map(String);
    const amountIx=headers.indexOf('المبلغ'),currencyIx=headers.indexOf('العملة');
    const footer=footerRow_(adv,'السلف المستلمة',cfg),count=Math.max(0,Math.min(lastRow,footer-1)-cfg.start+1);
    if(count&&amountIx>=0)adv.getRange(cfg.start,1,count,lastCol).getValues().forEach(row=>{
      const cur=currencyIx>=0?String(row[currencyIx]||'').toUpperCase():'';
      if(cur==='USD'||cur.includes('دولار')||cur.includes('$'))return;
      advancesIQD+=amountNumber_(row[amountIx]);
    });
  }}
  const projectProfitLoss=advancesIQD-expensesIQD;
  partners.forEach(name=>{stats[name].projectShare=projectProfitLoss*stats[name].shareRatio;stats[name].fundingDifference=stats[name].funding-stats[name].draw;stats[name].amountDue=stats[name].fundingDifference-stats[name].projectShare;});
  return {expensesIQD,advancesIQD,projectProfitLoss,partners:stats};
}

function doGet(e) {
  try {
    const name = (e.parameter && e.parameter.sheet) || 'السجل العام';
    const user = authUser_(e.parameter && e.parameter.token);
    if (!user) return out({ error: 'Unauthorized' });
    if (!sheetAllowed_(user, name)) return out({ error: 'Forbidden' });
    const ss = ss_(), tz = ss.getSpreadsheetTimeZone();
    const sheet = ss.getSheetByName(name);
    if (!sheet) return out({ error: 'Sheet not found: ' + name });
    const values = sheet.getDataRange().getValues();
    const hr=layout_(name).header-1; const headers=(values[hr]||[]).map(String);
    const response = { headers: headers, rows: values.slice(hr+1).map(r => r.map(v => cellOut_(v, tz))) };
    if(name==='خلاصة المشروع'||name==='السحب والتمويل') response.projectAccounting=projectAccounting_();
    return out(response);
  } catch (err) { return out({ error: err.message }); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(5000)) return out({ error: 'busy — retry later' });
    const p = JSON.parse(e.postData.contents);
    if (p.action === 'login') return out(loginOut_(p));
    const user = authUser_(p.token);
    if (!user) return out({ error: 'Unauthorized' });
    if (p.action === 'change_password') return out(changePassword_(p, user));
    if (p.action === 'attachment') return out(serveAttachment(p, user));
    const name = p.sheet || p.sheetName;
    if (!sheetAllowed_(user, name)) return out({ error: 'Forbidden' });
    if (String(p.action).indexOf('users_') === 0) return out({ error: 'User administration is disabled' });
    const ss = ss_(), tz = ss.getSpreadsheetTimeZone();
    let sheet = ss.getSheetByName(name);
    if (!sheet && p.headers && (p.action === 'add' || p.action === 'sync')) sheet = ss.insertSheet(name);
    if (!sheet) return out({ error: 'Sheet not found: ' + name });
    if (['add','update','delete','attach','detach','sync','mark'].includes(p.action)) {
      CacheService.getScriptCache().remove('sheet_data_' + name);
    }
    if (p.action === 'add') {
      const cfg = layout_(name);
      let result;
      if (name === 'المقاولين والمجهزين') result = addContractor_(sheet,p);
      else {
        const lastCol = sheet.getLastColumn();
        const headerRow = cfg.header;
        const headers = sheet.getRange(headerRow, 1, 1, lastCol).getValues()[0].map(String);
        const row = Array(headers.length).fill('');
        if (Array.isArray(p.data)) p.data.slice(0,row.length).forEach((v,i)=>row[i]=v ?? '');
        else headers.forEach((h,i)=>{ if(p.record && p.record[h] !== undefined) row[i]=p.record[h]; });
        const computed = computedCols_(sheet);
        if (name === 'السحب والتمويل' && Array.isArray(p.data)) {
          result = addWithdrawal_(sheet,row,cfg,p.partnerBlock);
        } else result = addAtDataRow_(sheet,cfg,row,computed,name);
        fillDownFormulas_(sheet,result.row,computed);
      }
      if(['السجل العام','المقاولين والمجهزين'].includes(name)) refreshDerivedSheets_();
      SpreadsheetApp.flush();
      return out({ status: 'success', action: 'add', row: result.row, skipped: result.bad || [] });
    }
    if (p.action === 'update') {
      if(name==='المقاولين والمجهزين' && p.entryType==='contractor') ensureContractorWorkHeader_(sheet,(p.data||[]).length);
      const data = sheet.getDataRange().getValues();
      const cfg=layout_(name); const headers=sheet.getRange(cfg.header,1,1,sheet.getLastColumn()).getValues()[0].map(String);
      const computed = computedCols_(sheet);
      const target = findRow_(data, headers, p.oldRecord || {}, tz, computed, cfg.header, p.oldData);
      if (target < 0) return out({ error: 'Row not found' });
      if(name==='السحب والتمويل') {
        const starts=withdrawalBlocks_(headers);
        const start=Number(p.partnerBlock), oldStart=Number(p.oldPartnerBlock);
        if(!starts.includes(start)||!starts.includes(oldStart)) return out({error:'Invalid partner block'});
        const incoming=Array.isArray(p.data)?p.data:[];
        const movement=incoming.slice(start,start+5);
        if(movement.length!==5) return out({error:'Incomplete partner movement'});
        if(oldStart!==start) {
          const destination=sheet.getRange(target+1,start+1,1,5).getValues()[0];
          if(destination.some(v=>v!==''&&v!==null&&v!==false)) return out({error:'Destination partner block already contains a movement'});
        }
        if(oldStart!==start) sheet.getRange(target+1,oldStart+1,1,5).clearContent();
        sheet.getRange(target+1,start+1,1,5).setValues([movement]);
        SpreadsheetApp.flush();
        return out({status:'success',action:'update',row:target+1,partial:true});
      }
      const row = Array.isArray(p.data) ? p.data.slice(0,headers.length).map((v,c)=>v===undefined?data[target][c]:v) : headers.map((h,c)=>(h!==ATT_HEADER&&p.record&&p.record[h]!==undefined)?p.record[h]:data[target][c]);
      const bad = writeRow_(sheet, target + 1, row, rowComputed_(sheet, target + 1, headers.length));
      if(['السجل العام','المقاولين والمجهزين'].includes(name)) refreshDerivedSheets_();
      SpreadsheetApp.flush();
      return out({ status: 'success', action: 'update', row: target + 1, skipped: bad });
    }
    if (p.action === 'attach') {
      const data = sheet.getDataRange().getValues();
      const cfg=layout_(name); const headers=sheet.getRange(cfg.header,1,1,sheet.getLastColumn()).getValues()[0].map(String);
      const ci = headers.indexOf(ATT_HEADER);
      if (ci < 0) return out({ error: 'Attachment column missing' });
      const r = findRow_(data, headers, p.oldRecord || {}, tz, computedCols_(sheet), cfg.header, p.oldData);
      if (r < 0) return out({ error: 'Row not found' });
      const blob = Utilities.newBlob(Utilities.base64Decode(p.data), p.mime || 'application/pdf', p.fileName || 'attachment.pdf');
      const file = attFolder_(name).createFile(blob);
      try { file.setDescription(String(name || '')); } catch (e) {}
      if (data[r][ci]) trashByUrl_(data[r][ci]);
      const url = 'https://drive.google.com/file/d/' + file.getId() + '/view';
      sheet.getRange(r + 1, ci + 1).setValue(url);
      return out({ status: 'success', action: 'attach', url: url, fileId: file.getId() });
    }
    if (p.action === 'delete') {
      const data = sheet.getDataRange().getValues();
      const cfg=layout_(name); const headers=sheet.getRange(cfg.header,1,1,sheet.getLastColumn()).getValues()[0].map(String);
      const target = findRow_(data, headers, p.oldRecord || {}, tz, computedCols_(sheet), cfg.header, p.oldData);
      if (target < 0) return out({ error: 'Row not found' });
      if (name === 'السحب والتمويل') {
        const starts=withdrawalBlocks_(headers);
        const start=Number(p.partnerBlock);
        if(!starts.includes(start)) return out({error:'Invalid partner block'});
        const values=sheet.getRange(target+1,start+1,1,5).getValues()[0];
        if(values.every(v=>v===''||v===null||v===false)) return out({error:'No movement in selected partner block'});
        sheet.getRange(target + 1, start + 1, 1, 5).clearContent();
        const footer = footerRow_(sheet, name, cfg);
        updateSumFooter_(sheet, name, footer, cfg.start, footer - 1);
        SpreadsheetApp.flush();
        return out({ status: 'success', action: 'delete', row: target + 1, partial: true });
      }
      const ci = headers.indexOf(ATT_HEADER);
      if (ci >= 0) trashByUrl_(data[target][ci]);
      sheet.deleteRow(target + 1);
      if(['السجل العام','المقاولين والمجهزين'].includes(name)) refreshDerivedSheets_();
      SpreadsheetApp.flush();
      return out({ status: 'success', action: 'delete', row: target + 1 });
    }
    if (p.action === 'detach') {
      const data = sheet.getDataRange().getValues();
      const cfg=layout_(name); const headers=sheet.getRange(cfg.header,1,1,sheet.getLastColumn()).getValues()[0].map(String);
      const ci = headers.indexOf(ATT_HEADER);
      if (ci < 0) return out({ error: 'Attachment column missing' });
      const r = findRow_(data, headers, p.oldRecord || {}, tz, computedCols_(sheet), cfg.header, p.oldData);
      if (r < 0) return out({ error: 'Row not found' });
      trashByUrl_(data[r][ci]);
      sheet.getRange(r + 1, ci + 1).setValue('');
      return out({ status: 'success', action: 'detach' });
    }
    if (p.action === 'sync') {
      const incoming = (p.data || []).map(r => p.headers.map((_, i) => r[i] ?? ''));
      const cur = sheet.getLastRow() > 0 ? sheet.getDataRange().getValues() : [[]];
      const curHeaders = (cur[0] || []).map(String);
      const headerMap = p.headers.map(h => curHeaders.indexOf(h));
      const newCols = p.headers.filter((h, i) => headerMap[i] < 0);
      if (newCols.length) {
        sheet.getRange(1, curHeaders.length + 1, 1, newCols.length).setValues([newCols]);
        newCols.forEach(h => { curHeaders.push(h); headerMap[p.headers.indexOf(h)] = curHeaders.length - 1; });
      }
      const mergeKeys = (Array.isArray(p.mergeKeys) && p.mergeKeys.length ? p.mergeKeys : ['ت']).map(k => p.headers.indexOf(k)).filter(i => i >= 0);
      const keyOf = (arr, indices) => indices.map(i => String(arr[i] ?? '').trim()).join('§');
      const existing = new Map();
      for (let r = 1; r < cur.length; r++) {
        const k = keyOf(cur[r], mergeKeys);
        if (k.replace(/§/g, '')) existing.set(k, r);
      }
      let added = 0, updated = 0; const newRows = [];
      incoming.forEach(rec => {
        const k = keyOf(rec, mergeKeys);
        const ridx = existing.get(k);
        if (ridx != null) {
          const row = cur[ridx].slice();
          let dirty = false;
          rec.forEach((v, i) => {
            if (i >= row.length) { row.push(v); dirty = true; return; }
            if (String(row[i] ?? '') !== String(v ?? '')) { row[i] = v; dirty = true; }
          });
          if (dirty) { sheet.getRange(ridx + 1, 1, 1, row.length).setValues([row]); updated++; }
        } else {
          const row = new Array(curHeaders.length).fill('');
          rec.forEach((v, i) => { row[headerMap[i]] = v; });
          newRows.push(row);
        }
      });
      if (newRows.length) {
        const cfg = layout_(name);
        const hasFooter = ['السجل العام', 'السلف المستلمة', 'السحب والتمويل'].includes(name);
        if (hasFooter) {
          const computed = computedCols_(sheet);
          newRows.forEach(row => addAtDataRow_(sheet, cfg, row, computed, name));
        } else {
          const start = Math.max(sheet.getLastRow() + 1, cfg.start);
          if (start + newRows.length - 1 > sheet.getMaxRows()) {
            sheet.insertRowsAfter(sheet.getMaxRows(), start + newRows.length - 1 - sheet.getMaxRows());
          }
          const computed = computedCols_(sheet);
          newRows.forEach((row, i) => {
            writeRow_(sheet, start + i, row, computed);
            fillDownFormulas_(sheet, start + i, computed);
          });
        }
        added = newRows.length;
      }
      SpreadsheetApp.flush();
      return out({ status: 'success', action: 'sync', added: added, updated: updated, total: incoming.length });
    }
    return out({ error: 'Unknown action' });
  } catch (err) {
    return out({ error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function privatizeOldAttachments() {
  const root = attRoot_();
  const folders = root.getFolders();
  let fixed = 0;
  while (folders.hasNext()) {
    const f = folders.next();
    const files = f.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      try { file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); file.setDescription(f.getName()); fixed++; } catch (e) {}
    }
  }
  Logger.log('Fixed: ' + fixed);
}

function setup() {
  throw new Error('setup() معطّل عمداً: بنية المصنف الحالية لا تطابق مخطط الإنشاء القديم.');
}

function resetAdminPassword() {
  const props = PropertiesService.getScriptProperties();
  const newPassword = props.getProperty('ADMIN_RESET_PASSWORD');
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Set ADMIN_RESET_PASSWORD in Script Properties to a temporary password of at least 8 characters.');
  }
  const users = getUsers_();
  const salt = Utilities.getUuid();
  if (!users.admin) {
    users.admin = { role: 'admin', name: 'المدير', tabs: [], email: props.getProperty('ADMIN_EMAIL') || '' };
  }
  users.admin.salt = salt;
  users.admin.hash = hashPw_(salt, newPassword);
  users.admin.mustChangePassword = true;
  props.setProperty('USERS', JSON.stringify(users));
  props.deleteProperty('ADMIN_RESET_PASSWORD');
  props.deleteProperty('ADMIN_PW_FALLBACK');
  Logger.log('تم ضبط كلمة مرور admin');
}
