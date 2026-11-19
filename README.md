# Al-Makhadhi Custom Firmware (Phicomm K2 Edition)
Developed & Customized by Eng. Abdulrahim Al-Makhadhi — المهندس عبد الرحيم الماخذي

## البنية
```
al-makhadhi-k2-firmware/
├── build.sh                 بناء كامل من المصدر (OpenWrt 23.05)
├── diffconfig               إعداد الحزم للبناء من المصدر
├── packages/core.txt        حزم أساسية (ImageBuilder)
├── packages/extra.txt       sqm / wol / relay-ui / pppoe-server (تسقط تلقائياً في lite)
├── scripts/ib-build.sh      بناء سريع (ImageBuilder) + فحص الحجم + fallback
├── .github/workflows/build.yml
└── files/                   overlay داخل الفيرموير
    ├── etc/banner
    ├── etc/al-makhadhi/defaults.conf      (IP, SSID, كلمة سر الواي فاي, القنوات, TTL ...)
    ├── etc/uci-defaults/99-custom-al-makhadhi
    ├── etc/sysctl.d/99-al-makhadhi.conf
    ├── usr/bin/al-ttl                     (al-ttl on 65 | al-ttl off)
    ├── usr/share/al-makhadhi/brand.css    (ذيل الصفحة + ألوان زرقاء)
    └── www/luci-static/resources/view/status/include/90_al-makhadhi.js   (بطاقة Overview)
```

## البناء على GitHub (الأسرع)
ارفع المجلد كاملاً مع `.github` ← Actions ← Build Al-Makhadhi K2 Firmware ← Run workflow.
إن تجاوزت الصورة 7.5MB يبني تلقائياً نسخة lite بدون sqm/wol وغيرها.

## البناء المحلي من المصدر
`chmod +x build.sh && ./build.sh` (اختياري: `DEVICE=phicomm_psg1218a ./build.sh`).

## التفليش عبر Breed (بدون خسارة EEPROM/ART)
1. شغّل الجهاز مع الضغط على Reset حتى يدخل Breed، ثم افتح `http://192.168.1.1`.
2. **قبل أي شيء**: احفظ نسخة كاملة من الفلاش (على الأقل قسم `factory/ART`).
3. ارفع ملف `*sysupgrade.bin` كـ **Firmware** فقط. لا تُفلّشه على Bootloader ولا EEPROM/ART.
4. لا تختر خيارات مسح كل الفلاش. بعد الانتهاء أعد التشغيل.
5. إن كان الجهاز يعمل بـ OpenWrt: `sysupgrade -n al-makhadhi-...-sysupgrade.bin`.
6. تأكد أن الحجم ≤ 7.5MB قبل التفليش (يتحقق منه السكربت).

## ملاحظات
- اسم الجهاز في OpenWrt 23.05 هو `phicomm_k2-v22.5` (أو `phicomm_psg1218a/b`)، وليس `phicomm_k2`.
- الشبكتان مفتوحتان بدون كلمة سر (WIFI_KEY فارغة). غيّر `WIFI_KEY` و`LAN_IP` في `files/etc/al-makhadhi/defaults.conf` قبل البناء.
- لا توجد كلمة مرور لـ root في البداية: ضع واحدة بعد أول دخول.
