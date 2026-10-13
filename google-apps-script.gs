/**
 * منصة تبرعات التجمع الطبي في التل — الخادم (Google Apps Script)
 * ------------------------------------------------------------
 * 1) كلمة السر: ضعها في Project Settings > Script Properties باسم ADMIN_PASSWORD
 *    (أفضل من كتابتها هنا، لأن هذا الملف قد يُرفع على GitHub).
 * 2) Deploy > New deployment > Web app
 *    Execute as: Me   |   Who has access: Anyone
 */
const ADMIN_PASSWORD = ''; // لا تكتب كلمة السر هنا

const TABS = {
  settings: 'الإعدادات',
  money: 'التبرعات المالية',
  inkind: 'التبرعات العينية',
  projects: 'المشاريع',
  photos: 'صور المشاريع'
};

const CURRENCIES = ['دولار', 'ليرة سورية جديدة', 'ريال سعودي'];

const SETTINGS_ROWS = [
  ['title_ar', 'اسم المنصة', 'منصة تبرعات التجمع الطبي في التل'],
  ['subtitle_ar', 'وصف قصير تحت العنوان (اختياري)', ''],
  ['totals_mode', 'عرض الإجماليات (محوّل / منفصل)', 'محوّل'],
  ['rate_mode', 'سعر الصرف (تلقائي / يدوي)', 'تلقائي'],
  ['usd_to_syp', 'سعر الدولار بالليرة السورية الجديدة', 140],
  ['sar_to_usd', 'سعر الريال بالدولار', 0.2667],
  ['rate_updated', 'آخر تحديث لسعر الصرف', ''],
  ['contact_name', 'المسؤول الأول: الاسم', 'المسؤول المالي'],
  ['whatsapp', 'المسؤول الأول: رقم الواتساب', '905070406368'],
  ['phone1', 'المسؤول الأول: رقم الاتصال', '963953943245'],
  ['contact2_name', 'المسؤول الثاني: الاسم (اختياري)', ''],
  ['whatsapp2', 'المسؤول الثاني: واتساب', ''],
  ['phone2', 'المسؤول الثاني: رقم الاتصال', ''],
  ['facebook_url', 'رابط صفحة فيسبوك', 'https://www.facebook.com/share/1E2Xn9xgha/'],
  ['shamcash_number', 'شام كاش: رقم الحساب', ''],
  ['shamcash_qr', 'شام كاش: رابط صورة الباركود', ''],
  ['whatsapp_msg', 'رسالة الواتساب الجاهزة', 'السلام عليكم، أرغب بالتبرع لمنصة تبرعات التجمع الطبي في التل'],
  ['note_ar', 'ملاحظة أعلى الإجماليات', 'يتم تحديث الإجمالي خلال 48 ساعة من وصول مبلغ التبرع إلى الصندوق'],
  ['logo_url', 'رابط الشعار', ''],
  ['logo_style', 'لون الشعار (أبيض / أصلي)', 'أبيض'],
  ['gallery_missing', 'إذا ما في صورة بعد (قريبًا / بدون)', 'قريبًا'],
  ['top_count', 'عدد أعلى التبرعات', 5],
  ['refresh_sec', 'مدة التحديث التلقائي (ثانية)', 60]
];

const HEADERS = {
  money: ['التاريخ', 'اسم المتبرع', 'المبلغ', 'العملة', 'ملاحظة', 'إظهار'],
  inkind: ['التاريخ', 'اسم المتبرع', 'نوع التبرع', 'الكمية', 'ملاحظة', 'إظهار'],
  projects: ['اسم المشروع', 'نسبة الإنجاز %', 'وصف قصير', 'إظهار'],
  photos: ['اسم المشروع', 'المرحلة', 'رابط الصورة', 'معرّف الملف', 'تاريخ الرفع', 'إظهار']
};

