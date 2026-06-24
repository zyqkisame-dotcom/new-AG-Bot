/**
 * Gold Price WhatsApp Blast Bot + AI Customer Reply
 * - Blast harga ke dealers setiap 10am MYT (Mon-Fri)
 * - Auto reply customer 24/7 guna Claude AI
 * - Skip reply kalau dealer
 * Uses Whapi.cloud + Anthropic Claude API
 */

require("dotenv").config();
const axios = require("axios");
const cron = require("node-cron");
const puppeteer = require("puppeteer");
const express = require("express");

const WHAPI_TOKEN     = process.env.WHAPI_TOKEN || "YOUR_WHAPI_TOKEN";
const WHAPI_URL       = "https://gate.whapi.cloud/messages/text";
const WHAPI_HOOK_PORT = process.env.PORT || 3000;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_KEY || "YOUR_ANTHROPIC_API_KEY";

// ─── DEALERS (skip auto-reply untuk nombor ni) ─────────────────────────────
const DEALERS = [
  { name: "FAUZIAH",    phone: "60126913431",  ref: "MKS We Buy",    src: "mks",    rounding: "floor",  deduct: {"999.9":3,"999":4,"916":6,"875":12,"835":12,"750":12,"585":12,"375":18} },
  { name: "NORIDAH",    phone: "60125974724",  ref: "AnyGold We Buy",src: "ag",     rounding: "as-is",  deduct: {"999.9":0,"999":0,"916":0,"875":0,"835":0,"750":0,"585":0,"375":0} },
  { name: "ZURAINI",    phone: "60147032770",  ref: "AnyGold We Buy",src: "ag",     rounding: "as-is",  deduct: {"999.9":0,"999":0,"916":0,"875":0,"835":0,"750":0,"585":0,"375":0} },
  { name: "TAQ NIAGA",  phone: "601827700801", ref: "MKS We Buy",    src: "mks",    rounding: "floor",  deduct: {"999.9":3,"999":4,"916":6,"875":12,"835":12,"750":12,"585":12,"375":15} },
  { name: "HYNN GOLD",  phone: "60143005979",  ref: "MKS We Buy",    src: "mks",    rounding: "floor",  deduct: {"999.9":5,"999":5,"916":5,"875":8,"835":8,"750":8,"585":8,"375":8} },
  { name: "ARX HL",     phone: "60176914202",  ref: "MS Gold We Buy",src: "msgold", rounding: "floor",  deduct: {"999.9":3,"999":0,"916":0,"875":0,"835":0,"750":0,"585":0,"375":0} },
  { name: "ARX SK",     phone: "601125718445", ref: "MS Gold We Buy",src: "msgold", rounding: "floor",  deduct: {"999.9":2,"999":2,"916":2,"875":5,"835":5,"750":5,"585":5,"375":5} },
  { name: "ARK SGB",    phone: "60182553022",  ref: "MS Gold We Buy",src: "msgold", rounding: "floor",  deduct: {"999.9":2,"999":-2,"916":-2,"875":-2,"835":-2,"750":-2,"585":-2,"375":-2} },
  { name: "ARX SRIG",   phone: "60167880882",  ref: "MS Gold We Buy",src: "msgold", rounding: "floor",  deduct: {"999.9":1,"999":-3,"916":-3,"875":-3,"835":-3,"750":-3,"585":-3,"375":-3} },
  { name: "ARX DD",     phone: "60193327748",  ref: "MS Gold We Buy",src: "msgold", rounding: "floor",  deduct: {"999.9":2,"999":-2,"916":-2,"875":-2,"835":-2,"750":-2,"585":-2,"375":-2}, extraPhone: "60116234105" },
];

const DEALER_PHONES = new Set(DEALERS.flatMap(d => d.extraPhone ? [d.phone, d.extraPhone] : [d.phone]));
const PURITIES = ["999.9","999","916","875","835","750","585","375"];
const PURITY_LABEL = {
  "999.9":"999.9 (24K)","999":"999   (24K)","916":"916   (22K)",
  "875":"875   (21K)","835":"835   (20K)","750":"750   (18K)",
  "585":"585   (14K)","375":"375   ( 9K)"
};

