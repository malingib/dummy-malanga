-- Drop existing tables if they exist (for fresh setup)
DROP TABLE IF EXISTS validation_logs CASCADE;
DROP TABLE IF EXISTS callback_logs CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS members CASCADE;

-- Create transactions table with all M-Pesa fields
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trans_id VARCHAR(255) NOT NULL UNIQUE,
  trans_type VARCHAR(50),
  trans_time TIMESTAMP,
  trans_amount VARCHAR(255) NOT NULL,
  business_shortcode VARCHAR(50),
  bill_ref_number VARCHAR(255),
  invoice_number VARCHAR(255),
  org_account_balance VARCHAR(255),
  third_party_trans_id VARCHAR(255),
  msisdn VARCHAR(20) NOT NULL,
  first_name VARCHAR(100),
  middle_name VARCHAR(100),
  last_name VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'failed', 'reconciled')),
  error_message TEXT,
  response_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create members table with all fields
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_number VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  id_number VARCHAR(100),
  address TEXT,
  wallet_balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create cases table with all fields
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(100) NOT NULL UNIQUE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount_due DECIMAL(15, 2) NOT NULL,
  amount_paid DECIMAL(15, 2) DEFAULT 0,
  contribution_per_member DECIMAL(15, 2),
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'disputed')),
  is_active BOOLEAN DEFAULT TRUE,
  is_finalized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create validation logs table
CREATE TABLE validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  bill_reference VARCHAR(255),
  validation_result BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create callback logs table
CREATE TABLE callback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trans_id VARCHAR(255),
  response_code VARCHAR(10),
  response_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for transactions
CREATE INDEX idx_transactions_trans_id ON transactions(trans_id);
CREATE INDEX idx_transactions_msisdn ON transactions(msisdn);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_bill_ref ON transactions(bill_ref_number);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Create indexes for members
CREATE INDEX idx_members_member_number ON members(member_number);
CREATE INDEX idx_members_phone ON members(phone_number);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_created_at ON members(created_at DESC);

-- Create indexes for cases
CREATE INDEX idx_cases_member_id ON cases(member_id);
CREATE INDEX idx_cases_case_number ON cases(case_number);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);

-- Create indexes for validation logs
CREATE INDEX idx_validation_logs_phone ON validation_logs(phone_number);
CREATE INDEX idx_validation_logs_created_at ON validation_logs(created_at DESC);

-- Enable row level security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE callback_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, add auth later)
CREATE POLICY "enable_read_transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "enable_insert_transactions" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "enable_update_transactions" ON transactions FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "enable_read_members" ON members FOR SELECT USING (true);
CREATE POLICY "enable_insert_members" ON members FOR INSERT WITH CHECK (true);
CREATE POLICY "enable_update_members" ON members FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "enable_read_cases" ON cases FOR SELECT USING (true);
CREATE POLICY "enable_insert_cases" ON cases FOR INSERT WITH CHECK (true);
CREATE POLICY "enable_update_cases" ON cases FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "enable_read_validation_logs" ON validation_logs FOR SELECT USING (true);
CREATE POLICY "enable_insert_validation_logs" ON validation_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "enable_read_callback_logs" ON callback_logs FOR SELECT USING (true);
CREATE POLICY "enable_insert_callback_logs" ON callback_logs FOR INSERT WITH CHECK (true);
