// ========================================================
// Expense Tracker — Frontend Application Logic
// Built for Dalil Academy Web Development Project
// ========================================================

const API_URL = "http://localhost:3000/api/expenses";
const ALLOWED_CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Other"];

// Application State
let allExpenses = [];        // Always holds the complete dataset from PostgreSQL
let currentFilter = "All";    // Selected category filter
let searchQuery = "";        // Search term for title filtering
let sortColumn = "date";     // Column to sort by
let sortDirection = "desc";   // Sort direction: 'asc' | 'desc'
let pendingDeleteId = null;  // ID of expense staged for deletion

// DOM Elements
const elements = {
  // Summary
  totalAmount: document.getElementById("totalAmount"),
  expenseCount: document.getElementById("expenseCount"),
  highestExpense: document.getElementById("highestExpense"),
  highestExpenseTitle: document.getElementById("highestExpenseTitle"),

  // Add Form
  addForm: document.getElementById("addExpenseForm"),
  titleInput: document.getElementById("expenseTitle"),
  amountInput: document.getElementById("expenseAmount"),
  categoryInput: document.getElementById("expenseCategory"),
  dateInput: document.getElementById("expenseDate"),
  addBtn: document.getElementById("addExpenseBtn"),

  // Table & Controls
  tableBody: document.getElementById("expensesTableBody"),
  tableHead: document.querySelector("#expensesTable thead"),
  emptyState: document.getElementById("emptyState"),
  categoryFilter: document.getElementById("categoryFilter"),
  searchInput: document.getElementById("searchInput"),
  filteredCountLabel: document.getElementById("filteredCountLabel"),
  refreshBtn: document.getElementById("refreshBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),

  // Edit Modal
  editModalEl: document.getElementById("editExpenseModal"),
  editForm: document.getElementById("editExpenseForm"),
  editIdInput: document.getElementById("editExpenseId"),
  editTitleInput: document.getElementById("editExpenseTitle"),
  editAmountInput: document.getElementById("editExpenseAmount"),
  editCategoryInput: document.getElementById("editExpenseCategory"),
  editDateInput: document.getElementById("editExpenseDate"),
  saveEditBtn: document.getElementById("saveEditBtn"),

  // Delete Modal
  deleteModalEl: document.getElementById("deleteConfirmModal"),
  deleteDetailsEl: document.getElementById("deleteExpenseDetails"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),

  // UX Feedback
  loadingSpinner: document.getElementById("loadingSpinner"),
  spinnerText: document.getElementById("spinnerText"),
  alertsContainer: document.getElementById("alertsContainer"),
  connectionBadge: document.getElementById("connectionBadge"),
  connectionStatusText: document.getElementById("connectionStatusText"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeIcon: document.getElementById("themeIcon")
};

// Bootstrap Modal Instances
let editModalInstance = null;
let deleteModalInstance = null;

// ========================================================
// 1. UX Feedback & Helper Functions
// ========================================================

/**
 * Show the loading spinner with optional custom label
 */
function showSpinner(text = "Syncing with server...") {
  if (elements.spinnerText) elements.spinnerText.textContent = text;
  if (elements.loadingSpinner) elements.loadingSpinner.style.display = "flex";
}

/**
 * Hide the loading spinner
 */
function hideSpinner() {
  if (elements.loadingSpinner) elements.loadingSpinner.style.display = "none";
}

/**
 * Update server connectivity badge indicator
 */
function updateConnectionStatus(isConnected) {
  if (!elements.connectionBadge || !elements.connectionStatusText) return;
  if (isConnected) {
    elements.connectionBadge.className = "badge rounded-pill bg-success-subtle text-success border border-success-subtle px-3 py-2 d-flex align-items-center gap-2";
    elements.connectionStatusText.textContent = "Server Online";
  } else {
    elements.connectionBadge.className = "badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle px-3 py-2 d-flex align-items-center gap-2";
    elements.connectionStatusText.textContent = "Server Offline";
  }
}

/**
 * Render a dismissible Bootstrap alert banner
 */
function showAlert(message, type = "danger") {
  if (!elements.alertsContainer) return;

  const alertId = "alert-" + Date.now();
  const iconClass = type === "success" 
    ? "bi-check-circle-fill text-success" 
    : type === "warning" 
      ? "bi-exclamation-triangle-fill text-warning" 
      : "bi-x-octagon-fill text-danger";

  const alertHtml = `
    <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show d-flex align-items-center gap-2 shadow-sm border mb-3" role="alert">
      <i class="bi ${iconClass} fs-5"></i>
      <div class="flex-grow-1">${escapeHtml(message)}</div>
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>
  `;

  elements.alertsContainer.insertAdjacentHTML("beforeend", alertHtml);

  // Auto-dismiss success alerts after 4 seconds
  if (type === "success") {
    setTimeout(() => {
      const el = document.getElementById(alertId);
      if (el) {
        const bsAlert = bootstrap.Alert.getOrCreateInstance(el);
        bsAlert.close();
      }
    }, 4000);
  }
}

/**
 * Clear all visible alerts
 */
function clearAlerts() {
  if (elements.alertsContainer) {
    elements.alertsContainer.innerHTML = "";
  }
}

/**
 * Format numerical currency: e.g. 4.5 -> "$4.50"
 */
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return "$" + num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Escape HTML to prevent injection
 */
function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Return category badge HTML with color and icon
 */
function renderCategoryBadge(category) {
  const icons = {
    Food: "bi-egg-fried",
    Transport: "bi-car-front-fill",
    Bills: "bi-lightning-charge-fill",
    Entertainment: "bi-controller",
    Other: "bi-tag-fill"
  };
  const icon = icons[category] || "bi-tag";
  const cssClass = `badge-category badge-${(category || "other").toLowerCase()}`;

  return `<span class="${cssClass}"><i class="bi ${icon}"></i> ${escapeHtml(category)}</span>`;
}

// ========================================================
// 2. Core API Client (fetch with async/await & try/catch)
// ========================================================

/**
 * GET /api/expenses - Retrieve all expenses
 */
async function getExpenses() {
  showSpinner("Fetching expenses from database...");
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to fetch expenses (Status ${response.status})`);
    }
    const data = await response.json();
    updateConnectionStatus(true);
    return data;
  } catch (error) {
    updateConnectionStatus(false);
    console.error("getExpenses error:", error);
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      showAlert("Cannot connect to backend server. Make sure Node.js is running at http://localhost:3000", "danger");
    } else {
      showAlert(error.message || "Failed to load expenses", "danger");
    }
    return null;
  } finally {
    hideSpinner();
  }
}

/**
 * POST /api/expenses - Add a new expense
 */
async function addExpense(expenseData) {
  showSpinner("Saving new expense...");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expenseData)
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(responseData.message || `Server returned error (${response.status})`);
    }

    showAlert(`Expense "${responseData.title}" added successfully!`, "success");
    return responseData;
  } catch (error) {
    console.error("addExpense error:", error);
    showAlert(error.message || "Failed to add expense", "danger");
    return null;
  } finally {
    hideSpinner();
  }
}

/**
 * PUT /api/expenses/:id - Update an existing expense
 */
async function updateExpense(id, expenseData) {
  showSpinner(`Updating expense #${id}...`);
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expenseData)
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(responseData.message || `Failed to update expense (${response.status})`);
    }

    showAlert(`Expense "${responseData.title}" updated successfully!`, "success");
    return responseData;
  } catch (error) {
    console.error("updateExpense error:", error);
    showAlert(error.message || "Failed to update expense", "danger");
    return null;
  } finally {
    hideSpinner();
  }
}