// Cache harga terkini
let cachedPrices = { ag: {}, mks: {}, msgold: {}, lastUpdate: null };

// ─── SCRAPERS ──────────────────────────────────────────────────────────────
async function launchBrowser() {
  return puppeteer.launch({ headless:"new", args:["--no-sandbox","--disable-setuid-sandbox"] });
}

async function fetchAGPrices() {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto("https://anygold.com.my/", { waitUntil:"networkidle2", timeout:30000 });
    await new Promise(r => setTimeout(r, 3000));
    const prices = await page.evaluate(() => {
      const result = {};
      document.querySelectorAll("*").forEach(el => {
        const text = (el.innerText||"").trim();
        ["999.9","999","916","875","835","750","585","375"].forEach(p => {
          if (text === p) {
            const parent = el.closest("tr,[class*='row'],[class*='item']");
            if (parent) {
              const nums = parent.innerText.match(/\d{3,4}\.?\d*/g);
              if (nums && nums.length > 1) {
                const price = parseFloat(nums[nums.length-1]);
                if (price > 100 && !result[p]) result[p] = price;
              }
            }
          }
        });
      });
      return result;
    });
    return prices;
  } catch(e) { console.error("AG error:", e.message); return {}; }
  finally { if (browser) await browser.close(); }
}

async function fetchMKSPrices() {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto("https://www.mkspamp.com.my/pricing", { waitUntil:"networkidle2", timeout:30000 });
    await new Promise(r => setTimeout(r, 5000));
    const prices = await page.evaluate(() => {
      const result = {};
      const map = {"9999":"999.9","999.9":"999.9","999":"999","916":"916","875":"875","835":"835","750":"750","585":"585","375":"375"};
      document.body.innerText.split("\n").forEach(row => {
        Object.keys(map).forEach(key => {
          if (row.includes(key) && !result[map[key]]) {
            const nums = row.match(/[\d,]+\.?\d*/g);
            if (nums) {
              const found = nums.map(n=>parseFloat(n.replace(",",""))).filter(n=>n>100&&n<5000);
              if (found.length > 0) result[map[key]] = found[found.length-1];
            }
          }
        });
      });
      return result;
    });
    return prices;
  } catch(e) { console.error("MKS error:", e.message); return {}; }
  finally { if (browser) await browser.close(); }
}

async function fetchMSGoldPrices() {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto("https://msgold.com.my/", { waitUntil:"networkidle2", timeout:30000 });
    await new Promise(r => setTimeout(r, 3000));
    const prices = await page.evaluate(() => {
      const result = {};
      document.querySelectorAll("table tr").forEach(row => {
        const cells = row.querySelectorAll("td");
        if (cells.length >= 2) {
          const label = cells[0].innerText.trim();
          const value = cells[1].innerText.replace(/,/g,"").trim();
          const pm = label.match(/(9999|999\.9|999|916|875|835|750|585|375)/);
          const vm = value.match(/([\d]+\.?\d*)/);
          if (pm && vm) {
            const purity = pm[1]==="9999"?"999.9":pm[1];
            const price = parseFloat(vm[1]);
            if (price > 100) result[purity] = price;
          }
        }
      });
      return result;
    });
    return prices;
  } catch(e) { console.error("MS Gold error:", e.message); return {}; }
  finally { if (browser) await browser.close(); }
}

async function refreshPrices() {
  console.log("📡 Refreshing all prices...");
  const [ag, mks, msgold] = await Promise.all([fetchAGPrices(), fetchMKSPrices(), fetchMSGoldPrices()]);
  cachedPrices = { ag, mks, msgold, lastUpdate: new Date() };
  console.log("✅ Prices updated:", new Date().toLocaleTimeString("en-MY", { timeZone:"Asia/Kuala_Lumpur" }));
  return cachedPrices;
}

