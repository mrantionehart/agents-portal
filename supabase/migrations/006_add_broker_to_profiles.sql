-- Add broker_id column to profiles table
-- This establishes the relationship between agents and their brokers

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS broker_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_broker_id ON profiles(broker_id);

-- Add RLS policy to allow users to see profiles of their own agents/team members
DROP POLICY IF EXISTS "Brokers can view their agents" ON profiles;
CREATE POLICY "Brokers can view their agents"
  ON profiles FOR SELECT
  USING (
    -- Users can see their own profile
    auth.uid() = id OR
    -- Brokers can see their agents
    auth.uid() = broker_id OR
    -- Agents and TCs can see their own broker's profile
    broker_id = auth.uid()
  );

-- Add RLS policy to allow brokers to update their agents
DROP POLICY IF EXISTS "Brokers can update their agents" ON profiles;
CREATE POLICY "Brokers can update their agents"
  ON profiles FOR UPDATE
  USING (auth.uid() = broker_id)
  WITH CHECK (auth.uid() = broker_id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
