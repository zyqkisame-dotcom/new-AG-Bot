# 🥇 AnyGold WA Blast Bot

Auto blast harga emas kepada dealers setiap **10:00 AM MYT** (Isnin–Jumaat).

Scrape live prices dari:
- [AnyGold](https://anygold.com.my/)
- [MKS Pamp](https://www.mkspamp.com.my/pricing)
- [MS Gold Bullion](https://msgold.com.my/)

Hantar via **[Whapi.cloud](https://whapi.cloud)** — connect terus ke WA Business app anda.

---

## ⚡ Quick Setup

### 1. Clone repo
```bash
git clone https://github.com/zyqkisame-dotcom/new-AG-Bot.git
cd new-AG-Bot
```

### 2. Install packages
```bash
npm install
```

### 3. Setup Whapi.cloud
- Daftar di [whapi.cloud](https://whapi.cloud) (ada 5 hari free trial)
- Create Channel → Scan QR dengan WA Business anda
- Copy **Channel Token** dari Settings

### 4. Configure token
```bash
# Rename fail
copy .env.example .env

# Buka .env dengan Notepad dan isi token
WHAPI_TOKEN=your_whapi_channel_token_here
```

### 5. Test & Run
```bash
# Test blast sekarang
npm test

# Run scheduler (10am setiap hari)
npm start

# Run 24/7 dengan PM2
npm install -g pm2
pm2 start index.js --name "gold-bot"
pm2 save
```

---

## 📋 Senarai 10 Dealers & Formula

| # | Dealer | Phone | Source | Formula |
|---|--------|-------|--------|---------|
| 1 | FAUZIAH | 012-691-3431 | MKS We Buy | 999.9−RM3, 999−RM4, 916−RM6, 875/835/750/585−RM12, 375−RM18 |
| 2 | NORIDAH | 012-597-4724 | AnyGold We Buy | Terus live screen rate |
| 3 | ZURAINI | 014-703-2770 | AnyGold We Buy | Terus live screen rate |
| 4 | TAQ NIAGA | 018-277-0801 | MKS We Buy | 999.9−RM3, 999−RM4, 916−RM6, 875/835/750/585−RM12, 375−RM15 |
| 5 | HYNN GOLD | 014-300-5979 | MKS We Buy | Atas 900: −RM5 \| Bawah 900: −RM8 |
| 6 | ARX HL | 017-691-4202 | MS Gold We Buy | 999.9−RM3, lain terus live MS Gold |
| 7 | ARX SK | 011-2571-8445 | MS Gold We Buy | 999.9/999/916−RM2, 875 ke bawah−RM5 |
| 8 | ARK SGB | 018-255-3022 | MS Gold We Buy | 999.9−RM2, lain +RM2 |
| 9 | ARX SRIG | 016-788-0882 | MS Gold We Buy | 999.9−RM1, lain +RM3 |
| 10 | ARX DD | 019-332-7748 & 011-623-4105 | MS Gold We Buy | 999.9−RM2, lain +RM2 |

---

## 💬 Contoh WA Message

```
Assalamualaikum & Selamat Sejahtera

🥇 *HARGA EMAS HARI INI*
📅 Isnin, 23 Jun 2026
🕙 10:00 AM
👤 FAUZIAH
─────────────────────
999.9 (24K): *RM 598*/g
999   (24K): *RM 584*/g
916   (22K): *RM 537*/g
875   (21K): *RM 504*/g
835   (20K): *RM 480*/g
750   (18K): *RM 420*/g
585   (14K): *RM 268*/g
375   ( 9K): *RM 161*/g
─────────────────────
_Harga tertakluk kepada perubahan pasaran_
_Hubungi untuk lock harga_

Semoga dimurahkan rezeki 🤲
```

---

## ➕ Tambah Dealer Baru

Dalam `index.js`, tambah dalam array `DEALERS`:
```js
{
  name: "NAMA DEALER",
  phone: "601XXXXXXXX",   // country code, tanpa +
  ref: "MKS We Buy",
  src: "mks",             // mks | ag | msgold
  rounding: "floor",      // floor = bulatkan bawah | as-is = kekal
  deduct: {
    "999.9": 3,  "999": 4,   "916": 6,
    "875": 12,   "835": 12,  "750": 12,
    "585": 12,   "375": 18
  },
},
```

> **Note:** Nilai `deduct` positif = tolak, negatif = tambah

---

## 🔧 Troubleshoot

| Masalah | Penyelesaian |
|---------|-------------|
| WA disconnect | Whapi dashboard → Reconnect → Scan QR semula |
| Token invalid | Semak fail `.env`, copy token semula |
| Harga missing/0 | Website tukar layout — update scraper |
| Bot tak jalan 10am | `pm2 status` — pastikan running |

---

## ⚠️ Penting

- **Jangan commit fail `.env`** — token anda ada dalam tu
- `.gitignore` dah set untuk exclude `.env` secara automatik
- Kongsikan `.env.example` je, bukan `.env`

---

## 📦 Tech Stack

- [Node.js](https://nodejs.org/) — runtime
- [Puppeteer](https://pptr.dev/) — web scraping
- [node-cron](https://github.com/node-cron/node-cron) — scheduler
- [Whapi.cloud](https://whapi.cloud) — WhatsApp API
- [axios](https://axios-http.com/) — HTTP requests
- [dotenv](https://github.com/motdotla/dotenv) — environment variables
