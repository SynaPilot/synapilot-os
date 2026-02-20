import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  MapPin,
  BarChart3,
  Home,
  Search,
  AlertTriangle,
  WifiOff,
  Database,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js';

// ── Types ────────────────────────────────────────────────────

interface TransactionSummary {
  date: string;
  price: number;
  surface: number;
  price_m2: number;
  type: string;
  address: string;
}

interface MarketData {
  postal_code: string;
  city_name: string;
  avg_price_m2: number;
  median_price_m2: number;
  transaction_count: number;
  recent_transactions: TransactionSummary[];
  source: 'cache' | 'api';
  last_updated_at: string;
}

const DEFAULT_POSTAL_CODE = '21000';

// ── Data Hook ────────────────────────────────────────────────

function useMarketData(postalCode: string) {
  return useQuery<MarketData>({
    queryKey: ['market-data', postalCode],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-market-data', {
        body: { postalCode },
      });

      if (error) {
        // Network-level failure (no internet, DNS, CORS blocked)
        if (error instanceof FunctionsFetchError) {
          throw new Error('NETWORK_ERROR');
        }

        // Function not found / not deployed (Supabase relay error)
        if (error instanceof FunctionsRelayError) {
          throw new Error('FUNCTION_NOT_DEPLOYED');
        }

        // Function returned a non-2xx HTTP status
        if (error instanceof FunctionsHttpError) {
          let code: string | undefined;
          try {
            const body = await (error as FunctionsHttpError).context.json();
            code = body?.code as string | undefined;
          } catch {
            // response body not JSON parseable
          }
          if (code === 'DVF_UNAVAILABLE') throw new Error('DVF_UNAVAILABLE');
          throw new Error(code || 'SERVER_ERROR');
        }

        // Fallback for any unexpected error shape
        throw new Error('UNKNOWN_ERROR');
      }

      return data as MarketData;
    },
    enabled: /^\d{5}$/.test(postalCode),
    staleTime: 1000 * 60 * 30, // 30 minutes client-side
    retry: 1,
  });
}

// ── Formatting Helpers ───────────────────────────────────────

function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR').format(price);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

// ── Sub-components ───────────────────────────────────────────

function MarketKPIs({ data }: { data: MarketData }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
          <BarChart3 className="w-3 h-3 text-blue-400" />
          Prix moyen /m²
        </div>
        <p className="text-lg font-bold tabular-nums">
          {data.avg_price_m2 > 0 ? `${formatPrice(data.avg_price_m2)} \u20AC` : '\u2014'}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {data.transaction_count} ventes analys\u00e9es
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
          <TrendingUp className="w-3 h-3 text-purple-400" />
          Prix m\u00e9dian /m²
        </div>
        <p className="text-lg font-bold tabular-nums">
          {data.median_price_m2 > 0 ? `${formatPrice(data.median_price_m2)} \u20AC` : '\u2014'}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Source : DVF {data.source === 'cache' ? '(cache)' : '(API)'}
        </p>
      </div>
    </div>
  );
}

