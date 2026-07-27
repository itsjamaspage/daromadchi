-- Referral codes stored on user_settings (already exists)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by   TEXT;  -- referral_code of the referrer

-- Referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  code             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paid')),
  reward_amount    INTEGER NOT NULL DEFAULT 0,  -- in so'm
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx ON referrals(code);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_user_id);
