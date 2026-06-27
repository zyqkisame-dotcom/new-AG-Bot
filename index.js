/**
 * Gold Price WhatsApp Blast Bot
 * - Blast harga ke dealers setiap 10am MYT (Mon-Fri)
 * Uses whatsapp-web.js
 */

require("dotenv").config();
const cron = require("node-cron");
const puppeteer = require("puppeteer");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

// ─── DEALERS ───────────────────────────────────────────────────────────────
const DEALERS = [
  { name: "FAUZIAH",    phone: "60126913431",  src: "mks",    rounding: "floor",  deduct: {"999.9":3,"999":4,"916":6,"875":12,"835":12,"750":12,"585":12,"375":18} },
  { name: "NORIDAH",    phone: "60125974724",  src: "ag",     rounding: "as-is",  deduct: {"999.9":0,"999":0,"916":0,"875":0,"835":0,"750":0,"585":0,"375":0} },
  { name: "ZURAINI",    phone: "60147032770",  src: "ag",     rounding: "as-is",  deduct: {"999.9":0,"999":0,"916":0,"875":0,"835":0,"750":0,"585":0,"375":0} },
  { name: "TAQ NIAGA",  phone: "601827700801", src: "mks",    rounding: "floor",  deduct: {"999.9":3,"999":4,"916":6,"875":12,"835":12,"750":12,"585":12,"375":15} },
  { name: "HYNN GOLD",  phone: "60143005979",  src: "mks",    rounding: "floor",  deduct: {"999.9":5,"999":5,"916":5,"875":8,"835":8,"750":8,"585":8,"375":8} },
  { name: "ARX HL",     phone: "60176914202",  src: "msgold", rounding: "floor",  deduct: {"999.9":3,"999":0,"916":0,"875":0,"835":0,"750":0,"585":0,"375":0} },
  { name: "ARX SK",     phone: "601125718445", src: "msgold", rounding: "floor",  deduct: {"999.9":2,"999":2,"916":2,"875":5,"835":5,"750":5,"585":5,"375":5} },
  { name: "ARK SGB",    phone: "60182553022",  src: "msgold", rounding: "floor",  deduct: {"999.9":2,"999":-2,"916":-2,"875":-2,"835":-2,"750":-2,"585":-2,"375":-2} },
  { name: "ARX SRIG",   phone: "60167880882",  src: "msgold", rounding: "floor",  deduct: {"999.9":1,"999":-3,"916":-3,"875":-3,"835":-3,"750":-3,"585":-3,"375":-3} },
  { name: "ARX DD",     phone: "60193327748",  src: "msgold", rounding: "floor",  deduct: {"999.9":2,"999":-2,"916":-2,"875":-2,"835":-2,"750":-2,"585":-2,"375":-2}, extraPhone: "60116234105" },
];

const PURITIES = ["999.9","999","916","875","835","750","585","375"];
const PURITY_LABEL = {
  "999.9":"999.9 (24K)","999":"999   (24K)","916":"916   (22K)",
  "875":"875   (21K)","835":"835   (20K)","750":"750   (18K)",
  "585":"585   (14K)","375":"375   ( 9K)"
};

let cachedPrices = { ag: {}, mks: {}, msgold: {}, lastUpdate: null };

// ─── WHATSAPP CLIENT ───────────────────────────────────────────────────────
let clientReady = false;

const waClient = new Client({
  authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
  puppeteer: {
    headless: true,
    executablePath: process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  }
});

waClient.on("qr", (qr) => {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║  📱 SCAN QR CODE DENGAN WHATSAPP     ║");
  console.log("╚══════════════════════════════════════╝\n");
  qrcode.generate(qr, { small: true });
  console.log("\nCara scan: Buka WhatsApp > ⋮ Menu > Peranti Dipautkan > Paut Peranti\n");
});

waClient.on("authenticated", () => {
  console.log("🔐 WhatsApp authenticated! Tunggu sebentar...");
});

waClient.on("ready", () => {
  clientReady = true;
  const info = waClient.info;
  console.log(`✅ WhatsApp connected! (${info?.pushname || "Bot"} — ${info?.wid?.user || ""})`);
});

waClient.on("auth_failure", (msg) => {
  console.error("❌ Auth failure:", msg);
  clientReady = false;
});

waClient.on("disconnected", (reason) => {
  clientReady = false;
  console.log("⚠️  WhatsApp disconnected:", reason);
  console.log("🔄 Restarting in 10 seconds...");
  setTimeout(() => waClient.initialize(), 10000);
});

waClient.initialize();

// ─── SCRAPERS ──────────────────────────────────────────────────────────────
async function launchBrowser() {
  return puppeteer.launch({
    headless: "new",
    executablePath: process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
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
  console.log("📡 Refreshing prices...");
  const [ag, mks, msgold] = await Promise.all([fetchAGPrices(), fetchMKSPrices(), fetchMSGoldPrices()]);
  cachedPrices = { ag, mks, msgold, lastUpdate: new Date() };
  console.log("✅ Prices updated:", new Date().toLocaleTimeString("en-MY", { timeZone:"Asia/Kuala_Lumpur" }));
}

// ─── DEALER BLAST ──────────────────────────────────────────────────────────
function calcDealerPrices(dealer) {
  const base = cachedPrices[dealer.src] || {};
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
    `📅 ${date}`,
    `🕙 ${time}`,
    `👤 ${dealer.name}`,
    "─────────────────────",
  ];
  for (const p of PURITIES) {
    if (prices[p] === undefined) continue;
    const v = prices[p];
    lines.push(`${PURITY_LABEL[p]}: *${Number.isInteger(v) ? `RM ${v}` : `RM ${v.toFixed(2)}`}*`);
  }
  lines.push("─────────────────────");
  lines.push("_Harga tertakluk kepada perubahan pasaran_");
  lines.push("_Hubungi untuk lock harga_");
  lines.push("");
  lines.push("Semoga dimurahkan rezeki 🤲");
  return lines.join("\n");
}

async function sendWA(phone, message) {
  try {
    await waClient.sendMessage(`${phone}@c.us`, message);
    console.log(`✅ Sent → ${phone}`);
    return true;
  } catch(e) {
    console.error(`❌ Failed → ${phone}:`, e.message);
    return false;
  }
}

async function runBlast() {
  const now = new Date();
  console.log(`\n${"═".repeat(50)}\n🚀 Blast started: ${now.toISOString()}\n${"═".repeat(50)}\n`);

  if (!clientReady) {
    console.log("⚠️  Blast skipped — WhatsApp not connected yet");
    return;
  }

  await refreshPrices();

  let ok = 0, fail = 0;
  for (const dealer of DEALERS) {
    const prices = calcDealerPrices(dealer);
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

// ─── SCHEDULER ─────────────────────────────────────────────────────────────
cron.schedule("0 10 * * 1-5", () => runBlast().catch(console.error), { timezone:"Asia/Kuala_Lumpur" });
cron.schedule("*/30 * * * *", () => refreshPrices().catch(console.error));

refreshPrices().catch(console.error);

console.log("🤖 AnyGold Bot aktif...");
console.log("⏰ Blast: 10:00 AM MYT, Isnin–Jumaat\n");

if (process.argv.includes("--test")) {
  console.log("🧪 Test blast bila WhatsApp connected...");
  const waitAndTest = setInterval(() => {
    if (clientReady) {
      clearInterval(waitAndTest);
      runBlast().catch(console.error);
    }
  }, 2000);
}
