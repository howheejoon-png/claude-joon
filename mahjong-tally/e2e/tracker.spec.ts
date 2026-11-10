import { expect, test, type Page } from '@playwright/test';
import { fillWin, startDefaultGame } from './helpers';

async function recordDraw(page: Page, kongBy?: 'east' | 'south' | 'west' | 'north') {
  await page.goto('/#/record');
  await page.getByRole('radio', { name: 'Draw 流局' }).click();
  if (kongBy) {
    await page.getByTestId('instant-sg-kong-self').click();
    await page.getByTestId(`pick-${kongBy}`).click();
  }
  await page.getByTestId('review-round').click();
  await page.getByTestId('confirm-round').click();
  await expect(page.getByTestId('dashboard-record')).toBeVisible();
}

test('the tracker moves the deal and winds on, and shows flowers and animals', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('start-new-game').click();
  await page.getByTestId('confirm-rules').check();
  await page.getByTestId('save-rules').click();
  await page.getByTestId('draw-animals').click();
  await page.getByTestId('start-game').click();

  // Hand 1: Player A (East seat) deals; everyone's flowers match their seat.
  await expect(page.getByTestId('table-round')).toHaveText('East round · Hand 1');
  await expect(page.getByTestId('table-dealer')).toContainText('Player A');
  await expect(page.getByTestId('score-card-east')).toContainText('Flowers 1');
  await expect(page.getByTestId('score-card-north')).toContainText('Flowers 4');
  for (const seat of ['east', 'south', 'west', 'north']) {
    await expect(page.getByTestId(`score-card-${seat}`)).toContainText(/Mouse|Cat|Chicken|Centipede/);
  }

  // Player B wins: the deal passes to B, who is now East with flowers 1.
  await page.getByTestId('dashboard-record').click();
  await expect(page.getByTestId('hand-info-dealer')).toContainText('Player A');
  await fillWin(page, { winner: 'south', method: 'self-draw', tai: 1 });
  await page.getByTestId('review-round').click();
  await page.getByTestId('confirm-round').click();
  await expect(page.getByTestId('table-dealer')).toContainText('Player B');
  await expect(page.getByTestId('score-card-south')).toContainText('Flowers 1');
  await expect(page.getByTestId('score-card-east')).toContainText('Flowers 4');

  // A drawn hand with no kong: B keeps the deal.
  await recordDraw(page);
  await expect(page.getByTestId('table-dealer')).toContainText('Player B');
  await expect(page.getByTestId('table-dealer')).toContainText('2nd hand in a row');

  // A drawn hand with a kong: the deal moves on to C.
  await recordDraw(page, 'west');
  await expect(page.getByTestId('table-dealer')).toContainText('Player C');
  await expect(page.getByTestId('table-round')).toHaveText('East round · Hand 4');

  // History remembers who dealt each hand.
  await page.goto('/#/history');
  await page.getByTestId('round-1').getByRole('button').first().click();
  await expect(page.getByTestId('round-hand-1')).toHaveText('East round · dealer Player A');
});

test('the next hand can be set by hand (e.g. starting mid-game)', async ({ page }) => {
  await startDefaultGame(page);
  await page.getByTestId('table-strip').click();
  await page.getByTestId('next-wind-south').click();
  await page.getByTestId('next-dealer-west').click();
  await page.getByTestId('save-next-hand').click();
  await expect(page.getByTestId('table-round')).toHaveText('South round · Hand 1');
  await expect(page.getByTestId('table-dealer')).toContainText('Player C');
  await expect(page.getByTestId('score-card-west')).toContainText('Flowers 1');
});

test('season leaderboard adds up finished nights', async ({ page }) => {
  await startDefaultGame(page);
  await page.getByTestId('dashboard-record').click();
  await fillWin(page, { winner: 'west', method: 'self-draw', tai: 2 });
  await page.getByTestId('review-round').click();
  await page.getByTestId('confirm-round').click();
  await page.goto('/#/settlement');
  await page.getByRole('button', { name: 'Finish game' }).click();
  await page.getByRole('button', { name: 'Finish game' }).last().click();
  await page.getByTestId('settlement-season').click();
  await expect(page.getByTestId('season-summary')).toContainText('1');
  // 2-tai self-draw: $1.20 from each of three players.
  await expect(page.getByTestId('season-row-1')).toContainText('Player C');
  await expect(page.getByTestId('season-row-1')).toContainText('+$3.60');
  await expect(page.getByText('add up to $0.00')).toBeVisible();
});
