import { expect, test } from '@playwright/test';
import { USER_A, USER_B } from './fixtures';
import { resetData, restartAll } from './stack';
import * as ui from './ui';

test.beforeEach(() => {
  resetData();
});

test('AT-J1: register, log in, post, log out, restart the containers, and the post is still there', async ({
  page,
}) => {
  await test.step('1. open the app: empty state and no composer', async () => {
    await ui.openApp(page);
    await expect(page.getByText('No posts yet.')).toBeVisible();
    await ui.expectSignedOut(page);
  });

  await test.step('2. register USER_A', async () => {
    await ui.register(page, USER_A);
  });

  await test.step('3. log in', async () => {
    await page.getByLabel('Password').fill(USER_A.password);
    await page
      .getByRole('region', { name: 'Log in' })
      .getByRole('button', { name: 'Log in' })
      .click();
    await ui.expectSignedIn(page, USER_A);
  });

  await test.step('4 and 5. post "First post" and see it in the feed', async () => {
    await ui.writePost(page, 'First post');
    expect(await ui.feed(page)).toEqual(['ada_l: First post']);
  });

  await test.step('6. log out: the composer is gone and a direct POST is refused', async () => {
    await ui.logOut(page);
    await ui.expectSignedOut(page);
    const { csrfToken } = (await (await page.request.get('/api/csrf-token')).json()) as {
      csrfToken: string;
    };
    const direct = await page.request.post('/api/posts', {
      data: { content: 'sneaky' },
      headers: { 'X-CSRF-Token': csrfToken },
    });
    expect(direct.status()).toBe(401);
  });

  await test.step('7. restart the containers', () => {
    restartAll();
  });

  await test.step('8. log in again: the post is still there', async () => {
    await page.reload();
    await ui.logIn(page, USER_A);
    expect(await ui.feed(page)).toEqual(['ada_l: First post']);
  });
});

test('AT-J2: two users in separate browsers share one feed, newest first, under the right names', async ({
  browser,
}) => {
  const adaPage = await (await browser.newContext()).newPage();
  const gracePage = await (await browser.newContext()).newPage();

  await ui.signUpAndLogIn(adaPage, USER_A);
  await ui.signUpAndLogIn(gracePage, USER_B);

  await ui.writePost(adaPage, 'Ada posts first');
  await ui.writePost(gracePage, 'Grace posts second');

  const expected = ['grace_h: Grace posts second', 'ada_l: Ada posts first'];
  await gracePage.reload();
  await adaPage.reload();
  expect(await ui.feed(gracePage)).toEqual(expected);
  expect(await ui.feed(adaPage)).toEqual(expected);
  // Each browser still has its own identity.
  await ui.expectSignedIn(adaPage, USER_A);
  await ui.expectSignedIn(gracePage, USER_B);
});