/**
 * DELETE /api/expenses/:id - Delete an expense
 */
async function deleteExpense(id) {
  showSpinner(`Deleting expense #${id}...`);
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE"
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(responseData.message || `Failed to delete expense (${response.status})`);
    }

    showAlert("Expense deleted successfully!", "success");
    return responseData;
  } catch (error) {
    console.error("deleteExpense error:", error);
    showAlert(error.message || "Failed to delete expense", "danger");
    return null;
  } finally {
    hideSpinner();
  }
}

/**
 * Refresh state from server:
 * Re-fetches all expenses from PostgreSQL, updates summary cards, and re-renders table.
 */
async function refresh() {
  const data = await getExpenses();
  if (data !== null) {
    allExpenses = data;
    renderSummary(allExpenses); // Summary cards always use all expenses
    applyFilterAndRender();
  }
}

// ========================================================
// 3. UI Rendering Functions
// ========================================================

/**
 * Update the 3 summary cards (Total amount, Count, Highest expense)
 * Must count ALL expenses, not the filtered list.
 */
function renderSummary(expensesList) {
  if (!Array.isArray(expensesList)) return;

  const count = expensesList.length;
  let total = 0;
  let highest = 0;
  let highestTitle = "None";

  for (const item of expensesList) {
    const amount = Number(item.amount) || 0;
    total += amount;
    if (amount > highest) {
      highest = amount;
      highestTitle = item.title;
    }
  }

  // Update DOM values
  elements.totalAmount.textContent = formatCurrency(total);
  elements.expenseCount.textContent = count.toLocaleString();
  elements.highestExpense.textContent = count > 0 ? formatCurrency(highest) : "$0.00";
  elements.highestExpenseTitle.textContent = count > 0 ? `(${highestTitle})` : "None recorded";
}

