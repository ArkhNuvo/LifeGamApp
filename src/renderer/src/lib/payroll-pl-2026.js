/**
 * payroll-pl-2026 — расчёт налогов и взносов работодателя (Польша, 2026)
 *
 *  - umowa o pracę / umowa zlecenie / umowa o dzieło: ZUS работника и работодателя,
 *    składka zdrowotna, KUP, zaliczka PIT, PPK, wynagrodzenie chorobowe, лимит 30-кратности,
 *    ulga dla młodych, autorskie KUP 50%, ryczałt для договоров до 200 zł;
 *  - lista płac: построчный расчёт и итоги к перечислению (ZUS DRA, PIT-4R, PPK);
 *  - JDG: ZUS владельца (ulga na start, preferencyjny, Mały ZUS Plus, pełny, wakacje składkowe),
 *    składka zdrowotna (skala / liniowy / ryczałt), помесячные авансы PIT нарастающим итогом.
 *
 * Все суммы в злотых. Взносы округляются до грошей, podstawa opodatkowania и zaliczka —
 * до полных злотых (art. 63 Ordynacji podatkowej).
 * Модуль без зависимостей, ES2020, работает в Node и в браузере.
 */

export const PARAMS_2026 = Object.freeze({
  year: 2026,
  minWage: 4806.0,                 // минимальная зарплата 2026
  minHourly: 31.4,                 // минимальная почасовая ставка (zlecenie)
  forecastAvgWage: 9420.0,         // prognozowane przeciętne wynagrodzenie 2026
  zusLimit30x: 282600.0,           // roczne ograniczenie podstawy emerytalno-rentowej
  rates: Object.freeze({
    emerytalne: 0.1952,            // всего; для работника и работодателя по 9,76%
    emerytalneHalf: 0.0976,
    rentoweJdg: 0.08,
    rentoweEmployee: 0.015,
    rentoweEmployer: 0.065,
    chorobowe: 0.0245,
    wypadkowe: 0.0167,             // для плательщиков до 9 застрахованных
    fp: 0.0245,                    // Fundusz Pracy + Fundusz Solidarnościowy
    fgsp: 0.001,
    fep: 0.015,                    // Fundusz Emerytur Pomostowych (szczególne warunki)
    health: 0.09,
    healthLinear: 0.049,
    employeeSocialTotal: 0.1371,
  }),
  jdg: Object.freeze({
    fullBase: 5652.0,              // 60% prognozowanego wynagrodzenia
    prefBase: 1441.8,              // 30% minimalnego wynagrodzenia
    malyZusPlusRevenueLimit: 120000,
  }),
  health: Object.freeze({
    minBase: 4806.0,               // с февраля 2026: 100% минимальной зарплаты → 432,54
    minBasePrevYear: 3499.5,       // за январь 2026 (rok składkowy 2025): 75% × 4666 → 314,96
    // przeciętne wynagrodzenie IV kw. 2025; на ryczałcie rok składkowy — календарный, суммы действуют с января
    ryczaltAvgWage: 9228.64,
    ryczaltTiers: Object.freeze([
      Object.freeze({ upTo: 60000, factor: 0.6 }),
      Object.freeze({ upTo: 300000, factor: 1.0 }),
      Object.freeze({ upTo: Infinity, factor: 1.8 }),
    ]),
    linearDeductionLimit: 14100,   // лимит вычета składki zdrowotnej на liniowym
  }),
  pit: Object.freeze({
    threshold: 120000,
    rate1: 0.12,
    rate2: 0.32,
    reductionAnnual: 3600,
    pit2Reduction: Object.freeze({ 0: 0, 1: 300, 2: 150, 3: 100 }),
    linearRate: 0.19,
    solidarityThreshold: 1000000,
    solidarityRate: 0.04,
    kupStandard: 250,
    kupElevated: 300,
    contractKupRate: 0.2,
    authorKupRate: 0.5,
    authorKupLimit: 120000,
    youngLimit: 85528,
    smallContractLimit: 200,
    smallContractRate: 0.12,
    // правила на 31.12.2021 — для ограничения składki zdrowotnej (art. 83 ust. 1a ustawy o świadczeniach)
    oldRulesRate: 0.17,
    oldRulesReduction: 43.76,
  }),
  ppk: Object.freeze({ employee: 0.02, employer: 0.015 }),
});

// ───────────────────────── округления ─────────────────────────

