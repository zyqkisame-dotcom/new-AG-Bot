# 🥇 Gold Price WhatsApp Blast Bot

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
git clone https://github.com/YOUR_USERNAME/gold-wa-bot.git
cd gold-wa-bot
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
# Copy fail contoh
cp .env.example .env

# Buka .env dan isi token anda
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

## 📋 Senarai Dealers & Formula

| Dealer | Source | Formula |
|--------|--------|---------|
| FAUZIAH | MKS We Buy | 999.9−RM3, 999−RM4, 916−RM6, 875/835/750/585−RM12, 375−RM18 |
| NORIDAH | AnyGold We Buy | Terus live screen rate |
| ZURAINI | AnyGold We Buy | Terus live screen rate |
| TAQ NIAGA | MKS We Buy | 999.9−RM3, 999−RM4, 916−RM6, 875/835/750/585−RM12, 375−RM15 |
| HYNN GOLD | MKS We Buy | Atas 900: −RM5 \| Bawah 900: −RM8 |
| ARX HL | MS Gold We Buy | 999.9−RM3, lain terus live MS Gold |
| ARX SK | MS Gold We Buy | 999.9/999/916−RM2, 875 ke bawah−RM5 |

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
    "999.9": 3, "999": 4, "916": 6,
    "875": 12, "835": 12, "750": 12,
    "585": 12, "375": 18
  },
},
```

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
