import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { OFFICIAL_MENU_SEED, type SeedProductItem } from '@/services/catalogueSeedService';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { RefreshCw, CheckCircle2, AlertCircle, FileText, Search } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────
interface DBProduct {
  id: string;
  name: string;
  category: string;
  description: string | null;
  active: boolean;
}

interface DBPricingRule {
  id: string;
  pricing_type: string;
  base_price: number | null;
  active: boolean;
}

interface DBVariant {
  id: string;
  product_id: string;
  name: string;
  quantity_value: number;
  quantity_unit: string;
  active: boolean;
  pricing_rules: DBPricingRule[];
}

interface DBProductWithVariants extends DBProduct {
  variants: DBVariant[];
}

// ─── Menu-side aggregation helpers ──────────────────────────
interface MenuProduct {
  name: string;
  category: string;
  variants: { variant_name: string; pricing_type: string; base_price: number | null }[];
}

function buildMenuProducts(seed: SeedProductItem[]): Map<string, MenuProduct> {
  const map = new Map<string, MenuProduct>();
  for (const item of seed) {
    if (!map.has(item.name)) {
      map.set(item.name, { name: item.name, category: item.category, variants: [] });
    }
    map.get(item.name)!.variants.push({
      variant_name: item.variant_name,
      pricing_type: item.pricing_type,
      base_price: item.base_price,
    });
  }
  return map;
}

// ─── Alias map: DB display name → canonical OFFICIAL_MENU_SEED name ──
// The official menu shows the same product under different display names
// across the detailed price table and the visual cake menu panels.
// This map lets the audit treat them as the same canonical product.
const DB_NAME_ALIASES: Record<string, string> = {
  'Ferraro Rocher': 'Ferraro Rocher Cake',
};

/** Resolve a DB product name to its canonical menu name (identity if no alias). */
function canonicalize(dbName: string): string {
  return DB_NAME_ALIASES[dbName] ?? dbName;
}

// ─── Reconciliation result types ────────────────────────────
interface ExtraProduct { name: string; category: string; classification: string }
interface MissingProduct { name: string; category: string }
interface ExtraVariant { productName: string; variantName: string; dbPrice: number | null }
interface MissingVariant { productName: string; variantName: string; menuPrice: number | null }
interface PriceMismatch { productName: string; variantName: string; menuPrice: number | null; dbPrice: number | null }
interface CategoryMismatch { productName: string; menuCategory: string; dbCategory: string }

interface AuditResult {
  // Counts
  dbProductsCount: number;
  dbVariantsCount: number;
  dbPricingRulesCount: number;
  menuProductsCount: number;
  menuVariantsCount: number;
  // Lists
  extraProducts: ExtraProduct[];
  missingProducts: MissingProduct[];
  extraVariants: ExtraVariant[];
  missingVariants: MissingVariant[];
  priceMismatches: PriceMismatch[];
  categoryMismatches: CategoryMismatch[];
  // Matched
  matchedProducts: string[];
}