/** До грошей, половина вверх. */
export function r2(x) {
  if (!Number.isFinite(x)) return 0;
  const s = x < 0 ? -1 : 1;
  return (s * Math.round(Math.abs(x) * 100 + 1e-7)) / 100;
}

/** До полных злотых: < 50 gr вниз, ≥ 50 gr вверх. */
export function roundPLN(x) {
  if (!Number.isFinite(x)) return 0;
  const s = x < 0 ? -1 : 1;
  return s * Math.floor(Math.abs(x) + 0.5 + 1e-9);
}

/** Налог по шкале 12% / 32% с учётом уже набранной в году базы. */
export function scaleTax(base, ytdBase = 0, p = PARAMS_2026) {
  const room = Math.max(0, p.pit.threshold - ytdBase);
  const low = Math.min(Math.max(0, base), room);
  const high = Math.max(0, base - low);
  return low * p.pit.rate1 + high * p.pit.rate2;
}

// ───────────────────────── работники ─────────────────────────

/**
 * Wymiar etatu: число (0.125), дробь ("1/8", "3/16") или десятичная с запятой ("0,2").
 * Возвращает { value, label } с сокращённой дробью в label, либо null, если значение вне (0; 1].
 */
export function parseEtat(v) {
  if (v === undefined || v === null || v === '') return { value: 1, label: '1/1' };
  const s = String(v).trim().replace(',', '.');
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  const value = m ? +m[1] / +m[2] : Number(s);
  if (!Number.isFinite(value) || value <= 0 || value > 1) return null;
  for (let d = 1; d <= 64; d++) {
    const n = Math.round(value * d);
    if (n > 0 && Math.abs(n / d - value) < 1e-9) return { value, label: `${n}/${d}` };
  }
  return { value, label: String(+value.toFixed(4)) };
}

/**
 * Wynagrodzenie chorobowe: база = средняя брутто за 12 мес. минус 13,71%,
 * дневная ставка = база / 30, по умолчанию 80%.
 */
export function calcSickPay({ days = 0, avgGross = 0, rate = 0.8 } = {}, p = PARAMS_2026) {
  if (!days) return { days: 0, base: 0, dailyBase: 0, daily: 0, rate, amount: 0 };
  const base = r2(avgGross - r2(avgGross * p.rates.employeeSocialTotal));
  const dailyBase = r2(base / 30);
  const daily = r2(dailyBase * rate);
  return { days, base, dailyBase, daily, rate, amount: r2(daily * days) };
}

const CONTRACTS = ['uop', 'zlecenie', 'dzielo'];

/**
 * Расчёт одного работника за месяц.
 *
 * @param {object} input
 * @param {'uop'|'zlecenie'|'dzielo'} input.contract
 * @param {number} input.gross            оклад / сумма договора
 * @param {number} [input.bonus]          премии и доплаты, облагаемые ZUS
 * @param {0|1|2|3} [input.pit2]          PIT-2: 1 — 300 zł, 2 — 150 zł, 3 — 100 zł, 0 — нет
 * @param {'standard'|'elevated'} [input.kup]  KUP для umowy o pracę: 250 или 300 zł
 * @param {number} [input.authorShare]    доля оклада с autorskimi KUP 50% (0..1)
 * @param {boolean} [input.under26]       ulga dla młodych (PIT-0)
 * @param {boolean} [input.student]       zlecenie: учащийся до 26 лет — без ZUS и zdrowotnej
 * @param {boolean} [input.chorobowe]     zlecenie: добровольное chorobowe
 * @param {boolean} [input.otherTitleZus] zlecenie: есть другой титул с базой ≥ мин. зарплаты — только zdrowotna
 * @param {boolean} [input.ownEmployee]   договор с собственным работником (нет ryczałtu до 200 zł)
 * @param {boolean} [input.fpExempt]      освобождение от FP (55/60+, после декрета, 50+ новый работник…)
 * @param {boolean} [input.fgspExempt]
 * @param {boolean} [input.fep]           работа в szczególnych warunkach — FEP 1,5%
 * @param {number} [input.wypadkoweRate]
 * @param {number|string} [input.etat]    wymiar etatu: 1, 0.2, "1/7", "1/8"… — для проверки минимальной зарплаты
 * @param {number} [input.hours]          zlecenie: часы — для проверки минимальной ставки
 * @param {null|{employee?:number, employer?:number}} [input.ppk]
 * @param {null|{days:number, avgGross:number, rate?:number}} [input.sickness]
 * @param {number} [input.fpMonthlyBase]  база FP в пересчёте на месяц (если отличается от фактической)
 * @param {boolean} [input.healthCapOldRules] ограничение zdrowotnej авансом по правилам 2021 (по умолчанию да)
 * @param {{zusBase?:number, taxBase?:number, youngRevenue?:number, authorKup?:number}} [input.ytd]
 */