/**
 * Build dynamic HTML table rows
 */
function renderTable(expenses) {
  if (!elements.tableBody) return;

  elements.tableBody.innerHTML = "";

  if (!expenses || expenses.length === 0) {
    if (elements.emptyState) elements.emptyState.classList.remove("d-none");
    if (elements.filteredCountLabel) {
      elements.filteredCountLabel.textContent = allExpenses.length === 0 
        ? "No expenses in database" 
        : `0 of ${allExpenses.length} records matching`;
    }
    return;
  }

  if (elements.emptyState) elements.emptyState.classList.add("d-none");
  if (elements.filteredCountLabel) {
    elements.filteredCountLabel.textContent = currentFilter === "All" && !searchQuery
      ? `Showing all ${allExpenses.length} records`
      : `Showing ${expenses.length} of ${allExpenses.length} records`;
  }

  // Document fragment for optimal DOM performance
  const fragment = document.createDocumentFragment();

  expenses.forEach(item => {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;

    tr.innerHTML = `
      <td class="ps-4 fw-medium text-body">
        ${escapeHtml(item.title)}
      </td>
      <td class="fw-bold text-body">
        ${formatCurrency(item.amount)}
      </td>
      <td>
        ${renderCategoryBadge(item.category)}
      </td>
      <td class="text-secondary small font-monospace">
        <i class="bi bi-calendar3 me-1"></i>${escapeHtml(item.date)}
      </td>
      <td class="text-end pe-4">
        <div class="btn-group btn-group-sm" role="group">
          <button type="button" class="btn btn-outline-primary btn-action edit-btn" title="Edit Expense" data-id="${item.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button type="button" class="btn btn-outline-danger btn-action delete-btn" title="Delete Expense" data-id="${item.id}">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    `;

    fragment.appendChild(tr);
  });

  elements.tableBody.appendChild(fragment);
  updateSortIndicators();
}

/**
 * Filter, search, and sort before rendering the table
 */
