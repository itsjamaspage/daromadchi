import { redirect } from 'next/navigation'

// The standalone «Остатки» view was folded into «Товары» (reconstruction-plan
// Task 1): the FBS leftover now lives as a column on the Products table, so a
// seller reads stock beside price/cost/margin instead of on a separate page.
// This route is kept only to redirect old links/bookmarks — there is no
// standalone stock page any more, and it is no longer in the sidebar.
//
// NB: getStockGroups / StocksTable / ProductGroupSuggestions are intentionally
// left in the repo (still used by the merge-suggestions flow and reused by the
// digest); only this page was retired. Where the cross-marketplace merge
// suggestions UI should live now is an open question for the owner.
export default function StocksPage() {
  redirect('/dashboard/products')
}
