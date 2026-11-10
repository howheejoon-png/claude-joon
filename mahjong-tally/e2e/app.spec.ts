import { expect, test } from '@playwright/test';
import { expectScores, fillWin, recordWin, startDefaultGame } from './helpers';

// Example house rules ($0.30 / $0.60 doubling, shared discard):
//   1 tai: discarder $0.60, others $0.30, self-draw $0.60 each
//   2 tai: $1.20 / $0.60 / $1.20      3 tai: $2.40 / $1.20 / $2.40

test('records rounds, previews payments and keeps every balance tallied', async ({ page }) => {
  await startDefaultGame(page);

  // Self-draw, 3 tai: B, C, D pay $2.40 each; A receives $7.20.
  await page.getByTestId('dashboard-record').click();
  await fillWin(page, { winner: 'east', method: 'self-draw', tai: 3 });
  await page.getByTestId('review-round').click();
  await expect(page.getByTestId('payment-preview')).toContainText('Self Draw');
  await expect(page.getByTestId('net-line-east')).toHaveAttribute('data-cents', '720');
  for (const seat of ['south', 'west', 'north']) {
    await expect(page.getByTestId(`net-line-${seat}`)).toHaveAttribute('data-cents', '-240');
  }
  await expect(page.getByTestId('balance-verification')).toContainText('PASSED');
  await page.getByTestId('confirm-round').click();
  await expectScores(page, { east: '+$7.20', south: '-$2.40', west: '-$2.40', north: '-$2.40' });

  // Discard win, 2 tai: West discards to South. West $1.20, East & North $0.60 each.
  await recordWin(page, { winner: 'south', method: 'discard', discarder: 'west', tai: 2 });
  await expectScores(page, { east: '+$6.60', south: '$0.00', west: '-$3.60', north: '-$3.00' });

  // A drawn round changes nothing.
  await page.goto('/#/record');
  await page.getByRole('radio', { name: 'Draw 流局' }).click();
  await page.getByTestId('review-round').click();
  await page.getByTestId('confirm-round').click();
  await expectScores(page, { east: '+$6.60', south: '$0.00', west: '-$3.60', north: '-$3.00' });
});

test('editing, undoing, deleting and restoring rounds recalculates balances', async ({ page }) => {
  await startDefaultGame(page);
  await recordWin(page, { winner: 'east', method: 'self-draw', tai: 3 });
  await recordWin(page, { winner: 'south', method: 'discard', discarder: 'west', tai: 2 });

  // Edit round 1 from 3 tai to 1 tai.
  await page.goto('/#/history');
  await page.getByTestId('round-1').getByRole('button').first().click();
  await page.getByTestId('edit-round-1').click();
  await page.getByTestId('tai-1').click();
  await page.getByTestId('review-round').click();
  await expect(page.getByText('Change from saved round')).toBeVisible();
  await page.getByTestId('confirm-round').click();
  await page.goto('/#/home');
  // Round 1: A +1.80, others -0.60. Round 2: B +2.40, C -1.20, A -0.60, D -0.60.
  await expectScores(page, { east: '+$1.20', south: '+$1.80', west: '-$1.80', north: '-$1.20' });

  // Undo the last round (with confirmation).
  await page.goto('/#/history');
  await page.getByTestId('undo-last').click();
  await page.getByRole('button', { name: 'Undo round' }).click();
  await page.goto('/#/home');
  await expectScores(page, { east: '+$1.80', south: '-$0.60', west: '-$0.60', north: '-$0.60' });

  // Restore it from "Recently deleted".
  await page.goto('/#/history');
  await page.getByRole('button', { name: 'Restore' }).first().click();
  await page.goto('/#/home');
  await expectScores(page, { east: '+$1.20', south: '+$1.80', west: '-$1.80', north: '-$1.20' });

  // Delete round 1 explicitly.
  await page.goto('/#/history');
  await page.getByTestId('round-1').getByRole('button').first().click();
  await page.getByTestId('delete-round-1').click();
  await page.getByRole('button', { name: 'Delete round' }).click();
  await page.goto('/#/home');
  await expectScores(page, { east: '-$0.60', south: '+$2.40', west: '-$1.20', north: '-$0.60' });
});