function PriceDistributionChart({ transactions }: { transactions: TransactionSummary[] }) {
  if (transactions.length === 0) return null;

  // Build a simple bar chart from recent transactions
  const chartData = transactions
    .slice(0, 8)
    .map((tx, i) => ({
      name: tx.type === 'Maison' ? `M${i + 1}` : `A${i + 1}`,
      price_m2: tx.price_m2,
      type: tx.type,
    }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Prix /m² — Derni\u00e8res ventes
        </span>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Appart.
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Maison
          </span>
        </div>
      </div>

      <div className="h-[160px] -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(0 0% 100% / 0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(0 0% 100% / 0.4)', fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(0 0% 100% / 0.4)', fontSize: 10 }}
              tickFormatter={(v: number) => `${v}\u20AC`}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'hsl(0 0% 7% / 0.95)',
                border: '1px solid hsl(0 0% 100% / 0.1)',
                borderRadius: '0.75rem',
                fontSize: 12,
                color: '#fff',
              }}
              formatter={(value: number) => [`${formatPrice(value)} \u20AC/m²`, 'Prix']}
            />
            <Bar
              dataKey="price_m2"
              radius={[4, 4, 0, 0]}
              fill="hsl(217, 91%, 60%)"
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function RecentTransactions({ transactions }: { transactions: TransactionSummary[] }) {
  if (transactions.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Home className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Derni\u00e8res ventes DVF
        </span>
      </div>

      <div className="space-y-1.5">
        {transactions.slice(0, 5).map((tx, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-xs truncate">
                {tx.type} — {tx.surface}m²
              </p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" />
                {tx.address}
              </p>
            </div>
            <div className="text-right shrink-0 ml-3">
              <p className="text-xs font-semibold tabular-nums text-blue-400">
                {formatPrice(tx.price)} \u20AC
              </p>
              <p className="text-[10px] text-muted-foreground">{formatDate(tx.date)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ postalCode }: { postalCode: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">Aucune transaction r\u00e9cente</p>
      <p className="text-xs mt-1">Pas de donn\u00e9es DVF pour {postalCode}</p>
    </div>
  );
}

const ERROR_CONFIG: Record<string, { icon: typeof WifiOff; title: string; detail: string }> = {
  NETWORK_ERROR: {
    icon: WifiOff,
    title: 'Connexion impossible',
    detail: 'Vérifiez votre connexion internet et réessayez.',
  },
  FUNCTION_NOT_DEPLOYED: {
    icon: Database,
    title: 'Fonction non déployée',
    detail: 'La fonction fetch-market-data n\u2019est pas disponible. Déployez-la ou lancez-la en local.',
  },
  DVF_UNAVAILABLE: {
    icon: AlertTriangle,
    title: 'Service DVF indisponible',
    detail: 'L\u2019API DVF ne répond pas. Réessayez plus tard.',
  },
  SERVER_ERROR: {
    icon: AlertTriangle,
    title: 'Erreur serveur',
    detail: 'La fonction a retourné une erreur interne. Consultez les logs Supabase.',
  },
  INTERNAL_ERROR: {
    icon: AlertTriangle,
    title: 'Erreur interne',
    detail: "Une erreur inattendue s'est produite côté serveur. Consultez les logs Supabase.",
  },
};

const DEFAULT_ERROR = {
  icon: AlertTriangle,
  title: 'Erreur de chargement',
  detail: 'Impossible de charger les données marché.',
};

function ErrorState({ message }: { message: string }) {
  const cfg = ERROR_CONFIG[message] || DEFAULT_ERROR;
  const Icon = cfg.icon;

  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">{cfg.title}</p>
      <p className="text-xs mt-1">{cfg.detail}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
      </div>
      <Skeleton className="h-[160px] rounded-xl" />
      <div className="space-y-1.5">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

interface MarketPulseProps {
  postalCode?: string;
  className?: string;
}

export function MarketPulse({ postalCode: initialPostalCode, className }: MarketPulseProps) {
  const [inputValue, setInputValue] = useState(initialPostalCode || DEFAULT_POSTAL_CODE);
  const [activePostalCode, setActivePostalCode] = useState(initialPostalCode || DEFAULT_POSTAL_CODE);

  const { data, isLoading, error } = useMarketData(activePostalCode);

  const handleSearch = () => {
    const trimmed = inputValue.trim();
    if (/^\d{5}$/.test(trimmed)) {
      setActivePostalCode(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const displayArea = data?.city_name
    ? `${data.city_name} (${data.postal_code})`
    : `${activePostalCode}`;

  const hasData = data && data.avg_price_m2 > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
    >
      <Card className={cn('glass border-white/10 overflow-hidden', className)}>
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500" />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Market Pulse
            </CardTitle>
            <div className="flex items-center gap-2">
              {data?.source === 'cache' && (
                <Badge variant="outline" className="text-[10px] border-white/20 gap-1">
                  <Database className="w-3 h-3" />
                  Cache
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] border-white/20 gap-1">
                <MapPin className="w-3 h-3" />
                {displayArea}
              </Badge>
            </div>
          </div>

          {/* Postal code search */}
          <div className="flex gap-2 mt-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Code postal (ex: 75011)"
              className="h-8 text-sm"
              maxLength={5}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSearch}
              disabled={isLoading || !/^\d{5}$/.test(inputValue.trim())}
              className="h-8 px-3 shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : error ? (
            <ErrorState message={(error as Error).message} />
          ) : !hasData ? (
            <EmptyState postalCode={activePostalCode} />
          ) : (
            <>
              <MarketKPIs data={data} />
              <PriceDistributionChart transactions={data.recent_transactions} />
              <RecentTransactions transactions={data.recent_transactions} />

              {data.last_updated_at && (
                <p className="text-[10px] text-center text-muted-foreground/60 italic">
                  Donn\u00e9es DVF — Derni\u00e8re mise \u00e0 jour : {formatDate(data.last_updated_at)}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