/* ============================ Routing ============================ */

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'data';
  try {
    if (action === 'data') return json_(getPublicData_());
    if (action === 'ping') return json_({ ok: true });
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents || '{}'); } catch (x) {}
  try {
    if (!getPassword_() || body.password !== getPassword_()) return json_({ ok: false, error: 'wrong_password' });
    switch (body.action) {
      case 'login': return json_({ ok: true });
      case 'list': return json_({ ok: true, sheets: getSheets_(), active: getActive_() });
      case 'generate': return json_(generate_(body.url, !!body.sample, body.activate !== false));
      case 'activate': setActive_(body.id); clearCache_(); return json_({ ok: true });
      case 'remove': removeSheet_(body.id); return json_({ ok: true, sheets: getSheets_(), active: getActive_() });
      case 'getSettings': return json_({ ok: true, settings: readSettings_(openActive_()) });
      case 'saveSettings': saveSettings_(body.settings || {}); clearCache_(); return json_({ ok: true });
      case 'uploadLogo': return json_(uploadImage_(body.dataUrl, 'logo_url'));
      case 'uploadImage': return json_(uploadImage_(body.dataUrl, body.key));
      case 'updateRates': return json_({ ok: true, result: updateRates(), settings: readSettings_(openActive_()) });
      case 'projects': return json_({ ok: true, projects: listProjectsWithPhotos_() });
      case 'uploadPhoto': return json_(uploadPhoto_(body.project, body.phase, body.dataUrl));
      case 'deletePhoto': return json_(deletePhoto_(body.fileId));
      default: return json_({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================ Storage ============================ */

const props_ = () => PropertiesService.getScriptProperties();
const getPassword_ = () => props_().getProperty('ADMIN_PASSWORD') || ADMIN_PASSWORD;
const getActive_ = () => props_().getProperty('ACTIVE_SHEET') || '';
const setActive_ = id => props_().setProperty('ACTIVE_SHEET', id);
const getSheets_ = () => JSON.parse(props_().getProperty('SHEETS') || '[]');
const saveSheets_ = list => props_().setProperty('SHEETS', JSON.stringify(list));
const clearCache_ = () => CacheService.getScriptCache().remove('public_data');

function removeSheet_(id) {
  saveSheets_(getSheets_().filter(s => s.id !== id));
  if (getActive_() === id) props_().deleteProperty('ACTIVE_SHEET');
  clearCache_();
}

function openActive_() {
  const id = getActive_();
  if (!id) throw new Error('no_active_sheet');
  return SpreadsheetApp.openById(id);
}

/* ============================ Generate ============================ */

function generate_(url, sample, activate) {
  if (!url) throw new Error('missing_url');
  const ss = SpreadsheetApp.openByUrl(url.trim());

  buildSettings_(ss);
  buildTable_(ss, TABS.money, HEADERS.money, [140, 220, 120, 120, 220, 80], sh => {
    const n = sh.getMaxRows() - 1;
    sh.getRange(2, 1, n, 1).setNumberFormat('yyyy-mm-dd');
    sh.getRange(2, 3, n, 1).setNumberFormat('#,##0.##');
    sh.getRange(2, 4, n, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(CURRENCIES, true).setAllowInvalid(false).build());
    sh.getRange(2, 6, n, 1).setDataValidation(yesNo_());
  });
  buildTable_(ss, TABS.inkind, HEADERS.inkind, [140, 220, 260, 100, 220, 80], sh => {
    const n = sh.getMaxRows() - 1;
    sh.getRange(2, 1, n, 1).setNumberFormat('yyyy-mm-dd');
    sh.getRange(2, 6, n, 1).setDataValidation(yesNo_());
  });
  buildTable_(ss, TABS.projects, HEADERS.projects, [300, 130, 300, 80], sh => {
    const n = sh.getMaxRows() - 1;
    sh.getRange(2, 2, n, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireNumberBetween(0, 100).setAllowInvalid(false)
        .setHelpText('اكتب رقمًا من 0 إلى 100').build());
    sh.getRange(2, 4, n, 1).setDataValidation(yesNo_());
  });

  buildTable_(ss, TABS.photos, HEADERS.photos, [260, 90, 380, 200, 140, 80], sh => {
    const n = sh.getMaxRows() - 1;
    sh.getRange(2, 2, n, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['قبل', 'بعد'], true).build());
    sh.getRange(2, 5, n, 1).setNumberFormat('yyyy-mm-dd');
    sh.getRange(2, 6, n, 1).setDataValidation(yesNo_());
  });

  if (sample) addSamples_(ss);

  // حذف الورقة الافتراضية الفارغة إن وجدت
  ['Sheet1', 'ورقة1', 'الورقة1'].forEach(name => {
    const s = ss.getSheetByName(name);
    if (s && ss.getSheets().length > 5 && s.getLastRow() === 0) ss.deleteSheet(s);
  });
  ss.setActiveSheet(ss.getSheetByName(TABS.money));

  const list = getSheets_().filter(s => s.id !== ss.getId());
  list.unshift({ id: ss.getId(), name: ss.getName(), url: ss.getUrl(), date: new Date().toISOString() });
  saveSheets_(list);
  if (activate || !getActive_()) setActive_(ss.getId());
  clearCache_();
  return { ok: true, id: ss.getId(), name: ss.getName(), sheets: list, active: getActive_() };
}

function yesNo_() {
  return SpreadsheetApp.newDataValidation().requireValueInList(['نعم', 'لا'], true).build();
}

function styleHeader_(range) {
  range.setBackground('#0F5E63').setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontSize(11);
}

function buildTable_(ss, name, headers, widths, extra) {
  let sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.setRightToLeft(true);
  if (sh.getMaxRows() < 500) sh.insertRowsAfter(sh.getMaxRows(), 500 - sh.getMaxRows());
  if (sh.getMaxColumns() < headers.length) sh.insertColumnsAfter(sh.getMaxColumns(), headers.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader_(sh.getRange(1, 1, 1, headers.length));
  sh.setRowHeight(1, 36);
  sh.setFrozenRows(1);
  widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getBandings().forEach(b => b.remove());
  sh.getRange(1, 1, sh.getMaxRows(), headers.length)
    .applyRowBanding(SpreadsheetApp.BandingTheme.CYAN, true, false);
  sh.getRange(1, 1, 1, headers.length).setBackground('#0F5E63');
  extra(sh);
  return sh;
}

function buildSettings_(ss) {
  let sh = ss.getSheetByName(TABS.settings) || ss.insertSheet(TABS.settings, 0);
  sh.setRightToLeft(true);
  const existing = {};
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(r => { if (r[0]) existing[r[0]] = r[2]; });
  }
  sh.clear();
  sh.getRange(1, 1, 1, 3).setValues([['المفتاح', 'الإعداد', 'القيمة']]);
  styleHeader_(sh.getRange(1, 1, 1, 3));
  const rows = SETTINGS_ROWS.map(r => [r[0], r[1], r[0] in existing && existing[r[0]] !== '' ? existing[r[0]] : r[2]]);
  sh.getRange(2, 1, rows.length, 3).setValues(rows);
  sh.getRange(2, 2, rows.length, 1).setFontWeight('bold').setBackground('#E6F5F5');
  sh.getRange(2, 1, rows.length, 1).setFontColor('#9AA9AA').setFontSize(9);
  sh.setColumnWidth(1, 110); sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 420);
  sh.setFrozenRows(1);
  const tmRow = SETTINGS_ROWS.findIndex(r => r[0] === 'totals_mode') + 2;
  sh.getRange(tmRow, 3).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['محوّل', 'منفصل'], true).build());
  const rmRow = SETTINGS_ROWS.findIndex(r => r[0] === 'rate_mode') + 2;
  sh.getRange(rmRow, 3).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['تلقائي', 'يدوي'], true).build());
  const gmRow = SETTINGS_ROWS.findIndex(r => r[0] === 'gallery_missing') + 2;
  sh.getRange(gmRow, 3).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['قريبًا', 'بدون'], true).build());
  const styleRow = SETTINGS_ROWS.findIndex(r => r[0] === 'logo_style') + 2;
  sh.getRange(styleRow, 3).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['أبيض', 'أصلي'], true).build());
  const prot = sh.getRange(1, 1, rows.length + 1, 2).protect().setDescription('لا تعدّل هذين العمودين');
  prot.setWarningOnly(true);
}

