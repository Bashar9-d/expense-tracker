




# Expense Tracker

[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/Bashar9-d/expense-tracker)

🔗 **GitHub Repository:** [https://github.com/Bashar9-d/expense-tracker](https://github.com/Bashar9-d/expense-tracker)

A full-stack personal finance web application built with **Node.js, Express, PostgreSQL, and Vanilla JavaScript with Bootstrap 5**. The application allows users to record, categorize, track, and manage their daily expenses seamlessly with real-time database synchronization.

---

## How to Run from Scratch

Follow these step-by-step instructions to run the application on your local machine.

### Prerequisites
- **Node.js** (v18+ recommended)
- **PostgreSQL** & **pgAdmin**
- **VS Code** (optionally with the **Live Server** extension)

---

### 1. Database Setup (PostgreSQL)

1. Open **pgAdmin** or your terminal (`psql`).
2. Create a new database named `expense_tracker`:
   ```sql
   CREATE DATABASE expense_tracker;
   ```
3. Connect to the `expense_tracker` database and execute the schema script located at `backend/schema.sql`:
   ```bash
   psql -U postgres -d expense_tracker -f backend/schema.sql
   ```
   *This creates the `expenses` table with appropriate constraints and loads initial sample data.*

---

### 2. Backend Setup

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Copy `.env.example` to create your `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in your PostgreSQL credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_postgres_password
   DB_NAME=expense_tracker
   PORT=3000
   ```
4. Install backend dependencies:
   ```bash
   npm install
   ```
5. Start the backend server:
   ```bash
   node server.js
   ```
   *You will see:*
   ```text
   🚀 Expense Tracker Backend running at http://localhost:3000
   ✅ Connected to PostgreSQL database: expense_tracker
   ```

---

### 3. Frontend Setup

1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. You can serve the frontend using either:
   - **VS Code Live Server:** Right-click `index.html` inside VS Code and choose **"Open with Live Server"**.
   - **Or built-in static server:**
     ```bash
     node server.js
     ```
3. Open your browser and navigate to:
   ```
   http://localhost:5500
   ```

---

## Features

- [x] **Add an expense** with client-side & server-side validation (title, positive amount, category, date).
- [x] **Delete an expense** with instant UI refresh and confirmation modal (`DELETE /api/expenses/:id`).
- [x] **Edit an expense** using a pre-populated Bootstrap Modal (`PUT /api/expenses/:id`).
- [x] **Filter by category** (All, Food, Transport, Bills, Entertainment, Other).
- [x] **Summary cards** (Total Amount, Number of Expenses, Highest Expense) built with **CSS Grid** (counts all expenses in DB, not just filtered ones).
- [x] **PostgreSQL database persistence** with parameterized queries (`$1, $2`) for full SQL injection protection.
- [x] **Dynamic DOM rendering** with colored badges for each category.
- [x] **Responsive design** fully optimized for mobile, tablet, and desktop screens.
- [x] **Loading spinner** indicator during API requests.
- [x] **Alert banners** with meaningful error messages when backend is offline or returns validation errors (400 / 404 / 500).
- [x] **Bonus — Live search** by expense title.
- [x] **Bonus — Interactive column sorting** (sort table by title, amount, category, or date).
- [x] **Bonus — Export to CSV** functionality for expense reports.
- [x] **Bonus — Dark Mode / Light Mode** theme switcher with `localStorage` persistence.

---

## API Endpoints

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/api/expenses` | Returns all expenses ordered by ID | `200` |
| `GET` | `/api/expenses/:id` | Returns single expense by ID | `200`, `404` |
| `POST` | `/api/expenses` | Creates a new expense | `201`, `400` |
| `PUT` | `/api/expenses/:id` | Updates an existing expense | `200`, `400`, `404` |
| `DELETE` | `/api/expenses/:id` | Deletes an expense | `200`, `404` |

---

## Screenshots

Backend API test results from Thunder Client are stored in `backend/screenshots/`:
- `get_all.png`: Successful retrieval of all expenses (`GET 200`).
- `get_by_id.png` & `get_by_id_404.png`: Single expense retrieval and not found error.
- `post_201.png` & `post_400.png`: Adding expense and validation failure handling.
- `put_200.png` & `put404.png`: Updating expense and invalid ID handling.
- `Delete_200.png` & `delete_404.png`: Deleting expense and 404 test.

---

## What was the hardest part?

One of the most nuanced challenges was ensuring **authoritative data synchronization** between the client-side state and PostgreSQL. Instead of mutating local arrays in memory, every action (`POST`, `PUT`, `DELETE`) triggers a server re-fetch (`GET /api/expenses`) to guarantee that the UI strictly reflects the persistent database state.

Additionally, handling data types across the stack required special attention:
1. PostgreSQL returns `NUMERIC` types as strings in the `pg` library to avoid floating-point precision loss, which required careful casting (`amount::float8` in SQL and `Number()` in JS).
2. Date values needed formatting via PostgreSQL's `to_char(date, 'YYYY-MM-DD')` to prevent timezone offsets from shifting dates back by a day when converted to JavaScript `Date` objects.
3. Structuring the summary cards using pure **CSS Grid** (`grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`) ensured equal card distribution while seamlessly wrapping on mobile devices.
