# ALAMEER SOFTWARE — Al-Makhadhi WISP Edition
**OpenWrt for Phicomm K2 (mt7620 / `phicomm_k2-v22.5`)** — MikroTik Hotspot / WISP ready
Developer: **Eng. Abdulrahim Al-Makhadhi** | المهندس عبد الرحيم الماخذي

```
.
├── .github/workflows/build-firmware.yml   # GitHub Actions build + release
├── configs/phicomm_k2.diffconfig          # minimal package selection
├── scripts/patch-theme.py                 # patches the real LuCI header/footer (logo + footer)
└── files/                                 # overlay copied into the firmware rootfs
    ├── etc/banner                         # SSH banner
    ├── etc/uci-defaults/99-almakhadhi-wisp# first-boot settings
    ├── usr/bin/alameer-watchdog.sh        # RAM + 2.4GHz watchdog (cron, every 5 min)
    └── www/luci-static/
        ├── bootstrap/custom-alameer.css   # Dark Red & Silver theme
        └── resources/alameer-logo.png     # logo (128px)
```

## ⚠️ Important notes / ملاحظات مهمة
1. **Device / الجهاز:** target is `ramips/mt7620` profile **`phicomm_k2-v22.5`** (K2 whose stock firmware is 22.5.x.x or newer, MT7612E 5GHz).
   If your router still runs stock **22.4 or older**, run the workflow with `phicomm_k2-v22.4`. Flashing the wrong variant can brick the router
   because the flash layout differs (v22.5 has an extra `permanent_config` partition).
   الملف مبني لـ `phicomm_k2-v22.5`. إذا كان فيرموير الجهاز الأصلي 22.4 أو أقدم اختر `phicomm_k2-v22.4`.
   If OpenWrt **v21.02.7** has no such profile, the workflow stops with a clear message → re-run with `openwrt_tag = v22.03.7`.
2. **Theme patching:** `header.htm` / `footer.htm` are patched at build time from the genuine LuCI 21.02.7 files
   (`scripts/patch-theme.py`) instead of being hand-copied, so LuCI can't break. The build fails early if the patch doesn't match.
3. **TX power 30 / القدرة 30:** the driver/EEPROM/regdb still cap the real output (and 30 dBm exceeds legal limits in many countries). Use responsibly.
4. **No firewall package** is installed (no NAT, pure L2 bridge). Wi-Fi is **open** and root has **no password** by default → set a password from LuCI/SSH.
5. **MikroTik discovery:** `lldpd` announces via LLDP/CDP/EDP/SONMP, which Winbox shows in *Neighbors*.
6. If your MikroTik is on another subnet, set `GATEWAY` at the top of `files/etc/uci-defaults/99-almakhadhi-wisp`.

---

## 🇸🇦 الدليل بالعربية

### 1) الشعار (alameer-logo.png)
الشعار موجود مسبقاً بحجم 128×128 في `files/www/luci-static/resources/alameer-logo.png`.
لاستبداله: صغّره إلى 128×128 بكسل PNG (مثلاً عبر photopea.com أو `convert logo.png -resize 128x128 alameer-logo.png`) وضعه في نفس المسار بنفس الاسم.

### 2) رفع المشروع إلى GitHub
1. أنشئ مستودعاً جديداً على github.com (مثلاً `alameer-k2-openwrt`) بدون ملفات.
2. فك ضغط الـ ZIP ثم من داخل المجلد:
```bash
git init
git add .
git commit -m "ALAMEER K2 WISP firmware"
git branch -M main
git remote add origin https://github.com/USERNAME/alameer-k2-openwrt.git
git push -u origin main
```
(أو ارفع الملفات عبر الواجهة: Add file ← Upload files، وتأكد من رفع المجلد المخفي `.github`.)
3. من Settings ← Actions ← General ← Workflow permissions اختر **Read and write permissions**.

### 3) تشغيل البناء وتنزيل الملف
1. تبويب **Actions** ← **Build ALAMEER OpenWrt 21.02.7** ← **Run workflow** ← اختر `phicomm_k2-v22.5` (أو `phicomm_k2-v22.4` لنسخة 22.4 وأقدم) ثم الإصدار `v21.02.7`.
2. الدفع (push) إلى `main` يبدأ البناء تلقائياً أيضاً. يستغرق البناء 40–90 دقيقة تقريباً.
3. بعد النجاح: حمّل الملف `ALAMEER-K2-...-sysupgrade.bin` من **Releases** أو من **Artifacts**.

### 4) التفليش عبر Breed بأمان (بدون مسح EEPROM/ART)
1. وصّل الكمبيوتر بمنفذ LAN، واجعل IP الكمبيوتر `192.168.1.x` (مثل 192.168.1.10).
2. افصل الكهرباء، اضغط زر **Reset** باستمرار، شغّل الكهرباء، وأبقِ الزر ~5–10 ثوانٍ حتى تدخل Breed، ثم افتح `http://192.168.1.1`.
3. **قبل أي شيء:** من قائمة النسخ الاحتياطي (固件备份 / Backup) احفظ **EEPROM (ART)** و **Bootloader** ونسخة كاملة إن أمكن.
4. افتح **固件更新 (Firmware update)** ← اختر ملف `.bin` ← اختر نوع التحديث **固件 (Firmware) فقط**.
   لا تختر: EEPROM / ART / Bootloader / Full-flash، ولا تفعّل خيار مسح كل الفلاش.
5. اضغط تحديث، انتظر حتى يعيد الجهاز التشغيل (~2–3 دقائق) ولا تفصل الكهرباء.
6. بعد الإقلاع اضبط IP الكمبيوتر على `192.168.1.x` وافتح `http://192.168.1.20` (المستخدم root بدون كلمة سر).

---

## 🇬🇧 English guide

### 1) Logo
A 128×128 PNG is already at `files/www/luci-static/resources/alameer-logo.png`. To replace it, resize your logo to 128×128 PNG
(e.g. `convert logo.png -resize 128x128 alameer-logo.png`) and keep the same path/name.

### 2) Push to GitHub
Create an empty repo, then in the project folder:
```bash
git init && git add . && git commit -m "ALAMEER K2 WISP firmware"
git branch -M main
git remote add origin https://github.com/USERNAME/alameer-k2-openwrt.git
git push -u origin main
```
Then **Settings → Actions → General → Workflow permissions → Read and write**.
(If uploading via the web UI, make sure the hidden `.github` folder is included.)

### 3) Run the build
**Actions → Build ALAMEER OpenWrt 21.02.7 → Run workflow** (pick `phicomm_k2-v22.5` or `phicomm_k2-v22.4`, tag `v21.02.7`). Takes ~40–90 min.
Download `ALAMEER-K2-...-sysupgrade.bin` from **Releases** or the run's **Artifacts**. The job fails if the image is ≥ 7.4 MiB.

### 4) Flash safely with Breed (keep EEPROM/ART)
1. PC on a LAN port, static IP `192.168.1.10`.
2. Power off, hold **Reset**, power on, keep holding ~5–10 s, open `http://192.168.1.1` (Breed).
3. **Back up first:** EEPROM (ART), bootloader, and full flash if possible.
4. *Firmware update* → choose the `.bin` → select **Firmware only**. Do **not** select EEPROM/ART/Bootloader/Full flash or "erase all".
5. Start, wait 2–3 minutes, do not unplug.
6. Set your PC to `192.168.1.x` and open `http://192.168.1.20` (user `root`, no password).
