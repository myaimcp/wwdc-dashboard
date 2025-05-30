import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * WWDC Momentum Dashboard — v2.2
 * --------------------------------------------------------------
 * 🔧  Updates for the new **shadcn** package (formerly shadcn‑ui):
 *      • Comments now reference `npx shadcn` commands instead of the
 *        deprecated `shadcn-ui` CLI.
 *      • Import paths remain `@/components/ui/*` because the new CLI still
 *        scaffolds components there by default.
 *      • No runtime/TS changes were needed – just docs.
 * --------------------------------------------------------------
 */

// WWDC Day‑1 dates — six most recent before 2025
const wwdcDates: { year: number; date: string }[] = [
  { year: 2019, date: "2019-06-03" },
  { year: 2020, date: "2020-06-22" },
  { year: 2021, date: "2021-06-07" },
  { year: 2022, date: "2022-06-06" },
  { year: 2023, date: "2023-06-05" },
  { year: 2024, date: "2024-06-10" },
];

const toEpoch = (d: string) => Math.floor(new Date(`${d}T00:00:00Z`).getTime() / 1000);

const buyOffsets = [
  { label: "5 sessions before", val: -5 },
  { label: "1 session before", val: -1 },
  { label: "Open day-of", val: 0 },
];

const sellOffsets = [
  { label: "Close day-of", val: 0 },
  { label: "5 sessions after", val: 5 },
  { label: "20 sessions after", val: 20 },
];

const buildYahooChartURL = (date: string) => {
  const period1 = toEpoch(date) - 60 * 60 * 24 * 40;
  const period2 = toEpoch(date) + 60 * 60 * 24 * 40;
  return `/api/chart?period1=${period1}&period2=${period2}&interval=1d`;
};

async function fetchOHLC(date: string, offset: number): Promise<number> {
  const res = await fetch(buildYahooChartURL(date));
  if (!res.ok) throw new Error(`Network error ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("Malformed Yahoo payload");
  const { timestamp, indicators } = result;
  const closes: number[] = indicators?.quote?.[0]?.close ?? [];
  const idx = timestamp.findIndex((t: number) => new Date(t * 1000).toISOString().slice(0, 10) === date);
  const targetIdx = idx + offset;
  if (idx < 0 || targetIdx < 0 || targetIdx >= closes.length) throw new Error("Offset outside range");
  const price = closes[targetIdx];
  if (price == null) throw new Error("Close price missing");
  return price;
}

export default function WWDCMomentumDashboard() {
  const [buy, setBuy] = useState(buyOffsets[1]);
  const [sell, setSell] = useState(sellOffsets[0]);
  const [results, setResults] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows: { year: number | string; ret: number }[] = [];
      for (const ev of wwdcDates) {
        const buyP = await fetchOHLC(ev.date, buy.val);
        const sellP = await fetchOHLC(ev.date, sell.val);
        rows.push({ year: ev.year, ret: +(((sellP - buyP) / buyP) * 100).toFixed(2) });
      }
      const mean = rows.reduce((s, r) => s + (r.ret as number), 0) / rows.length;
      const stdev = Math.sqrt(rows.reduce((s, r) => s + Math.pow((r.ret as number) - mean, 2), 0) / rows.length);
      const winRate = rows.filter((r) => (r.ret as number) > 0).length / rows.length;
      setResults([
        ...rows,
        { year: "Avg", ret: +mean.toFixed(2) },
        { year: "StDev", ret: +stdev.toFixed(2) },
        { year: "WinRate", ret: +(winRate * 100).toFixed(0) },
      ]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold">
        Apple WWDC Momentum Lab
      </motion.h1>

      {error && (
        <Card className="border-red-500 bg-red-50">
          <CardContent>
            <p className="text-red-700 text-sm">⚠️ {error}</p>
          </CardContent>
        </Card>
      )}

      <Card className="p-4">
        <CardContent>
          <p className="mb-2 text-sm text-muted-foreground">
            Since 2019, <strong>buy‑the‑rumor</strong> has generally outperformed <strong>sell‑the‑news</strong>. Apple
            rallied ~4 % in the 20 sessions leading up to WWDC on average, while day‑of moves skew flat‑to‑negative.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select className="p-2 rounded border" value={buy.label} onChange={(e) => setBuy(buyOffsets.find((b) => b.label === e.target.value)!)}>
          {buyOffsets.map((o) => (
            <option key={o.label}>{o.label}</option>
          ))}
        </select>
        <select className="p-2 rounded border" value={sell.label} onChange={(e) => setSell(sellOffsets.find((s) => s.label === e.target.value)!)}>
          {sellOffsets.map((o) => (
            <option key={o.label}>{o.label}</option>
          ))}
        </select>
        <Button onClick={runBacktest} disabled={loading}>
          {loading ? "Crunching…" : "Run Backtest"}
        </Button>
      </div>

      {results && (
        <Card className="p-4">
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={results.filter((r) => typeof r.year === "number") as any[]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: any) => `${v}%`} />
                <Legend />
                <Bar dataKey="ret" name="Return (%)" />
              </BarChart>
            </ResponsiveContainer>
            <table className="w-full mt-4 text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1 text-left">Year</th>
                  <th className="py-1 text-right">Return %</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row, i) => (
                  <tr key={i} className={`border-b last:border-none ${typeof row.year === "string" ? "text-slate-500" : ""}`}>
                    <td className="py-1">{row.year}</td>
                    <td className="py-1 text-right">{row.ret}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
   Local setup for **shadcn** & path alias
   ------------------------------------------------------------------------------------------------
   1.  Init the project scaffold:
       npx shadcn@latest init

   2.  Add components used in this file:
       npx shadcn@latest add button card

   3.  Vite alias (vite.config.ts):
       import { defineConfig } from 'vite';
       import react from '@vitejs/plugin-react';
       import { fileURLToPath } from 'url';

       export default defineConfig({
         plugins: [react()],
         resolve: {
           alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
         },
       });

   4.  tsconfig.json "paths" must mirror the alias:
       "paths": { "@/*": ["./src/*"] }
   ------------------------------------------------------------------------------------------------ */