export function calcEmployment(input = {}, p = PARAMS_2026) {
  const i = {
    contract: 'uop', gross: 0, bonus: 0, pit2: 1, kup: 'standard', authorShare: 0,
    under26: false, student: false, chorobowe: false, otherTitleZus: false, ownEmployee: false,
    fpExempt: false, fgspExempt: false, fep: false, wypadkoweRate: p.rates.wypadkowe,
    etat: 1, hours: 0, ppk: null, sickness: null, fpMonthlyBase: undefined, healthCapOldRules: true,
    ...input,
  };
  if (!CONTRACTS.includes(i.contract)) throw new Error(`Неизвестный тип договора: ${i.contract}`);
  const ytd = { zusBase: 0, taxBase: 0, youngRevenue: 0, authorKup: 0, ...(input.ytd || {}) };
  const isUop = i.contract === 'uop';
  const isZl = i.contract === 'zlecenie';
  const isDz = i.contract === 'dzielo';
  const warnings = [];
  const gross = Math.max(0, +i.gross || 0);
  const bonus = Math.max(0, +i.bonus || 0);

  // 1. Przychód
  const sick = isUop && i.sickness && i.sickness.days > 0 ? calcSickPay(i.sickness, p) : null;
  const absenceDeduction = sick ? r2((gross / 30) * Math.min(30, sick.days)) : 0;
  const zusBaseGross = r2(Math.max(0, gross - absenceDeduction) + bonus);
  const sickPay = sick ? sick.amount : 0;

  // 2. Кто подлежит страхованию
  const socialInsured = isUop || (isZl && !i.student && !i.otherTitleZus);
  const healthInsured = isUop || (isZl && !i.student);
  const chorobowe = isUop || (isZl && socialInsured && !!i.chorobowe);
  const zusBase = socialInsured ? zusBaseGross : 0;
  const cappedBase = r2(Math.min(zusBase, Math.max(0, p.zusLimit30x - ytd.zusBase)));
  if (socialInsured && cappedBase < zusBase) {
    warnings.push(`Лимит 30-кратности: emerytalne/rentowe начислены от ${cappedBase.toFixed(2)} zł`);
  }

  const R = p.rates;
  const ee = {
    emerytalne: r2(cappedBase * R.emerytalneHalf),
    rentowe: r2(cappedBase * R.rentoweEmployee),
    chorobowe: chorobowe ? r2(zusBase * R.chorobowe) : 0,
  };
  ee.total = r2(ee.emerytalne + ee.rentowe + ee.chorobowe);

  let fpDue;
  if (i.fpMonthlyBase !== undefined) fpDue = i.fpMonthlyBase >= p.minWage;
  else {
    // при болезни минимальная зарплата уменьшается пропорционально дням отсутствия
    const fpThreshold = sick ? r2((p.minWage * (30 - Math.min(30, sick.days))) / 30) : p.minWage;
    fpDue = zusBase > 0 && zusBase >= fpThreshold;
  }
  fpDue = fpDue && socialInsured && !i.fpExempt;

  const er = {
    emerytalne: r2(cappedBase * R.emerytalneHalf),
    rentowe: r2(cappedBase * R.rentoweEmployer),
    wypadkowe: socialInsured ? r2(zusBase * i.wypadkoweRate) : 0,
    fp: fpDue ? r2(zusBase * R.fp) : 0,
    fgsp: socialInsured && !i.fgspExempt ? r2(zusBase * R.fgsp) : 0,
    fep: socialInsured && i.fep ? r2(cappedBase * R.fep) : 0,
  };
  er.total = r2(er.emerytalne + er.rentowe + er.wypadkowe + er.fp + er.fgsp + er.fep);

  // 3. PPK — база без лимита 30-кратности; взнос работодателя — przychód работника
  const ppkBase = socialInsured ? zusBase : 0;
  const ppk = i.ppk
    ? {
        employee: r2(ppkBase * (i.ppk.employee ?? p.ppk.employee)),
        employer: r2(ppkBase * (i.ppk.employer ?? p.ppk.employer)),
      }
    : { employee: 0, employer: 0 };

  const revenue = r2(zusBaseGross + sickPay + ppk.employer);

  // 4. Składka zdrowotna
  const healthBase = healthInsured ? r2(zusBaseGross + sickPay - ee.total) : 0;
  let health = r2(healthBase * R.health);

  // 5. Ulga dla młodych
  const youngEligible = i.under26 && !isDz;
  const exempt = youngEligible
    ? r2(Math.min(revenue, Math.max(0, p.pit.youngLimit - ytd.youngRevenue)))
    : 0;
  const taxable = r2(revenue - exempt);
  const share = revenue > 0 ? taxable / revenue : 0;
  const zusDeductible = r2(ee.total * share);
  if (youngEligible && exempt < revenue && exempt > 0) {
    warnings.push(`Лимит ulgi dla młodych исчерпан: освобождено ${exempt.toFixed(2)} zł`);
  }

  const smallContract = (isZl || isDz) && !i.ownEmployee && zusBaseGross > 0
    && zusBaseGross <= p.pit.smallContractLimit;

  // 6. KUP
  let kupStandard = 0;
  let authorKup = 0;
  if (taxable > 0 && !smallContract) {
    const incomeAfterZus = Math.max(0, taxable - zusDeductible);
    const f = revenue > 0 ? Math.min(1, ((+i.authorShare || 0) * zusBaseGross) / revenue) : 0;
    if (f > 0) {
      const room = Math.max(0, p.pit.authorKupLimit - ytd.authorKup);
      authorKup = r2(Math.min(incomeAfterZus * f * p.pit.authorKupRate, room));
      if (authorKup < r2(incomeAfterZus * f * p.pit.authorKupRate)) {
        warnings.push('Достигнут годовой лимит autorskich KUP 120 000 zł');
      }
    }
    const rest = incomeAfterZus * (1 - f);
    if (isUop) {
      if (f < 1) {
        const fixed = i.kup === 'elevated' ? p.pit.kupElevated : p.pit.kupStandard;
        kupStandard = r2(Math.min(fixed, rest));
      }
    } else {
      kupStandard = r2(rest * p.pit.contractKupRate);
    }
  }
  const kup = r2(kupStandard + authorKup);

  // 7. Zaliczka PIT
  const reductionMonthly = p.pit.pit2Reduction[i.pit2] ?? 0;
  let taxBase = 0;
  let pitAdvance = 0;
  let taxMethod;
  if (smallContract) {
    taxMethod = 'ryczalt';
    taxBase = roundPLN(Math.max(0, taxable - zusDeductible));
    pitAdvance = roundPLN(taxBase * p.pit.smallContractRate);
  } else {
    taxBase = roundPLN(Math.max(0, taxable - zusDeductible - kup));
    const tax = isUop ? scaleTax(taxBase, ytd.taxBase, p) : taxBase * p.pit.rate1;
    taxMethod = isUop ? 'skala' : 'zaliczka12';
    pitAdvance = taxBase > 0 ? roundPLN(Math.max(0, tax - reductionMonthly)) : 0;
  }

  // 8. Ограничение składki zdrowotnej авансом по правилам 2021 г.
  let healthCapped = false;
  if (i.healthCapOldRules && health > 0 && exempt === 0 && !smallContract) {
    const oldReduction = isUop && i.pit2 > 0 ? p.pit.oldRulesReduction : 0;
    // podstawa округлена до злотых, а сам предел — нет (так считает Płatnik: 268 × 17% − 43,76 = 1,80)
    const oldAdvance = r2(Math.max(0, taxBase * p.pit.oldRulesRate - oldReduction));
    if (health > oldAdvance) {
      health = oldAdvance;
      healthCapped = true;
      warnings.push(`Składka zdrowotna ограничена авансом по правилам 2021 г. (${oldAdvance.toFixed(2)} zł)`);
    }
  }

  // 9. Проверки
  let etat = parseEtat(i.etat);
  if (isUop && !etat) {
    warnings.push(`Некорректный wymiar etatu «${i.etat}» — принят полный etat`);
  }
  etat = etat || { value: 1, label: '1/1' };
  // минимальная зарплата пропорциональна wymiarowi etatu
  const minForEtat = r2(p.minWage * etat.value);
  if (isUop && gross + bonus < minForEtat) {
    warnings.push(`Оклад ниже минимальной зарплаты для ${etat.label} etatu (${minForEtat.toFixed(2)} zł)`);
  }
  if (isZl && i.hours > 0 && gross / i.hours < p.minHourly) {
    warnings.push(`Ставка ниже минимальной почасовой ${p.minHourly.toFixed(2)} zł`);
  }

  const net = r2(zusBaseGross + sickPay - ee.total - health - pitAdvance - ppk.employee);
  const employerCost = r2(zusBaseGross + sickPay + er.total + ppk.employer);

  return {
    contract: i.contract,
    etat: isUop ? { ...etat, minWage: minForEtat } : null,
    gross: r2(zusBaseGross + sickPay),
    salary: { base: gross, absenceDeduction, bonus, sickPay, sick, zusBase: zusBaseGross },
    revenue,
    insured: { social: socialInsured, health: healthInsured, chorobowe },
    zusBases: { emRent: cappedBase, chorobowe: chorobowe ? zusBase : 0, wypadkowe: zusBase },
    employee: ee,
    health,
    healthBase,
    healthCapped,
    young: { exempt, taxable },
    kup,
    kupDetail: { standard: kupStandard, author: authorKup },
    taxBase,
    taxMethod,
    reduction: smallContract ? 0 : reductionMonthly,
    pitAdvance,
    ppk,
    net,
    employer: er,
    employerCost,
    warnings,
    ytd: {
      zusBase: r2(ytd.zusBase + zusBase),
      taxBase: isUop ? ytd.taxBase + taxBase : ytd.taxBase,
      youngRevenue: r2(ytd.youngRevenue + exempt),
      authorKup: r2(ytd.authorKup + authorKup),
    },
  };
}

