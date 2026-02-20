import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DVFResult {
  id_mutation?: string;
  date_mutation?: string;
  nature_mutation?: string;
  valeur_fonciere?: number;
  code_postal?: string;
  nom_commune?: string;
  type_local?: string;
  surface_reelle_bati?: number;
  surface_relle_bati?: number; // cquest API typo variant
  nombre_pieces_principales?: number;
  adresse_numero?: string;
  adresse_nom_voie?: string;
}

interface DVFApiResponse {
  nb_resultats?: number;
  resultats?: DVFResult[];
}

interface TransactionSummary {
  date: string;
  price: number;
  surface: number;
  price_m2: number;
  type: string;
  address: string;
}

interface MarketDataResponse {
  postal_code: string;
  city_name: string;
  avg_price_m2: number;
  median_price_m2: number;
  transaction_count: number;
  recent_transactions: TransactionSummary[];
  source: 'cache' | 'api';
  last_updated_at: string;
}

const CACHE_MAX_AGE_DAYS = 30;
const DVF_API_BASE = 'https://api.cquest.org/dvf';
const MIN_PRICE_M2 = 500;
const MAX_PRICE_M2 = 20000;
const MAX_TRANSACTIONS = 200; // Fetch up to 200 to compute stats

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function getSurface(r: DVFResult): number {
  return r.surface_reelle_bati || r.surface_relle_bati || 0;
}

function buildAddress(r: DVFResult): string {
  const num = r.adresse_numero || '';
  const voie = r.adresse_nom_voie || '';
  return `${num} ${voie}`.trim() || r.nom_commune || '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Parse request
    const body = await req.json();
    const postalCode = body.postalCode?.toString().trim();

    if (!postalCode || !/^\d{5}$/.test(postalCode)) {
      return new Response(
        JSON.stringify({ error: 'Code postal invalide (5 chiffres requis)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Service role client for DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Step 1: Check cache ──
    const { data: cached } = await adminClient
      .from('market_stats_cache')
      .select('*')
      .eq('postal_code', postalCode)
      .single();

    if (cached) {
      const lastUpdate = new Date(cached.last_updated_at);
      const ageInDays = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays < CACHE_MAX_AGE_DAYS) {
        const response: MarketDataResponse = {
          postal_code: cached.postal_code,
          city_name: cached.city_name,
          avg_price_m2: cached.avg_price_m2,
          median_price_m2: cached.median_price_m2,
          transaction_count: cached.transaction_count,
          recent_transactions: (cached.recent_transactions as TransactionSummary[]) || [],
          source: 'cache',
          last_updated_at: cached.last_updated_at,
        };
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Step 2: Fetch from DVF API ──
    let dvfResults: DVFResult[] = [];

    try {
      const url = `${DVF_API_BASE}?code_postal=${postalCode}&nature_mutation=Vente&type_local=Appartement,Maison`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const apiResponse = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!apiResponse.ok) {
        throw new Error(`DVF API returned ${apiResponse.status}`);
      }

      const apiData: DVFApiResponse = await apiResponse.json();
      dvfResults = apiData.resultats || [];
    } catch (fetchErr) {
      console.error('DVF API fetch failed:', fetchErr);

      // Return stale cache if available
      if (cached) {
        const response: MarketDataResponse = {
          postal_code: cached.postal_code,
          city_name: cached.city_name,
          avg_price_m2: cached.avg_price_m2,
          median_price_m2: cached.median_price_m2,
          transaction_count: cached.transaction_count,
          recent_transactions: (cached.recent_transactions as TransactionSummary[]) || [],
          source: 'cache',
          last_updated_at: cached.last_updated_at,
        };
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({ error: 'Service DVF indisponible', code: 'DVF_UNAVAILABLE' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Step 3: Process results ──
    // Filter valid sales with price and surface
    const validSales = dvfResults
      .filter((r) => {
        const price = r.valeur_fonciere;
        const surface = getSurface(r);
        if (!price || !surface || surface <= 0) return false;

        const priceM2 = price / surface;
        return priceM2 >= MIN_PRICE_M2 && priceM2 <= MAX_PRICE_M2;
      })
      .slice(0, MAX_TRANSACTIONS);

    if (validSales.length === 0) {
      // No valid transactions
      const emptyResult: MarketDataResponse = {
        postal_code: postalCode,
        city_name: dvfResults[0]?.nom_commune || '',
        avg_price_m2: 0,
        median_price_m2: 0,
        transaction_count: 0,
        recent_transactions: [],
        source: 'api',
        last_updated_at: new Date().toISOString(),
      };

      return new Response(JSON.stringify(emptyResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Compute price/m² stats
    const pricesM2 = validSales.map((r) => Math.round(r.valeur_fonciere! / getSurface(r)));
    const avgPriceM2 = Math.round(pricesM2.reduce((a, b) => a + b, 0) / pricesM2.length);
    const medianPriceM2 = computeMedian(pricesM2);

    // Build recent transactions (last 10 by date)
    const sortedSales = [...validSales]
      .sort((a, b) => (b.date_mutation || '').localeCompare(a.date_mutation || ''))
      .slice(0, 10);

    const recentTransactions: TransactionSummary[] = sortedSales.map((r) => {
      const surface = getSurface(r);
      return {
        date: r.date_mutation || '',
        price: r.valeur_fonciere!,
        surface,
        price_m2: Math.round(r.valeur_fonciere! / surface),
        type: r.type_local || 'Inconnu',
        address: buildAddress(r),
      };
    });

    const cityName = validSales[0]?.nom_commune || '';

    // ── Step 4: Upsert cache ──
    await adminClient.from('market_stats_cache').upsert(
      {
        postal_code: postalCode,
        city_name: cityName,
        avg_price_m2: avgPriceM2,
        median_price_m2: medianPriceM2,
        transaction_count: validSales.length,
        recent_transactions: recentTransactions,
        last_updated_at: new Date().toISOString(),
      },
      { onConflict: 'postal_code' }
    );

    // ── Step 5: Return result ──
    const response: MarketDataResponse = {
      postal_code: postalCode,
      city_name: cityName,
      avg_price_m2: avgPriceM2,
      median_price_m2: medianPriceM2,
      transaction_count: validSales.length,
      recent_transactions: recentTransactions,
      source: 'api',
      last_updated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Erreur interne du serveur', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
