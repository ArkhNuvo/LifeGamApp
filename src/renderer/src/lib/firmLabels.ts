import { useLanguageStore } from '../state/useLanguageStore'

type Row = [ru: string, en: string, pl: string]

/**
 * Labels of the firm mode (ru / en / pl; Hungarian reads English, Interslavic
 * reads Russian). Official Polish names — KPiR columns, RZiS lines, ZUS schemes —
 * are kept in Polish in every language, as they appear on the forms.
 */
const LABELS: Record<string, Row> = {
  // picker / firm form
  'firms.title': ['Фирмы', 'Firms', 'Firmy'],
  'firms.empty': ['Фирм пока нет — создайте первую.', 'No firms yet — create the first one.', 'Brak firm — utwórz pierwszą.'],
  'firms.new': ['+ Новая фирма', '+ New firm', '+ Nowa firma'],
  'firms.open': ['Открыть', 'Open', 'Otwórz'],
  'firms.change': ['Сменить', 'Switch', 'Zmień'],
  'firms.deleteConfirm': [
    'Удалить фирму «{name}» вместе со всеми её счетами и событиями?',
    'Delete “{name}” with all its accounts and events?',
    'Usunąć firmę „{name}” wraz ze wszystkimi kontami i zdarzeniami?'
  ],
  'firm.newTitle': ['Новая фирма', 'New firm', 'Nowa firma'],
  'firm.editTitle': ['Фирма', 'Firm', 'Firma'],
  'firm.name': ['Название', 'Name', 'Nazwa'],
  'firm.nip': ['NIP', 'NIP', 'NIP'],
  'firm.nipInvalid': ['NIP неверный: нужно 10 цифр с правильной контрольной суммой', 'Invalid NIP: 10 digits with a valid checksum', 'Nieprawidłowy NIP: 10 cyfr z poprawną sumą kontrolną'],
  'firm.logo': ['Логотип (PNG)', 'Logo (PNG)', 'Logo (PNG)'],
  'firm.logoUpload': ['Загрузить PNG', 'Upload PNG', 'Wgraj PNG'],
  'firm.logoRemove': ['Убрать', 'Remove', 'Usuń'],
  'firm.logoHint': ['Без логотипа показывается первая буква названия.', 'Without a logo the first letter of the name is shown.', 'Bez logo wyświetlana jest pierwsza litera nazwy.'],
  'firm.logoPngOnly': ['Нужен файл PNG.', 'A PNG file is needed.', 'Potrzebny jest plik PNG.'],
  'firm.currency': ['Валюта основного счёта', 'Main account currency', 'Waluta głównego konta'],
  // summary
  'sum.revenue': ['Przychód', 'Przychód (revenue)', 'Przychód'],
  'sum.costs': ['Koszty', 'Koszty (costs)', 'Koszty'],
  'sum.balance': ['Saldo', 'Saldo (balance)', 'Saldo'],
  'sum.ytd': ['с начала года', 'year to date', 'od początku roku'],
  // tax panel
  'tax.title': ['Налоги и ZUS', 'Taxes & ZUS', 'Podatki i ZUS'],
  'tax.social': ['ZUS społeczne', 'ZUS społeczne', 'ZUS społeczne'],
  'tax.labourFund': ['w tym Fundusz Pracy', 'incl. Fundusz Pracy', 'w tym Fundusz Pracy'],
  'tax.health': ['Składka zdrowotna', 'Składka zdrowotna', 'Składka zdrowotna'],
  'tax.zusTotal': ['ZUS к оплате до {date}', 'ZUS due by {date}', 'ZUS do zapłaty do {date}'],
  'tax.pit': ['Zaliczka PIT до {date}', 'PIT advance due by {date}', 'Zaliczka PIT do {date}'],
  'tax.vat': ['VAT до {date}', 'VAT due by {date}', 'VAT do {date}'],
  'tax.vatRefund': ['VAT к возврату / переносу', 'VAT to refund / carry over', 'VAT do zwrotu / przeniesienia'],
  'tax.income': ['Dochód с начала года', 'Dochód year to date', 'Dochód od początku roku'],
  'tax.base': ['База налога с начала года', 'Tax base year to date', 'Podstawa od początku roku'],
  'tax.pitYtd': ['PIT с начала года', 'PIT year to date', 'PIT od początku roku'],
  'tax.threshold': ['Próg 120 000 zł (32%)', 'Próg 120 000 zł (32%)', 'Próg 120 000 zł (32%)'],
  'tax.vatLimit': ['Limit zwolnienia z VAT', 'VAT exemption limit', 'Limit zwolnienia z VAT'],
  'tax.settings': ['Настройки налогов', 'Tax settings', 'Ustawienia podatków'],
  'tax.estimate': [
    'Оценка по данным KPiR. Взносы учтены за месяц, к которому относятся.',
    'An estimate from the KPiR. Contributions are counted for the month they concern.',
    'Szacunek na podstawie KPiR. Składki liczone za miesiąc, którego dotyczą.'
  ],
  'tax.none': ['—', '—', '—'],
  // tax settings
  'ts.title': ['Налоги и ZUS', 'Taxes & ZUS', 'Podatki i ZUS'],
  'ts.form': ['Форма налогообложения', 'Form of taxation', 'Forma opodatkowania'],
  'ts.form.skala': ['Skala podatkowa (12% / 32%)', 'Skala podatkowa (12% / 32%)', 'Skala podatkowa (12% / 32%)'],
  'ts.form.liniowy': ['Podatek liniowy (19%)', 'Podatek liniowy (19%)', 'Podatek liniowy (19%)'],
  'ts.form.ryczalt': ['Ryczałt od przychodów ewidencjonowanych', 'Ryczałt od przychodów ewidencjonowanych', 'Ryczałt od przychodów ewidencjonowanych'],
  'ts.ryczaltRate': ['Ставка ryczałtu, %', 'Ryczałt rate, %', 'Stawka ryczałtu, %'],
  'ts.zus': ['Składki ZUS', 'ZUS contributions', 'Składki ZUS'],
  'ts.zus.full': ['Pełny ZUS („duży”)', 'Pełny ZUS („duży”)', 'Pełny ZUS („duży”)'],
  'ts.zus.preferential': ['Preferencyjny ZUS (24 mies.)', 'Preferencyjny ZUS (24 mies.)', 'Preferencyjny ZUS (24 mies.)'],
  'ts.zus.start': ['Ulga na start (6 mies., только zdrowotna)', 'Ulga na start (6 mies., health only)', 'Ulga na start (6 mies., tylko zdrowotna)'],
  'ts.zus.small_plus': ['Mały ZUS Plus', 'Mały ZUS Plus', 'Mały ZUS Plus'],
  'ts.zus.none': ['Без społecznych (напр., есть etat)', 'No social ZUS (e.g. employed elsewhere)', 'Bez społecznych (np. etat)'],
  'ts.smallPlusBase': ['Podstawa Mały ZUS Plus, zł', 'Mały ZUS Plus base, zł', 'Podstawa Mały ZUS Plus, zł'],
  'ts.sickness': ['Dobrowolne ubezpieczenie chorobowe', 'Voluntary sickness insurance', 'Dobrowolne ubezpieczenie chorobowe'],
  'ts.vatPayer': ['Czynny podatnik VAT', 'Active VAT payer', 'Czynny podatnik VAT'],
  'ts.vatPeriod': ['Rozliczenie VAT', 'VAT settlement', 'Rozliczenie VAT'],
  'ts.vatMonth': ['ежемесячно', 'monthly', 'miesięcznie'],
  'ts.vatQuarter': ['ежеквартально', 'quarterly', 'kwartalnie'],
  'ts.params': ['Параметры {year} года', '{year} parameters', 'Parametry na {year} rok'],
  'ts.paramsHint': [
    'Значения подставлены по умолчанию и меняются каждый январь — сверьте их с zus.pl / podatki.gov.pl или с бухгалтером.',
    'Defaults change every January — check them against zus.pl / podatki.gov.pl or with your accountant.',
    'Wartości domyślne zmieniają się co roku — sprawdź je na zus.pl / podatki.gov.pl lub u księgowego.'
  ],
  'ts.p.minimumWage': ['Minimalne wynagrodzenie', 'Minimum wage', 'Minimalne wynagrodzenie'],
  'ts.p.zusFullBase': ['Podstawa pełnego ZUS', 'Full ZUS base', 'Podstawa pełnego ZUS'],
  'ts.p.zusPreferentialBase': ['Podstawa preferencyjna', 'Preferential base', 'Podstawa preferencyjna'],
  'ts.p.healthMin': ['Minimalna składka zdrowotna', 'Minimum health contribution', 'Minimalna składka zdrowotna'],
  'ts.p.healthRyczalt0': ['Zdrowotna ryczałt ≤ 60 tys.', 'Ryczałt health ≤ 60k', 'Zdrowotna ryczałt ≤ 60 tys.'],
  'ts.p.healthRyczalt1': ['Zdrowotna ryczałt 60–300 tys.', 'Ryczałt health 60–300k', 'Zdrowotna ryczałt 60–300 tys.'],
  'ts.p.healthRyczalt2': ['Zdrowotna ryczałt > 300 tys.', 'Ryczałt health > 300k', 'Zdrowotna ryczałt > 300 tys.'],
  'ts.p.liniowyHealthDeductionLimit': ['Limit odliczenia zdrowotnej (liniowy)', 'Health deduction cap (liniowy)', 'Limit odliczenia zdrowotnej (liniowy)'],
  'ts.reset': ['Вернуть значения по умолчанию', 'Restore defaults', 'Przywróć domyślne'],
  // KPiR tab
  'kpir.tab': ['KPiR', 'KPiR', 'KPiR'],
  'kpir.book': ['Księga (KPiR)', 'Book (KPiR)', 'Księga (KPiR)'],
  'kpir.rzis': ['RZiS', 'RZiS (P&L)', 'RZiS'],
  'kpir.empty': ['В этом месяце записей нет.', 'No entries this month.', 'Brak wpisów w tym miesiącu.'],
  'kpir.defaulted': [
    'Позиции не размечены — сумма записана в колонку по умолчанию. Откройте событие, чтобы разнести по колонкам.',
    'No lines yet — the amount went to the default column. Open the event to assign columns.',
    'Brak pozycji — kwota trafiła do kolumny domyślnej. Otwórz zdarzenie, aby przypisać kolumny.'
  ],
  'kpir.monthSum': ['Podsumowanie miesiąca', 'Podsumowanie miesiąca', 'Podsumowanie miesiąca'],
  'kpir.carried': ['Z przeniesienia', 'Z przeniesienia', 'Z przeniesienia'],
  'kpir.ytd': ['Razem od początku roku', 'Razem od początku roku', 'Razem od początku roku'],
  'kpir.pdf': ['Экспорт PDF', 'Export PDF', 'Eksport PDF'],
  'kpir.csv': ['CSV', 'CSV', 'CSV'],
  'kpir.saved': ['Сохранено: {path}', 'Saved: {path}', 'Zapisano: {path}'],
  'kpir.currencyNote': [
    'Суммы в валюте пересчитаны в PLN по текущему курсу (для KPiR нужен курс NBP со дня перед операцией).',
    'Foreign amounts are converted to PLN at the current rate (the KPiR needs the NBP rate of the previous day).',
    'Kwoty w walutach przeliczono na PLN po bieżącym kursie (w KPiR wymagany kurs NBP z dnia poprzedzającego).'
  ],
  'rzis.period': ['Период', 'Period', 'Okres'],
  'rzis.month': ['Месяц', 'Month', 'Miesiąc'],
  'rzis.quarter': ['Квартал', 'Quarter', 'Kwartał'],
  'rzis.ytd': ['С начала года', 'Year to date', 'Od początku roku'],
  'rzis.year': ['Весь год', 'Whole year', 'Cały rok'],
  'rzis.note': [
    'Упрощённый отчёт (вариант сравнительный) по данным KPiR: строки определяются по колонкам и категориям, остатки запасов не учитываются.',
    'A simplified report (comparative variant) built from the KPiR: lines follow columns and categories; inventory changes are not included.',
    'Uproszczone sprawozdanie (wariant porównawczy) na podstawie KPiR: pozycje wg kolumn i kategorii, bez zmiany stanu zapasów.'
  ],
  // VAT
  'vat.tab': ['Rejestr VAT', 'VAT registers', 'Rejestr VAT'],
  'vat.modeVat': ['KPiR: netto · VAT отдельно', 'KPiR: net · VAT separately', 'KPiR: netto · VAT osobno'],
  'vat.modeNoVat': ['KPiR: brutto · без VAT', 'KPiR: gross · no VAT', 'KPiR: brutto · bez VAT'],
  'vat.modeVatHint': [
    'Czynny podatnik VAT: в KPiR записываются суммы netto, VAT ведётся отдельно в реестрах продаж и покупок (основа для JPK_V7).',
    'Active VAT payer: the KPiR records net amounts; VAT is kept separately in the sales and purchase registers (the basis for JPK_V7).',
    'Czynny podatnik VAT: w KPiR kwoty netto, VAT osobno w rejestrach sprzedaży i zakupów (podstawa JPK_V7).'
  ],
  'vat.modeNoVatHint': [
    'Не плательщик VAT: в KPiR записываются суммы brutto, VAT из документов виден только для статистики и ни на что не влияет.',
    'Not a VAT payer: the KPiR records gross amounts; VAT on documents is shown as a statistic only and affects nothing.',
    'Niepłatnik VAT: w KPiR kwoty brutto, VAT z dokumentów jest tylko statystyką i na nic nie wpływa.'
  ],
  'vat.infoOnly': [
    'VAT в документах месяца: {vat} zł — только для статистики (фирма не на VAT).',
    'VAT on this month’s documents: {vat} zł — a statistic only (not a VAT payer).',
    'VAT w dokumentach miesiąca: {vat} zł — tylko statystyka (firma bez VAT).'
  ],
  'vat.docVat': ['VAT в документах (статистика)', 'VAT on documents (statistic)', 'VAT w dokumentach (statystyka)'],
  'vat.jpk': ['Сгенерировать {kind}', 'Generate {kind}', 'Generuj {kind}'],
  'vat.jpkSoon': ['Генерация файла JPK появится позже', 'JPK file generation is coming later', 'Generowanie pliku JPK pojawi się później'],
  'vat.output': ['VAT należny (продажи)', 'Output VAT (sales)', 'VAT należny'],
  'vat.input': ['VAT naliczony (покупки)', 'Input VAT (purchases)', 'VAT naliczony'],
  'vat.period': ['Период расчёта', 'Settlement period', 'Okres rozliczenia'],
  'vat.missing': [
    'событий без позиций: {n} — в реестры VAT они не попали',
    'events without lines: {n} — they are not in the VAT registers',
    'zdarzeń bez pozycji: {n} — nie trafiły do rejestrów VAT'
  ],
  'vat.salesRates': ['Продажи по ставкам', 'Sales by rate', 'Sprzedaż wg stawek'],
  'vat.purchaseRates': ['Покупки по ставкам', 'Purchases by rate', 'Zakupy wg stawek'],
  'vat.salesRegister': ['Rejestr sprzedaży VAT', 'Sales VAT register', 'Rejestr sprzedaży VAT'],
  'vat.purchaseRegister': ['Rejestr zakupów VAT', 'Purchase VAT register', 'Rejestr zakupów VAT'],
  'vat.rate': ['Ставка', 'Rate', 'Stawka'],
  'vat.total': ['Итого', 'Total', 'Razem'],
  'vat.date': ['Дата', 'Date', 'Data'],
  // event modal (firm)
  'ev.doc': ['Реквизиты документа', 'Document details', 'Dane dokumentu'],
  'ev.docNumber': ['Номер документа', 'Document number', 'Nr dowodu księgowego'],
  'ev.ksef': ['Номер KSeF', 'KSeF number', 'Numer KSeF'],
  'ev.cpName': ['Контрагент', 'Counterparty', 'Kontrahent'],
  'ev.cpNip': ['NIP контрагента', 'Counterparty NIP', 'NIP kontrahenta'],
  'ev.cpAddress': ['Адрес', 'Address', 'Adres'],
  'ev.items': ['Позиции (KPiR)', 'Lines (KPiR)', 'Pozycje (KPiR)'],
  'ev.addItem': ['+ Позиция', '+ Line', '+ Pozycja'],
  'ev.itemDesc': ['Описание', 'Description', 'Opis'],
  'ev.net': ['Нетто', 'Net', 'Netto'],
  'ev.vatRate': ['VAT', 'VAT', 'VAT'],
  'ev.vat': ['Сумма VAT', 'VAT amount', 'Kwota VAT'],
  'ev.gross': ['Брутто', 'Gross', 'Brutto'],
  'ev.column': ['Колонка KPiR', 'KPiR column', 'Kolumna KPiR'],
  'ev.notInBook': ['не в KPiR', 'not in KPiR', 'poza KPiR'],
  'ev.itemsTotal': ['Итого позиций: нетто {net}, VAT {vat}, брутто {gross}', 'Lines total: net {net}, VAT {vat}, gross {gross}', 'Suma pozycji: netto {net}, VAT {vat}, brutto {gross}'],
  'ev.mismatch': ['Сумма события отличается от итога позиций', 'The event amount differs from the lines total', 'Kwota zdarzenia różni się od sumy pozycji'],
  'ev.useTotal': ['Взять итог позиций', 'Use the lines total', 'Użyj sumy pozycji'],
  'ev.itemsHint': [
    'Без позиций сумма попадёт в колонку {col}. Позиции позволяют разнести документ по разным колонкам.',
    'Without lines the amount goes to column {col}. Lines let you split a document across columns.',
    'Bez pozycji kwota trafi do kolumny {col}. Pozycje pozwalają rozbić dokument na kolumny.'
  ],
  'ev.exempt': ['zw/np', 'exempt', 'zw/np']
}

export type FirmLabel = (key: string, vars?: Record<string, string | number>) => string

export function makeFirmLabel(lang: string): FirmLabel {
  const index = lang === 'ru' || lang === 'isv' ? 0 : lang === 'pl' ? 2 : 1
  return (key, vars) => {
    let text = LABELS[key]?.[index] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v))
    return text
  }
}

export function useFirmLabel(): FirmLabel {
  const lang = useLanguageStore((s) => s.language)
  return makeFirmLabel(lang)
}