test('settlement plan clears every balance', async ({ page }) => {
  await startDefaultGame(page);
  await recordWin(page, { winner: 'east', method: 'self-draw', tai: 3 });
  await recordWin(page, { winner: 'south', method: 'discard', discarder: 'west', tai: 2 });
  await page.goto('/#/settlement');
  await expect(page.getByTestId('settlement-verification')).toContainText('Settlement verified');
  const transfers = page.getByTestId('settlement-transfer');
  await expect(transfers).toHaveCount(2);
  await expect(transfers.nth(0)).toContainText('Player C');
  await expect(transfers.nth(0)).toContainText('$3.60');
  await expect(transfers.nth(1)).toContainText('Player D');
  await expect(transfers.nth(1)).toContainText('$3.00');
});

test('game survives a reload and reopening from the start screen', async ({ page, context }) => {
  await startDefaultGame(page);
  await recordWin(page, { winner: 'north', method: 'discard', discarder: 'east', tai: 1 });
  const expected = { east: '-$0.60', south: '-$0.30', west: '-$0.30', north: '+$1.20' } as const;
  await expectScores(page, expected);

  await page.reload();
  await expectScores(page, expected);

  // A fresh tab in the same profile, opening at the app's start URL, lands back in the game.
  const second = await context.newPage();
  await second.goto('/');
  await expectScores(second, expected);
});

test('works offline after the first load', async ({ page, context }) => {
  await startDefaultGame(page);
  await recordWin(page, { winner: 'east', method: 'self-draw', tai: 1 });
  // Wait for the service worker to finish installing and precaching.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('dashboard-record')).toBeVisible();
  await expectScores(page, { east: '+$1.80', south: '-$0.60', west: '-$0.60', north: '-$0.60' });
  // Record a round while offline.
  await recordWin(page, { winner: 'west', method: 'discard', discarder: 'north', tai: 1 });
  await expectScores(page, { east: '+$1.50', south: '-$0.90', west: '+$0.60', north: '-$1.20' });
  await context.setOffline(false);
});

test('installable manifest is served', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest.name).toBe('Mahjong Tally');
  expect(manifest.short_name).toBe('Mahjong');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
});

test('kongs, flowers and animals are paid during the hand, whoever wins', async ({ page }) => {
  // Example rules use a $0.30 base: kong from a discard $0.60 (discarder pays),
  // everything else $0.20.
  await startDefaultGame(page);
  // South wins 1 tai off West's discard: West $0.60, East & North $0.30 each.
  await page.goto('/#/record');
  await fillWin(page, { winner: 'south', method: 'discard', discarder: 'west', tai: 1 });
  // South konged East's discard: East pays South $0.60.
  await page.getByTestId('instant-sg-kong-discard').click();
  await expect(page.getByText('Who made the kong?')).toBeVisible();
  await page.getByTestId('pick-south').click();
  await expect(page.getByText('Who discarded the tile?')).toBeVisible();
  await page.getByTestId('pick-east').click();
  // North self-drew a kong: everyone pays North $0.20.
  await page.getByTestId('instant-sg-kong-self').click();
  await page.getByTestId('pick-north').click();
  // West drew their own spirit animal: everyone pays West $0.20.
  await page.getByTestId('instant-sg-animal-own').click();
  await page.getByTestId('pick-west').click();
  await expect(page.getByTestId('instant-event')).toHaveCount(3);
  await page.getByTestId('review-round').click();
  await expect(page.getByTestId('balance-verification')).toContainText('PASSED');
  await page.getByTestId('confirm-round').click();
  await expectScores(page, { east: '-$1.30', south: '+$1.40', west: '-$0.20', north: '+$0.10' });

  // Drawn hand: East drew South's flower (South pays East $0.20) and
  // North drew their own flower (everyone pays North $0.20).
  await page.goto('/#/record');
  await page.getByRole('radio', { name: 'Draw 流局' }).click();
  await page.getByTestId('instant-sg-flower-other').click();
  await expect(page.getByText('Who drew the flower?')).toBeVisible();
  await page.getByTestId('pick-east').click();
  await expect(page.getByText('Whose flower is it?')).toBeVisible();
  await page.getByTestId('pick-south').click();
  await page.getByTestId('instant-sg-flower-own').click();
  await page.getByTestId('pick-north').click();
  await page.getByTestId('review-round').click();
  await page.getByTestId('confirm-round').click();
  await expectScores(page, { east: '-$1.30', south: '+$1.00', west: '-$0.40', north: '+$0.70' });
});