/**
 * Lista płac: расчёт всех работников и итоги к перечислению.
 * @param {Array<object & {id?:any, name?:string}>} employees — входные данные calcEmployment
 */
export function calcPayrollList(employees, p = PARAMS_2026) {
  const rows = employees.map((e, idx) => ({
    id: e.id ?? idx + 1,
    name: e.name ?? `Pracownik ${idx + 1}`,
    ...calcEmployment(e, p),
  }));
  const sum = (fn) => r2(rows.reduce((a, r) => a + fn(r), 0));
  const totals = {
    gross: sum((r) => r.gross),
    employeeZus: sum((r) => r.employee.total),
    health: sum((r) => r.health),
    pit: sum((r) => r.pitAdvance),
    ppkEmployee: sum((r) => r.ppk.employee),
    ppkEmployer: sum((r) => r.ppk.employer),
    net: sum((r) => r.net),
    employerZus: sum((r) => r.employer.total),
    employerCost: sum((r) => r.employerCost),
  };
  totals.zusTransfer = r2(totals.employeeZus + totals.health + totals.employerZus);
  totals.ppkTransfer = r2(totals.ppkEmployee + totals.ppkEmployer);
  return { rows, totals };
}

// ───────────────────────── JDG ─────────────────────────

/** Podstawa Małego ZUS Plus: 50% среднемесячного дохода прошлого года, в пределах [30% мин., 60% прогноза]. */
export function calcMalyZusPlusBase(prevYearIncome, businessDays = 365, p = PARAMS_2026) {
  const avgMonthly = (Math.max(0, prevYearIncome) / Math.max(1, businessDays)) * 30;
  const base = r2(avgMonthly * 0.5);
  return r2(Math.min(Math.max(base, p.jdg.prefBase), p.jdg.fullBase));
}