// ─── The Audit Page Component ───────────────────────────────
export const AuditPage: React.FC = () => {
  const [sessionOk, setSessionOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [rawJson, setRawJson] = useState<string | null>(null);

  // Check session on mount
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSessionOk(!!session);
    })();
  }, []);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setRawJson(null);

    try {
      // ── 1. Verify session ──────────────────────────────────
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No authenticated session. Please log into Brownie Point first.');
        setLoading(false);
        return;
      }

      // ── 2. Query live DB ───────────────────────────────────
      const { data: dbProducts, error: pErr } = await supabase
        .from('products')
        .select(`
          id, name, category, description, active,
          variants:product_variants (
            id, product_id, name, quantity_value, quantity_unit, active,
            pricing_rules ( id, pricing_type, base_price, active )
          )
        `)
        .order('name', { ascending: true });

      if (pErr) throw new Error(`Products query failed: ${pErr.message}`);

      const products = (dbProducts || []) as DBProductWithVariants[];

      // Count totals
      let dbVariantsCount = 0;
      let dbPricingRulesCount = 0;
      for (const p of products) {
        dbVariantsCount += (p.variants || []).length;
        for (const v of p.variants || []) {
          dbPricingRulesCount += (v.pricing_rules || []).length;
        }
      }

      // ── 3. Build menu reference ────────────────────────────
      const menuProducts = buildMenuProducts(OFFICIAL_MENU_SEED);
      const menuProductsCount = menuProducts.size;
      const menuVariantsCount = OFFICIAL_MENU_SEED.length;

      // ── 4. Build DB lookup (canonicalized) ──────────────────
      //    If two DB products map to the same canonical name
      //    (e.g. "Ferraro Rocher" → "Ferraro Rocher Cake"),
      //    merge their variants into a single canonical entry.
      const dbProductMap = new Map<string, DBProductWithVariants>();
      const aliasedDbNames = new Set<string>(); // track raw DB names consumed by alias
      for (const p of products) {
        const canonical = canonicalize(p.name);
        if (canonical !== p.name) aliasedDbNames.add(p.name);
        if (dbProductMap.has(canonical)) {
          // Merge variants into existing canonical entry
          const existing = dbProductMap.get(canonical)!;
          existing.variants = [...existing.variants, ...(p.variants || [])];
        } else {
          dbProductMap.set(canonical, { ...p, name: canonical, variants: [...(p.variants || [])] });
        }
      }

      // ── 5. Extra products (in DB, not in menu) ─────────────
      const extraProducts: ExtraProduct[] = [];
      for (const p of products) {
        const canonical = canonicalize(p.name);
        // Skip if this DB name was consumed by an alias (already merged into canonical)
        if (aliasedDbNames.has(p.name)) continue;
        if (!menuProducts.has(canonical)) {
          let classification = 'UNKNOWN';
          if (p.category === 'Packaging' || p.category === 'Utensils' || p.category === 'Consumables') {
            classification = 'OPERATIONAL';
          } else if (p.name === 'Custom Cake') {
            classification = 'CUSTOM';
          }
          extraProducts.push({ name: p.name, category: p.category, classification });
        }
      }

      // ── 6. Missing products (in menu, not in DB) ───────────
      const missingProducts: MissingProduct[] = [];
      for (const [name, mp] of menuProducts) {
        if (!dbProductMap.has(name)) {
          missingProducts.push({ name, category: mp.category });
        }
      }

      // ── 7. Category mismatches ─────────────────────────────
      const categoryMismatches: CategoryMismatch[] = [];
      for (const [name, mp] of menuProducts) {
        const dbP = dbProductMap.get(name);
        if (dbP && dbP.category !== mp.category) {
          categoryMismatches.push({
            productName: name,
            menuCategory: mp.category,
            dbCategory: dbP.category,
          });
        }
      }

      // ── 8. Matched products ────────────────────────────────
      const matchedProducts: string[] = [];
      for (const [name] of menuProducts) {
        if (dbProductMap.has(name)) {
          matchedProducts.push(name);
        }
      }

      // ── 9. Variant-level comparison ────────────────────────
      const extraVariants: ExtraVariant[] = [];
      const missingVariants: MissingVariant[] = [];
      const priceMismatches: PriceMismatch[] = [];

      for (const [productName, mp] of menuProducts) {
        const dbP = dbProductMap.get(productName);
        if (!dbP) continue; // already captured as missing product

        const dbVariantMap = new Map<string, DBVariant>();
        for (const v of dbP.variants || []) {
          dbVariantMap.set(v.name, v);
        }

        // Check menu variants exist in DB
        for (const mv of mp.variants) {
          const dbV = dbVariantMap.get(mv.variant_name);
          if (!dbV) {
            missingVariants.push({ productName, variantName: mv.variant_name, menuPrice: mv.base_price });
          } else {
            // Price check: find active pricing rule
            const activeRule = (dbV.pricing_rules || []).find(r => r.active);
            const dbPrice = activeRule?.base_price ?? null;
            const menuPrice = mv.base_price;
            // Compare (handle null for custom)
            if (menuPrice !== null && dbPrice !== null && Number(menuPrice) !== Number(dbPrice)) {
              priceMismatches.push({ productName, variantName: mv.variant_name, menuPrice, dbPrice });
            } else if ((menuPrice === null) !== (dbPrice === null)) {
              priceMismatches.push({ productName, variantName: mv.variant_name, menuPrice, dbPrice });
            }
          }
        }

        // Check DB variants not in menu
        const menuVariantNames = new Set(mp.variants.map(v => v.variant_name));
        for (const [vName, dbV] of dbVariantMap) {
          if (!menuVariantNames.has(vName)) {
            const activeRule = (dbV.pricing_rules || []).find(r => r.active);
            extraVariants.push({ productName, variantName: vName, dbPrice: activeRule?.base_price ?? null });
          }
        }
      }

      // Also check variants of extra products (products not in menu at all)
      // These are already captured under extra products, but let's add their variant counts
      // (No extra variant listing needed for products not in menu)

      const auditResult: AuditResult = {
        dbProductsCount: products.length,
        dbVariantsCount,
        dbPricingRulesCount,
        menuProductsCount,
        menuVariantsCount,
        extraProducts,
        missingProducts,
        extraVariants,
        missingVariants,
        priceMismatches,
        categoryMismatches,
        matchedProducts,
      };

      setResult(auditResult);

      // Also store raw JSON for optional download
      setRawJson(JSON.stringify({
        auditTimestamp: new Date().toISOString(),
        summary: {
          dbProductsCount: products.length,
          dbVariantsCount,
          dbPricingRulesCount,
          menuProductsCount,
          menuVariantsCount,
          matchedProductsCount: matchedProducts.length,
          extraProductsCount: extraProducts.length,
          missingProductsCount: missingProducts.length,
          extraVariantsCount: extraVariants.length,
          missingVariantsCount: missingVariants.length,
          priceMismatchesCount: priceMismatches.length,
          categoryMismatchesCount: categoryMismatches.length,
        },
        extraProducts,
        missingProducts,
        extraVariants,
        missingVariants,
        priceMismatches,
        categoryMismatches,
        matchedProducts,
        rawDbProducts: products,
      }, null, 2));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadJson = () => {
    if (!rawJson) return;
    const blob = new Blob([rawJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brownie-point-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    setTimeout(() => {
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 60000);
    }, 0);
  };

  // ── Not authenticated ─────────────────────────────────────
  if (sessionOk === false) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card title="Database Audit" subtitle="READ-ONLY catalogue reconciliation">
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">Please log into Brownie Point first. No authenticated session detected.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">📋 Catalogue Audit — READ ONLY</h2>
        <p className="text-sm text-slate-600 mt-1">
          Compares live Supabase database against the <code className="font-mono bg-slate-100 px-1 rounded">OFFICIAL_MENU_SEED</code> reference data.
          No database changes are made.
        </p>
      </div>

      {/* Actions */}
      <Card title="Run Audit" subtitle="Queries products, product_variants, and pricing_rules using your authenticated session">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={runAudit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-700 text-white text-sm font-medium rounded-lg hover:bg-brand-800 disabled:opacity-50 transition-colors"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Querying…' : 'Run Audit'}
          </button>

          {rawJson && (
            <button
              onClick={downloadJson}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Download Full JSON
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {/* ═══ RESULTS ═══ */}
      {result && (
        <>
          {/* Summary Counts */}
          <Card title="Summary Counts" subtitle="Side-by-side totals">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-semibold text-slate-700">Metric</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-700">Menu (Seed)</th>
                    <th className="text-right py-2 px-3 font-semibold text-emerald-700">Live DB</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-700">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">Total Products</td>
                    <td className="py-2 px-3 text-right font-mono">{result.menuProductsCount}</td>
                    <td className="py-2 px-3 text-right font-mono">{result.dbProductsCount}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">
                      <span className={result.dbProductsCount - result.menuProductsCount === 0 ? 'text-emerald-600' : 'text-amber-600'}>
                        {result.dbProductsCount - result.menuProductsCount >= 0 ? '+' : ''}{result.dbProductsCount - result.menuProductsCount}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">Total Variants</td>
                    <td className="py-2 px-3 text-right font-mono">{result.menuVariantsCount}</td>
                    <td className="py-2 px-3 text-right font-mono">{result.dbVariantsCount}</td>
                    <td className="py-2 px-3 text-right font-mono font-semibold">
                      <span className={result.dbVariantsCount - result.menuVariantsCount === 0 ? 'text-emerald-600' : 'text-amber-600'}>
                        {result.dbVariantsCount - result.menuVariantsCount >= 0 ? '+' : ''}{result.dbVariantsCount - result.menuVariantsCount}
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">Total Pricing Rules</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-400">—</td>
                    <td className="py-2 px-3 text-right font-mono">{result.dbPricingRulesCount}</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-400">—</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">Matched Products</td>
                    <td className="py-2 px-3 text-right font-mono" colSpan={3}>
                      <Badge variant="success">{result.matchedProducts.length}</Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">Extra Products (DB only)</td>
                    <td className="py-2 px-3 text-right font-mono" colSpan={3}>
                      <Badge variant={result.extraProducts.length > 0 ? 'warning' : 'success'}>{result.extraProducts.length}</Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">Missing Products (Menu only)</td>
                    <td className="py-2 px-3 text-right font-mono" colSpan={3}>
                      <Badge variant={result.missingProducts.length > 0 ? 'warning' : 'success'}>{result.missingProducts.length}</Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">Extra Variants (DB only)</td>
                    <td className="py-2 px-3 text-right font-mono" colSpan={3}>
                      <Badge variant={result.extraVariants.length > 0 ? 'warning' : 'success'}>{result.extraVariants.length}</Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">Missing Variants (Menu only)</td>
                    <td className="py-2 px-3 text-right font-mono" colSpan={3}>
                      <Badge variant={result.missingVariants.length > 0 ? 'warning' : 'success'}>{result.missingVariants.length}</Badge>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2 px-3 font-medium">Price Mismatches</td>
                    <td className="py-2 px-3 text-right font-mono" colSpan={3}>
                      <Badge variant={result.priceMismatches.length > 0 ? 'warning' : 'success'}>{result.priceMismatches.length}</Badge>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">Category Mismatches</td>
                    <td className="py-2 px-3 text-right font-mono" colSpan={3}>
                      <Badge variant={result.categoryMismatches.length > 0 ? 'warning' : 'success'}>{result.categoryMismatches.length}</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Extra Products */}
          {result.extraProducts.length > 0 && (
            <Card title={`Extra Products in DB (${result.extraProducts.length})`} subtitle="Products found in database but NOT in OFFICIAL_MENU_SEED">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">#</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Product Name</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Category</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Classification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.extraProducts.map((ep, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{ep.name}</td>
                        <td className="py-2 px-3">{ep.category}</td>
                        <td className="py-2 px-3">
                          <Badge variant={ep.classification === 'OPERATIONAL' ? 'secondary' : ep.classification === 'CUSTOM' ? 'primary' : 'warning'}>
                            {ep.classification}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Missing Products */}
          {result.missingProducts.length > 0 && (
            <Card title={`Missing Products from DB (${result.missingProducts.length})`} subtitle="Products in OFFICIAL_MENU_SEED but NOT in database">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">#</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Product Name</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.missingProducts.map((mp, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{mp.name}</td>
                        <td className="py-2 px-3">{mp.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Category Mismatches */}
          {result.categoryMismatches.length > 0 && (
            <Card title={`Category Mismatches (${result.categoryMismatches.length})`} subtitle="Products where menu category differs from database category">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">#</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Product</th>
                      <th className="text-left py-2 px-3 font-semibold text-blue-700">Menu Category</th>
                      <th className="text-left py-2 px-3 font-semibold text-emerald-700">DB Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.categoryMismatches.map((cm, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{cm.productName}</td>
                        <td className="py-2 px-3">{cm.menuCategory}</td>
                        <td className="py-2 px-3">{cm.dbCategory}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Extra Variants */}
          {result.extraVariants.length > 0 && (
            <Card title={`Extra Variants in DB (${result.extraVariants.length})`} subtitle="Variants in database that are NOT in the menu seed for matched products">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">#</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Product</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Variant</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700">DB Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.extraVariants.map((ev, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{ev.productName}</td>
                        <td className="py-2 px-3">{ev.variantName}</td>
                        <td className="py-2 px-3 text-right font-mono">{ev.dbPrice !== null ? `₹${ev.dbPrice}` : 'CUSTOM'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Missing Variants */}
          {result.missingVariants.length > 0 && (
            <Card title={`Missing Variants from DB (${result.missingVariants.length})`} subtitle="Variants in menu seed but NOT found in database for matched products">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">#</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Product</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Variant</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700">Menu Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.missingVariants.map((mv, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{mv.productName}</td>
                        <td className="py-2 px-3">{mv.variantName}</td>
                        <td className="py-2 px-3 text-right font-mono">{mv.menuPrice !== null ? `₹${mv.menuPrice}` : 'CUSTOM'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Price Mismatches */}
          {result.priceMismatches.length > 0 && (
            <Card title={`Price Mismatches (${result.priceMismatches.length})`} subtitle="Variants where the active DB price differs from the menu price">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">#</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Product</th>
                      <th className="text-left py-2 px-3 font-semibold text-slate-700">Variant</th>
                      <th className="text-right py-2 px-3 font-semibold text-blue-700">Menu Price</th>
                      <th className="text-right py-2 px-3 font-semibold text-emerald-700">DB Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.priceMismatches.map((pm, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                        <td className="py-2 px-3 font-medium">{pm.productName}</td>
                        <td className="py-2 px-3">{pm.variantName}</td>
                        <td className="py-2 px-3 text-right font-mono">{pm.menuPrice !== null ? `₹${pm.menuPrice}` : 'NULL'}</td>
                        <td className="py-2 px-3 text-right font-mono">{pm.dbPrice !== null ? `₹${pm.dbPrice}` : 'NULL'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Matched Products (collapsed) */}
          <details className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <summary className="px-6 py-4 cursor-pointer text-sm font-semibold text-slate-700 hover:bg-slate-50 rounded-xl">
              <span className="ml-2">✅ Matched Products ({result.matchedProducts.length}) — click to expand</span>
            </summary>
            <div className="px-6 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs font-mono text-slate-600 mt-2">
                {result.matchedProducts.map((name, i) => (
                  <div key={i} className="bg-emerald-50 border border-emerald-200 rounded px-2 py-1 truncate" title={name}>
                    {name}
                  </div>
                ))}
              </div>
            </div>
          </details>

          {/* All-clear banner */}
          {result.missingProducts.length === 0 &&
           result.extraProducts.length === 0 &&
           result.missingVariants.length === 0 &&
           result.extraVariants.length === 0 &&
           result.priceMismatches.length === 0 &&
           result.categoryMismatches.length === 0 && (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium text-emerald-800">
                Database is fully reconciled with the OFFICIAL_MENU_SEED. No discrepancies found.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