function addSamples_(ss) {
  const today = new Date();
  const d = n => new Date(today.getTime() - n * 86400000);
  const money = ss.getSheetByName(TABS.money);
  if (money.getLastRow() < 2) {
    money.getRange(2, 1, 6, 6).setValues([
      [d(0), 'أبو مصلح طالب', 1000, 'دولار', '', 'نعم'],
      [d(1), 'فاعل خير', 5200, 'ليرة سورية جديدة', '', 'نعم'],
      [d(1), 'أبو فادي الأغبر', 1200, 'دولار', '', 'نعم'],
      [d(2), 'فاعل خير من بيت النقيب', 2000, 'دولار', '', 'نعم'],
      [d(3), 'أحمد بشير جاموس', 1500, 'ريال سعودي', '', 'نعم'],
      [d(4), 'الطفل تيم حجازي', 25, 'دولار', '', 'نعم']
    ]);
  }
  const ink = ss.getSheetByName(TABS.inkind);
  if (ink.getLastRow() < 2) {
    ink.getRange(2, 1, 2, 6).setValues([
      [d(1), 'أبو علي الكردي', 'مظلة وزنبق', '3', '', 'نعم'],
      [d(2), 'محمد علي جاموس', 'كيس تراب زراعي لحديقة البيدر', '40', '', 'نعم']
    ]);
  }
  const pr = ss.getSheetByName(TABS.projects);
  if (pr.getLastRow() < 2) {
    pr.getRange(2, 1, 5, 4).setValues([
      ['تركيب أبواب وصيانة الشبابيك', 100, '', 'نعم'],
      ['صيانة صحية وكهربائية عامة', 60, '', 'نعم'],
      ['تركيب سيراميك ودهان كامل', 35, '', 'نعم'],
      ['تركيب خزانات مياه', 0, '', 'نعم'],
      ['تركيب منظومة طاقة شمسية كاملة', 0, '', 'نعم']
    ]);
  }
}

