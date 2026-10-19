import { expect, test } from '@playwright/test';
import { ApiSession } from './api';
import { USER_A, USER_B } from './fixtures';
import { BASE_URL, resetData, sql } from './stack';
import * as ui from './ui';

test.beforeEach(() => {
  resetData();
});

test('AT-R1: a visitor registers through the form and can then log in', async ({ page }) => {
  await ui.openApp(page);
  await ui.register(page, USER_A);

  await page.getByLabel('Password').fill(USER_A.password);
  await page
    .getByRole('region', { name: 'Log in' })
    .getByRole('button', { name: 'Log in' })
    .click();

  await ui.expectSignedIn(page, USER_A);
  expect(sql('SELECT count(*) FROM users')).toBe('1');
});

test('AT-L1: logging in shows the logged-in state and sets an HttpOnly, SameSite=Lax cookie', async ({
  page,
}) => {
  await ui.signUpAndLogIn(page, USER_A);

  const cookie = (await page.context().cookies()).find((c) => c.name === 'chatterbox.sid');
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
  // Scripts on the page cannot read the session cookie.
  expect(await page.evaluate(() => document.cookie)).not.toContain('chatterbox');
  expect(sql("SELECT count(*) FROM session WHERE sess::text LIKE '%userId%'")).toBe('1');
});

test('AT-L5: the user is still logged in after the page is reloaded', async ({ page }) => {
  await ui.signUpAndLogIn(page, USER_A);

  await page.reload();

  await ui.expectSignedIn(page, USER_A);
});

test('AT-O1: logging out removes the session from the database', async ({ page }) => {
  await ui.signUpAndLogIn(page, USER_A);
  expect(sql("SELECT count(*) FROM session WHERE sess::text LIKE '%userId%'")).toBe('1');

  await ui.logOut(page);

  expect(sql("SELECT count(*) FROM session WHERE sess::text LIKE '%userId%'")).toBe('0');
});

test('AT-O4: after logging out the composer is gone, and a reload stays logged out', async ({
  page,
}) => {
  await ui.signUpAndLogIn(page, USER_A);
  await ui.logOut(page);
  await ui.expectSignedOut(page);

  await page.reload();

  await ui.expectSignedOut(page);
  await expect(
    page.getByRole('navigation', { name: 'Account' }).getByRole('button', { name: 'Register' }),
  ).toBeVisible();
});

test('AT-F1: a visitor with no session can read the feed', async ({ browser, playwright }) => {
  const author = new ApiSession(await playwright.request.newContext({ baseURL: BASE_URL }));
  await author.signUp(USER_A);
  await author.post('/api/posts', { content: 'Public for everyone' });

  const visitor = await browser.newContext();
  const page = await visitor.newPage();
  await ui.openApp(page);

  expect(await ui.feed(page)).toEqual(['ada_l: Public for everyone']);
  await ui.expectSignedOut(page);
  expect((await visitor.request.get(`${BASE_URL}/api/posts`)).status()).toBe(200);
  await visitor.close();
});

test('AT-F2: the feed shows every user’s posts, newest first', async ({ browser, playwright }) => {
  const ada = new ApiSession(await playwright.request.newContext({ baseURL: BASE_URL }));
  const grace = new ApiSession(await playwright.request.newContext({ baseURL: BASE_URL }));
  await ada.signUp(USER_A);
  await grace.signUp(USER_B);
  await ada.post('/api/posts', { content: 'first, from ada' });
  await grace.post('/api/posts', { content: 'second, from grace' });
  await ada.post('/api/posts', { content: 'third, from ada' });

  const page = await (await browser.newContext()).newPage();
  await ui.openApp(page);

  expect(await ui.feed(page)).toEqual([
    'ada_l: third, from ada',
    'grace_h: second, from grace',
    'ada_l: first, from ada',
  ]);
});

test('AT-P1: a new post appears at the top of the feed without reloading', async ({ page }) => {
  await ui.signUpAndLogIn(page, USER_A);
  await ui.writePost(page, 'An older post');

  await ui.writePost(page, 'Hello, Chatterbox!');

  expect(await ui.feed(page)).toEqual(['ada_l: Hello, Chatterbox!', 'ada_l: An older post']);
  await expect(page.getByLabel('What is on your mind?')).toHaveValue('');
});

test('AT-P2: a visitor sees no composer, and a direct POST is refused with 401', async ({
  page,
  playwright,
}) => {
  await ui.openApp(page);
  await ui.expectSignedOut(page);

  const visitor = new ApiSession(await playwright.request.newContext({ baseURL: BASE_URL }));
  await visitor.refreshToken();
  const res = await visitor.post('/api/posts', { content: 'let me in' });

  expect(res.status()).toBe(401);
  expect(sql('SELECT count(*) FROM posts')).toBe('0');
});

test('AT-P8: post content is shown as text, and no script runs', async ({ page }) => {
  const hostile = '<script>alert(1)</script><b>x</b>';
  let dialogs = 0;
  page.on('dialog', (dialog) => {
    dialogs++;
    void dialog.dismiss();
  });
  await ui.signUpAndLogIn(page, USER_A);

  await ui.writePost(page, hostile);
  await page.reload();

  expect(await ui.feed(page)).toEqual([`ada_l: ${hostile}`]);
  await expect(page.locator('.post script')).toHaveCount(0);
  await expect(page.locator('.post b')).toHaveCount(0);
  expect(dialogs).toBe(0);
});
