// ===== Tabs =====
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");

tabButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    tabButtons.forEach(function (b) { b.classList.remove("active"); });
    tabPanels.forEach(function (p) { p.classList.remove("active"); });

    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

// ===== Storage =====
const STORAGE_KEY = "financeTracker.transactions";

function loadTransactions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return [];
    const data = JSON.parse(saved);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Could not load saved transactions:", error);
    return [];
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error("Could not save transactions:", error);
    alert("Your changes could not be saved in this browser.");
  }
}

// ===== Data =====
let transactions = loadTransactions();

// null means "we are adding"; a number means "we are editing that transaction"
let editingId = null;

// ===== Helper functions =====
function formatMoney(cents, currency) {
  return currency + " " + (cents / 100).toFixed(2);
}

function validateManualInput(amount, description, date) {
  if (Number.isNaN(amount)) return "Please enter an amount.";
  if (amount <= 0) return "The amount must be greater than zero.";
  if (description.trim() === "") return "Please enter a description or category.";
  if (date === "") return "Please choose a date.";
  return "";
}

function addCell(row, text, className) {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  row.appendChild(cell);
}

function createActionCell(t) {
  const cell = document.createElement("td");

  const editButton = document.createElement("button");
  editButton.textContent = "Edit";
  editButton.className = "row-btn";
  editButton.addEventListener("click", function () {
    startEdit(t.id);
  });

  const deleteButton = document.createElement("button");
  deleteButton.textContent = "Delete";
  deleteButton.className = "row-btn danger";
  deleteButton.addEventListener("click", function () {
    deleteTransaction(t.id);
  });

  cell.appendChild(editButton);
  cell.appendChild(deleteButton);
  return cell;
}

// ===== Showing data on the page =====
function updateSummary() {
  let incomeCents = 0;
  let expenseCents = 0;

  transactions.forEach(function (t) {
    if (t.type === "income") {
      incomeCents += t.amountCents;
    } else {
      expenseCents += t.amountCents;
    }
  });

  document.getElementById("total-income").textContent = formatMoney(incomeCents, "ETB");
  document.getElementById("total-expenses").textContent = formatMoney(expenseCents, "ETB");
  document.getElementById("net-change").textContent = formatMoney(incomeCents - expenseCents, "ETB");
  document.getElementById("transaction-count").textContent = transactions.length;
}

function getVisibleTransactions() {
  const searchText = document.getElementById("search").value.trim().toLowerCase();
  const typeFilter = document.getElementById("filter-type").value;

  return transactions.filter(function (t) {
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    const matchesSearch =
      t.description.toLowerCase().includes(searchText) ||
      t.notes.toLowerCase().includes(searchText);
    return matchesType && matchesSearch;
  });
}

function showTransactions() {
  const body = document.getElementById("transaction-body");
  body.innerHTML = "";

  if (transactions.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No transactions yet.</td></tr>';
    return;
  }

  const visible = getVisibleTransactions();

  if (visible.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="empty">No transactions match your search.</td></tr>';
    return;
  }

  // Newest date first
  const sorted = [...visible].sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });

  sorted.forEach(function (t) {
    const row = document.createElement("tr");
    const sign = t.type === "income" ? "+" : "-";

    addCell(row, t.date);
    addCell(row, t.description);
    addCell(row, t.type === "income" ? "Income" : "Expense");
    addCell(row, sign + " " + formatMoney(t.amountCents, t.currency), "amount-" + t.type);
    row.appendChild(createActionCell(t));

    body.appendChild(row);
  });
}

function render() {
  updateSummary();
  showTransactions();
}

// ===== Manual form =====
const manualForm = document.getElementById("manual-form");
const manualError = document.getElementById("manual-error");
const manualSubmit = document.getElementById("manual-submit");
const cancelEditButton = document.getElementById("cancel-edit");

function startEdit(id) {
  const t = transactions.find(function (item) { return item.id === id; });
  editingId = id;

  document.getElementById("type").value = t.type;
  document.getElementById("amount").value = (t.amountCents / 100).toFixed(2);
  document.getElementById("currency").value = t.currency;
  document.getElementById("date").value = t.date;
  document.getElementById("description").value = t.description;
  document.getElementById("notes").value = t.notes;

  manualSubmit.textContent = "Save changes";
  cancelEditButton.hidden = false;
  manualError.textContent = "";

  document.querySelector('[data-tab="manual-tab"]').click();
  manualForm.scrollIntoView({ behavior: "smooth" });
}

function stopEditing() {
  editingId = null;
  manualForm.reset();
  manualSubmit.textContent = "Add transaction";
  cancelEditButton.hidden = true;
  manualError.textContent = "";
}

function deleteTransaction(id) {
  const t = transactions.find(function (item) { return item.id === id; });
  const confirmed = confirm('Delete "' + t.description + '"? This cannot be undone.');
  if (!confirmed) return;

  transactions = transactions.filter(function (item) { return item.id !== id; });
  if (editingId === id) stopEditing();
  saveTransactions();
  render();
}

cancelEditButton.addEventListener("click", stopEditing);

manualForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const type = document.getElementById("type").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const currency = document.getElementById("currency").value;
  const date = document.getElementById("date").value;
  const description = document.getElementById("description").value;
  const notes = document.getElementById("notes").value;

  const error = validateManualInput(amount, description, date);
  if (error !== "") {
    manualError.textContent = error;
    return;
  }
  manualError.textContent = "";

  if (editingId !== null) {
    const t = transactions.find(function (item) { return item.id === editingId; });
    t.type = type;
    t.amountCents = Math.round(amount * 100);
    t.currency = currency;
    t.date = date;
    t.description = description.trim();
    t.notes = notes.trim();
    stopEditing();
  } else {
    transactions.push({
      id: Date.now(),
      type: type,
      amountCents: Math.round(amount * 100),
      currency: currency,
      description: description.trim(),
      date: date,
      notes: notes.trim(),
      reference: "",
      source: "manual"
    });
    manualForm.reset();
  }

  saveTransactions();
  render();
});

// ===== Message tab =====
// Fictional samples for testing. Real messages will look different.
const SAMPLE_MESSAGES = [
  "Dear Customer, your account has been credited with ETB 1,500.00 on 12/10/2026 from ABEBE KEBEDE. Ref: TXN12345678. Your balance is ETB 5,200.00.",
  "Dear Customer, your account has been debited with ETB 350.00 on 13/10/2026. Ref: TXN12345679. Your balance is ETB 4,850.00.",
  "You have received ETB 700.00 from SARA TESFAYE. Transaction ID: MM98765432. Date: 2026-10-14.",
  "You have sent ETB 120.00 to DAWIT BEKELE. Transaction ID: MM98765433. Date: 2026-10-15.",
  "Your transaction of ETB 200.00 was processed. Ref: TXN55566677."
];

const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const messageError = document.getElementById("message-error");

const reviewForm = document.getElementById("review-form");
const reviewWarning = document.getElementById("review-warning");
const reviewError = document.getElementById("review-error");

function hideReview() {
  reviewForm.hidden = true;
  reviewWarning.innerHTML = "";
  reviewError.textContent = "";
}

function showReview(result) {
  // Fill the review form with what the parser found
  document.getElementById("review-type").value = result.type || "";
  document.getElementById("review-amount").value =
    result.amountCents === null ? "" : (result.amountCents / 100).toFixed(2);
  document.getElementById("review-currency").value = result.currency;
  document.getElementById("review-date").value = result.date;
  document.getElementById("review-description").value = result.description;
  document.getElementById("review-reference").value = result.reference;
  document.getElementById("review-notes").value = "";

  // Show each warning as a list item
  reviewWarning.innerHTML = "";
  result.warnings.forEach(function (text) {
    const item = document.createElement("li");
    item.textContent = text;
    reviewWarning.appendChild(item);
  });

  reviewError.textContent = "";
  reviewForm.hidden = false;
  reviewForm.scrollIntoView({ behavior: "smooth" });
}

// Sample buttons put a fictional message into the text area
document.querySelectorAll(".sample-btn").forEach(function (button) {
  button.addEventListener("click", function () {
    messageInput.value = SAMPLE_MESSAGES[Number(button.dataset.sample)];
    messageError.textContent = "";
    hideReview();
  });
});

messageForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const text = messageInput.value.trim();
  if (text === "") {
    messageError.textContent = "Please paste a message first.";
    return;
  }
  messageError.textContent = "";

  const result = parseMessage(text);
  showReview(result);
});

document.getElementById("cancel-review").addEventListener("click", hideReview);

reviewForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const type = document.getElementById("review-type").value;
  const amount = parseFloat(document.getElementById("review-amount").value);
  const currency = document.getElementById("review-currency").value;
  const date = document.getElementById("review-date").value;
  const description = document.getElementById("review-description").value;
  const reference = document.getElementById("review-reference").value.trim();
  const notes = document.getElementById("review-notes").value;

  if (type === "") {
    reviewError.textContent = "Please choose whether this is income or expense.";
    return;
  }

  const error = validateManualInput(amount, description, date);
  if (error !== "") {
    reviewError.textContent = error;
    return;
  }

  // Duplicate check: only possible when there is a reference number
  if (reference !== "") {
    const duplicate = transactions.find(function (t) {
      return t.reference && t.reference.toLowerCase() === reference.toLowerCase();
    });
    if (duplicate) {
      reviewError.textContent =
        "A transaction with reference " + reference + " is already recorded (" +
        duplicate.description + ", " + duplicate.date + ").";
      return;
    }
  }

  transactions.push({
    id: Date.now(),
    type: type,
    amountCents: Math.round(amount * 100),
    currency: currency,
    description: description.trim(),
    date: date,
    notes: notes.trim(),
    reference: reference,
    source: "message"
  });

  saveTransactions();
  render();

  messageInput.value = "";
  hideReview();
});

// ===== Search and filter =====
document.getElementById("search").addEventListener("input", showTransactions);
document.getElementById("filter-type").addEventListener("change", showTransactions);

// Draw the page once when it first loads
render();