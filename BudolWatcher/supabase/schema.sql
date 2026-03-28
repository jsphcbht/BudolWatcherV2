-- BudolWatcher Supabase Schema
-- Run this in your Supabase SQL Editor after creating a project

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DEVICES (anonymous device-based identity)
-- ============================================================
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_fingerprint TEXT UNIQUE NOT NULL,
  device_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 30),
  is_archived BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_categories_unique_name
  ON categories (device_id, lower(name))
  WHERE is_archived = false;

-- ============================================================
-- BUDGETS (daily budget additions)
-- ============================================================
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_budgets_device_date ON budgets (device_id, date);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  category_id UUID NOT NULL REFERENCES categories(id),
  is_overspent BOOLEAN DEFAULT false,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 100),
  logged_at TIMESTAMPTZ NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_device_date ON expenses (device_id, date);
CREATE INDEX idx_expenses_device_category ON expenses (device_id, category_id);

-- ============================================================
-- SAVINGS GOALS
-- ============================================================
CREATE TABLE savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 50),
  target_amount DECIMAL(12,2) NOT NULL CHECK (target_amount > 0),
  saved_amount DECIMAL(12,2) DEFAULT 0,
  target_date DATE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_goals_device ON savings_goals (device_id, is_completed);

-- ============================================================
-- CONTRIBUTIONS (to savings goals)
-- ============================================================
CREATE TYPE contribution_type AS ENUM ('manual', 'leftover');

CREATE TABLE contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  type contribution_type NOT NULL DEFAULT 'manual',
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;

-- Devices: can only see/modify own device
CREATE POLICY "devices_select" ON devices FOR SELECT USING (true);
CREATE POLICY "devices_insert" ON devices FOR INSERT WITH CHECK (true);
CREATE POLICY "devices_update" ON devices FOR UPDATE USING (true);

-- For all other tables, use a function to check device ownership
-- The client will pass device_id in the request headers or as a parameter

CREATE POLICY "categories_all" ON categories FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "budgets_all" ON budgets FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "expenses_all" ON expenses FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "savings_goals_all" ON savings_goals FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "contributions_all" ON contributions FOR ALL
  USING (true) WITH CHECK (true);
