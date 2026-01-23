/*
  Airgead Banking (CS-210) - JavaScript Port
  Logic matches original C++ implementation:
  - Monthly deposit applied before interest (when enabled)
  - Monthly interest calculation
  - Yearly summaries after every 12 months
  - Yearly interest resets at the end of each year
  Month counting starts at 1 for readability (Month 1 = first month)
*/

// ---------- Core calculation  ----------
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

// ---------- Wire up UI ----------
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("calcForm");
  const resetBtn = document.getElementById("resetBtn");

  const noDepBody = document.getElementById("noDepBody");
  const depBody = document.getElementById("depBody");

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

  // Optional: calculate once on load so the page isn't empty
  runCalculation();
});
