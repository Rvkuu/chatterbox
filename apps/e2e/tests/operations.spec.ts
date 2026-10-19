import { expect, test } from '@playwright/test';
import { USER_A } from './fixtures';
import {
  crashRestarts,
  down,
  resetData,
  restartAll,
  restartService,
  sql,
  startService,
  stopService,
  up,
} from './stack';
import * as ui from './ui';

// These tests restart the stack, stop the database and delete the volume. They only ever act on
// the private test stack (see stack.ts), and they run in this order.
test.describe.configure({ mode: 'serial' });

test.beforeEach(() => {
  resetData();
});

test('AT-D4: data survives a container restart, and a down and up that keeps the volume', async ({
  page,
}) => {
  await ui.signUpAndLogIn(page, USER_A);
  await ui.writePost(page, 'This must survive');
  await ui.logOut(page);

  restartAll();
  await page.reload();
  await ui.logIn(page, USER_A);
  expect(await ui.feed(page)).toEqual(['ada_l: This must survive']);
  await ui.logOut(page);

  // Removing the containers keeps the named volume, so the data is still there afterwards.
  down({ volumes: false });
  up();
  await page.reload();
  await ui.logIn(page, USER_A);
  expect(await ui.feed(page)).toEqual(['ada_l: This must survive']);
});

test('AT-D6: a session survives an API restart', async ({ page }) => {
  await ui.signUpAndLogIn(page, USER_A);

  restartService('api');
  await page.reload();

  await ui.expectSignedIn(page, USER_A);
});

test('AT-D7: the health check reports the database, and turns to 503 when it is stopped', async ({
  request,
}) => {
  const healthy = await request.get('/api/health');
  expect(healthy.status()).toBe(200);
  expect(await healthy.json()).toEqual({ status: 'ok', database: 'up' });

  stopService('db');
  await expect
    .poll(async () => (await request.get('/api/health')).status(), { timeout: 30_000 })
    .toBe(503);
  const degraded = await request.get('/api/health');
  expect(await degraded.json()).toEqual({ status: 'degraded', database: 'down' });
  expect(await degraded.text()).not.toMatch(/postgres|e2e|password|version|ECONN/i);

  startService('db');
  await expect
    .poll(async () => (await request.get('/api/health')).status(), { timeout: 60_000 })
    .toBe(200);
  expect(await (await request.get('/api/health')).json()).toEqual({ status: 'ok', database: 'up' });
});

test('extra: with the API stopped the feed shows an error and a retry, and recovers when it is back', async ({
  page,
}) => {
  await ui.openApp(page);
  stopService('api');

  await page.reload();

  // The proxy must fail fast. A long wait here would leave visitors looking at "Loading posts…".
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Chatterbox' })).toBeVisible();

  startService('api');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('No posts yet.')).toBeVisible();
});

test('AT-D8: a cold start brings up all three services without a crash loop', async ({ page }) => {
  down({ volumes: true });

  up();

  expect(crashRestarts('api')).toBe(0);
  expect(crashRestarts('db')).toBe(0);
  expect(crashRestarts('web')).toBe(0);
  await ui.openApp(page);
  // The API applied the migrations itself on start.
  expect(
    sql(
      "SELECT count(*) FROM information_schema.tables WHERE table_name IN ('users','posts','session')",
    ),
  ).toBe('3');
});

test('AT-D5: deleting the volume deletes the data, as the documentation warns', async ({
  page,
}) => {
  await ui.signUpAndLogIn(page, USER_A);
  await ui.writePost(page, 'This will be deleted');
  expect(sql('SELECT count(*) FROM users')).toBe('1');

  down({ volumes: true });
  up();

  expect(sql('SELECT count(*) FROM users')).toBe('0');
  expect(sql('SELECT count(*) FROM posts')).toBe('0');
  await page.reload();
  await expect(page.getByText('No posts yet.')).toBeVisible();
  await ui.expectSignedOut(page);
  // The old account is gone, so logging in fails.
  await page
    .getByRole('navigation', { name: 'Account' })
    .getByRole('button', { name: 'Log in' })
    .click();
  await ui.submitLogin(page, USER_A);
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
});