/**
 * ZUS владельца JDG за месяц.
 * @param {'start'|'preferencyjny'|'malyZusPlus'|'pelny'} variant
 */
export function calcJdgZus({
  variant = 'pelny', base, chorobowe = true, wypadkoweRate, fpExempt = false, wakacje = false, ytdBase = 0,
} = {}, p = PARAMS_2026) {
  const zero = { variant, base: 0, baseEmRent: 0, emerytalne: 0, rentowe: 0, chorobowe: 0, wypadkowe: 0, fp: 0, social: 0, total: 0 };
  if (variant === 'start') return zero;
  let b;
  if (variant === 'pelny') b = Math.max(base ?? p.jdg.fullBase, p.jdg.fullBase);
  else if (variant === 'preferencyjny') b = p.jdg.prefBase;
  else if (variant === 'malyZusPlus') b = Math.min(Math.max(base ?? p.jdg.prefBase, p.jdg.prefBase), p.jdg.fullBase);
  else throw new Error(`Неизвестный вариант ZUS: ${variant}`);
  if (wakacje) return { ...zero, base: b, wakacje: true };
  const R = p.rates;
  const capped = Math.min(b, Math.max(0, p.zusLimit30x - ytdBase));
  const z = {
    variant,
    base: r2(b),
    baseEmRent: r2(capped),
    emerytalne: r2(capped * R.emerytalne),
    rentowe: r2(capped * R.rentoweJdg),
    chorobowe: chorobowe ? r2(b * R.chorobowe) : 0,
    wypadkowe: r2(b * (wypadkoweRate ?? R.wypadkowe)),
    // FP не платится на uldze na start, preferencyjnym и Małym ZUS Plus
    fp: variant === 'pelny' && !fpExempt ? r2(b * R.fp) : 0,
  };
  z.social = r2(z.emerytalne + z.rentowe + z.chorobowe + z.wypadkowe);
  z.total = r2(z.social + z.fp);
  return z;
}

