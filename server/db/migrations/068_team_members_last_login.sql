-- Track the last time each user signed in, so the Grounded admin overview can
-- show who's active. Set on every successful login (server/routes/auth.js).
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
