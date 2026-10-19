import { useLanguageStore } from '../state/useLanguageStore'

type Row = [ru: string, en: string, pl: string]

/**
 * Labels for the finance statistics board, kept next to the board instead of in
 * the global dictionaries: ru / en / pl are written out, Hungarian reads as
 * English and Interslavic as Russian.
 */
const LABELS: Record<string, Row> = {
  // groups
  'group.expenses': ['Расходы', 'Expenses', 'Wydatki'],
  'group.income': ['Доходы', 'Income', 'Przychody'],
  'group.transfers': ['Переводы', 'Transfers', 'Przelewy'],
  'group.totals': ['Итоги и капитал', 'Totals & net worth', 'Podsumowania i kapitał'],
  'group.subs': ['Подписки', 'Subscriptions', 'Subskrypcje'],
  'group.crypto': ['Крипта', 'Crypto', 'Krypto'],
  'group.quality': ['Качество данных', 'Data quality', 'Jakość danych'],
  // charts
  'chart.tile': ['Плитка', 'Tile', 'Kafelek'],
  'chart.line': ['Линия', 'Line', 'Linia'],
  'chart.area': ['Площадь', 'Area', 'Obszar'],
  'chart.bar': ['Столбцы', 'Bars', 'Słupki'],
  'chart.stacked': ['Накопление', 'Stacked', 'Skumulowane'],
  'chart.hbar': ['Гориз. столбцы', 'Horizontal bars', 'Słupki poziome'],
  'chart.donut': ['Кольцо', 'Donut', 'Pierścień'],
  'chart.treemap': ['Treemap', 'Treemap', 'Treemap'],
  'chart.heat': ['Тепловая карта', 'Heat map', 'Mapa cieplna'],
  'chart.sankey': ['Санкей', 'Sankey', 'Sankey'],
  'chart.progress': ['Прогресс', 'Progress', 'Postęp'],
  'chart.table': ['Таблица', 'Table', 'Tabela'],
  'chart.diverging': ['Плюс/минус', 'Up/down bars', 'Plus/minus'],
  // periods
  'period.month': ['Выбранный месяц', 'Selected month', 'Wybrany miesiąc'],
  'period.3m': ['3 месяца', '3 months', '3 miesiące'],
  'period.6m': ['6 месяцев', '6 months', '6 miesięcy'],
  'period.12m': ['12 месяцев', '12 months', '12 miesięcy'],
  'period.all': ['Всё время', 'All time', 'Cały czas'],
  // metrics (name)
  'm.expense_by_category': ['Расходы по категориям', 'Expenses by category', 'Wydatki wg kategorii'],
  'm.category_by_month': ['Категории по времени', 'Categories over time', 'Kategorie w czasie'],
  'm.category_trend': ['Динамика категорий', 'Category change', 'Zmiana kategorii'],
  'm.top_expenses': ['Топ крупных трат', 'Biggest expenses', 'Największe wydatki'],
  'm.avg_check': ['Средний чек', 'Average purchase', 'Średni paragon'],
  'm.expense_by_weekday': ['Расходы по дням недели', 'Spending by weekday', 'Wydatki wg dni tygodnia'],
  'm.expense_by_account': ['Расходы по счетам', 'Spending by account', 'Wydatki wg kont'],
  'm.small_share': ['Доля мелких покупок', 'Small purchases share', 'Udział drobnych zakupów'],
  'm.expense_forecast': ['Прогноз расходов на месяц', 'Month expense forecast', 'Prognoza wydatków'],
  'm.income_by_category': ['Доходы по категориям', 'Income by category', 'Przychody wg kategorii'],
  'm.income_sources': ['Источники дохода', 'Income sources', 'Źródła przychodów'],
  'm.income_trend': ['Динамика дохода', 'Income trend', 'Trend przychodów'],
  'm.transfer_flows': ['Потоки между счетами', 'Flows between accounts', 'Przepływy między kontami'],
  'm.account_net_flow': ['Чистый приток по счетам', 'Net flow per account', 'Przepływ netto wg kont'],
  'm.fx_conversions': ['Конвертации валют', 'Currency conversions', 'Wymiany walut'],
  'm.savings_transfers': ['Переводы на сбережения', 'Savings transfers', 'Przelewy na oszczędności'],
  'm.kpi_income': ['Доход', 'Income', 'Przychód'],
  'm.kpi_expense': ['Расход', 'Expense', 'Wydatek'],
  'm.kpi_result': ['Результат', 'Result', 'Wynik'],
  'm.savings_rate': ['Норма сбережений', 'Savings rate', 'Stopa oszczędności'],
  'm.income_expense': ['Доходы и расходы', 'Income vs expenses', 'Przychody i wydatki'],
  'm.cashflow': ['Денежный поток', 'Cash flow', 'Przepływ gotówki'],
  'm.net_worth': ['Динамика капитала', 'Net worth', 'Kapitał w czasie'],
  'm.asset_structure': ['Структура активов', 'Asset structure', 'Struktura aktywów'],
  'm.runway': ['Подушка безопасности', 'Safety cushion', 'Poduszka bezpieczeństwa'],
  'm.yoy_expense': ['Расходы: год к году', 'Expenses year over year', 'Wydatki rok do roku'],
  'm.annual_summary': ['Годовой итог', 'Annual summary', 'Podsumowanie roczne'],
  'm.subs_cost': ['Стоимость подписок', 'Subscription cost', 'Koszt subskrypcji'],
  'm.subs_share': ['Подписки от дохода', 'Subscriptions vs income', 'Subskrypcje vs przychód'],
  'm.subs_upcoming': ['Платежи на 30 дней', 'Next 30 days of payments', 'Płatności na 30 dni'],
  'm.subs_forgotten': ['«Забытые» подписки', 'Forgotten subscriptions', '„Zapomniane” subskrypcje'],
  'm.crypto_share': ['Доли монет', 'Coin shares', 'Udziały monet'],
  'm.portfolio_history': ['Динамика крипто-портфеля', 'Crypto portfolio history', 'Historia portfela krypto'],
  'm.review_count': ['События на проверку ⚠', 'Events to review ⚠', 'Zdarzenia do sprawdzenia ⚠'],
  'm.uncategorized': ['События без категории', 'Uncategorized events', 'Zdarzenia bez kategorii'],
  'm.overdue_planned': ['Просроченные плановые', 'Overdue planned payments', 'Zaległe planowane'],
  'm.budget': ['Бюджет по категориям', 'Category budget', 'Budżet kategorii'],
  'm.crypto_pnl': ['Прибыль/убыток по монетам', 'Coin profit/loss', 'Zysk/strata na monetach'],
  'm.mandatory_split': ['Обязательные и произвольные', 'Mandatory vs optional', 'Obowiązkowe i dowolne'],
  // why a metric is unavailable
  'why.budget': ['Нужны лимиты по категориям', 'Needs per-category limits', 'Wymaga limitów kategorii'],
  'why.crypto_pnl': ['Нужны цена и дата покупки', 'Needs purchase price and date', 'Wymaga ceny i daty zakupu'],
  'why.mandatory_split': ['Нужна пометка «обязательная» у категории', 'Needs a “mandatory” flag on categories', 'Wymaga oznaczenia kategorii jako obowiązkowej'],
  // data labels
  'd.other': ['Прочее', 'Other', 'Inne'],
  'd.noCategory': ['Без категории', 'No category', 'Bez kategorii'],
  'd.small': ['Мелкие (до 100)', 'Small (under 100)', 'Drobne (do 100)'],
  'd.large': ['Остальные', 'The rest', 'Pozostałe'],
  'd.income': ['Доход', 'Income', 'Przychód'],
  'd.expense': ['Расход', 'Expense', 'Wydatek'],
  'd.result': ['Результат', 'Result', 'Wynik'],
  'd.cumulative': ['Нарастающим итогом', 'Cumulative', 'Narastająco'],
  'd.movingAvg': ['Среднее за 3 периода', '3-period average', 'Średnia z 3 okresów'],
  'd.actual': ['Факт', 'Actual', 'Faktycznie'],
  'd.forecast': ['Прогноз', 'Forecast', 'Prognoza'],
  'd.thisYear': ['Этот год', 'This year', 'Ten rok'],
  'd.prevYear': ['Прошлый год', 'Last year', 'Poprzedni rok'],
  'd.category': ['Категория', 'Category', 'Kategoria'],
  'd.date': ['Дата', 'Date', 'Data'],
  'd.title': ['Описание', 'Description', 'Opis'],
  'd.account': ['Счёт', 'Account', 'Konto'],
  'd.amount': ['Сумма', 'Amount', 'Kwota'],
  'd.thisPeriod': ['Сейчас', 'Now', 'Teraz'],
  'd.prevPeriod': ['Было', 'Before', 'Wcześniej'],
  'd.change': ['Изменение', 'Change', 'Zmiana'],
  'd.avg3': ['Среднее 3 мес.', '3-mo avg', 'Śr. 3 mies.'],
  'd.rate': ['Курс', 'Rate', 'Kurs'],
  'd.fromTo': ['Откуда → куда', 'From → to', 'Skąd → dokąd'],
  'd.perMonth': ['В месяц', 'Per month', 'Miesięcznie'],
  'd.lastPaid': ['Последняя оплата', 'Last paid', 'Ostatnia płatność'],
  'd.never': ['не было', 'never', 'brak'],
  'd.months': ['мес.', 'mo.', 'mies.'],
  'd.count': ['Покупок', 'Purchases', 'Zakupy'],
  'd.noHistory': ['История копится с сегодняшнего дня', 'History builds up from today', 'Historia gromadzi się od dziś'],
  'd.forecastNote': ['Только для текущего месяца', 'Current month only', 'Tylko bieżący miesiąc'],
  'd.noData': ['Нет данных', 'No data', 'Brak danych'],
  'd.noChart': ['Этот график недоступен для показателя', 'This chart is not available for the metric', 'Ten wykres nie jest dostępny'],
  'd.target': ['цель', 'target', 'cel'],
  // ui
  'ui.addWidget': ['+ Виджет', '+ Widget', '+ Widget'],
  'ui.reset': ['Сбросить', 'Reset', 'Resetuj'],
  'ui.resetConfirm': ['Вернуть набор виджетов по умолчанию?', 'Restore the default widgets?', 'Przywrócić domyślne widgety?'],
  'ui.newWidget': ['Новый виджет', 'New widget', 'Nowy widget'],
  'ui.editWidget': ['Настройка виджета', 'Widget settings', 'Ustawienia widgetu'],
  'ui.metric': ['Показатель', 'Metric', 'Wskaźnik'],
  'ui.search': ['Поиск…', 'Search…', 'Szukaj…'],
  'ui.chart': ['График', 'Chart', 'Wykres'],
  'ui.period': ['Период', 'Period', 'Okres'],
  'ui.account': ['Счёт', 'Account', 'Konto'],
  'ui.allAccounts': ['Все счета', 'All accounts', 'Wszystkie konta'],
  'ui.title': ['Название (необязательно)', 'Title (optional)', 'Tytuł (opcjonalnie)'],
  'ui.unavailable': ['Недоступно', 'Unavailable', 'Niedostępne'],
  'ui.drag': ['Перетащить', 'Drag', 'Przeciągnij'],
  'ui.resize': ['Изменить размер', 'Resize', 'Zmień rozmiar'],
  'ui.settings': ['Настроить', 'Settings', 'Ustawienia'],
  'ui.duplicate': ['Дублировать', 'Duplicate', 'Duplikuj'],
  'ui.remove': ['Убрать', 'Remove', 'Usuń'],
  'ui.add': ['Добавить', 'Add', 'Dodaj'],
  'ui.save': ['Сохранить', 'Save', 'Zapisz'],
  'ui.cancel': ['Отмена', 'Cancel', 'Anuluj'],
  'ui.empty': ['Нет виджетов. Добавьте первый.', 'No widgets yet. Add the first one.', 'Brak widgetów. Dodaj pierwszy.'],
  'ui.hint': ['Перетаскивайте виджеты за ⠿, размер меняется углом', 'Drag widgets by ⠿, resize with the corner', 'Przeciągaj widgety za ⠿, rozmiar zmienia róg']
}

export type StatsLabel = (key: string) => string

export function makeLabel(lang: string): StatsLabel {
  const index = lang === 'ru' || lang === 'isv' ? 0 : lang === 'pl' ? 2 : 1
  return (key) => LABELS[key]?.[index] ?? key
}

/** Hook form for components. */
export function useStatsLabel(): StatsLabel {
  const lang = useLanguageStore((s) => s.language)
  return makeLabel(lang)
}

export function localeOf(lang: string): string {
  return lang === 'ru' || lang === 'isv' ? 'ru' : lang === 'pl' ? 'pl' : lang === 'hu' ? 'hu' : 'en'
}
