import { useMemo, useState } from 'react'
import { useFirmLabel } from '../../../lib/firmLabels'
import { KPIR_COLUMNS, RZIS_LINES, allCosts, kpirRows, rzis, totals, type KpirRow, type RzisReport } from '../../../lib/kpir'
import { formatNip } from '../../../lib/polishTax'
import type { Firm, LedgerEvent } from '../../../lib/types'
import { useFirmYear } from './useFirmYear'
import { documentVat, vatRegister } from '../../../lib/vat'
import VatRegisterView from './VatRegisterView'

const money = (n: number): string => (n === 0 ? '' : n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const moneyAlways = (n: number): string => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ddmm = (iso: string): string => iso.split('-').reverse().join('.')
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

type Period = 'month' | 'quarter' | 'ytd' | 'year'

/** The amount columns in the official order: 9 and 14 are the revenue and expense totals. */
const SCREEN_COLUMNS = ['7', '8', '9', '10', '11', '12', '13', '14', '16'] as const
type ScreenColumn = (typeof SCREEN_COLUMNS)[number]
const COLUMN_TITLES: Record<ScreenColumn, string> = {
  ...(Object.fromEntries(KPIR_COLUMNS.map((c) => [c.id, c.label])) as Record<Exclude<ScreenColumn, '9' | '14'>, string>),
  '9': 'Razem przychód (7 + 8)',
  '14': 'Razem wydatki (12 + 13)'
}

function columnValue(r: { cols: Record<string, number>; revenue: number; expenses: number }, c: ScreenColumn): number {
  return c === '9' ? r.revenue : c === '14' ? r.expenses : (r.cols[c] ?? 0)
}

function periodRange(month: string, period: Period): { from: string; to: string; label: string } {
  const [y, m] = month.split('-').map(Number)
  const end = (mm: number): string => `${y}-${String(mm).padStart(2, '0')}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}`
  if (period === 'month') return { from: `${month}-01`, to: end(m), label: month }
  if (period === 'quarter') {
    const q = Math.ceil(m / 3)
    return { from: `${y}-${String(q * 3 - 2).padStart(2, '0')}-01`, to: end(q * 3), label: `Q${q} ${y}` }
  }
  if (period === 'ytd') return { from: `${y}-01-01`, to: end(m), label: `01–${String(m).padStart(2, '0')}.${y}` }
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) }
}

const PDF_STYLE = `
  body { font-family: Arial, sans-serif; font-size: 8.5pt; color: #000; }
  h1 { font-size: 13pt; margin: 0 0 2px; }
  .meta { margin-bottom: 8px; color: #333; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #555; padding: 3px 4px; vertical-align: top; }
  th { background: #eee; font-weight: bold; text-align: center; }
  td.n { text-align: right; white-space: nowrap; }
  tr.sum td { font-weight: bold; background: #f4f4f4; }
  .rz td:first-child { width: 36px; font-weight: bold; }
  .rz tr.total td { font-weight: bold; background: #f0f0f0; }
  .note { margin-top: 8px; font-size: 7.5pt; color: #444; }
`

interface Props {
  firm: Firm
  month: string
  onEdit: (ev: LedgerEvent) => void
}

