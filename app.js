/*
  Airgead Banking (CS-210) - JavaScript Port
  Logic matches original C++ implementation:
  - Monthly deposit applied before interest (when enabled)
  - Monthly interest calculation
  - Yearly summaries after every 12 months
  - Yearly interest resets at the end of each year
  Month counting starts at 1 for readability (Month 1 = first month)
*/

// ---------- Supabase setup ----------
const SUPABASE_URL = "https://gcafqjwdhtlyddcpgbdh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_2vDfA-Uf72fClGntr45FLw_dha0XZCK";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Local storage key ----------
const LOCAL_KEY = "airgead_scenarios_local_v1";

// ---------- DSA enhancement: in-memory collection of saved scenarios ----------
let investments = [];
let nextId = 1;

// Track whether if using DB saves/loads
let usingDatabase = false;

/**
 * @typedef {Object} YearSummary
 * @property {number} year
 * @property {number} yearEndBalance
 * @property {number} yearEndInterest
 */

/**
 * Calculate yearly schedule.
 * @param {number} initialInvestment
 * @param {number} monthlyDeposit
 * @param {number} annualInterestRate
 * @param {number} years
 * @param {boolean} withDeposit
 * @returns {YearSummary[]}
 */

// =======================
// CORE CALCULATION
// =======================
function calculateSchedule(initialInvestment, monthlyDeposit, annualInterestRate, years, withDeposit) {
  const results = [];

  const totalMonths = years * 12;
  let openingBalance = initialInvestment;
  let interestSoFar = 0.0;
  const deposit = withDeposit ? monthlyDeposit : 0.0;

  let year = 1;

  // Month 1 is first month for clarity
  for (let month = 1; month <= totalMonths; month++) {
    // Interest is calculated after adding the monthly deposit
    const interest =
      (openingBalance + deposit) * ((annualInterestRate / 100.0) / 12.0);

    interestSoFar += interest;

    const closingBalance = (openingBalance + deposit) + interest;

    // End-of-year after every 12 months
    if (month % 12 === 0) {
      results.push({
        year,
        yearEndBalance: closingBalance,
        yearEndInterest: interestSoFar
      });

      year += 1;
      interestSoFar = 0.0; // reset yearly interest
    }

    openingBalance = closingBalance;
  }

  return results;
}

// ---------- Inputs ----------
function getParsedInputs() {
  const initial = Number(document.getElementById("initial").value);
  const monthly = Number(document.getElementById("monthly").value);
  const rate = Number(document.getElementById("rate").value);
  const years = Number(document.getElementById("years").value);

  return { initial, monthly, rate, years };
}

function isValidInputs(inputs) {
  if (!Number.isFinite(inputs.initial) || inputs.initial < 0) return false;
  if (!Number.isFinite(inputs.monthly) || inputs.monthly < 0) return false;
  if (!Number.isFinite(inputs.rate) || inputs.rate < 0) return false;
  if (!Number.isFinite(inputs.years) || inputs.years <= 0) return false;
  return true;
}

// ---------- Local persistence helpers ----------
function loadLocalInvestments() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveLocalInvestments(list) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
}

function syncNextIdFromInvestments() {
  // Keep IDs increasing even after reload
  const maxId = investments.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);
  nextId = maxId + 1;
}

