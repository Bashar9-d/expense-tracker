require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "expense_tracker"
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ PostgreSQL connection error:", err.message);
  } else {
    console.log("✅ Connected to PostgreSQL database:", process.env.DB_NAME || "expense_tracker");
    release();
  }
});

const ALLOWED_CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Other"];

// Helper: Validate ID parameter
function parseValidId(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }
  return numericId;
}

// Helper: Validate expense body
function validateExpenseBody({ title, amount, category, date }) {
  if (!title || typeof title !== "string" || title.trim() === "") {
    return "Title is required and must not be empty.";
  }
  if (title.trim().length > 100) {
    return "Title cannot exceed 100 characters.";
  }

  const numericAmount = Number(amount);
  if (amount === undefined || amount === null || isNaN(numericAmount) || numericAmount <= 0) {
    return "Amount is required and must be a number greater than 0.";
  }

  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    return `Category is required and must be one of: ${ALLOWED_CATEGORIES.join(", ")}.`;
  }

  if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
    return "Date is required and must be in YYYY-MM-DD format.";
  }

  return null;
}

// 1. GET /api/expenses - Return all expenses
app.get("/api/expenses", async (req, res) => {
  try {
    const query = `
      SELECT 
        id, 
        title, 
        amount::float8, 
        category, 
        to_char(date, 'YYYY-MM-DD') AS date 
      FROM expenses 
      ORDER BY id ASC;
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("GET /api/expenses error:", error.message);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to retrieve expenses." });
  }
});

// 2. GET /api/expenses/:id - Return one expense
app.get("/api/expenses/:id", async (req, res) => {
  const id = parseValidId(req.params.id);

  if (!id) {
    return res.status(404).json({
      error: "Not Found",
      message: `Invalid expense ID: '${req.params.id}'. ID must be a positive integer.`
    });
  }

  try {
    const query = `
      SELECT 
        id, 
        title, 
        amount::float8, 
        category, 
        to_char(date, 'YYYY-MM-DD') AS date 
      FROM expenses 
      WHERE id = $1;
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: `Expense with ID ${id} was not found.`
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`GET /api/expenses/${req.params.id} error:`, error.message);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to retrieve expense." });
  }
});

// 3. POST /api/expenses - Add a new expense
app.post("/api/expenses", async (req, res) => {
  const { title, amount, category, date } = req.body;
  const validationError = validateExpenseBody({ title, amount, category, date });

  if (validationError) {
    return res.status(400).json({
      error: "Bad Request",
      message: validationError
    });
  }

  const numericAmount = Number(amount);
  const cleanTitle = title.trim();

  try {
    const query = `
      INSERT INTO expenses (title, amount, category, date)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id, 
        title, 
        amount::float8, 
        category, 
        to_char(date, 'YYYY-MM-DD') AS date;
    `;
    const result = await pool.query(query, [cleanTitle, numericAmount, category, date]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("POST /api/expenses error:", error.message);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to create expense." });
  }
});

// 4. PUT /api/expenses/:id - Update an expense
app.put("/api/expenses/:id", async (req, res) => {
  const id = parseValidId(req.params.id);

  if (!id) {
    return res.status(404).json({
      error: "Not Found",
      message: `Invalid expense ID: '${req.params.id}'. ID must be a positive integer.`
    });
  }

  const { title, amount, category, date } = req.body;
  const validationError = validateExpenseBody({ title, amount, category, date });

  if (validationError) {
    return res.status(400).json({
      error: "Bad Request",
      message: validationError
    });
  }

  const numericAmount = Number(amount);
  const cleanTitle = title.trim();

  try {
    const query = `
      UPDATE expenses 
      SET title = $1, amount = $2, category = $3, date = $4
      WHERE id = $5
      RETURNING 
        id, 
        title, 
        amount::float8, 
        category, 
        to_char(date, 'YYYY-MM-DD') AS date;
    `;
    const result = await pool.query(query, [cleanTitle, numericAmount, category, date, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: `Expense with ID ${id} was not found.`
      });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`PUT /api/expenses/${req.params.id} error:`, error.message);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to update expense." });
  }
});

// 5. DELETE /api/expenses/:id - Delete an expense
app.delete("/api/expenses/:id", async (req, res) => {
  const id = parseValidId(req.params.id);

  if (!id) {
    return res.status(404).json({
      error: "Not Found",
      message: `Invalid expense ID: '${req.params.id}'. ID must be a positive integer.`
    });
  }

  try {
    const query = `
      DELETE FROM expenses 
      WHERE id = $1
      RETURNING id;
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Not Found",
        message: `Expense with ID ${id} was not found.`
      });
    }

    res.status(200).json({
      message: "Expense deleted successfully",
      id: result.rows[0].id
    });
  } catch (error) {
    console.error(`DELETE /api/expenses/${req.params.id} error:`, error.message);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to delete expense." });
  }
});

// 404 Handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist.`
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Expense Tracker Backend running at http://localhost:${PORT}`);
});