/* ============================ Settings ============================ */

function readSettings_(ss) {
  const out = {};
  SETTINGS_ROWS.forEach(r => out[r[0]] = r[2]);
  const sh = ss.getSheetByName(TABS.settings);
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(r => { if (r[0]) out[r[0]] = r[2]; });
  }
  return out;
}

function saveSettings_(obj) {
  const ss = openActive_();
  const sh = ss.getSheetByName(TABS.settings) || (buildSettings_(ss), ss.getSheetByName(TABS.settings));
  const keys = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => r[0]);
  Object.keys(obj).forEach(k => {
    let i = keys.indexOf(k);
    if (i < 0) { // إعداد جديد غير موجود في الجدول: يُضاف تلقائيًا لنفس الجدول بدون إعادة إنشاء
      const def = SETTINGS_ROWS.find(r => r[0] === k);
      if (!def) return;
      sh.appendRow([k, def[1], obj[k]]);
      keys.push(k); return;
    }
    sh.getRange(i + 2, 3).setValue(obj[k]);
  });
}

function saveImageFile_(dataUrl, name) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('bad_image');
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 310 * 1024) throw new Error('حجم الصورة أكبر من 300 كيلوبايت');
  const file = imagesFolder_().createFile(Utilities.newBlob(bytes, m[1], name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: file.getId(), url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1600' };
}

function uploadImage_(dataUrl, key) {
  if (['logo_url', 'shamcash_qr'].indexOf(key) < 0) throw new Error('bad_key');
  const f = saveImageFile_(dataUrl, key === 'logo_url' ? 'logo' : 'shamcash-qr');
  const o = {}; o[key] = f.url; saveSettings_(o);
  clearCache_();
  return { ok: true, url: f.url };
}

function photosSheet_(ss) {
  let sh = ss.getSheetByName(TABS.photos);
  if (!sh) {
    sh = ss.insertSheet(TABS.photos); sh.setRightToLeft(true);
    sh.getRange(1, 1, 1, HEADERS.photos.length).setValues([HEADERS.photos]);
    styleHeader_(sh.getRange(1, 1, 1, HEADERS.photos.length)); sh.setFrozenRows(1);
  }
  return sh;
}

function listProjectsWithPhotos_() {
  const ss = openActive_();
  const names = sheetRows_(ss, TABS.projects, 1).map(r => String(r[0]).trim()).filter(Boolean);
  const photos = sheetRows_(ss, TABS.photos, 6);
  return names.map(n => ({
    name: n,
    photos: photos.filter(p => String(p[0]).trim() === n)
      .map(p => ({ phase: String(p[1]).trim() === 'بعد' ? 'after' : 'before', url: String(p[2]), id: String(p[3]) }))
  }));
}

function uploadPhoto_(project, phase, dataUrl) {
  project = String(project || '').trim();
  if (!project) throw new Error('اختر المشروع');
  if (['قبل', 'بعد'].indexOf(phase) < 0) throw new Error('اختر قبل أو بعد');
  const ss = openActive_();
  const f = saveImageFile_(dataUrl, project + ' - ' + phase);
  photosSheet_(ss).appendRow([project, phase, f.url, f.id, new Date(), 'نعم']);
  clearCache_();
  return { ok: true, url: f.url, id: f.id };
}

function deletePhoto_(fileId) {
  const ss = openActive_();
  const sh = photosSheet_(ss);
  if (sh.getLastRow() > 1) {
    const ids = sh.getRange(2, 4, sh.getLastRow() - 1, 1).getValues();
    for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === String(fileId)) sh.deleteRow(i + 2);
  }
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (x) {}
  clearCache_();
  return { ok: true };
}

