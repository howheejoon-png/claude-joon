/**
 * Independent oracle for the minimum number of settlement transfers.
 *
 * Enumerates every set partition of the non-zero players (no DP, no greedy)
 * and takes the partition with the most blocks in which every block sums to
 * zero. For a settlement graph, each connected component of size s needs at
 * least s − 1 transfers, and a zero-sum block of size s can always be settled
 * with s − 1, so the minimum is (non-zero players) − (max zero-sum blocks).
 */
export function bruteForceMinTransfers(values: readonly number[]): number {
  const nonZero = values.filter((v) => v !== 0);
  if (nonZero.length === 0) return 0;
  let best = 0;
  const blocks: number[][] = [];
  const recurse = (i: number) => {
    if (i === nonZero.length) {
      if (blocks.every((b) => b.reduce((a, x) => a + x, 0) === 0)) best = Math.max(best, blocks.length);
      return;
    }
    const v = nonZero[i]!;
    for (const block of blocks) {
      block.push(v);
      recurse(i + 1);
      block.pop();
    }
    blocks.push([v]);
    recurse(i + 1);
    blocks.pop();
  };
  recurse(0);
  return nonZero.length - best;
}
