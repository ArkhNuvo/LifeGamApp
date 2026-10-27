import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../../src/renderer/src/lib/payroll-pl-2026.js';
import { defineCases } from './cases.js';

const eq = (actual, expected, label) => {
  if (!(Math.abs(actual - expected) <= 0.005)) {
    assert.fail(`${label}: ожидалось ${expected}, получено ${actual}`);
  }
};

for (const c of defineCases(P)) {
  test(`${c.group} › ${c.name}`, () => c.run(eq));
}

test('Неизвестный тип договора — ошибка', () => {
  assert.throws(() => P.calcEmployment({ contract: 'b2b', gross: 1 }), /Неизвестный тип договора/);
});

test('Параметры заморожены', () => {
  assert.ok(Object.isFrozen(P.PARAMS_2026));
  assert.ok(Object.isFrozen(P.PARAMS_2026.rates));
});
