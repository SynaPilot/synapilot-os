CREATE TABLE IF NOT EXISTS public.market_stats_cache (
  postal_code         TEXT PRIMARY KEY,
  city_name           TEXT NOT NULL DEFAULT '',
  avg_price_m2        INTEGER NOT NULL DEFAULT 0,
  median_price_m2     INTEGER NOT NULL DEFAULT 0,
  transaction_count   INTEGER NOT NULL DEFAULT 0,
  recent_transactions JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- This table is global (not per-org), read-only for authenticated users via edge function.
-- All writes go through the service role key in the edge function.
ALTER TABLE public.market_stats_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read cached market data
CREATE POLICY "Authenticated users can read market cache"
  ON public.market_stats_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy for regular users (service role bypasses RLS)

COMMENT ON TABLE public.market_stats_cache IS
  'Cache for DVF market data fetched by the fetch-market-data edge function. TTL = 30 days.';