// ─── FORMAT HARGA UNTUK CUSTOMER ──────────────────────────────────────────
function formatCustomerPrices() {
  const prices = cachedPrices.ag;
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-MY", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Kuala_Lumpur" });
  const dateStr = now.toLocaleDateString("ms-MY", { weekday:"long", year:"numeric", month:"long", day:"numeric", timeZone:"Asia/Kuala_Lumpur" });

  if (!Object.keys(prices).length) return "Maaf, harga tidak tersedia sekarang. Sila cuba sebentar lagi. 🙏";

  const lines = [
    "🥇 *HARGA EMAS SEMASA*",
    `📅 ${dateStr}`,
    `🕙 ${timeStr}`,
    `📊 Ref: AnyGold`,
    "─────────────────────",
  ];

  for (const p of PURITIES) {
    if (!prices[p]) continue;
    lines.push(`${PURITY_LABEL[p]}: *RM ${prices[p].toFixed(2)}*/g`);
  }

  lines.push("─────────────────────");
  lines.push("_Harga tertakluk kepada perubahan pasaran_");
  lines.push("_Untuk pertanyaan lanjut, sila tunggu kami balas_ 🙏");
  return lines.join("\n");
}

// ─── AI REPLY GUNA CLAUDE ─────────────────────────────────────────────────
async function getAIReply(customerMessage) {
  const priceContext = formatCustomerPrices();
  try {
    const res = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: `Kamu adalah assistant kedai emas Anygold Sdn Bhd Malaysia. Jawab dalam Bahasa Melayu yang mesra dan ringkas. 

Harga emas semasa:
${priceContext}

Peraturan:
- Kalau customer tanya harga, terus share harga di atas
- Kalau tanya tentang jual/beli emas, jelaskan boleh dan ajak datang atau hubungi
- Kalau tanya soalan lain, jawab dengan mesra dan professional
- Jangan buat janji yang tidak pasti
- Sentiasa akhiri dengan "Terima kasih kerana menghubungi Anygold! 😊"
- Jawapan mesti pendek dan padat — maksimum 5 ayat`,
        messages: [{ role: "user", content: customerMessage }]
      },
      {
        headers: {
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        }
      }
    );
    return res.data.content[0].text;
  } catch(e) {
    console.error("AI error:", e.message);
    // Fallback kalau AI fail
    return formatCustomerPrices();
  }
}

// ─── SEND WA ───────────────────────────────────────────────────────────────
async function sendWA(phone, message) {
  try {
    const res = await axios.post(
      WHAPI_URL,
      { to: `${phone}@s.whatsapp.net`, body: message },
      { headers: { Authorization: `Bearer ${WHAPI_TOKEN}`, "Content-Type": "application/json" } }
    );
    console.log(`✅ Sent → ${phone}`);
    return true;
  } catch(e) {
    console.error(`❌ Failed → ${phone}:`, e.response?.data || e.message);
    return false;
  }
}

// ─── CALCULATE DEALER PRICES ───────────────────────────────────────────────
function calcDealerPrices(dealer, allPrices) {
  const base = allPrices[dealer.src] || {};
  const result = {};
  for (const p of PURITIES) {
    if (!base[p]) continue;
    const val = base[p] - (dealer.deduct[p] || 0);
    result[p] = dealer.rounding === "floor" ? Math.floor(val) : Math.round(val * 100) / 100;
  }
  return result;
}

