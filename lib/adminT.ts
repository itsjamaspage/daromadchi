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
  newThisMonth: tr('Новые за месяц', 'Bu oyda yangi', 'New this month'),
  churnedMonth: tr('Ушли за месяц', 'Bu oyda ketgan', 'Churned this month'),
  pastDue:      tr('Просрочка оплаты', "To'lov muammosi", 'Past due'),
  pastDueHint:  tr('Списание не прошло, оплаченный период ещё идёт', "To'lov o'tmadi, lekin muddat hali tugamagan", 'Charge failed, paid period still running'),

  // ── splits ──
  byPlan:       tr('По тарифам', 'Tariflar bo\'yicha', 'By plan'),
  byInterval:   tr('Месячные и годовые', 'Oylik va yillik', 'Monthly vs yearly'),
  planPro:      tr('Pro', 'Pro', 'Pro'),
  planProPlus:  tr('Pro+', 'Pro+', 'Pro+'),
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

  som:          tr('сум', "so'm", "so'm"),
  noEmail:      tr('аккаунт удалён', "hisob o'chirilgan", 'account deleted'),
  readOnlyNote: tr(
    'Только отчёт: страница ничего не списывает, не возвращает и не меняет.',
    "Faqat hisobot: sahifa hech narsani yechmaydi, qaytarmaydi va o'zgartirmaydi.",
    'Reporting only: this page never charges, refunds or modifies anything.',
  ),
} satisfies Record<string, Tr>

export type AdminLabelKey = keyof typeof adminT
