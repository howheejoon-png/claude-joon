import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { startDefaultGame, fillWin } from './helpers';

/**
 * Two phones, one shared game. The sharing server is simulated in this test
 * process with the same semantics as the real database functions
 * (append-only, idempotent per op id, ordered by sequence number).
 */
interface Row {
  seq: number;
  op_id: string;
  device_id: string;
  created_at: string;
  payload: unknown;
}

function fakeServer() {
  const games = new Map<string, Row[]>();
  const byOp = new Map<string, number>();
  let seq = 0;
  let down = false;
  return {
    setDown(v: boolean) {
      down = v;
    },
    count: () => seq,
    async attach(context: BrowserContext) {
      await context.route('**/rest/v1/rpc/*', async (route) => {
        if (down) return route.abort('internetdisconnected');
        const fn = new URL(route.request().url()).pathname.split('/').pop();
        const args = route.request().postDataJSON() as Record<string, unknown>;
        const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        if (fn === 'mt_append_op') {
          const opId = String(args.p_op_id);
          const existing = byOp.get(opId);
          if (existing) return json(existing);
          seq += 1;
          const list = games.get(String(args.p_game_id)) ?? [];
          list.push({ seq, op_id: opId, device_id: String(args.p_device_id), created_at: new Date().toISOString(), payload: args.p_payload });
          games.set(String(args.p_game_id), list);
          byOp.set(opId, seq);
          return json(seq);
        }
        if (fn === 'mt_get_ops') {
          const after = Number(args.p_after ?? 0);
          return json((games.get(String(args.p_game_id)) ?? []).filter((r) => r.seq > after));
        }
        return route.fulfill({ status: 404, body: '{}' });
      });
    },
  };
}

async function phone(browser: import('@playwright/test').Browser, server: ReturnType<typeof fakeServer>): Promise<{ ctx: BrowserContext; page: Page }> {
  // Service workers are blocked so every request reaches the simulated server.
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
  await server.attach(ctx);
  return { ctx, page: await ctx.newPage() };
}

test('four friends, one link: each phone sees its own balance and anyone can record', async ({ browser }) => {
  const server = fakeServer();
  const a = await phone(browser, server);
  const b = await phone(browser, server);

  // Phone A starts the game and shares it.
  await startDefaultGame(a.page);
  await a.page.getByTestId('open-share').click();
  await a.page.getByTestId('start-sharing').click();
  const link = (await a.page.getByTestId('share-link').innerText()).trim();
  expect(link).toMatch(/#\/join\/[A-Za-z0-9_-]{24}$/);
  await a.page.getByTestId('me-east').click(); // A is Player A (East)
  await a.page.keyboard.press('Escape');
  await expect(a.page.getByTestId('you-card')).toContainText('Player A');
  await expect(a.page.getByTestId('sync-chip')).toHaveAttribute('data-status', 'synced');

  // Phone B opens the same link and says who they are.
  await b.page.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await expect(b.page.getByRole('heading', { name: 'Which player are you?' })).toBeVisible();
  await b.page.getByTestId('join-me-south').click();
  await expect(b.page.getByTestId('you-card')).toContainText('Player B');
  await expect(b.page.getByTestId('you-card')).toContainText('$0.00');

  // A records a 3-tai self-draw; B's phone updates by itself.
  await a.page.getByTestId('dashboard-record').click();
  await fillWin(a.page, { winner: 'east', method: 'self-draw', tai: 3 });
  await a.page.getByTestId('review-round').click();
  await a.page.getByTestId('confirm-round').click();
  await expect(b.page.getByTestId('score-card-east')).toContainText('+$7.20', { timeout: 10_000 });
  await expect(b.page.getByTestId('you-card')).toContainText('-$2.40');
  await expect(b.page.getByTestId('you-card')).toContainText('pay Player A');

  // B records the next hand from their own phone: a kong from A's discard in a drawn hand.
  await b.page.getByTestId('dashboard-record').click();
  await b.page.getByRole('radio', { name: 'Draw 流局' }).click();
  await b.page.getByTestId('instant-sg-kong-discard').click();
  await b.page.getByTestId('pick-south').click();
  await b.page.getByTestId('pick-east').click();
  await b.page.getByTestId('review-round').click();
  await b.page.getByTestId('confirm-round').click();
  await expect(a.page.getByTestId('score-card-south')).toContainText('-$1.80', { timeout: 10_000 });
  await expect(a.page.getByTestId('you-card')).toContainText('+$6.60');
  for (const p of [a.page, b.page]) {
    await expect(p.getByTestId('total-balance')).toHaveText('$0.00');
    await expect(p.getByTestId('balance-indicator')).toHaveAttribute('data-status', 'ok');
  }
  // History on A shows who recorded B's round.
  await a.page.goto('/#/history');
  await expect(a.page.getByTestId('round-2')).toContainText('by Player B');

  // B loses connection, records anyway, and catches up when back online.
  server.setDown(true);
  await b.page.goto('/#/record');
  await fillWin(b.page, { winner: 'south', method: 'discard', discarder: 'west', tai: 1 });
  await b.page.getByTestId('review-round').click();
  await b.page.getByTestId('confirm-round').click();
  await expect(b.page.getByTestId('sync-chip')).toContainText('1 waiting', { timeout: 10_000 });
  await expect(b.page.getByTestId('score-card-south')).toContainText('-$0.60'); // shown on B already
  server.setDown(false);
  await a.page.goto('/#/home');
  await expect(a.page.getByTestId('score-card-south')).toContainText('-$0.60', { timeout: 15_000 });
  await expect(b.page.getByTestId('sync-chip')).toHaveAttribute('data-status', 'synced', { timeout: 15_000 });

  // A phone that loses its data gets the game back just by opening the link again.
  const c = await phone(browser, server);
  await c.page.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await c.page.getByRole('button', { name: 'Just watching' }).click();
  await expect(c.page.getByTestId('score-card-south')).toContainText('-$0.60');
  await expect(c.page.getByTestId('score-card-east')).toContainText('+$6.30');

  await Promise.all([a.ctx.close(), b.ctx.close(), c.ctx.close()]);
});

test('reopening the app goes straight back to the game in progress', async ({ page }) => {
  await startDefaultGame(page);
  await page.goto('/');
  await expect(page.getByTestId('dashboard-record')).toBeVisible();
});
