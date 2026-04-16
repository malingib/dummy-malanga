-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mpesa_reference VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  bill_reference VARCHAR(255),
  case_id UUID,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'failed')),
  response_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create members table
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  id_number VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create cases table
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number VARCHAR(50) UNIQUE NOT NULL,
  member_id UUID NOT NULL REFERENCES members(id),
  amount_due DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'disputed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create validation logs table
CREATE TABLE IF NOT EXISTS validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  bill_reference VARCHAR(255),
  validation_result BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create callback logs table
CREATE TABLE IF NOT EXISTS callback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mpesa_reference VARCHAR(255),
  response_code VARCHAR(10),
  response_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_transactions_phone ON transactions(phone_number);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_mpesa_ref ON transactions(mpesa_reference);
CREATE INDEX idx_members_phone ON members(phone_number);
CREATE INDEX idx_cases_member_id ON cases(member_id);
CREATE INDEX idx_cases_case_number ON cases(case_number);

-- Create function to get total transaction amount
CREATE OR REPLACE FUNCTION get_total_transaction_amount()
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status = 'completed'
$$ LANGUAGE SQL;

-- Enable row level security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE callback_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, add auth later)
CREATE POLICY "enable_read_transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "enable_read_members" ON members FOR SELECT USING (true);
CREATE POLICY "enable_read_cases" ON cases FOR SELECT USING (true);
CREATE POLICY "enable_read_validation_logs" ON validation_logs FOR SELECT USING (true);
CREATE POLICY "enable_read_callback_logs" ON callback_logs FOR SELECT USING (true);