/** The firm's revenue and expense book (KPiR) for the month, and the profit-and-loss report (RZiS). */
export default function KpirTab({ firm, month, onEdit }: Props): JSX.Element {
  const F = useFirmLabel()
  const [viewChoice, setView] = useState<'book' | 'rzis' | 'vat'>('book')
  const vatPayer = firm.tax.vatPayer
  // The VAT registers exist only for an active VAT payer.
  const view = viewChoice === 'vat' && !vatPayer ? 'book' : viewChoice
  const [period, setPeriod] = useState<Period>('ytd')
  const [saved, setSaved] = useState<string | null>(null)
  const { ctx, taxes } = useFirmYear(firm, month)

  const yearRows = useMemo(() => kpirRows(ctx, firm.ledger.events, month.slice(0, 4)), [ctx, firm.ledger.events, month])
  const rows = yearRows.filter((r) => r.date.startsWith(month))
  const before = totals(yearRows.filter((r) => r.date < `${month}-01`))
  const monthTotal = totals(rows)
  const ytd = totals(yearRows.filter((r) => r.date <= `${month}-31`))
  const byId = new Map(firm.ledger.events.map((e) => [e.id, e]))
  const hasForeign = ctx.accounts.some((a) => a.currency !== 'PLN')

  const range = periodRange(month, period)
  // VAT settles per month or per quarter, as set for the firm.
  const vatRange = periodRange(month, firm.tax.vatPeriod === 'quarter' ? 'quarter' : 'month')
  const register = useMemo(() => vatRegister(ctx, firm.ledger.events, vatRange.from, vatRange.to), [ctx, firm.ledger.events, vatRange.from, vatRange.to])
  const infoVat = vatPayer ? 0 : documentVat(ctx, firm.ledger.events, `${month}-01`, `${month}-31`)
  // Line J: the income tax for the period, from the monthly advances.
  const pitInRange = taxes
    .filter((t) => t.month >= range.from.slice(0, 7) && t.month <= range.to.slice(0, 7))
    .reduce((s, t) => s + t.pitAdvance, 0)
  const report = useMemo(() => rzis(ctx, firm.ledger.events, range.from, range.to, pitInRange), [ctx, firm.ledger.events, range.from, range.to, pitInRange])

  const header = (title: string, sub: string): string =>
    `<h1>${esc(title)}</h1><div class="meta">${esc(firm.name)} · NIP ${esc(formatNip(firm.nip))} · ${esc(sub)}</div>`

  function bookHtml(): string {
    const cols = ['7', '8', '9', '10', '11', '12', '13', '14', '16']
    const cell = (r: { cols: Record<string, number>; revenue: number; expenses: number }, c: string): string =>
      c === '9' ? money(r.revenue) : c === '14' ? money(r.expenses) : money(r.cols[c] ?? 0)
    const head = `<tr><th>1<br>Lp.</th><th>2<br>Data</th><th>3<br>Nr dowodu</th><th>4–5<br>Kontrahent, adres</th><th>6<br>Opis zdarzenia</th>${cols
      .map((c) => `<th>${c}</th>`)
      .join('')}</tr>`
    const body = rows
      .map(
        (r) =>
          `<tr><td>${r.lp}</td><td>${ddmm(r.date)}</td><td>${esc(r.docNumber)}</td><td>${esc([r.counterparty, r.address].filter(Boolean).join(', '))}</td><td>${esc(r.description)}</td>${cols
            .map((c) => `<td class="n">${cell(r, c)}</td>`)
            .join('')}</tr>`
      )
      .join('')
    const sumRow = (label: string, t: ReturnType<typeof totals>): string =>
      `<tr class="sum"><td colspan="5">${esc(label)}</td>${cols.map((c) => `<td class="n">${cell(t, c)}</td>`).join('')}</tr>`
    return `<!doctype html><html><head><meta charset="utf-8"><style>${PDF_STYLE}</style></head><body>${header(
      'Podatkowa księga przychodów i rozchodów',
      `miesiąc ${month}`
    )}<table>${head}${body}${sumRow(F('kpir.monthSum'), monthTotal)}${sumRow(F('kpir.carried'), before)}${sumRow(F('kpir.ytd'), ytd)}</table></body></html>`
  }

  function rzisHtml(r: RzisReport): string {
    const line = (code: string, label: string, value: number, total = false): string =>
      `<tr class="${total ? 'total' : ''}"><td>${code}</td><td>${esc(label)}</td><td class="n">${moneyAlways(value)}</td></tr>`
    const L = (id: string): string => RZIS_LINES.find((l) => l.id === id)?.label ?? id
    const rowsHtml = [
      line('A.', 'Przychody netto ze sprzedaży i zrównane z nimi', r.A, true),
      line('I.', L('A_I'), r.lines.A_I),
      line('IV.', L('A_IV'), r.lines.A_IV),
      line('B.', 'Koszty działalności operacyjnej', r.B, true),
      ...(['B_I', 'B_II', 'B_III', 'B_IV', 'B_V', 'B_VI', 'B_VII', 'B_VIII'] as const).map((id) =>
        line(`${id.split('_')[1]}.`, L(id), r.lines[id])
      ),
      line('C.', 'Zysk (strata) ze sprzedaży (A – B)', r.C, true),
      line('D.', L('D'), r.lines.D),
      line('E.', L('E'), r.lines.E),
      line('F.', 'Zysk (strata) z działalności operacyjnej (C + D – E)', r.F, true),
      line('G.', L('G'), r.lines.G),
      line('H.', L('H'), r.lines.H),
      line('I.', 'Zysk (strata) brutto (F + G – H)', r.I, true),
      line('J.', 'Podatek dochodowy', r.J),
      line('L.', 'Zysk (strata) netto (I – J)', r.L, true)
    ].join('')
    return `<!doctype html><html><head><meta charset="utf-8"><style>${PDF_STYLE}</style></head><body>${header(
      'Rachunek zysków i strat (wariant porównawczy)',
      `okres ${range.label} (${ddmm(range.from)} – ${ddmm(range.to)})`
    )}<table class="rz"><tr><th></th><th>Wyszczególnienie</th><th>Kwota (zł)</th></tr>${rowsHtml}</table><div class="note">${esc(F('rzis.note'))}</div></body></html>`
  }

  async function exportPdf(): Promise<void> {
    const html = view === 'book' ? bookHtml() : rzisHtml(report)
    const name = view === 'book' ? `KPiR_${firm.nip}_${month}.pdf` : `RZiS_${firm.nip}_${range.label.replace(/\W+/g, '_')}.pdf`
    const path = await window.api.reports.savePdf(html, name, view === 'book')
    setSaved(path)
  }

  async function exportCsv(): Promise<void> {
    const q = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`
    const head = ['Lp', 'Data', 'Nr dowodu', 'Kontrahent', 'Adres', 'Opis', '7', '8', '9', '10', '11', '12', '13', '14', '16']
    const lines = rows.map((r: KpirRow) =>
      [r.lp, r.date, r.docNumber, r.counterparty, r.address, r.description, r.cols['7'], r.cols['8'], r.revenue, r.cols['10'], r.cols['11'], r.cols['12'], r.cols['13'], r.expenses, r.cols['16']]
        .map(q)
        .join(';')
    )
    const path = await window.api.reports.saveText([head.map(q).join(';'), ...lines].join('\n'), `KPiR_${firm.nip}_${month}.csv`)
    setSaved(path)
  }

  return (
    <div className="fin-tab kpir-tab">
      <div className="kpir-bar">
        <div className="main-panel-tabs">
          <button type="button" className={view === 'book' ? 'main-tab active' : 'main-tab'} onClick={() => setView('book')}>
            {F('kpir.book')}
          </button>
          <button type="button" className={view === 'rzis' ? 'main-tab active' : 'main-tab'} onClick={() => setView('rzis')}>
            {F('kpir.rzis')}
          </button>
          {vatPayer && (
            <button type="button" className={view === 'vat' ? 'main-tab active' : 'main-tab'} onClick={() => setView('vat')}>
              {F('vat.tab')}
            </button>
          )}
        </div>
        <span className={`kpir-mode${vatPayer ? ' kpir-mode--vat' : ''}`} title={F(vatPayer ? 'vat.modeVatHint' : 'vat.modeNoVatHint')}>
          {F(vatPayer ? 'vat.modeVat' : 'vat.modeNoVat')}
        </span>
        <div className="reward-row">
          {view === 'rzis' && (
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} title={F('rzis.period')}>
              <option value="month">{F('rzis.month')}</option>
              <option value="quarter">{F('rzis.quarter')}</option>
              <option value="ytd">{F('rzis.ytd')}</option>
              <option value="year">{F('rzis.year')}</option>
            </select>
          )}
          {view === 'book' && (
            <button type="button" className="btn" onClick={() => void exportCsv()}>
              {F('kpir.csv')}
            </button>
          )}
          {view === 'vat' ? (
            <button type="button" className="btn fin-jpk-btn" disabled title={F('vat.jpkSoon')}>
              {F('vat.jpk', { kind: firm.tax.vatPeriod === 'quarter' ? 'JPK_V7K' : 'JPK_V7M' })}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => void exportPdf()}>
              {F('kpir.pdf')}
            </button>
          )}
        </div>
      </div>
      {saved && <div className="fin-hint">{F('kpir.saved', { path: saved })}</div>}

      {view === 'book' ? (
        <>
          <div className="kpir-table">
            <table>
              <thead>
                <tr>
                  <th>Lp.</th>
                  <th>Data</th>
                  <th>Nr dowodu</th>
                  <th>Kontrahent</th>
                  <th>Opis zdarzenia</th>
                  {SCREEN_COLUMNS.map((c) => (
                    <th key={c} className="num" title={COLUMN_TITLES[c]}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="fin-empty">
                      {F('kpir.empty')}
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const ev = byId.get(r.eventId)
                  return (
                    <tr key={r.eventId} className="kpir-row" onClick={() => ev && onEdit(ev)}>
                      <td>{r.lp}</td>
                      <td>{ddmm(r.date)}</td>
                      <td>{r.docNumber}</td>
                      <td>
                        {r.counterparty}
                        {r.address && <small className="kpir-sub">{r.address}</small>}
                      </td>
                      <td>
                        {r.defaulted && (
                          <span className="fin-review-badge" title={F('kpir.defaulted')}>
                            ⚠
                          </span>
                        )}
                        {r.description}
                      </td>
                      {SCREEN_COLUMNS.map((c) => (
                        <td key={c} className="num">
                          {money(columnValue(r, c))}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                {(
                  [
                    [F('kpir.monthSum'), monthTotal],
                    [F('kpir.carried'), before],
                    [F('kpir.ytd'), ytd]
                  ] as const
                ).map(([label, t]) => (
                  <tr key={label} className="kpir-sum">
                    <td colSpan={5}>{label}</td>
                    {SCREEN_COLUMNS.map((c) => (
                      <td key={c} className="num">
                        {money(columnValue(t, c))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
          <div className="fin-hint">
            {F('sum.costs')}: {moneyAlways(allCosts(monthTotal))} zł · {F('sum.balance')}: {moneyAlways(monthTotal.revenue - allCosts(monthTotal))} zł
            {hasForeign && <> · {F('kpir.currencyNote')}</>}
          </div>
          {!vatPayer && infoVat > 0 && <div className="fin-hint">{F('vat.infoOnly', { vat: moneyAlways(infoVat) })}</div>}
        </>
      ) : view === 'vat' ? (
        <VatRegisterView
          register={register}
          label={vatRange.label}
          lastMonth={vatRange.to.slice(0, 7)}
          events={byId}
          onEdit={onEdit}
        />
      ) : (
        <div className="rzis">
          <h3>Rachunek zysków i strat (wariant porównawczy)</h3>
          <div className="fin-hint">
            {range.label} · {ddmm(range.from)} – {ddmm(range.to)}
          </div>
          <table className="rzis-table">
            <tbody>
              {(
                [
                  ['A.', 'Przychody netto ze sprzedaży i zrównane z nimi', report.A, true],
                  ['I.', RZIS_LINES[0].label, report.lines.A_I, false],
                  ['IV.', RZIS_LINES[1].label, report.lines.A_IV, false],
                  ['B.', 'Koszty działalności operacyjnej', report.B, true],
                  ...(['B_I', 'B_II', 'B_III', 'B_IV', 'B_V', 'B_VI', 'B_VII', 'B_VIII'] as const).map(
                    (id) => [`${id.split('_')[1]}.`, RZIS_LINES.find((l) => l.id === id)?.label ?? id, report.lines[id], false] as const
                  ),
                  ['C.', 'Zysk (strata) ze sprzedaży (A – B)', report.C, true],
                  ['D.', 'Pozostałe przychody operacyjne', report.lines.D, false],
                  ['E.', 'Pozostałe koszty operacyjne', report.lines.E, false],
                  ['F.', 'Zysk (strata) z działalności operacyjnej (C + D – E)', report.F, true],
                  ['G.', 'Przychody finansowe', report.lines.G, false],
                  ['H.', 'Koszty finansowe', report.lines.H, false],
                  ['I.', 'Zysk (strata) brutto (F + G – H)', report.I, true],
                  ['J.', 'Podatek dochodowy', report.J, false],
                  ['L.', 'Zysk (strata) netto (I – J)', report.L, true]
                ] as const
              ).map(([code, label, value, total], i) => (
                <tr key={i} className={total ? 'rzis-total' : undefined}>
                  <td className="rzis-code">{code}</td>
                  <td>{label}</td>
                  <td className={`num${value < 0 ? ' fin-negative' : ''}`}>{moneyAlways(value)} zł</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="fin-hint">{F('rzis.note')}</div>
        </div>
      )}
    </div>
  )
}
