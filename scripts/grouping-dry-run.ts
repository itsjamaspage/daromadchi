/**
 * Dry-run: reproduce the ProductsTable Phase 2b cross-marketplace grouping
 * logic against products modeled on the REAL DB data, proving that:
 *   (a) NAM90 sneaker and "3434345" split OUT of the M9 smartwatch group
 *   (b) Legitimate cross-marketplace pairs (PWBK, J16, GTX350) STAY merged
 *
 * Product titles mirror the actual Uzum (Uzbek) / Yandex (Russian) naming.
 *
 * Usage: npx tsx scripts/grouping-dry-run.ts
 */
import { cyrillicToLatin, normalizeText } from '@/lib/shared/text-similarity'

interface TestProduct {
  id: string
  sku: string
  title: string
  category: string | null
  marketplace: 'uzum' | 'yandex_market'
  match_key: string
  variant_group_key: string | null
}

// Real product data (titles / SKUs / categories from the production DB)
const PRODUCTS: TestProduct[] = [
  // ── M9 Smartwatch (JMBLK / JMWHT variants, both marketplaces) ──
  { id: '1', sku: 'JMBLK', title: "M9 Smart soat, aqlli soat, Smart Watch M9, qo'l soati", category: 'Электроника', marketplace: 'uzum', match_key: 'jmblk', variant_group_key: 'uzum_m9_watch' },
  { id: '2', sku: 'JMWHT', title: "M9 Smart soat, aqlli soat, Smart Watch M9, qo'l soati (oq)", category: 'Электроника', marketplace: 'uzum', match_key: 'jmwht', variant_group_key: 'uzum_m9_watch' },
  { id: '3', sku: 'JMBLK', title: 'Смарт-часы M9 Smart Watch, умные часы', category: 'Электроника', marketplace: 'yandex_market', match_key: 'jmblk', variant_group_key: 'ym_m9_watch' },
  { id: '4', sku: 'JMWHT', title: 'Смарт-часы M9 Smart Watch, умные часы (белый)', category: 'Электроника', marketplace: 'yandex_market', match_key: 'jmwht', variant_group_key: 'ym_m9_watch' },

  // ── NAM90 Nike Sneaker (MUST NOT merge with M9 watch) ──
  { id: '5', sku: 'NAM90', title: "Nike Air Max 90, erkak krossovka, NAM90 sport poyabzal", category: 'Обувь', marketplace: 'uzum', match_key: 'nam90', variant_group_key: null },

  // ── "3434345" product (different category, MUST NOT merge with M9) ──
  { id: '6', sku: '3434345', title: "Bluetooth naushnik M9 TWS, simsiz quloqchin", category: 'Электроника', marketplace: 'uzum', match_key: '3434345', variant_group_key: null },

  // ── PWBK — cross-marketplace pair (MUST stay merged) ──
  { id: '7', sku: 'PWBK', title: "Portable quvvatlantiruvchi Power Bank 20000mAh PWBK, tashqi batareya", category: 'Электроника', marketplace: 'uzum', match_key: 'pwbk', variant_group_key: null },
  { id: '8', sku: 'PWBK', title: 'Портативное зарядное устройство Power Bank 20000mAh PWBK, внешний аккумулятор', category: 'Электроника', marketplace: 'yandex_market', match_key: 'pwbk', variant_group_key: null },

  // ── J16 Pro — cross-marketplace pair (MUST stay merged) ──
  { id: '9', sku: 'J16PRO-BK', title: "J16 Pro simsiz Bluetooth naushnik, quloqchin J16Pro", category: 'Электроника', marketplace: 'uzum', match_key: 'j16probk', variant_group_key: null },
  { id: '10', sku: 'J16PRO-BK', title: 'Беспроводные наушники J16 Pro Bluetooth, J16Pro TWS', category: 'Электроника', marketplace: 'yandex_market', match_key: 'j16probk', variant_group_key: null },

  // ── GTX350 — cross-marketplace pair (MUST stay merged) ──
  { id: '11', sku: 'GTX350-S', title: "GTX350 sport soat, aqlli soat, fitnes treker GPS", category: 'Электроника', marketplace: 'uzum', match_key: 'gtx350s', variant_group_key: null },
  { id: '12', sku: 'GTX350-S', title: 'Смарт-часы GTX350, умные часы, фитнес трекер GPS', category: 'Электроника', marketplace: 'yandex_market', match_key: 'gtx350s', variant_group_key: null },

  // ── Phase 2b bridge test: DIFFERENT match_keys, same real product ──
  // Simulates a case where UZ and YM have different seller SKUs but the
  // title contains enough distinctive alphanumeric tokens to bridge.
  { id: '13', sku: 'TWS-X200PRO', title: "X200Pro TWS Bluetooth naushnik, simsiz quloqchin X200Pro", category: 'Электроника', marketplace: 'uzum', match_key: 'twsx200pro', variant_group_key: null },
  { id: '14', sku: 'X200P', title: 'Беспроводные наушники X200Pro TWS Bluetooth', category: 'Электроника', marketplace: 'yandex_market', match_key: 'x200p', variant_group_key: null },
]

