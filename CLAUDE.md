# منصة تبرعات التجمع الطبي في التل — Dr.Tal

موقع عرض مباشر للتبرعات، عربي فقط (RTL)، خط Readex Pro، ألوان فيروزي ومرجاني.

## البنية
- `index.html` — الموقع العام (HTML/CSS/JS في ملف واحد، بدون build).
- `settings-alsalam.html` — صفحة الإعدادات السرية (محمية بكلمة سر على الخادم).
- `config.js` — رابط خادم Apps Script.
- `google-apps-script.gs` — كود الخادم (نسخة طبق الأصل من مشروع Apps Script).
- `_headers` — يمنع أرشفة صفحة الإعدادات. `og-image.jpg`, `icon.png`, `apple-touch-icon.png` — معاينة الروابط والأيقونات.

## النشر
- **الموقع:** أي `git push` إلى `main` ينشره Cloudflare Pages تلقائيًا على https://drtal.pages.dev خلال ثوانٍ.
- **الخادم (Apps Script):** عبر clasp
  - Script ID: `1hkumM8ZsKUZf43wCQbypdhh2t4sivNGe_OOWsSraVq_2_I3TQnPsC1JB`
  - Deployment ID (لا تغيّره، الموقع يعتمد عليه): `AKfycbwVSZvh0YgaUR7rYBtPhHF3_G3T3yXsn1Z_6I3QwUBh2kXvY1WMugmvnJ86_oPnCv4r`
  - مجلد `server/` (خارج git) هو نسخة clasp من المشروع؛ ملف الكود فيه اسمه `server/الرمز.js` (لا تغيّر اسمه، وإلا يُحذف ويُنشأ ملف جديد على Google).
  - عدّل `server/الرمز.js` ثم انسخه فوق `google-apps-script.gs` (النسخة الاحتياطية في git) قبل الـ commit.
  - قبل أي تعديل: `cd server && clasp pull` للتأكد أن لا تعديلات أحدث على Google.
  - كلمة السر في Script Properties باسم `ADMIN_PASSWORD` — لا تُكتب في الكود أبدًا.

## طريقة النشر السريع
- **الموقع:** `git push`
- **الخادم:** `cd server && clasp push && clasp deploy -i AKfycbwVSZvh0YgaUR7rYBtPhHF3_G3T3yXsn1Z_6I3QwUBh2kXvY1WMugmvnJ86_oPnCv4r`

## البيانات
- Google Sheet الفعّال: https://docs.google.com/spreadsheets/d/1kytPVXyTY_1cJpH8krS537jx7BrMdZrxEErztNgk6Lo/edit
- أوراق: الإعدادات، التبرعات المالية، التبرعات العينية، المشاريع، صور المشاريع.
- الليرة: تُسجَّل بالليرة السورية **الجديدة**، وتُعرض بخانتين عشريتين مع القديمة (×100) بخط صغير.
- سعر الصرف: تلقائي كل ساعة من api-v2.sp-today.com (متوسط الشراء والمبيع، ÷100 للجديدة)، أو يدوي.
- الصور تُضغط في المتصفح لأقل من 300KB وتُحفظ في مجلد Drive "منصة التبرعات - الصور".

## قواعد العمل
- كل النصوص بالعربي. لا إنجليزي على الواجهة.
- جرّب على مقاس جوال (390px) ولابتوب قبل الـ push.
- لا أسماء حملات. العنوان: "منصة تبرعات التجمع الطبي في التل".
