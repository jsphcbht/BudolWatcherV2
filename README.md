# ₱ BudolWatcher V2


> **The ultimate local-first budget tracker for Filipino students.**

BudolWatcher V2 is a modern, mobile-first Progressive Web App (PWA) designed to help you stay on top of your finances. Track your daily allowance, log expenses, manage debts, and reach your savings goals—all with a premium, minimalist interface tailored for the Philippine Peso (₱).

---

## 🚀 Key Features

### 📊 Smarter Dashboard
*   **Real-time Balance**: Instantly see your available funds based on daily budgets and expenses.
*   **Budol Meter**: A visual gauge of your monthly spending habits. Stay in the "Safe" zone!
*   **Quick Logging**: One-tap category selection for lightning-fast expense entry.

### 🤝 Utang Ledger (New!)
*   **Dual Tracking**: Record both money people owe you ("Owes Me") and money you owe others ("I Owe Then").
*   **Integrated Summary**: View your total debt position directly on the home dashboard.

### 🎯 Savings Goals
*   **Visual Progress**: Track goals with target amounts and optional deadlines.
*   **Save Leftover Today**: A unique feature to instantly sweep your remaining daily balance into a goal.
*   **Contribution History**: See how every Peso brings you closer to your target.

### 📈 Deep Insights
*   **Category Breakdown**: Interactive pie charts showing where your money goes.
*   **Spending Trends**: Line charts visualizing your daily spending patterns over time.
*   **Filterable History**: Review expenses by day, week, month, or all-time.

### 🛠️ Professional Tools
*   **PWA Ready**: Install it on your phone's home screen for an app-like experience.
*   **Offline First**: Works perfectly without an internet connection. Data is saved locally.
*   **Supabase Sync**: Optional cloud sync to keep your data safe across devices.
*   **Data Export**: Download your reports in **CSV** or **PDF** format.
*   **Dark Mode**: Sleek, eye-friendly design for late-night budgeting.

---

## 🛠️ Tech Stack

*   **Logic**: Pure JavaScript (ES6+)
*   **Storage**: LocalStorage + [Supabase](https://supabase.com/) for optional cloud sync.
*   **UI/UX**: HTML5 Semantic markers & Vanilla CSS (custom design system).
*   **Charts**: [Chart.js](https://www.chartjs.org/)
*   **Reports**: [jsPDF](https://github.com/parallax/jsPDF) + AutoTable.

---

## 📦 How to Use

1.  **Direct Run**: Open `BudolWatcher/index.html` in any modern web browser.
2.  **Local Server (Recommended)**:
    ```bash
    # If you have Python installed
    python -m http.server 5500
    ```
    Then visit `http://localhost:5500/BudolWatcher`.
3.  **Install as PWA**: On mobile, use "Add to Home Screen" or click the "Install" button in the app.

---

## 🛡️ Privacy & Data
*   Your data belongs to you. By default, everything is stored locally on your device.
*   No tracking, no ads, just budgeting.

---

*Made with ❤️ for Filipino students.*
