/**
 * Контрольные примеры. Ожидаемые значения посчитаны вручную по ставкам 2026 г.
 * Файл не зависит от тест-раннера: используется и в Node (node --test), и на странице артефакта.
 * Каждый кейс: { group, name, run(eq) }, где eq(actual, expected, label) бросает ошибку при расхождении > 0,005.
 */
export function defineCases(P) {
  const { calcEmployment, calcPayrollList, calcJdgZus, calcJdgHealth, calcJdgYear, calcMalyZusPlusBase,
    calcSickPay, parseEtat, r2, roundPLN } = P;
  const uniform = (revenue, costs = 0) => Array.from({ length: 12 }, () => ({ revenue, costs }));
  const jdgBase = { zusVariant: 'pelny', chorobowe: true, months: uniform(15000, 3000) };

  return [
    // ── округления ──
    { group: 'Округления', name: 'r2: половина гроша вверх', run(eq) {
      eq(r2(469.0656), 469.07, '9,76% от 4806');
      eq(r2(117.747), 117.75, '2,45% от 4806');
      eq(r2(0.125), 0.13, '0,125');
      eq(r2(-1.005), -1.01, 'отрицательное');
    } },
    { group: 'Округления', name: 'roundPLN: до полных злотых (art. 63 OP)', run(eq) {
      eq(roundPLN(167.49), 167, '167,49');
      eq(roundPLN(167.5), 168, '167,50');
      eq(roundPLN(4314.5), 4315, '4314,50');
    } },

    // ── umowa o pracę ──
    { group: 'Umowa o pracę', name: 'Минимальная зарплата 4806 zł → нетто 3605,85, стоимость 5790,28', run(eq) {
      const r = calcEmployment({ gross: 4806 });
      eq(r.employee.emerytalne, 469.07, 'emerytalne pracownika');
      eq(r.employee.rentowe, 72.09, 'rentowe pracownika');
      eq(r.employee.chorobowe, 117.75, 'chorobowe');
      eq(r.employee.total, 658.91, 'ZUS pracownika');
      eq(r.health, 373.24, 'zdrowotna');
      eq(r.taxBase, 3897, 'podstawa');
      eq(r.pitAdvance, 168, 'zaliczka PIT');
      eq(r.net, 3605.85, 'netto');
      eq(r.employer.rentowe, 312.39, 'rentowe pracodawcy');
      eq(r.employer.wypadkowe, 80.26, 'wypadkowe');
      eq(r.employer.fp, 117.75, 'FP');
      eq(r.employer.fgsp, 4.81, 'FGŚP');
      eq(r.employer.total, 984.28, 'ZUS pracodawcy');
      eq(r.employerCost, 5790.28, 'koszt pracodawcy');
    } },
    { group: 'Umowa o pracę', name: '10 000 zł brutto → нетто 7147,39', run(eq) {
      const r = calcEmployment({ gross: 10000 });
      eq(r.employee.total, 1371, 'ZUS pracownika');
      eq(r.health, 776.61, 'zdrowotna');
      eq(r.taxBase, 8379, 'podstawa');
      eq(r.pitAdvance, 705, 'zaliczka');
      eq(r.net, 7147.39, 'netto');
      eq(r.employer.total, 2048, 'ZUS pracodawcy');
      eq(r.employerCost, 12048, 'koszt');
    } },
    { group: 'Umowa o pracę', name: 'Podwyższone KUP 300 zł', run(eq) {
      eq(calcEmployment({ gross: 10000, kup: 'elevated' }).pitAdvance, 699, 'zaliczka');
    } },
    { group: 'Umowa o pracę', name: 'Без PIT-2 и PIT-2 у двух работодателей (150 zł)', run(eq) {
      eq(calcEmployment({ gross: 10000, pit2: 0 }).pitAdvance, 1005, 'без PIT-2');
      eq(calcEmployment({ gross: 10000, pit2: 2 }).pitAdvance, 855, 'PIT-2 1/24');
    } },
    { group: 'Umowa o pracę', name: 'Переход порога 120 000 zł в месяце (12% + 32%)', run(eq) {
      const r = calcEmployment({ gross: 10000, ytd: { taxBase: 118000 } });
      eq(r.pitAdvance, 1981, '2000×12% + 6379×32% − 300');
      eq(r.ytd.taxBase, 126379, 'ytd podstawa');
    } },
    { group: 'Umowa o pracę', name: 'Лимит 30-кратности 282 600 zł', run(eq) {
      const r = calcEmployment({ gross: 10000, ytd: { zusBase: 280000 } });
      eq(r.employee.emerytalne, 253.76, 'emerytalne от 2600');
      eq(r.employee.rentowe, 39, 'rentowe от 2600');
      eq(r.employee.chorobowe, 245, 'chorobowe без лимита');
      eq(r.employer.rentowe, 169, 'rentowe pracodawcy');
      eq(r.employer.fp, 245, 'FP без лимита');
      eq(r.warnings.length, 1, 'предупреждение');
    } },
    { group: 'Umowa o pracę', name: 'Ulga dla młodych: нет PIT, KUP не применяются', run(eq) {
      const r = calcEmployment({ gross: 4806, under26: true });
      eq(r.pitAdvance, 0, 'PIT');
      eq(r.kup, 0, 'KUP');
      eq(r.health, 373.24, 'zdrowotna без ограничения');
      eq(r.net, 3773.85, 'netto');
    } },
    { group: 'Umowa o pracę', name: 'Ulga dla młodych: превышение лимита 85 528 zł', run(eq) {
      const r = calcEmployment({ gross: 4806, under26: true, ytd: { youngRevenue: 84000 } });
      eq(r.young.exempt, 1528, 'освобождено');
      eq(r.young.taxable, 3278, 'облагается');
      eq(r.taxBase, 2579, 'podstawa (ZUS пропорционально)');
      eq(r.pitAdvance, 9, 'zaliczka');
    } },
    { group: 'Umowa o pracę', name: 'Autorskie KUP 50% от всего оклада', run(eq) {
      const r = calcEmployment({ gross: 10000, authorShare: 1 });
      eq(r.kupDetail.author, 4314.5, 'KUP 50%');
      eq(r.kupDetail.standard, 0, 'KUP 250 не применяются');
      eq(r.taxBase, 4315, 'podstawa');
      eq(r.pitAdvance, 218, 'zaliczka');
    } },
    { group: 'Umowa o pracę', name: 'PPK 2% + 1,5%: взнос работодателя облагается PIT', run(eq) {
      const r = calcEmployment({ gross: 10000, ppk: {} });
      eq(r.ppk.employee, 200, 'PPK pracownika');
      eq(r.ppk.employer, 150, 'PPK pracodawcy');
      eq(r.health, 776.61, 'zdrowotna не меняется');
      eq(r.pitAdvance, 723, 'zaliczka');
      eq(r.net, 6929.39, 'netto');
      eq(r.employerCost, 12198, 'koszt');
    } },
    { group: 'Umowa o pracę', name: 'Wynagrodzenie chorobowe 80%, 10 дней', run(eq) {
      const s = calcSickPay({ days: 10, avgGross: 6000 });
      eq(s.base, 5177.4, 'podstawa chorobowego');
      eq(s.daily, 138.06, 'stawka dzienna 80%');
      const r = calcEmployment({ gross: 6000, sickness: { days: 10, avgGross: 6000 } });
      eq(r.salary.absenceDeduction, 2000, 'потрачение 1/30 за день');
      eq(r.salary.sickPay, 1380.6, 'chorobowe');
      eq(r.employee.total, 548.4, 'ZUS только от 4000');
      eq(r.health, 434.9, 'zdrowotna включает chorobowe');
      eq(r.pitAdvance, 250, 'zaliczka');
      eq(r.employer.fp, 98, 'FP: порог уменьшен пропорционально');
      eq(r.net, 4147.3, 'netto');
    } },
    { group: 'Umowa o pracę', name: 'Низкий доход: zdrowotna ограничена авансом по правилам 2021', run(eq) {
      const r = calcEmployment({ gross: 1000, etat: 0.2 });
      eq(r.employee.total, 137.1, 'ZUS');
      eq(r.pitAdvance, 0, 'zaliczka');
      eq(r.health, 60.45, 'zdrowotna = 613×17% − 43,76 (без округления до злотых)');
      eq(r.employer.fp, 0, 'FP нет — ниже минимальной');
      eq(r.healthCapped ? 1 : 0, 1, 'флаг ограничения');
    } },
    { group: 'Umowa o pracę', name: 'Предупреждение: оклад ниже минимальной', run(eq) {
      eq(calcEmployment({ gross: 4500 }).warnings.length, 1, 'предупреждений');
    } },
    { group: 'Umowa o pracę', name: 'Wymiar etatu: дроби 1/5, 1/7, 1/8 и десятичные', run(eq) {
      eq(parseEtat('1/7').value, 1 / 7, '1/7');
      eq(parseEtat('0,2').value, 0.2, '0,2');
      eq(parseEtat('2/8').label === '1/4' ? 1 : 0, 1, 'сокращение 2/8 → 1/4');
      eq(parseEtat(0.125).label === '1/8' ? 1 : 0, 1, 'метка 0,125 → 1/8');
      eq(parseEtat('3/2') === null ? 1 : 0, 1, 'больше 1 — ошибка');
      const belowMin = (r) => (r.warnings.some((w) => w.includes('ниже минимальной')) ? 1 : 0);
      eq(belowMin(calcEmployment({ gross: 686.57, etat: '1/7' })), 0, '1/7: минимум 686,57');
      eq(belowMin(calcEmployment({ gross: 686, etat: '1/7' })), 1, '1/7: ниже минимума');
      eq(calcEmployment({ gross: 961.2, etat: '1/5' }).etat.minWage, 961.2, '1/5: минимум 961,20');
      eq(calcEmployment({ gross: 5000, etat: 'abc' }).warnings.length, 1, 'некорректный etat');
    } },
    { group: 'Umowa o pracę', name: '1/8 etatu от минимальной (600,75 zł)', run(eq) {
      const r = calcEmployment({ gross: 600.75, etat: '1/8' });
      eq(r.warnings.length, 1, 'только предупреждение об ограничении zdrowotnej');
      eq(r.employee.total, 82.36, 'ZUS pracownika');
      eq(r.taxBase, 268, 'podstawa');
      eq(r.pitAdvance, 0, 'zaliczka');
      eq(r.health, 1.8, 'zdrowotna = 268×17% − 43,76, как в Płatniku');
      eq(r.net, 516.59, 'netto');
      eq(r.employer.fp, 0, 'FP');
      eq(r.employer.total, 108.31, 'ZUS pracodawcy');
      eq(r.employerCost, 709.06, 'koszt');
    } },

    // ── zlecenie / dzieło ──
    { group: 'Zlecenie i dzieło', name: 'Zlecenie 3000 zł без chorobowego', run(eq) {
      const r = calcEmployment({ contract: 'zlecenie', gross: 3000, pit2: 0 });
      eq(r.employee.total, 337.8, 'ZUS');
      eq(r.employee.chorobowe, 0, 'chorobowe');
      eq(r.health, 239.6, 'zdrowotna');
      eq(r.kup, 532.44, 'KUP 20%');
      eq(r.taxBase, 2130, 'podstawa');
      eq(r.pitAdvance, 256, 'zaliczka 12%');
      eq(r.net, 2166.6, 'netto');
      eq(r.employer.rentowe, 195, 'rentowe pracodawcy');
      eq(r.employer.fp, 0, 'FP: база ниже минимальной');
      eq(r.employer.fgsp, 3, 'FGŚP');
    } },
    { group: 'Zlecenie i dzieło', name: 'Zlecenie: студент до 26 лет', run(eq) {
      const r = calcEmployment({ contract: 'zlecenie', gross: 3000, student: true, under26: true, pit2: 0 });
      eq(r.employee.total, 0, 'ZUS');
      eq(r.health, 0, 'zdrowotna');
      eq(r.pitAdvance, 0, 'PIT');
      eq(r.net, 3000, 'netto');
      eq(r.employerCost, 3000, 'koszt');
    } },
    { group: 'Zlecenie i dzieło', name: 'Zlecenie: zbieg tytułów — только zdrowotna', run(eq) {
      const r = calcEmployment({ contract: 'zlecenie', gross: 3000, otherTitleZus: true, pit2: 0 });
      eq(r.employee.total, 0, 'ZUS');
      eq(r.health, 270, 'zdrowotna');
      eq(r.pitAdvance, 288, 'zaliczka');
      eq(r.net, 2442, 'netto');
    } },
    { group: 'Zlecenie i dzieło', name: 'Dzieło 1000 zł (KUP 20%) и до 200 zł (ryczałt)', run(eq) {
      const a = calcEmployment({ contract: 'dzielo', gross: 1000, pit2: 0 });
      eq(a.pitAdvance, 96, 'zaliczka');
      eq(a.health, 0, 'без zdrowotnej');
      eq(a.net, 904, 'netto');
      const b = calcEmployment({ contract: 'dzielo', gross: 150, pit2: 0 });
      eq(b.pitAdvance, 18, 'ryczałt 12%');
      eq(b.net, 132, 'netto');
    } },
    { group: 'Zlecenie i dzieło', name: 'Dzieło с autorskimi KUP 50%', run(eq) {
      const r = calcEmployment({ contract: 'dzielo', gross: 5000, authorShare: 1, pit2: 0 });
      eq(r.kup, 2500, 'KUP 50%');
      eq(r.pitAdvance, 300, 'zaliczka');
    } },

    // ── zestawienie DRA: сверка с выгрузкой из Płatnika ──
    { group: 'Zestawienie DRA', name: 'Сверка с Płatnikiem: JDG pełny (A) и 1/8 etatu 600,75 zł (B)', run(eq) {
      const txt = (a, e, label) => eq(a === e ? 1 : 0, 1, `${label}: ожидалось «${e}», получено «${a}»`);
      const a = P.zestawienieForJdg(calcJdgZus({ variant: 'pelny' }), calcJdgHealth({ taxForm: 'skala', month: 10, incomeBase: 3000 }));
      txt(a.kod, '05 10 00', 'A.01 kod');
      eq(a.emRentBase, 5652, 'A.04');
      eq(a.em.ub, 1103.27, 'A.05'); eq(a.em.pl, 0, 'A.06');
      eq(a.rent.ub, 452.16, 'A.10'); eq(a.rent.pl, 0, 'A.11');
      eq(a.chorBase, 5652, 'A.15'); eq(a.chor.ub, 138.47, 'A.16');
      eq(a.wypBase, 5652, 'A.21'); eq(a.wyp.ub, 94.39, 'A.22'); eq(a.wyp.pl, 0, 'A.23');
      eq(a.total, 1788.29, 'A.29');
      eq(a.healthBase, 4806, 'A.V.01'); eq(a.health, 432.54, 'A.V.04');

      const b = P.zestawienieForEmployee(calcEmployment({ gross: 600.75, etat: '1/8' }), 'B');
      txt(b.kod, '01 10 00', 'B.01 kod');
      txt(b.wymiar, '001 008', 'B.03 wymiar');
      eq(b.emRentBase, 600.75, 'B.04');
      eq(b.em.ub, 58.63, 'B.05'); eq(b.em.pl, 58.63, 'B.06');
      eq(b.rent.ub, 9.01, 'B.10'); eq(b.rent.pl, 39.05, 'B.11');
      eq(b.chorBase, 600.75, 'B.15'); eq(b.chor.ub, 14.72, 'B.16');
      eq(b.wypBase, 600.75, 'B.21'); eq(b.wyp.ub, 0, 'B.22'); eq(b.wyp.pl, 10.03, 'B.23');
      eq(b.total, 190.07, 'B.29');
      eq(b.healthBase, 518.39, 'B.V.01'); eq(b.health, 1.8, 'B.V.04');

      const { total } = P.buildZestawienie([a, b]);
      eq(total.total, 1978.36, 'Razem społeczne');
      eq(total.health, 434.34, 'Razem zdrowotne');
    } },
    { group: 'Zestawienie DRA', name: 'Коды и пропуски: zlecenie 04 11 00, dzieło и студент не входят', run(eq) {
      const txt = (a, e, label) => eq(a === e ? 1 : 0, 1, `${label}: ожидалось «${e}», получено «${a}»`);
      txt(P.zestawienieForEmployee(calcEmployment({ contract: 'zlecenie', gross: 3000, pit2: 0 }), 'Z').kod, '04 11 00', 'zlecenie');
      txt(P.zestawienieForEmployee(calcEmployment({ contract: 'dzielo', gross: 3000, pit2: 0 }), 'D'), null, 'dzieło');
      txt(P.zestawienieForEmployee(calcEmployment({ contract: 'zlecenie', gross: 3000, student: true, under26: true }), 'S'), null, 'студент');
      txt(P.formatWymiar({ label: '1/1' }), '001 001', 'полный etat');
      txt(P.zestawienieForJdg(calcJdgZus({ variant: 'preferencyjny' }), { base: 4806, amount: 432.54 }).kod, '05 70 00', 'preferencyjny');
    } },

    // ── lista płac ──
    { group: 'Lista płac', name: 'Итоги ведомости: ZUS DRA, PIT-4R, нетто', run(eq) {
      const { rows, totals } = calcPayrollList([{ name: 'A', gross: 4806 }, { name: 'B', gross: 10000 }]);
      eq(rows.length, 2, 'строк');
      eq(totals.pit, 873, 'PIT-4R');
      eq(totals.zusTransfer, 6212.04, 'ZUS к перечислению');
      eq(totals.net, 10753.24, 'нетто');
      eq(totals.employerCost, 17838.28, 'стоимость');
    } },

    // ── JDG ZUS ──
    { group: 'JDG: ZUS', name: 'Pełny ZUS 2026: 1926,76 zł с chorobowym', run(eq) {
      const z = calcJdgZus({ variant: 'pelny' });
      eq(z.emerytalne, 1103.27, 'emerytalne');
      eq(z.rentowe, 452.16, 'rentowe');
      eq(z.chorobowe, 138.47, 'chorobowe');
      eq(z.wypadkowe, 94.39, 'wypadkowe');
      eq(z.fp, 138.47, 'FP');
      eq(z.social, 1788.29, 'społeczne');
      eq(z.total, 1926.76, 'итого');
    } },
    { group: 'JDG: ZUS', name: 'Preferencyjny ZUS: 456,18 zł / без chorobowego 420,86 zł', run(eq) {
      eq(calcJdgZus({ variant: 'preferencyjny' }).total, 456.18, 'с chorobowym');
      eq(calcJdgZus({ variant: 'preferencyjny', chorobowe: false }).total, 420.86, 'без chorobowego');
      eq(calcJdgZus({ variant: 'preferencyjny' }).fp, 0, 'FP');
    } },
    { group: 'JDG: ZUS', name: 'Ulga na start и wakacje składkowe — 0 zł', run(eq) {
      eq(calcJdgZus({ variant: 'start' }).total, 0, 'start');
      eq(calcJdgZus({ variant: 'pelny', wakacje: true }).total, 0, 'wakacje');
    } },
    { group: 'JDG: ZUS', name: 'Mały ZUS Plus: база и границы', run(eq) {
      eq(calcMalyZusPlusBase(60000, 365), 2465.75, 'доход 60 000');
      eq(calcMalyZusPlusBase(10000, 365), 1441.8, 'нижняя граница');
      eq(calcMalyZusPlusBase(200000, 365), 5652, 'верхняя граница');
      eq(calcJdgZus({ variant: 'malyZusPlus', base: 2465.75 }).fp, 0, 'FP');
    } },

    // ── JDG składka zdrowotna ──
    { group: 'JDG: zdrowotna', name: 'Skala 9% / liniowy 4,9% / минимум 432,54', run(eq) {
      eq(calcJdgHealth({ taxForm: 'skala', incomeBase: 10000 }).amount, 900, 'skala');
      eq(calcJdgHealth({ taxForm: 'liniowy', incomeBase: 10000 }).amount, 490, 'liniowy');
      eq(calcJdgHealth({ taxForm: 'liniowy', incomeBase: 5000 }).amount, 432.54, 'минимум');
      eq(calcJdgHealth({ taxForm: 'skala', incomeBase: -2000 }).amount, 432.54, 'убыток');
      eq(calcJdgHealth({ taxForm: 'skala', month: 1, incomeBase: 0 }).amount, 314.96, 'январь 2026');
    } },
    { group: 'JDG: zdrowotna', name: 'Ryczałt: 498,35 / 830,58 / 1495,04, в январе те же суммы', run(eq) {
      eq(calcJdgHealth({ taxForm: 'ryczalt', ryczaltRevenueYtd: 50000 }).amount, 498.35, 'до 60 тыс.');
      eq(calcJdgHealth({ taxForm: 'ryczalt', ryczaltRevenueYtd: 60000.01 }).amount, 830.58, '60–300 тыс.');
      eq(calcJdgHealth({ taxForm: 'ryczalt', ryczaltRevenueYtd: 300000.01 }).amount, 1495.04, 'свыше 300 тыс.');
      eq(calcJdgHealth({ taxForm: 'ryczalt', month: 1, ryczaltRevenueYtd: 1000 }).amount, 498.35, 'январь — календарный rok składkowy');
    } },

    // ── JDG год ──
    { group: 'JDG: год', name: 'Skala: первый аванс в марте (26 zł), zdrowotna от дохода прошлого месяца', run(eq) {
      const y = calcJdgYear({ ...jdgBase, taxForm: 'skala' });
      eq(y.rows[0].pitAdvance, 0, 'январь');
      eq(y.rows[1].pitAdvance, 0, 'февраль');
      eq(y.rows[2].pitAdvance, 26, 'март');
      eq(y.rows[0].health, 314.96, 'zdrowotna январь (доход за декабрь 0)');
      eq(y.rows[1].health, 906.59, 'zdrowotna февраль');
      eq(y.totals.zus, 23121.12, 'ZUS за год');
    } },
    { group: 'JDG: год', name: 'Liniowy 19% с вычетом składki zdrowotnej', run(eq) {
      const y = calcJdgYear({ ...jdgBase, taxForm: 'liniowy' });
      eq(y.rows[0].pitAdvance, 1854, 'январь');
      eq(y.rows[1].health, 493.59, 'zdrowotna 4,9%');
      eq(y.rows[1].pitAdvance, 1820, 'февраль');
    } },
    { group: 'JDG: год', name: 'Liniowy: вычет zdrowotnej ограничен 14 100 zł', run(eq) {
      const y = calcJdgYear({ ...jdgBase, taxForm: 'liniowy', months: uniform(60000, 5000) });
      eq(y.rows[11].healthDeductionYtd, 14100, 'лимит');
    } },
    { group: 'JDG: год', name: 'Ryczałt 12%: FP не вычитается, ступень zdrowotnej с мая', run(eq) {
      const y = calcJdgYear({ ...jdgBase, taxForm: 'ryczalt', ryczaltRate: 0.12 });
      eq(y.rows[0].health, 498.35, 'январь');
      eq(y.rows[0].pitAdvance, 1556, 'аванс январь: (15000 − 1788,29 − 249,18) × 12%');
      eq(y.rows[3].health, 498.35, 'апрель');
      eq(y.rows[4].health, 830.58, 'май');
    } },
    { group: 'JDG: год', name: 'Ulga na start 6 мес. → preferencyjny; wakacje składkowe', run(eq) {
      const v = [...Array(6).fill('start'), ...Array(6).fill('preferencyjny')];
      const y = calcJdgYear({ ...jdgBase, zusVariant: v, wakacjeMonth: 12 });
      eq(y.rows[0].zus.total, 0, 'январь');
      eq(y.rows[6].zus.total, 456.18, 'июль');
      eq(y.rows[11].zus.total, 0, 'декабрь — wakacje');
      eq(y.totals.zus, 2280.9, 'ZUS за год');
    } },
    { group: 'JDG: год', name: 'Danina solidarnościowa 4% сверх 1 млн zł', run(eq) {
      const y = calcJdgYear({ ...jdgBase, taxForm: 'liniowy', months: uniform(100000, 0) });
      eq(y.totals.solidarity, r2((1200000 - 23121.12 - 1000000) * 0.04), 'danina');
    } },
  ];
}