function applyFilterAndRender() {
  let filtered = [...allExpenses];

  // 1. Filter by category
  if (currentFilter !== "All") {
    filtered = filtered.filter(item => item.category === currentFilter);
  }

  // 2. Search query on title
  if (searchQuery.trim() !== "") {
    const query = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(item => item.title.toLowerCase().includes(query));
  }

  // 3. Sorting
  filtered.sort((a, b) => {
    let valA = a[sortColumn];
    let valB = b[sortColumn];

    if (sortColumn === "amount" || sortColumn === "id") {
      valA = Number(valA);
      valB = Number(valB);
    } else if (typeof valA === "string") {
      valA = valA.toLowerCase();
      valB = (valB || "").toLowerCase();
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  renderTable(filtered);
}

/**
 * Update the sort arrow indicator on table headers
 */
function updateSortIndicators() {
  if (!elements.tableHead) return;
  const headers = elements.tableHead.querySelectorAll("th[data-sort]");
  headers.forEach(th => {
    const col = th.getAttribute("data-sort");
    const icon = th.querySelector(".sort-icon");
    if (col === sortColumn) {
      th.classList.add("active-sort");
      if (icon) {
        icon.className = `bi bi-sort-${sortDirection === "asc" ? "up" : "down"} sort-icon`;
      }
    } else {
      th.classList.remove("active-sort");
      if (icon) {
        icon.className = "bi bi-arrow-down-up sort-icon";
      }
    }
  });
}

// ========================================================
// 4. Client-side Form Validation
// ========================================================

/**
 * Validate add/edit form data according to project specifications
 */
function validateInputs(title, amount, category, date) {
  const errors = [];

  if (!title || title.trim() === "") {
    errors.push("Title is required and cannot be empty.");
  } else if (title.trim().length > 100) {
    errors.push("Title cannot exceed 100 characters.");
  }

  const numAmount = Number(amount);
  if (amount === "" || isNaN(numAmount) || numAmount <= 0) {
    errors.push("Amount must be a number greater than 0.");
  }

  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    errors.push(`Category must be one of: ${ALLOWED_CATEGORIES.join(", ")}`);
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
    errors.push("Date is required and must follow YYYY-MM-DD format.");
  }

  return errors;
}

// ========================================================
// 5. Modal Operations (Edit & Delete)
// ========================================================

/**
 * Open edit modal pre-filled with the selected expense
 */
function openEditModal(id) {
  const expense = allExpenses.find(item => item.id === Number(id));
  if (!expense) {
    showAlert(`Could not find expense with ID ${id}`, "danger");
    return;
  }

  elements.editIdInput.value = expense.id;
  elements.editTitleInput.value = expense.title;
  elements.editAmountInput.value = Number(expense.amount).toFixed(2);
  elements.editCategoryInput.value = expense.category;
  elements.editDateInput.value = expense.date;

  elements.editForm.classList.remove("was-validated");
  editModalInstance.show();
}

/**
 * Open delete confirmation modal
 */
function openDeleteModal(id) {
  const expense = allExpenses.find(item => item.id === Number(id));
  if (!expense) {
    showAlert(`Could not find expense with ID ${id}`, "danger");
    return;
  }

  pendingDeleteId = expense.id;
  elements.deleteDetailsEl.textContent = `"${expense.title}" — ${formatCurrency(expense.amount)} (${expense.date})`;
  deleteModalInstance.show();
}

// ========================================================
// 6. Bonus Features: CSV Export & Dark Mode
// ========================================================

/**
 * Export expenses list as a downloadable CSV file
 */
function exportToCsv() {
  if (allExpenses.length === 0) {
    showAlert("No expenses available to export.", "warning");
    return;
  }

  const headers = ["ID", "Title", "Amount", "Category", "Date"];
  const rows = allExpenses.map(exp => [
    exp.id,
    `"${exp.title.replace(/"/g, '""')}"`,
    exp.amount,
    `"${exp.category}"`,
    exp.date
  ]);

  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `expenses_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showAlert("Expenses exported to CSV successfully!", "success");
}

/**
 * Dark / Light theme toggle
 */
function setupThemeToggle() {
  const savedTheme = localStorage.getItem("expense_theme") || "light";
  document.documentElement.setAttribute("data-bs-theme", savedTheme);
  updateThemeIcon(savedTheme);

  elements.themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-bs-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-bs-theme", newTheme);
    localStorage.setItem("expense_theme", newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  if (!elements.themeIcon) return;
  if (theme === "dark") {
    elements.themeIcon.className = "bi bi-sun-fill text-warning";
  } else {
    elements.themeIcon.className = "bi bi-moon-stars-fill";
  }
}

// ========================================================
// 7. Event Listeners Initialization
// ========================================================

function initEventListeners() {
  // Set default date in Add Form to today's date
  const today = new Date().toISOString().split("T")[0];
  elements.dateInput.value = today;

  // Add Expense Form Submit
  elements.addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlerts();

    const title = elements.titleInput.value.trim();
    const amount = elements.amountInput.value;
    const category = elements.categoryInput.value;
    const date = elements.dateInput.value;

    const errors = validateInputs(title, amount, category, date);
    if (errors.length > 0) {
      elements.addForm.classList.add("was-validated");
      showAlert(errors.join(" "), "warning");
      return;
    }

    const payload = {
      title,
      amount: Number(amount),
      category,
      date
    };

    const result = await addExpense(payload);
    if (result) {
      // Reset form on success and keep today's date
      elements.addForm.reset();
      elements.addForm.classList.remove("was-validated");
      elements.dateInput.value = today;

      // Always re-fetch from the server so the page shows the truth
      await refresh();
    }
  });

  // Edit Expense Form Submit (inside modal)
  elements.editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlerts();

    const id = elements.editIdInput.value;
    const title = elements.editTitleInput.value.trim();
    const amount = elements.editAmountInput.value;
    const category = elements.editCategoryInput.value;
    const date = elements.editDateInput.value;

    const errors = validateInputs(title, amount, category, date);
    if (errors.length > 0) {
      elements.editForm.classList.add("was-validated");
      showAlert(errors.join(" "), "warning");
      return;
    }

    const payload = {
      title,
      amount: Number(amount),
      category,
      date
    };

    const result = await updateExpense(id, payload);
    if (result) {
      editModalInstance.hide();
      await refresh();
    }
  });

  // Delete Confirm Action
  elements.confirmDeleteBtn.addEventListener("click", async () => {
    if (!pendingDeleteId) return;
    deleteModalInstance.hide();
    const result = await deleteExpense(pendingDeleteId);
    pendingDeleteId = null;
    if (result) {
      await refresh();
    }
  });

  // Table Action Buttons Delegation (Edit & Delete)
  elements.tableBody.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit-btn");
    const deleteBtn = e.target.closest(".delete-btn");

    if (editBtn) {
      const id = editBtn.getAttribute("data-id");
      openEditModal(id);
    } else if (deleteBtn) {
      const id = deleteBtn.getAttribute("data-id");
      openDeleteModal(id);
    }
  });

  // Category Filter Change
  elements.categoryFilter.addEventListener("change", (e) => {
    currentFilter = e.target.value;
    applyFilterAndRender();
  });

  // Search Input (Bonus)
  elements.searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    applyFilterAndRender();
  });

  // Column Header Sort Click (Bonus)
  elements.tableHead.addEventListener("click", (e) => {
    const th = e.target.closest("th[data-sort]");
    if (!th) return;

    const col = th.getAttribute("data-sort");
    if (sortColumn === col) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortColumn = col;
      sortDirection = "asc";
    }
    applyFilterAndRender();
  });

  // Refresh Button
  elements.refreshBtn.addEventListener("click", async () => {
    clearAlerts();
    await refresh();
  });

  // Export CSV Button (Bonus)
  elements.exportCsvBtn.addEventListener("click", exportToCsv);
}

// ========================================================
// 8. Application Bootstrap
// ========================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Modals
  editModalInstance = new bootstrap.Modal(elements.editModalEl);
  deleteModalInstance = new bootstrap.Modal(elements.deleteModalEl);

  // Setup theme & event listeners
  setupThemeToggle();
  initEventListeners();

  // Initial fetch from backend API
  await refresh();
});