function imagesFolder_() {
  const name = 'منصة التبرعات - الصور';
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

/* ============================ Public data ============================ */

function getPublicData_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('public_data');
  if (hit) return JSON.parse(hit);

  const ss = openActive_();
  const s = readSettings_(ss);
  const rate = Number(s.usd_to_syp) || 1;
  const sarUsd = Number(s.sar_to_usd) || 0.2667;
  const visible = v => String(v).trim() !== 'لا';
  const iso = v => v instanceof Date ? v.toISOString() : (v ? String(v) : '');
  const cur = c => {
    c = String(c).trim();
    if (/ليرة|ل\.س|syp/i.test(c)) return 'SYP';
    if (/ريال|sar/i.test(c)) return 'SAR';
    return 'USD';
  };

  const rows = sheetRows_(ss, TABS.money, 6);
  const donations = [];
  const sums = { USD: 0, SYP: 0, SAR: 0 };
  rows.forEach((r, i) => {
    const amount = Number(String(r[2]).replace(/[^\d.]/g, ''));
    if (!amount || !r[1]) return;
    const c = cur(r[3]);
    sums[c] += amount;
    const usd = c === 'USD' ? amount : c === 'SYP' ? amount / rate : amount * sarUsd;
    if (visible(r[5])) donations.push({ i: i, date: iso(r[0]), name: String(r[1]).trim(), amount: amount, currency: c, usd: usd, note: String(r[4] || '') });
  });

  const grandUsd = sums.USD + sums.SYP / rate + sums.SAR * sarUsd;
  const top = donations.slice().sort((a, b) => b.usd - a.usd).slice(0, Number(s.top_count) || 5);
  const recent = donations.slice().sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.i - a.i)).slice(0, 60);

  const inkind = sheetRows_(ss, TABS.inkind, 6)
    .filter(r => r[1] && r[2] && visible(r[5]))
    .map(r => ({ date: iso(r[0]), name: String(r[1]).trim(), item: String(r[2]).trim(), qty: String(r[3] || ''), note: String(r[4] || '') }))
    .reverse();

  const photoRows = sheetRows_(ss, TABS.photos, 6).filter(r => r[0] && r[2] && visible(r[5]));
  const photosFor = name => {
    const out = { before: [], after: [] };
    photoRows.forEach(r => { if (String(r[0]).trim() === name) out[String(r[1]).trim() === 'بعد' ? 'after' : 'before'].push(String(r[2]).trim()); });
    return out;
  };
  const projects = sheetRows_(ss, TABS.projects, 4)
    .filter(r => r[0] && visible(r[3]))
    .map(r => {
      let v = Number(String(r[1]).replace('%', '')) || 0;
      if (v > 0 && v <= 1 && String(r[1]).indexOf('%') < 0 && typeof r[1] === 'number' && r[1] % 1 !== 0) v = v * 100;
      const ar = String(r[0]).trim();
      return { ar: ar, pct: Math.max(0, Math.min(100, v)), desc: String(r[2] || ''), photos: photosFor(ar) };
    });

  const out = {
    ok: true,
    updated: new Date().toISOString(),
    settings: s,
    totals: {
      grandUsd: grandUsd, grandSyp: grandUsd * rate,
      usd: sums.USD, syp: sums.SYP, sar: sums.SAR,
      count: rows.filter(r => r[1] && Number(String(r[2]).replace(/[^\d.]/g, ''))).length,
      rate: rate
    },
    top: top, recent: recent, inkind: inkind, projects: projects
  };
  try { cache.put('public_data', JSON.stringify(out), 30); } catch (x) {}
  return out;
}

