# BudolWatcher

BudolWatcher is a local-first web app for students to track daily budget, expenses, category spending, and savings goals in Philippine Peso.

## Features
- Daily budget input with carryover stacking
- Quick expense logging (amount + category)
- Overspent auto-tagging when balance goes below zero
- Editable categories (add, rename, archive)
- Multiple savings goals
- Manual savings contribution and one-tap Save Leftover Today
- Category breakdown (Today, Last 7 Days, This Month)

## Run
Since this is a static app, you can open it directly:
1. Open `index.html` in your browser

For better browser behavior, run with any local static server:
1. In this folder, run `python -m http.server 5500`
2. Open `http://localhost:5500`

## Data Storage
- Data is saved in browser Local Storage using key `budolwatcher.v1`.
- Clearing browser site data will remove saved entries.

## Notes
- Timezone logic uses Asia/Manila for day-based calculations.
- Currency display uses PHP.
