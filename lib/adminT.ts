// Labels for the admin-only analytics dashboard (/dashboard/admin).
// Same tr(ru, uz, en) shape as lib/landing-t.ts — the page is owner-facing, but
// it follows the app's language switch like every other page.
import type { Lang } from './i18n'

type Tr = Record<Lang, string>

function tr(ru: string, uz: string, en: string): Tr {
  return { ru, uz, en }
}

export const adminT = {
  title:        tr('Админ — подписки и выручка', 'Admin — obuna va daromad', 'Admin — subscriptions & revenue'),
  subtitle:     tr('Только для владельца. Данные из нашей БД, режим чтения.', "Faqat egasi uchun. Ma'lumot o'z bazamizdan, faqat o'qish.", 'Owner only. Read from our own database, read-only.'),
  updatedAt:    tr('Обновлено', 'Yangilangan', 'Updated'),
  refresh:      tr('Обновить', 'Yangilash', 'Refresh'),

  // ── metric cards ──
  mrr:          tr('MRR (в месяц)', 'MRR (oyiga)', 'MRR (monthly)'),
  mrrHint:      tr('Годовые тарифы = годовая сумма / 12', 'Yillik tariflar = yillik summa / 12', 'Yearly plans = annual total / 12'),
  arr:          tr('ARR (в год)', 'ARR (yiliga)', 'ARR (yearly)'),
  totalRevenue: tr('Выручка за всё время', 'Umumiy daromad', 'Total revenue'),
  monthRevenue: tr('Выручка за этот месяц', 'Bu oydagi daromad', 'Revenue this month'),
  paymentsCount: tr('оплаченных платежей', "to'langan to'lov", 'paid payments'),
  activeSubs:   tr('Активные подписки', 'Faol obunalar', 'Active subscriptions'),
  newThisMonth: tr('Новые оплаты за месяц', 'Bu oyda yangi to\'lov', 'New paid this month'),
  churnedMonth: tr('Ушли за месяц', 'Bu oyda ketgan', 'Churned this month'),
  pastDue:      tr('Просрочка оплаты', "To'lov muammosi", 'Past due'),
  pastDueHint:  tr('Списание не прошло, оплаченный период ещё идёт', "To'lov o'tmadi, lekin muddat hali tugamagan", 'Charge failed, paid period still running'),

  // ── user base (registered vs paying) ──
  registered:   tr('Всего регистраций', 'Jami ro\'yxatdan o\'tganlar', 'Total registered'),
  registeredHint: tr('Все аккаунты, не только платящие', 'Barcha hisoblar, faqat to\'lovchilar emas', 'All accounts, not just paying'),
  newSignups:   tr('Регистраций за месяц', 'Bu oyda ro\'yxatdan o\'tgan', 'Signups this month'),
  trialNotPaying: tr('На триале (не платят)', 'Trialdagi (to\'lamaydi)', 'On trial (not paying)'),

  // ── funnel ──
  funnelTitle:     tr('Воронка: регистрация → оплата', 'Voronka: ro\'yxat → to\'lov', 'Funnel: registered → paying'),
  funnelRegistered: tr('Зарегистрировались', 'Ro\'yxatdan o\'tgan', 'Registered'),
  funnelPaidPlan:  tr('На платном тарифе', 'Pullik tarifda', 'On a paid plan'),
  funnelActive:    tr('Активно платят', 'Faol to\'laydi', 'Actively paying'),
  funnelNote:      tr('Триалы не считаются платящими (тариф «free»).', 'Triallar to\'lovchi hisoblanmaydi («free» tarif).', 'Trials are not counted as paying (plan “free”).'),
  ofRegistered:    tr('от регистраций', 'ro\'yxatdan', 'of registered'),

  // ── splits ──
  byPlan:       tr('По тарифам', 'Tariflar bo\'yicha', 'By plan'),
  byInterval:   tr('Месячные и годовые', 'Oylik va yillik', 'Monthly vs yearly'),
  planPro:      tr('Pro', 'Pro', 'Pro'),
  planProPlus:  tr('Pro+', 'Pro+', 'Pro+'),
  planBiznes:   tr('Biznes', 'Biznes', 'Biznes'),
  monthly:      tr('Месячный', 'Oylik', 'Monthly'),
  annual:       tr('Годовой', 'Yillik', 'Yearly'),
  subsUnit:     tr('подписок', 'obuna', 'subs'),

  // ── tables ──
  activeTitle:  tr('Активные подписчики', 'Faol obunachilar', 'Active subscribers'),
  paymentsTitle: tr('Последние платежи', "So'nggi to'lovlar", 'Recent payments'),
  churnedTitle: tr('Ушедшие и истёкшие', 'Ketgan va muddati tugagan', 'Churned & expired'),

  colEmail:     tr('Email', 'Email', 'Email'),
  colPlan:      tr('Тариф', 'Tarif', 'Plan'),
  colInterval:  tr('Период', 'Muddat', 'Interval'),
  colAmount:    tr('Сумма', 'Summa', 'Amount'),
  colMrr:       tr('MRR', 'MRR', 'MRR'),
  colStarted:   tr('Начало', 'Boshlangan', 'Started'),
  colPeriodEnd: tr('Конец периода', 'Muddat tugashi', 'Period end'),
  colAutorenew: tr('Автопродление', 'Avto-yangilash', 'Autorenew'),
  colDate:      tr('Дата', 'Sana', 'Date'),
  colStatus:    tr('Статус', 'Holat', 'Status'),
  colLapsed:    tr('Когда истекла', 'Qachon tugagan', 'Lapsed'),
  colReason:    tr('Причина', 'Sabab', 'Reason'),

  sortAsc:      tr('Ближайшие продления сверху', 'Yaqin yangilanishlar tepada', 'Soonest renewal first'),
  sortDesc:     tr('Дальние продления сверху', 'Uzoq yangilanishlar tepada', 'Latest renewal first'),

  on:           tr('Вкл', 'Yoqilgan', 'On'),
  off:          tr('Выкл', "O'chirilgan", 'Off'),

  statusPaid:      tr('Оплачен', "To'langan", 'Paid'),
  statusPending:   tr('В ожидании', 'Kutilmoqda', 'Pending'),
  statusFailed:    tr('Ошибка', 'Xatolik', 'Failed'),
  statusCancelled: tr('Отменён', 'Bekor qilingan', 'Cancelled'),

  reasonCancelled: tr('Отменена', 'Bekor qilingan', 'Cancelled'),
  reasonExpired:   tr('Истекла', 'Muddati tugagan', 'Expired'),
  reasonLapsed:    tr('Не продлена', 'Yangilanmagan', 'Not renewed'),

  // ── empty states ──
  emptyActive:  tr('Пока нет активных подписок', 'Hozircha faol obuna yo\'q', 'No active subscriptions yet'),
  emptyPayments: tr('Платежей пока нет', "To'lovlar hali yo'q", 'No payments yet'),
  emptyChurned: tr('Никто пока не ушёл', 'Hali hech kim ketmagan', 'Nobody has churned yet'),

  // ── hero spark cards (Stripe-style KPI tiles) ──
  cardMrr:       tr('MRR', 'MRR', 'MRR'),
  cardActiveSubs: tr('Активные подписки', 'Faol obunalar', 'Active subscriptions'),
  cardRevenue:   tr('Выручка', 'Daromad', 'Revenue'),
  cardNewSubs:   tr('Новые подписки', 'Yangi obunalar', 'New subscriptions'),
  cardSignups:   tr('Новые регистрации', "Yangi ro'yxatlar", 'New signups'),
  cardUsers:     tr('Всего пользователей', 'Jami foydalanuvchilar', 'Total users'),
  subMrr:        tr('Ежемесячный доход', 'Oylik takroriy daromad', 'Monthly recurring'),
  subTotal:      tr('Всего сейчас', 'Hozirgi jami', 'In total'),
  subMonth:      tr('За этот месяц', 'Bu oyda', 'This month'),

  // ── redesign: KPIs, charts, ranges ──
  kpiChurn:     tr('Отток (в месяц)', 'Otish (oyiga)', 'Churn (monthly)'),
  vsLastMonth:  tr('за месяц', 'oyiga', 'vs last month'),
  newSubsTitle: tr('Новые подписки', 'Yangi obunalar', 'New subscriptions'),
  newSubsSub:   tr('по дням, этот месяц', 'kunlar bo\'yicha, shu oy', 'by day, this month'),
  planShareTitle: tr('Доли тарифов (MRR)', 'Tariflar ulushi (MRR)', 'Plan share (MRR)'),
  mrrGrowthTitle: tr('Рост MRR vs Отток', 'MRR o\'sishi vs Otish', 'MRR growth vs churn'),
  mrrGrowthSub:   tr('новый MRR против оттока', 'yangi MRR va otish', 'new MRR vs churned revenue'),
  seriesNewMrr:   tr('Новый MRR', 'Yangi MRR', 'New MRR'),
  seriesChurned:  tr('Отток MRR', 'Otgan MRR', 'Churned MRR'),
  chartCaveat:  tr(
    'Выведено из дат (нет истории смены тарифов; отток — по концу оплаченного периода). Оплаты — точные.',
    'Sanalardan hisoblangan (tarif tarixi yo\'q; otish — to\'langan davr oxiri bo\'yicha). To\'lovlar — aniq.',
    'Derived from timestamps (no plan-change history; churn dated at period end). Collected payments are exact.',
  ),
  emptyChart:   tr('Пока нет данных за период', 'Bu davr uchun ma\'lumot yo\'q', 'No data for this period yet'),
  shareUnit:    tr('доля', 'ulush', 'share'),
  rangeCustom:  tr('Период', 'Davr', 'Range'),
  rangeFrom:    tr('Начало', 'Boshlanish', 'From'),
  rangeTo:      tr('Конец', 'Tugash', 'To'),
  rangeApply:   tr('Применить', 'Qo\'llash', 'Apply'),

  som:          tr('сум', "so'm", "so'm"),
  noEmail:      tr('аккаунт удалён', "hisob o'chirilgan", 'account deleted'),
  readOnlyNote: tr(
    'Только отчёт: страница ничего не списывает, не возвращает и не меняет.',
    "Faqat hisobot: sahifa hech narsani yechmaydi, qaytarmaydi va o'zgartirmaydi.",
    'Reporting only: this page never charges, refunds or modifies anything.',
  ),
} satisfies Record<string, Tr>

export type AdminLabelKey = keyof typeof adminT
