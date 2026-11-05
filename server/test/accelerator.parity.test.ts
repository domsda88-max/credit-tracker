import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { simulateAccelerator as serverSim } from '../src/utils/finance/accelerator';
import { simulateAccelerator as clientSim } from '../../client/src/utils/finance/accelerator';
import type { AcceleratorDebt, AcceleratorInput } from '../src/utils/finance/accelerator';

const CLIENT_PATH = new URL('../../client/src/utils/finance/accelerator.ts', import.meta.url);
const SERVER_PATH = new URL('../src/utils/finance/accelerator.ts', import.meta.url);

function readNormalized(path: URL): string {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
}

/** Deterministic PRNG (LCG) so the differential suite is reproducible on any machine. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function makePortfolio(seed: number): AcceleratorInput {
  const rnd = makeRng(seed);
  const count = 1 + Math.floor(rnd() * 6);
  const debts: AcceleratorDebt[] = [];
  const sharedRate = round1(rnd() * 60);

  for (let i = 0; i < count; i += 1) {
    // Every third portfolio forces equal rates to exercise the id tie-break.
    const annualRate = seed % 3 === 0 ? sharedRate : round1(rnd() * 60);
    debts.push({
      id: `debt-${String.fromCharCode(97 + i)}`,
      name: `Debt ${i}`,
      annualRate,
      balance: round2(1_000 + rnd() * 2_000_000),
      minPayment: rnd() < 0.15 ? 0 : round2(rnd() * 50_000),
    });
  }

  return {
    extraPerMonth: round2(1_000 + rnd() * 49_000),
    baselineMonths: 1 + Math.floor(rnd() * 360),
    debts,
  };
}

const GOLDEN: Array<{
  name: string;
  input: AcceleratorInput;
  acceleratedMonths: number | null;
  targetName: string | null;
}> = [
  {
    name: 'two debts: expensive card + mortgage',
    input: {
      extraPerMonth: 10_000,
      baselineMonths: 240,
      debts: [
        { id: '1', name: 'Дорогая карта', annualRate: 40, balance: 100_000, minPayment: 5_000 },
        { id: '2', name: 'Ипотека', annualRate: 19.8, balance: 2_000_000, minPayment: 35_000 },
      ],
    },
    acceleratedMonths: 72.9235336, // cycles=73, finalAvailable=3823.32<pool=50000 (fixed)
  },
  {
    name: 'three debts: avalanche closes the most expensive first',
    input: {
      extraPerMonth: 10_000,
      baselineMonths: 240,
      debts: [
        { id: 'A', name: 'A 50%', annualRate: 50, balance: 30_000, minPayment: 1_000 },
        { id: 'B', name: 'B 30%', annualRate: 30, balance: 60_000, minPayment: 1_000 },
        { id: 'C', name: 'C 10%', annualRate: 10, balance: 90_000, minPayment: 1_000 },
      ],
    },
    acceleratedMonths: 15.970046923076923, // cycles=16, finalAvailable=389.39<pool=13000 (fixed)
  },
  {
    name: 'frozen card is not the target',
    input: {
      extraPerMonth: 10_000,
      baselineMonths: 240,
      debts: [
        { id: 'frozen', name: 'Замороженная', annualRate: 0, balance: 500_000, minPayment: 0 },
        { id: 'pay', name: 'Реально гасимый', annualRate: 30, balance: 100_000, minPayment: 10_000 },
      ],
    },
    acceleratedMonths: 31, // cycles=31, finalAvailable=0<pool=20000 (fixed)
  },
  // P4 attribution (verified against server@70081a7, then fixed):
  // Before the fractional fix, available was not decremented in the target
  // payment. Equal rates were ordered by the input array only, so [B, A]
  // targeted B and reported 8 (loop ran 9 months, finalAvailable==pool).
  // After tie-break + the available decrement: cycles=10, finalAvailable=15976.69
  // (<16000), reported=9.0015. The semantic changes in PR #1+fix are only:
  // byRateThenId comparator and available = round2(available - pay).
  {
    name: 'equal rates: lower id wins regardless of input order',
    input: {
      extraPerMonth: 10_000,
      baselineMonths: 240,
      debts: [
        { id: 'B', name: 'B 30%', annualRate: 30, balance: 20_000, minPayment: 1_000 },
        { id: 'A', name: 'A 30%', annualRate: 30, balance: 100_000, minPayment: 5_000 },
      ],
    },
    acceleratedMonths: 9.001456875, // cycles=10, finalAvailable=15976.69<pool=16000 (fixed)
  },
  {
    name: 'interest outruns payments: MAX_MONTHS -> null',
    input: {
      extraPerMonth: 1,
      baselineMonths: 240,
      debts: [{ id: 'never', name: 'Never', annualRate: 30, balance: 10_000_000, minPayment: 1_000 }],
    },
    acceleratedMonths: null,
    targetName: null,
  },
];

describe('accelerator parity: client vs server', () => {
  it('client and server source files are identical', () => {
    expect(readNormalized(CLIENT_PATH)).toBe(readNormalized(SERVER_PATH));
  });

  it.each(GOLDEN)('golden: $name', ({ input, acceleratedMonths }) => {
    const server = serverSim(input);
    const client = clientSim(input);

    expect(server).toEqual(client);
    if (acceleratedMonths === null) {
      expect(server).toBeNull();
      return;
    }
    expect(server).not.toBeNull();
    const expectedTarget = [...input.debts].sort((a, b) =>
      b.annualRate !== a.annualRate ? b.annualRate - a.annualRate : a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    )[0].name;
    expect(server!.acceleratedMonths).toBeCloseTo(acceleratedMonths as number, 5);
    expect(server!.targetName).toBe(expectedTarget);
  });

  it('tie-break does not depend on the input array order', () => {
    const base = GOLDEN[3].input;
    const reversed: AcceleratorInput = { ...base, debts: [...base.debts].reverse() };

    const a = serverSim(base);
    const b = serverSim(reversed);
    expect(a).toEqual(b);
    expect(a!.targetName).toBe('A 30%');
    expect(clientSim(reversed)).toEqual(a);
  });

  it('savedMonths and extraPerMonth stay consistent', () => {
    for (const golden of GOLDEN) {
      const result = serverSim(golden.input);
      if (!result) continue;
      expect(result.savedMonths).toBe(
        Math.max(0, result.baselineMonths - result.acceleratedMonths),
      );
      expect(result.extraPerMonth).toBe(round2(golden.input.extraPerMonth));
    }
  });

  it('differential: 200 seeded portfolios match exactly', () => {
    let nonNull = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const input = makePortfolio(seed);
      const server = serverSim(input);
      const client = clientSim(input);
      expect(client, `seed ${seed}`).toEqual(server);
      if (server) nonNull += 1;
    }
    // Guard against a suite that accidentally only produces nulls.
    expect(nonNull).toBeGreaterThan(100);
  });
});