/**
 * Składka zdrowotna JDG за месяц.
 * Skala и liniowy: rok składkowy длится с февраля по январь, поэтому month = 1 (январь 2026)
 * относится к roku składkowemu 2025 и минимальная składka считается от прошлогодней базы.
 * Ryczałt: rok składkowy календарный, суммы 2026 действуют с января.
 * @param {'skala'|'liniowy'|'ryczalt'} taxForm
 * @param {number} incomeBase   доход (dochód) за предыдущий месяц (skala, liniowy)
 * @param {number} ryczaltRevenueYtd  przychód с начала года минус składki społeczne (ryczałt)
 */
export function calcJdgHealth({ taxForm = 'skala', month = 2, incomeBase = 0, ryczaltRevenueYtd = 0 } = {}, p = PARAMS_2026) {
  const H = p.health;
  const prevYear = month === 1;
  if (taxForm === 'ryczalt') {
    const tier = H.ryczaltTiers.find((t) => ryczaltRevenueYtd <= t.upTo);
    const base = r2(H.ryczaltAvgWage * tier.factor);
    return { base, amount: r2(base * p.rates.health), tier: tier.factor, minApplied: false };
  }
  const minBase = prevYear ? H.minBasePrevYear : H.minBase;
  const minAmount = r2(minBase * p.rates.health);
  const rate = taxForm === 'liniowy' ? p.rates.healthLinear : p.rates.health;
  if (taxForm !== 'skala' && taxForm !== 'liniowy') throw new Error(`Неизвестная форма налогообложения: ${taxForm}`);
  const computed = r2(Math.max(0, incomeBase) * rate);
  const minApplied = computed < minAmount;
  // при минимальном взносе в DRA podstawą является минимальная база (4806,00), а не доход
  return { base: minApplied ? minBase : r2(Math.max(0, incomeBase)), amount: Math.max(computed, minAmount), minApplied };
}

/**
 * Год JDG: помесячный ZUS, składka zdrowotna и zaliczki PIT нарастающим итогом.
 *
 * @param {object} cfg
 * @param {'skala'|'liniowy'|'ryczalt'} cfg.taxForm
 * @param {number} [cfg.ryczaltRate]      ставка ryczałtu (0.12, 0.085, 0.15…)
 * @param {string|string[]} [cfg.zusVariant] вариант ZUS или массив из 12 вариантов по месяцам
 * @param {number} [cfg.declaredBase]     заявленная база для pełnego ZUS (не ниже 5652)
 * @param {number} [cfg.malyZusPlusBase]
 * @param {boolean} [cfg.chorobowe]
 * @param {number} [cfg.wypadkoweRate]
 * @param {boolean} [cfg.fpExempt]
 * @param {number|null} [cfg.wakacjeMonth] месяц wakacji składkowych (1–12)
 * @param {number} [cfg.prevDecIncome]    доход за декабрь 2025 — база zdrowotnej за январь
 * @param {Array<{revenue:number, costs?:number}>} cfg.months
 *
 * Упрощение: ZUS и zdrowotna за месяц вычитаются в авансе того же месяца (уплачены до 20-го).
 */