// ---------- Database helpers ----------
async function loadInvestmentsFromDb() {
  const { data, error } = await supabaseClient
    .from("investments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Map DB rows into existing in-memory shape
  return (data || []).map(r => ({
    id: r.id, // DB primary key; fine to keep internal
    initial: r.initial_investment,
    monthly: r.monthly_deposit,
    rate: r.annual_interest_rate,
    years: r.years,
    // Keep a hidden timestamp for sorting
    createdAt: r.created_at
  }));
}

async function saveInvestmentToDb(inputs) {
  const { error } = await supabaseClient.from("investments").insert([{
    initial_investment: inputs.initial,
    monthly_deposit: inputs.monthly,
    annual_interest_rate: inputs.rate,
    years: inputs.years
  }]);

  if (error) throw error;
}

// ---------- Save scenario (DB if logged in, otherwise local) ----------
async function saveInvestment(inputs) {
  if (usingDatabase) {
    await saveInvestmentToDb(inputs);
    // reload after save so list reflects DB order
    investments = await loadInvestmentsFromDb();
    return;
  }

  // Local save (persist + keep hidden timestamp for sorting)
  investments.push({
    id: nextId++,
    initial: inputs.initial,
    monthly: inputs.monthly,
    rate: inputs.rate,
    years: inputs.years,
    createdAt: new Date().toISOString() // hidden in UI but used for sorting
  });

  saveLocalInvestments(investments);
}

function sortByDateDesc() {
  investments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function sortByInitialDesc() {
  investments.sort((a, b) => b.initial - a.initial);
}

function renderInvestmentList() {
  const list = document.getElementById("savedList");
  if (!list) return;

  list.innerHTML = "";

  if (investments.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No scenarios saved yet.";
    list.appendChild(li);
    return;
  }

  investments.forEach(inv => {
    const li = document.createElement("li");

    // NOTE: timestamp stays internal only (not displayed)
    // NOTE: id stays internal only (not displayed)

    li.textContent =
      `Initial: $${inv.initial} | Monthly: $${inv.monthly} | Rate: ${inv.rate}% | Years: ${inv.years}`;

    list.appendChild(li);
  });
}

// ---------- UI helpers ----------
function money(n) {
  // Match fixed << setprecision(2)
  return Number(n).toFixed(2);
}

function clearTableBody(tbody) {
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
}

/**
 * Render yearly rows into a table body
 * @param {HTMLTableSectionElement} tbody
 * @param {YearSummary[]} rows
 */
function renderRows(tbody, rows) {
  clearTableBody(tbody);

  for (const r of rows) {
    const tr = document.createElement("tr");

    const tdYear = document.createElement("td");
    tdYear.textContent = String(r.year);

    const tdBalance = document.createElement("td");
    tdBalance.textContent = money(r.yearEndBalance);

    const tdInterest = document.createElement("td");
    tdInterest.textContent = money(r.yearEndInterest);

    tr.appendChild(tdYear);
    tr.appendChild(tdBalance);
    tr.appendChild(tdInterest);

    tbody.appendChild(tr);
  }
}

function readInputs() {
  const initial = Number(document.getElementById("initial").value);
  const monthly = Number(document.getElementById("monthly").value);
  const rate = Number(document.getElementById("rate").value);
  const years = Number(document.getElementById("years").value);

  if ([initial, monthly, rate, years].some(v => Number.isNaN(v))) {
    return { ok: false, message: "Invalid input. Please enter numeric values." };
  }
  if (initial < 0 || monthly < 0 || rate < 0) {
    return { ok: false, message: "Invalid input. Please enter non-negative values." };
  }
  if (!Number.isInteger(years) || years <= 0) {
    return {
      ok: false,
      message: "Invalid input. Please enter a whole number of years greater than 0."
    };
  }

  return { ok: true, initial, monthly, rate, years };
}

function setError(msg) {
  document.getElementById("error").textContent = msg || "";
}

// ---------- Auth UI helpers ----------
function setAuthStatus(msg) {
  const el = document.getElementById("authStatus");
  if (el) el.textContent = msg || "";
}

function setAuthUi(isLoggedIn) {
  const email = document.getElementById("authEmail");
  const pass = document.getElementById("authPassword");
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (!email || !pass || !loginBtn || !registerBtn || !logoutBtn) return;

  email.disabled = isLoggedIn;
  pass.disabled = isLoggedIn;

  loginBtn.style.display = isLoggedIn ? "none" : "";
  registerBtn.style.display = isLoggedIn ? "none" : "";
  logoutBtn.style.display = isLoggedIn ? "" : "none";

  if (isLoggedIn) pass.value = "";
}

// ---------- Wire up UI ----------
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("calcForm");
  const resetBtn = document.getElementById("resetBtn");

  const noDepBody = document.getElementById("noDepBody");
  const depBody = document.getElementById("depBody");

  // --- Determine auth state on load ---
  try {
    const { data } = await supabaseClient.auth.getSession();
    if (data?.session) {
      usingDatabase = true;
      setAuthUi(true);
      setAuthStatus("Logged in. Saving to database.");

      investments = await loadInvestmentsFromDb();
    } else {
      usingDatabase = false;
      setAuthUi(false);
      setAuthStatus("Not logged in. Saving locally.");

      investments = loadLocalInvestments();
      syncNextIdFromInvestments();
    }
  } catch {
    usingDatabase = false;
    setAuthUi(false);
    setAuthStatus("Auth unavailable. Saving locally.");

    investments = loadLocalInvestments();
    syncNextIdFromInvestments();
  }

  function runCalculation() {
    setError("");

    const parsed = readInputs();
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    const noDep = calculateSchedule(
      parsed.initial,
      parsed.monthly,
      parsed.rate,
      parsed.years,
      false
    );

    const dep = calculateSchedule(
      parsed.initial,
      parsed.monthly,
      parsed.rate,
      parsed.years,
      true
    );

    renderRows(noDepBody, noDep);
    renderRows(depBody, dep);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runCalculation();
  });

  resetBtn.addEventListener("click", () => {
    document.getElementById("initial").value = "1000";
    document.getElementById("monthly").value = "100";
    document.getElementById("rate").value = "5";
    document.getElementById("years").value = "5";
    setError("");
    clearTableBody(noDepBody);
    clearTableBody(depBody);
  });

  document.getElementById("saveScenarioBtn")?.addEventListener("click", async () => {
    const parsed = getParsedInputs();

    if (!isValidInputs(parsed)) {
      alert("Please enter valid values before saving.");
      return;
    }

    try {
      await saveInvestment(parsed);

      // newest first by default 
      sortByDateDesc();
      renderInvestmentList();
    } catch (e) {
      alert(e?.message || "Save failed.");
    }
  });

  document.getElementById("sortDateBtn")?.addEventListener("click", () => {
    sortByDateDesc();
    renderInvestmentList();
  });

  document.getElementById("sortAmountBtn")?.addEventListener("click", () => {
    sortByInitialDesc();
    renderInvestmentList();
  });

  // --- Auth buttons ---
  document.getElementById("registerBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("authEmail")?.value?.trim();
    const password = document.getElementById("authPassword")?.value;

    if (!email || !password) {
      setAuthStatus("Enter email and password.");
      return;
    }

    const { error } = await supabaseClient.auth.signUp({ email, password });
    setAuthStatus(error ? error.message : "Registered. (Check email if confirmation is enabled.)");
  });

  document.getElementById("loginBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("authEmail")?.value?.trim();
    const password = document.getElementById("authPassword")?.value;

    if (!email || !password) {
      setAuthStatus("Enter email and password.");
      return;
    }

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthStatus(error.message);
      return;
    }

    // Switch to DB mode and load
    usingDatabase = true;
    setAuthUi(true);
    setAuthStatus("Logged in. Saving to database.");

    investments = await loadInvestmentsFromDb();
    sortByDateDesc();
    renderInvestmentList();
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();

    // Switch to local mode and load
    usingDatabase = false;
    setAuthUi(false);
    setAuthStatus("Not logged in. Saving locally.");

    investments = loadLocalInvestments();
    syncNextIdFromInvestments();
    sortByDateDesc();
    renderInvestmentList();
  });

  // Optional: calculate once on load so the page isn't empty
  runCalculation();
  sortByDateDesc();
  renderInvestmentList();
});