function sheetRows_(ss, name, cols) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, cols).getValues()
    .filter(r => r.some(v => v !== '' && v !== null));
}

/* ============================ Exchange rate (الليرة اليوم) ============================ */

const RATE_API = 'https://api-v2.sp-today.com/api/v1/overview?lang=ar&city=damascus';

/** يجلب سعر الصرف (متوسط الشراء والمبيع) ويحدّث ورقة الإعدادات — يعمل كل ساعة تلقائيًا */
function updateRates() {
  const ss = openActive_();
  const s = readSettings_(ss);
  if (String(s.rate_mode).trim() === 'يدوي') return 'manual';
  const res = UrlFetchApp.fetch(RATE_API, { muteHttpExceptions: true, headers: { 'Accept': 'application/json', 'Origin': 'https://sp-today.com', 'Referer': 'https://sp-today.com/', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36' } });
  if (res.getResponseCode() !== 200) throw new Error('rate_http_' + res.getResponseCode());
  const j = JSON.parse(res.getContentText());
  const find = code => (j.data && j.data.rates || []).find(r => r.code === code);
  const avg = r => { const c = r && r.cities && r.cities.damascus; return c ? (Number(c.buy) + Number(c.sell)) / 2 : 0; };
  const usdOld = avg(find('USD'));           // بالليرة القديمة
  const sarOld = avg(find('SAR'));
  if (!(usdOld > 0)) throw new Error('rate_missing');
  const usdNew = Math.round(usdOld) / 100;    // الليرة الجديدة = القديمة ÷ 100
  const o = { usd_to_syp: usdNew, rate_updated: new Date().toISOString() };
  if (sarOld > 0) o.sar_to_usd = Math.round(sarOld / usdOld * 10000) / 10000;
  saveSettings_(o);
  clearCache_();
  return o;
}

/** شغّلها مرة واحدة: تنشئ التحديث التلقائي كل ساعة وتحدّث السعر فورًا */
function setupRates() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'updateRates').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('updateRates').timeBased().everyHours(1).create();
  Logger.log(JSON.stringify(updateRates()));
}

/** شغّل هذه الدالة مرة واحدة من المحرر لمنح الصلاحيات قبل النشر */
function authorize() {
  DriveApp.getRootFolder();
  SpreadsheetApp.getActive && SpreadsheetApp.getActive();
  UrlFetchApp.fetch(RATE_API, { muteHttpExceptions: true });
  ScriptApp.getProjectTriggers();
  Logger.log('تم منح الصلاحيات ✔');
}