export function calcJdgYear(cfg = {}, p = PARAMS_2026) {
  const c = {
    taxForm: 'skala', ryczaltRate: 0.12, zusVariant: 'pelny', declaredBase: undefined, malyZusPlusBase: undefined,
    chorobowe: true, wypadkoweRate: p.rates.wypadkowe, fpExempt: false, wakacjeMonth: null, prevDecIncome: 0,
    months: [], ...cfg,
  };
  const variants = Array.isArray(c.zusVariant) ? c.zusVariant : Array(12).fill(c.zusVariant);
  const cum = { revenue: 0, costs: 0, zusDeductible: 0, zusBase: 0, health: 0, advances: 0 };
  let prevIncome = +c.prevDecIncome || 0;
  const rows = [];

  for (let m = 0; m < 12; m++) {
    const revenue = +(c.months[m]?.revenue) || 0;
    const costs = c.taxForm === 'ryczalt' ? 0 : +(c.months[m]?.costs) || 0;
    const variant = variants[m] ?? 'pelny';
    const zus = calcJdgZus({
      variant,
      base: variant === 'malyZusPlus' ? c.malyZusPlusBase : c.declaredBase,
      chorobowe: c.chorobowe,
      wypadkoweRate: c.wypadkoweRate,
      fpExempt: c.fpExempt,
      wakacje: c.wakacjeMonth === m + 1,
      ytdBase: cum.zusBase,
    }, p);
    // На ryczałcie FP не вычитается; на skali/liniowym FP — koszt
    const zusDeductible = c.taxForm === 'ryczalt' ? zus.social : zus.total;
    const monthIncome = r2(revenue - costs - zusDeductible);

    cum.revenue = r2(cum.revenue + revenue);
    cum.costs = r2(cum.costs + costs);
    cum.zusDeductible = r2(cum.zusDeductible + zusDeductible);
    cum.zusBase = r2(cum.zusBase + (zus.wakacje ? 0 : zus.base));

    const health = calcJdgHealth({
      taxForm: c.taxForm,
      month: m + 1,
      incomeBase: prevIncome,
      ryczaltRevenueYtd: r2(cum.revenue - cum.zusDeductible),
    }, p);
    cum.health = r2(cum.health + health.amount);

    let taxBase;
    let taxDue;
    let healthDeduction = 0;
    if (c.taxForm === 'skala') {
      taxBase = roundPLN(Math.max(0, cum.revenue - cum.costs - cum.zusDeductible));
      taxDue = Math.max(0, scaleTax(taxBase, 0, p) - p.pit.reductionAnnual);
    } else if (c.taxForm === 'liniowy') {
      healthDeduction = Math.min(cum.health, p.health.linearDeductionLimit);
      taxBase = roundPLN(Math.max(0, cum.revenue - cum.costs - cum.zusDeductible - healthDeduction));
      taxDue = taxBase * p.pit.linearRate;
    } else {
      healthDeduction = r2(cum.health * 0.5);
      taxBase = roundPLN(Math.max(0, cum.revenue - cum.zusDeductible - healthDeduction));
      taxDue = taxBase * c.ryczaltRate;
    }
    const pitAdvance = roundPLN(Math.max(0, taxDue - cum.advances));
    cum.advances += pitAdvance;

    rows.push({
      month: m + 1,
      revenue,
      costs,
      zus,
      zusDeductible,
      monthIncome,
      health: health.amount,
      healthBase: health.base,
      healthMinApplied: health.minApplied,
      healthTier: health.tier,
      taxBaseYtd: taxBase,
      healthDeductionYtd: r2(healthDeduction),
      pitAdvance,
      cashLeft: r2(revenue - costs - zus.total - health.amount - pitAdvance),
    });
    prevIncome = monthIncome;
  }

  const sum = (fn) => r2(rows.reduce((a, r) => a + fn(r), 0));
  const totals = {
    revenue: sum((r) => r.revenue),
    costs: sum((r) => r.costs),
    zusSocial: sum((r) => r.zus.social),
    fp: sum((r) => r.zus.fp),
    zus: sum((r) => r.zus.total),
    health: sum((r) => r.health),
    pit: sum((r) => r.pitAdvance),
    cashLeft: sum((r) => r.cashLeft),
  };
  const income = r2(totals.revenue - totals.costs - totals.zus);
  totals.burden = totals.revenue > 0 ? r2(((totals.zus + totals.health + totals.pit) / totals.revenue) * 100) : 0;
  totals.solidarity = c.taxForm === 'ryczalt'
    ? 0
    : r2(Math.max(0, income - p.pit.solidarityThreshold) * p.pit.solidarityRate);
  // składka за январь 2027 считается от дохода за декабрь 2026 — показываем по параметрам 2026
  totals.healthJanNextYear = c.taxForm === 'ryczalt'
    ? null
    : calcJdgHealth({ taxForm: c.taxForm, month: 2, incomeBase: prevIncome }, p).amount;
  return { config: c, rows, totals };
}

