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
    acceleratedMonths: 72,
    targetName: 'Дорогая карта',
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
    acceleratedMonths: 15,
    targetName: 'A 50%',
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
    acceleratedMonths: 30,
    targetName: 'Реально гасимый',
  },
  // P4 attribution (verified against server@70081a7):
  // equal rates were ordered by the input array only. With [B, A] the old
  // server targeted B and returned 8; with [A, B] it targeted A and returned 9.
  // The 8 was not 8 full months: the run took 9 loop months and returned
  // 9 - finalAvailable / pool = 8 because the target payment is not subtracted
  // from `available`. The only semantic change in this PR is the comparator:
  // rate desc, then id asc.
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
    acceleratedMonths: 9,
    targetName: 'A 30%',
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

  it.each(GOLDEN)('golden: $name', ({ input, acceleratedMonths, targetName }) => {
    const server = serverSim(input);
    const client = clientSim(input);

    expect(server).toEqual(client);
    if (acceleratedMonths === null) {
      expect(server).toBeNull();
      return;
    }
    expect(server).not.toBeNull();
    expect(server!.acceleratedMonths).toBe(acceleratedMonths);
    expect(server!.targetName).toBe(targetName);
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
