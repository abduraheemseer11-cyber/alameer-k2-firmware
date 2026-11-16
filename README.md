# AL-AMEER Firmware — Phicomm K2 (PSG1218) / OpenWrt ramips-mt7620

## طريقة البناء على GitHub
1. أنشئ مستودعاً جديداً وارفع محتويات هذا المجلد كما هي (مع المجلد المخفي `.github`).
2. عدّل `files/etc/ameer/defaults.conf` (أهم شيء: `WIFI_KEY` كلمة سر الواي فاي).
3. تبويب **Actions** ← *Build AL-AMEER Phicomm K2 Firmware* ← **Run workflow**.
   - اختر `phicomm_psg1218a` أو `phicomm_psg1218b` (حسب نسخة الجهاز، انظر ملصق/لوحة الجهاز).
4. بعد الانتهاء حمّل الملف `*sysupgrade.bin` من Artifacts.

## التفليش عبر Breed
- أولاً خذ نسخة احتياطية كاملة من الفلاش (خصوصاً قسم `factory/EEPROM`) من واجهة Breed.
- ادخل Breed (غالباً 192.168.1.1) ← تحديث الفيرموير ← ارفع ملف `sysupgrade.bin`.

## بعد التشغيل
- الآي بي: `192.168.1.20` — لا توجد كلمة سر لـ root؛ ضع واحدة فوراً (System → Administration).
- LuCI: أول عنصر في القائمة **البرمجة السريعة** (Access Point / Mesh / AP WDS / Client WDS). الإعدادات تُحفظ في `/etc/config/ameer` وتُطبّق بالأمر `ameer-mode`.
- الشبكتان مفتوحتان بدون كلمة مرور افتراضياً؛ فعّل «تخصيص كلمة مرور Wifi» لوضع كلمة.
- VLAN: Network ← Switch، و Multi-SSID: Network ← Wireless ← Add.
- RAM Cleaner: كرون كل 10 دقائق (`/usr/bin/ram-cleaner`) يفرّغ الكاش عند نقص الذاكرة.
- Watchdog: `/usr/bin/ameer-watchdog` كل دقيقة (إعادة الواي فاي/الشبكة/الجهاز عند التعليق). إضافةً إلى watchdog العتاد الذي يفعّله procd.

## ملاحظات صريحة
- لم يُبنَ هذا المشروع ولم يُختبر على جهاز من طرفي؛ شغّل الـ workflow وجرّب، وأرسل لي سجل الأخطاء إن حدث أي خطأ.
- اكتشاف الجيران في المايكروتك يعمل عبر **CDP/LLDP** (حزمة lldpd). بروتوكول MNDP الخاص بمايكروتك غير مضمّن.
- Repeater/WDS (تمرير الماك) يتطلب دعم 4addr/WDS في الأكسس بوينت الأصلي ودرايفر الشريحة؛ إن لم يعمل استخدم relayd.
- `Country=US` يفتح القنوات والقدرة حسب الـ regdb؛ تأكد أن استخدامك مسموح قانونياً في بلدك.
- الحجم: يُفحص تلقائياً أنه ≤ 7.5MB. إن زاد احذف حزماً من `packages.txt`.