// ───────────────────────── zestawienie należnych składek (DRA, cz. IV–V) ─────────────────────────

const JDG_TITLE_CODES = Object.freeze({ pelny: '05 10 00', preferencyjny: '05 70 00', malyZusPlus: '05 90 00', start: '05 40 00' });
const EMPLOYEE_TITLE_CODES = Object.freeze({ uop: '01 10 00', zlecenie: '04 11 00' });

/** Wymiar czasu pracy в формате DRA/RCA: 1/8 → «001 008». */
export function formatWymiar(etat) {
  const m = String(etat?.label ?? '1/1').match(/^(\d+)\/(\d+)$/);
  return m ? `${m[1].padStart(3, '0')} ${m[2].padStart(3, '0')}` : '';
}

const pair = (ub = 0, pl = 0) => ({ ub, pl });

/**
 * Колонка zestawienia для владельца JDG. Все взносы владелец платит как ubezpieczony.
 * @param {object} zus     результат calcJdgZus
 * @param {{base:number, amount:number}} health  результат calcJdgHealth
 */
export function zestawienieForJdg(zus, health, name = 'Właściciel JDG') {
  const active = zus.variant !== 'start' && !zus.wakacje;
  return {
    name,
    kod: JDG_TITLE_CODES[zus.variant] ?? '',
    wymiar: '',
    emRentBase: active ? zus.baseEmRent : 0,
    em: pair(zus.emerytalne),
    rent: pair(zus.rentowe),
    chorBase: zus.chorobowe ? zus.base : 0,
    chor: pair(zus.chorobowe),
    wypBase: active ? zus.base : 0,
    wyp: pair(zus.wypadkowe),
    total: zus.social,
    healthBase: health.base,
    health: health.amount,
    fp: zus.fp,
    fgsp: 0,
    fep: 0,
  };
}

/**
 * Колонка zestawienia для работника (результат calcEmployment).
 * null — лицо не указывается в DRA (umowa o dzieło, учащийся до 26 лет на zleceniu).
 */
export function zestawienieForEmployee(r, name) {
  const kod = EMPLOYEE_TITLE_CODES[r.contract];
  if (!kod || (!r.insured.social && !r.insured.health)) return null;
  const ee = r.employee;
  const er = r.employer;
  const b = r.zusBases;
  return {
    name,
    kod,
    wymiar: r.contract === 'uop' ? formatWymiar(r.etat) : '',
    emRentBase: b.emRent,
    em: pair(ee.emerytalne, er.emerytalne),
    rent: pair(ee.rentowe, er.rentowe),
    chorBase: b.chorobowe,
    chor: pair(ee.chorobowe),
    wypBase: b.wypadkowe,
    wyp: pair(0, er.wypadkowe),
    total: r2(ee.total + er.emerytalne + er.rentowe + er.wypadkowe),
    healthBase: r.insured.health ? r.healthBase : 0,
    health: r.health,
    fp: er.fp,
    fgsp: er.fgsp,
    fep: er.fep,
  };
}

const ZEST_NUMERIC = ['emRentBase', 'chorBase', 'wypBase', 'total', 'healthBase', 'health', 'fp', 'fgsp', 'fep'];
const ZEST_PAIRS = ['em', 'rent', 'chor', 'wyp'];

/** Добавляет итоговую колонку «Razem» к колонкам zestawienia. */
export function buildZestawienie(columns) {
  const total = { name: 'Razem', kod: '', wymiar: '' };
  for (const k of ZEST_NUMERIC) total[k] = r2(columns.reduce((a, c) => a + c[k], 0));
  for (const k of ZEST_PAIRS) {
    total[k] = pair(r2(columns.reduce((a, c) => a + c[k].ub, 0)), r2(columns.reduce((a, c) => a + c[k].pl, 0)));
  }
  return { columns, total };
}

export const PayrollPL = {
  PARAMS_2026, r2, roundPLN, scaleTax, parseEtat, calcSickPay, calcEmployment, calcPayrollList,
  calcMalyZusPlusBase, calcJdgZus, calcJdgHealth, calcJdgYear,
  formatWymiar, zestawienieForJdg, zestawienieForEmployee, buildZestawienie,
};
