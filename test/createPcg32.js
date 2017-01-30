import test from 'ava';
import { createPcg32, nextState, prevState, randomInt, randomList } from './../lib';

const randomUint32 = randomInt(0, (2 ** 32) - 1);

const pcg = createPcg32({}, 42, 54);

test('PCG32_XSH_RR: Single integer', (t) => {
  // Check for generator immutability and result reproducibility
  t.is(randomUint32(pcg)[0], 0xa15c02b7);
  t.is(randomUint32(pcg)[0], 0xa15c02b7);
});

test('PCG32_XSH_RR: Multiple integers', (t) => {
  t.deepEqual(
    randomList(6, randomUint32, pcg).map(([value]) => value),
    [0xa15c02b7, 0x7b47f409, 0xba1d3330, 0x83d2f293, 0xbfa4784b, 0xcbed606e],
  );
});

test('PCG32_XSH_RR: Jump-ahead, jump-back', (t) => {
  t.is(randomUint32(nextState(pcg))[0], 0x7b47f409);
  t.is(randomUint32(prevState(nextState(pcg)))[0], 0xa15c02b7);

  t.deepEqual(randomUint32(pcg)[1], nextState(pcg));

  t.deepEqual(prevState(nextState(pcg)), pcg);
  t.deepEqual(nextState(prevState(pcg)), pcg);
});
