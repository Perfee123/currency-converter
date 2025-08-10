const fromEl = document.getElementById("from");
const toEl = document.getElementById("to");
const amountEl = document.getElementById("amount");
const resultEl = document.getElementById("result");
const swapBtn = document.getElementById("swapBtn");
const convertBtn = document.getElementById("convertBtn");

const FACTS = [
  " Tip: Press Enter to convert quickly.",
  " Most traded: USD, EUR, JPY, GBP, AUD.",
  " Rates update hourly (sometimes faster).",
  " Swap button flips the currencies instantly.",
];

function randomFact() {
  const el = document.getElementById("fact");
  if (el) el.textContent = FACTS[Math.floor(Math.random() * FACTS.length)];
}

function format(n, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

const CACHE_KEY = "rates_cache_v1";
function getCached(base) {
  try {
    const blob = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    const hit = blob[base];
    if (!hit) return null;
    const ttl = 12 * 60 * 60 * 1000;
    return Date.now() - hit.ts > ttl ? null : hit.data;
  } catch { return null; }
}
function setCached(base, data) {
  try {
    const blob = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    blob[base] = { ts: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(blob));
  } catch {}
}

const endpoint = (base) => `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;

async function fetchRates(base) {
  const cached = getCached(base);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(endpoint(base), { signal: controller.signal });
  clearTimeout(timer);

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.result !== "success") throw new Error(data["error-type"] || "API error");
  setCached(base, data);
  return data;
}

async function initCurrencies() {
  try {
    const data = await fetchRates("USD");
    const codes = Object.keys(data.rates).sort();

    [fromEl, toEl].forEach(select => {
      select.innerHTML = "";
      for (const code of codes) {
        const opt = document.createElement("option");
        opt.value = opt.textContent = code;
        select.appendChild(opt);
      }
    });

    fromEl.value = "USD";
    toEl.value = "EUR";
  } catch (e) {
    console.error(e);
    resultEl.textContent = "Check your connection";
  }
}

async function convertCurrency() {
  const amount = parseFloat(amountEl.value);
  const from = fromEl.value;
  const to = toEl.value;

  if (!amount || amount <= 0) {
    resultEl.textContent = "Please enter a valid amount";
    return;
  }

  resultEl.textContent = "Fetching latest rates…";

  try {
    const data = await fetchRates(from);
    const rate = data.rates[to];
    if (!rate) throw new Error(`No rate for ${to}`);

    const converted = amount * rate;
    const pretty = `${format(amount, from)} = ${format(converted, to)}`;
    resultEl.textContent = pretty + (converted > 1000 ? "  💰" : "  💵");
  } catch (err) {
    console.error(err);
    resultEl.textContent =
      err.name === "AbortError"
        ? "Request timed out. Try again."
        : `Error fetching rates: ${err.message}`;
  }
}

swapBtn.addEventListener("click", () => {
  const tmp = fromEl.value;
  fromEl.value = toEl.value;
  toEl.value = tmp;
  if (amountEl.value) convertCurrency();
});

convertBtn.addEventListener("click", convertCurrency);
amountEl.addEventListener("keydown", (e) => { if (e.key === "Enter") convertCurrency(); });
[fromEl, toEl].forEach(el => el.addEventListener("change", () => amountEl.value && convertCurrency()));

randomFact();
initCurrencies();