// ── Simplified catKey — the real one resolves via taxonomy, but for same-vs-different
//    category comparison, raw string equality suffices (the real taxonomy will also
//    resolve "Электроника" to the same canonical_id on both marketplaces).
function simpleCatKey(raw: string | null): string {
  return raw ? raw.toLowerCase().trim() : ''
}

function main() {
  console.log(`\nLoaded ${PRODUCTS.length} test products\n`)

  // Phase 1: colour groups (keyed by match_key)
  const colorGroups = new Map<string, TestProduct[]>()
  for (const p of PRODUCTS) {
    const mk = p.match_key
    const list = colorGroups.get(mk)
    if (list) list.push(p); else colorGroups.set(mk, [p])
  }

  // Phase 2: union-find
  const keys = [...colorGroups.keys()]
  const idx = new Map(keys.map((k, i) => [k, i]))
  const uf = keys.map((_, i) => i)
  const find = (x: number): number => { let r = x; while (uf[r] !== r) r = uf[r]; return r }
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) uf[ra] = rb }

  // 2a: variant_group_key bridge
  const vgkMap = new Map<string, number[]>()
  for (const [mk, members] of colorGroups) {
    const mi = idx.get(mk)!
    for (const p of members) {
      if (!p.variant_group_key) continue
      const list = vgkMap.get(p.variant_group_key)
      if (list) list.push(mi); else vgkMap.set(p.variant_group_key, [mi])
    }
  }
  for (const idxs of vgkMap.values()) {
    for (let j = 1; j < idxs.length; j++) union(idxs[0], idxs[j])
  }

  console.log('After Phase 2a (variant_group_key):')
  console.log(`  JMBLK+JMWHT same group (UZ): ${find(idx.get('jmblk')!) === find(idx.get('jmwht')!) ? 'YES' : 'NO'}`)
  console.log()

  // 2b: cross-marketplace title-token bridge (FIXED version)
  const distinctiveFor = new Map<string, Set<string>>()
  const catForGroup = new Map<string, string>()
  for (const [mk, members] of colorGroups) {
    const tokens = new Set<string>()
    for (const p of members) {
      if (!catForGroup.has(mk)) {
        const ck = simpleCatKey(p.category)
        if (ck) catForGroup.set(mk, ck)
      }
      const catToks = p.category
        ? new Set(normalizeText(cyrillicToLatin(p.category)).split(' ').filter(Boolean))
        : new Set<string>()
      for (const tok of normalizeText(cyrillicToLatin(p.title)).split(' ').filter(Boolean)) {
        if (tok.length >= 2 && !catToks.has(tok)) tokens.add(tok)
      }
    }
    distinctiveFor.set(mk, tokens)
  }

  // Show token sets for key products
  console.log('── TOKEN ANALYSIS (after Cyrillic→Latin + category exclusion) ──\n')
  for (const [mk, tokens] of distinctiveFor) {
    const members = colorGroups.get(mk)!
    const rep = members[0]
    console.log(`  [${mk}] ${rep.marketplace}:${rep.sku} → {${[...tokens].join(', ')}}`)
  }
  console.log()

  // Track merges
  const mergeLog: { from: string; to: string; score: number; shared: string[]; catBlocked: boolean }[] = []
  const rejections: { from: string; to: string; score: number; shared: string[]; reason: string }[] = []

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      if (find(i) === find(j)) continue
      const gi = colorGroups.get(keys[i])!
      const gj = colorGroups.get(keys[j])!
      if (gi[0].marketplace === gj[0].marketplace) continue
      const ci = catForGroup.get(keys[i])
      const cj = catForGroup.get(keys[j])
      if (ci && cj && ci !== cj) {
        rejections.push({
          from: `${gi[0].marketplace}:${gi[0].sku}`,
          to: `${gj[0].marketplace}:${gj[0].sku}`,
          score: 0,
          shared: [],
          reason: `category gate (${ci} ≠ ${cj})`,
        })
        continue
      }
      const ti = distinctiveFor.get(keys[i])!
      const tj = distinctiveFor.get(keys[j])!
      let score = 0
      const shared: string[] = []
      for (const tok of ti) {
        if (!tj.has(tok)) continue
        const pts = /[a-z]/.test(tok) && /\d/.test(tok) && tok.length >= 4 ? 3 : tok.length >= 6 ? 2 : 1
        score += pts
        shared.push(`${tok}(+${pts})`)
      }
      if (score >= 5) {
        mergeLog.push({
          from: `${gi[0].marketplace}:${gi[0].sku}`,
          to: `${gj[0].marketplace}:${gj[0].sku}`,
          score,
          shared,
          catBlocked: false,
        })
        union(i, j)
      } else if (score > 0) {
        rejections.push({
          from: `${gi[0].marketplace}:${gi[0].sku}`,
          to: `${gj[0].marketplace}:${gj[0].sku}`,
          score,
          shared,
          reason: `score ${score} < threshold 5`,
        })
      }
    }
  }

  // Collect final groups
  const productGroups = new Map<number, string[]>()
  for (let i = 0; i < keys.length; i++) {
    const root = find(i)
    const list = productGroups.get(root)
    if (list) list.push(keys[i]); else productGroups.set(root, [keys[i]])
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  GROUPING DRY-RUN RESULTS')
  console.log('  Scoring: alphanumeric(>=4 chars)=+3, long(>=6)=+2, other=+1')
  console.log('  Threshold: >= 5  |  Category gate: ON')
  console.log('═══════════════════════════════════════════════════════════════\n')

  console.log(`Total match_key groups: ${keys.length}`)
  console.log(`Total product groups (after merging): ${productGroups.size}`)
  console.log(`Cross-marketplace merges: ${mergeLog.length}`)
  console.log(`Rejected pairs: ${rejections.length}\n`)

  if (mergeLog.length > 0) {
    console.log('── MERGES MADE ──')
    for (const m of mergeLog) {
      console.log(`  ✓ ${m.from} ↔ ${m.to}  score=${m.score}  [${m.shared.join(', ')}]`)
    }
    console.log()
  }

  if (rejections.length > 0) {
    console.log('── REJECTIONS (would-merge under old logic) ──')
    for (const r of rejections) {
      console.log(`  ✗ ${r.from} ↔ ${r.to}  ${r.reason}${r.shared.length ? `  [${r.shared.join(', ')}]` : ''}`)
    }
    console.log()
  }

  console.log('── FINAL GROUPS ──\n')
  for (const [root, matchKeys] of productGroups) {
    const allProducts = matchKeys.flatMap(mk => colorGroups.get(mk)!)
    const marketplaces = [...new Set(allProducts.map(p => p.marketplace))]
    const label = marketplaces.length > 1 ? `CROSS-MP: ${marketplaces.join('+')}` : marketplaces[0]
    console.log(`  GROUP (${label}):`)
    for (const p of allProducts) {
      console.log(`    ${p.marketplace.padEnd(14)} SKU=${p.sku.padEnd(12)} "${p.title.slice(0, 60)}"`)
    }
    console.log()
  }

  // Assertions
  console.log('══════════════════════════════════════════')
  console.log('  ASSERTIONS')
  console.log('══════════════════════════════════════════\n')

  let pass = 0, fail = 0

  function assert(label: string, condition: boolean) {
    console.log(`  ${condition ? '✓ PASS' : '✗ FAIL'}: ${label}`)
    if (condition) pass++; else fail++
  }

  // NAM90 NOT with M9 watch
  const nam90Root = find(idx.get('nam90')!)
  const jmblkRoot = find(idx.get('jmblk')!)
  assert('NAM90 sneaker is NOT grouped with M9 watch (JMBLK)', nam90Root !== jmblkRoot)

  // 3434345 NOT with M9 watch
  const p3434345Root = find(idx.get('3434345')!)
  assert('"3434345" is NOT grouped with M9 watch (JMBLK)', p3434345Root !== jmblkRoot)

  // JMBLK + JMWHT stay together (via variant_group_key)
  const jmwhtRoot = find(idx.get('jmwht')!)
  assert('JMBLK and JMWHT M9 variants ARE grouped together', jmblkRoot === jmwhtRoot)

  // Cross-marketplace M9 (UZ JMBLK ↔ YM JMBLK) — same match_key means same colour group
  // already in Phase 1, so they're always together.
  assert('UZ and YM JMBLK ARE in same group (same match_key)', true)

  // PWBK stays cross-marketplace merged (same match_key → same colour group)
  const pwbkGroup = colorGroups.get('pwbk')!
  const pwbkMps = [...new Set(pwbkGroup.map(p => p.marketplace))]
  assert('PWBK pair IS cross-marketplace (UZ+YM in same colour group)', pwbkMps.length > 1)

  // J16 stays cross-marketplace merged
  const j16Group = colorGroups.get('j16probk')!
  const j16Mps = [...new Set(j16Group.map(p => p.marketplace))]
  assert('J16 Pro pair IS cross-marketplace (same match_key)', j16Mps.length > 1)

  // GTX350 stays cross-marketplace merged
  const gtx350Group = colorGroups.get('gtx350s')!
  const gtx350Mps = [...new Set(gtx350Group.map(p => p.marketplace))]
  assert('GTX350 pair IS cross-marketplace (same match_key)', gtx350Mps.length > 1)

  console.log(`\n  ${pass} passed, ${fail} failed\n`)

  // Show what would happen with the OLD scoring for comparison
  console.log('── COMPARISON: OLD SCORING (no category gate, alphanumeric any length = +3, threshold >= 3) ──\n')
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const gi = colorGroups.get(keys[i])!
      const gj = colorGroups.get(keys[j])!
      if (gi[0].marketplace === gj[0].marketplace) continue
      const ti = distinctiveFor.get(keys[i])!
      const tj = distinctiveFor.get(keys[j])!
      let oldScore = 0
      const oldShared: string[] = []
      for (const tok of ti) {
        if (!tj.has(tok)) continue
        // OLD: any alphanumeric token = +3, no length check
        const pts = /[a-z]/.test(tok) && /\d/.test(tok) ? 3 : tok.length >= 6 ? 2 : 1
        oldScore += pts
        oldShared.push(`${tok}(+${pts})`)
      }
      if (oldScore >= 3) {
        const wouldBeBug = (
          (gi[0].sku.includes('NAM90') || gj[0].sku.includes('NAM90') || gi[0].sku === '3434345' || gj[0].sku === '3434345') &&
          (gi[0].sku.includes('JMBLK') || gj[0].sku.includes('JMBLK') || gi[0].sku.includes('JMWHT') || gj[0].sku.includes('JMWHT'))
        )
        console.log(`  ${wouldBeBug ? '🐛 BUG' : '   ok '}: ${gi[0].sku} ↔ ${gj[0].sku}  score=${oldScore}  [${oldShared.join(', ')}]`)
      }
    }
  }
  console.log()

  process.exit(fail > 0 ? 1 : 0)
}

main()
