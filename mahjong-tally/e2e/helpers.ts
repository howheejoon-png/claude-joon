import { expect, type Page } from '@playwright/test';

export type SeatName = 'east' | 'south' | 'west' | 'north';

/** First-run: confirm the example house rules and start a game with default players. */
export async function startDefaultGame(page: Page) {
  await page.goto('/');
  await page.getByTestId('start-new-game').click();
  await expect(page.getByRole('heading', { name: 'Confirm house rules' })).toBeVisible();
  // Saving is blocked until the group confirms the rules.
  await expect(page.getByTestId('save-rules')).toBeDisabled();
  await page.getByTestId('confirm-rules').check();
  await page.getByTestId('save-rules').click();
  await expect(page.getByRole('heading', { name: 'New game' })).toBeVisible();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('dashboard-record')).toBeVisible();
}

export interface WinSpec {
  winner: SeatName;
  method: 'self-draw' | 'discard';
  discarder?: SeatName;
  tai: number;
}

export async function fillWin(page: Page, spec: WinSpec) {
  await page.getByTestId(`winner-${spec.winner}`).click();
  await page.getByTestId(`method-${spec.method}`).click();
  if (spec.discarder) await page.getByTestId(`discarder-${spec.discarder}`).click();
  await page.getByTestId(`tai-${spec.tai}`).click();
}

export async function recordWin(page: Page, spec: WinSpec) {
  await page.goto('/#/record');
  await fillWin(page, spec);
  await page.getByTestId('review-round').click();
  await expect(page.getByTestId('balance-verification')).toContainText('PASSED');
  await page.getByTestId('confirm-round').click();
  await expect(page.getByTestId('dashboard-record')).toBeVisible();
}

export async function expectScores(page: Page, scores: Record<SeatName, string>) {
  for (const [seat, text] of Object.entries(scores)) {
    await expect(page.getByTestId(`score-card-${seat}`)).toContainText(text);
  }
  await expect(page.getByTestId('total-balance')).toHaveText('$0.00');
  await expect(page.getByTestId('balance-indicator')).toHaveAttribute('data-status', 'ok');
}
