import { useMemo } from 'react'
import { useFirmLabel } from '../../../lib/firmLabels'
import { buildZestawienie, zestawienieForEmployee, zestawienieForJdg, type ZestawienieColumn } from '../../../lib/payroll-pl-2026'
import type { PayslipMonth } from '../../../lib/payroll'
import type { Firm } from '../../../lib/types'
import { useFirmYear } from './useFirmYear'

const money = (n: number): string => n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Pair = 'em' | 'rent' | 'chor' | 'wyp'
type Amount = 'emRentBase' | 'chorBase' | 'wypBase' | 'total' | 'healthBase' | 'health' | 'fp' | 'fgsp' | 'fep'

/** DRA rows (cz. IV–V): bases, contributions split into the insured person's and the payer's part. */
const ROWS: ({ label: string; text: 'kod' | 'wymiar' } | { label: string; amount: Amount } | { label: string; pair: Pair })[] = [
  { label: 'Kod tytułu ubezpieczenia', text: 'kod' },
  { label: 'Wymiar czasu pracy', text: 'wymiar' },
  { label: 'Podstawa — emerytalne i rentowe', amount: 'emRentBase' },
  { label: 'Emerytalne (ub. / pł.)', pair: 'em' },
  { label: 'Rentowe (ub. / pł.)', pair: 'rent' },
  { label: 'Podstawa — chorobowe', amount: 'chorBase' },
  { label: 'Chorobowe', pair: 'chor' },
  { label: 'Podstawa — wypadkowe', amount: 'wypBase' },
  { label: 'Wypadkowe', pair: 'wyp' },
  { label: 'Razem składki społeczne', amount: 'total' },
  { label: 'Podstawa — zdrowotne', amount: 'healthBase' },
  { label: 'Składka zdrowotna', amount: 'health' },
  { label: 'FP + FS', amount: 'fp' },
  { label: 'FGŚP', amount: 'fgsp' },
  { label: 'FEP', amount: 'fep' }
]

/** The month's contributions in the layout of the DRA: the owner, every insured person, and the total to pay. */
export default function DraSummary({ firm, month, slips }: { firm: Firm; month: string; slips: PayslipMonth[] }): JSX.Element {
  const F = useFirmLabel()
  const { current } = useFirmYear(firm, month)
  const { columns, total } = useMemo(() => {
    const cols: ZestawienieColumn[] = []
    if (current) {
      const owner = zestawienieForJdg(current.zus, { base: current.healthBase, amount: current.health }, F('staff.draOwner'))
      // Insured elsewhere: only the health contribution, without a social title code of its own.
      cols.push(firm.tax.zus === 'none' ? { ...owner, kod: '' } : owner)
    }
    for (const s of slips) {
      if (!s.calc) continue
      const col = zestawienieForEmployee(s.calc, `${s.member.firstName} ${s.member.lastName}`.trim())
      if (col) cols.push(col)
    }
    return buildZestawienie(cols)
  }, [current, slips, firm.tax.zus, F])

  const cell = (c: ZestawienieColumn, r: (typeof ROWS)[number]): JSX.Element | string => {
    if ('text' in r) return c[r.text] || '—'
    if ('amount' in r) return money(c[r.amount])
    const p = c[r.pair]
    return p.pl > 0 ? `${money(p.ub)} / ${money(p.pl)}` : money(p.ub)
  }

  return (
    <details className="staff-dra">
      <summary className="fin-section-title">{F('staff.dra')}</summary>
      <div className="fin-hint">{F('staff.draHint', { month })}</div>
      <div className="kpir-table">
        <table>
          <thead>
            <tr>
              <th />
              {columns.map((c, i) => (
                <th key={i} className="num">
                  {c.name}
                </th>
              ))}
              <th className="num">{total.name}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label}>
                <td className="staff-dra-label">{r.label}</td>
                {columns.map((c, i) => (
                  <td key={i} className="num">
                    {cell(c, r)}
                  </td>
                ))}
                <td className="num staff-dra-total">{'text' in r ? '' : cell(total, r)}</td>
              </tr>
            ))}
            <tr className="staff-dra-total">
              <td className="staff-dra-label">Do zapłaty (ZUS)</td>
              {columns.map((c, i) => (
                <td key={i} className="num">
                  {money(c.total + c.health + c.fp + c.fgsp + c.fep)}
                </td>
              ))}
              <td className="num">{money(total.total + total.health + total.fp + total.fgsp + total.fep)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  )
}