function formatDealerMsg(dealer, prices, now) {
  const date = now.toLocaleDateString("ms-MY", { weekday:"long", year:"numeric", month:"long", day:"numeric", timeZone:"Asia/Kuala_Lumpur" });
  const time = now.toLocaleTimeString("en-MY", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Kuala_Lumpur" });
  const lines = [
    "Assalamualaikum & Selamat Sejahtera",
    "",
    "🥇 *HARGA EMAS HARI INI*",
    `📅 ${date}`, `🕙 ${time}`,
    `👤 ${dealer.name}`,
    "─────────────────────",
  ];
  for (const p of PURITIES) {
    if (prices[p] === undefined) continue;
    const v = prices[p];
    lines.push(`${PURITY_LABEL[p]}: *${Number.isInteger(v)?`RM ${v}`:`RM ${v.toFixed(2)}`}*/g`);
  }
  lines.push("─────────────────────");
  lines.push("_Harga tertakluk kepada perubahan pasaran_");
  lines.push("_Hubungi untuk lock harga_");
  lines.push("");
  lines.push("Semoga dimurahkan rezeki 🤲");
  return lines.join("\n");
}

// ─── MAIN BLAST ────────────────────────────────────────────────────────────
async function runBlast() {
  const now = new Date();
  console.log(`\n${"═".repeat(50)}\n🚀 Blast started: ${now.toISOString()}\n${"═".repeat(50)}\n`);

  await refreshPrices();
  const allPrices = cachedPrices;

  let ok = 0, fail = 0;
  for (const dealer of DEALERS) {
    const prices = calcDealerPrices(dealer, allPrices);
    if (!Object.keys(prices).length) continue;
    const msg = formatDealerMsg(dealer, prices, now);
    console.log(`📤 → ${dealer.name}`);
    await new Promise(r => setTimeout(r, 1500));
    (await sendWA(dealer.phone, msg)) ? ok++ : fail++;
    if (dealer.extraPhone) {
      await new Promise(r => setTimeout(r, 1500));
      (await sendWA(dealer.extraPhone, msg)) ? ok++ : fail++;
    }
  }
  console.log(`\n✅ Blast done — ${ok} sent, ${fail} failed\n`);
}

// ─── WEBHOOK — TERIMA MESSAGE DARI CUSTOMER ────────────────────────────────
const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // Balas Whapi dulu
  try {
    const messages = req.body.messages || [];
    for (const msg of messages) {
      // Skip kalau bukan text atau dari bot sendiri
      if (!msg.text?.body || msg.from_me) continue;

      const senderPhone = msg.from?.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const messageText = msg.text.body;

      console.log(`📨 Message from ${senderPhone}: ${messageText}`);

      // Skip kalau dealer
      if (DEALER_PHONES.has(senderPhone)) {
        console.log(`⏭️  Skip — dealer: ${senderPhone}`);
        continue;
      }

      // Skip kalau group message
      if (msg.from?.includes("@g.us")) {
        console.log(`⏭️  Skip — group message`);
        continue;
      }

      // Refresh harga kalau dah lebih 30 minit
      const now = new Date();
      const lastUpdate = cachedPrices.lastUpdate;
      if (!lastUpdate || (now - lastUpdate) > 30 * 60 * 1000) {
        await refreshPrices();
      }

      // Get AI reply
      console.log(`🤖 Getting AI reply for: ${messageText}`);
      const reply = await getAIReply(messageText);

      // Send reply
      await sendWA(senderPhone, reply);
      console.log(`✅ Replied to customer ${senderPhone}`);
    }
  } catch(e) {
    console.error("Webhook error:", e.message);
  }
});

app.get("/", (req, res) => res.json({ status: "Gold WA Bot running!", dealers: DEALERS.length }));

// ─── SCHEDULER ─────────────────────────────────────────────────────────────
// Blast 10am MYT setiap Isnin-Jumaat
cron.schedule("0 10 * * 1-5", () => runBlast().catch(console.error), { timezone:"Asia/Kuala_Lumpur" });

// Refresh harga setiap 30 minit
cron.schedule("*/30 * * * *", () => refreshPrices().catch(console.error));

// Start server untuk webhook
app.listen(WHAPI_HOOK_PORT, () => {
  console.log(`🌐 Webhook server running on port ${WHAPI_HOOK_PORT}`);
});

// Load harga awal
refreshPrices().catch(console.error);

console.log("🤖 Gold WA Bot aktif...");
console.log("⏰ Blast: 10:00 AM MYT, Isnin–Jumaat");
console.log("💬 Auto reply customer: 24/7 AI\n");

if (process.argv.includes("--test")) {
  console.log("🧪 Test blast sekarang...");
  runBlast().catch(console.error);
}
