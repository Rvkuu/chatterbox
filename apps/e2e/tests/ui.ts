import { expect, type Page } from '@playwright/test';
import type { TestUser } from './fixtures';

// Steps a person would take in the browser. They only use what the user can see and click.

const account = (page: Page) => page.getByRole('navigation', { name: 'Account' });
const loginForm = (page: Page) => page.getByRole('region', { name: 'Log in' });

export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('API status: ok')).toBeVisible();
}

export async function submitLogin(page: Page, user: TestUser): Promise<void> {
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await loginForm(page).getByRole('button', { name: 'Log in' }).click();
}

export async function register(page: Page, user: TestUser): Promise<void> {
  await account(page).getByRole('button', { name: 'Register' }).click();
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  // Registering does not log in: the login form follows, with a notice.
  await expect(page.getByRole('status')).toHaveText('Account created. Please log in.');
}

export async function logIn(page: Page, user: TestUser): Promise<void> {
  await account(page).getByRole('button', { name: 'Log in' }).click();
  await submitLogin(page, user);
  await expectSignedIn(page, user);
}

export async function signUpAndLogIn(page: Page, user: TestUser): Promise<void> {
  await openApp(page);
  await register(page, user);
  await page.getByLabel('Password').fill(user.password);
  await loginForm(page).getByRole('button', { name: 'Log in' }).click();
  await expectSignedIn(page, user);
}

export async function logOut(page: Page): Promise<void> {
  await account(page).getByRole('button', { name: 'Log out' }).click();
  await expect(account(page).getByRole('button', { name: 'Log in' })).toBeVisible();
}

export async function expectSignedIn(page: Page, user: TestUser): Promise<void> {
  await expect(account(page)).toContainText(`Signed in as ${user.username}`);
  await expect(page.getByLabel('What is on your mind?')).toBeVisible();
}

export async function expectSignedOut(page: Page): Promise<void> {
  await expect(account(page).getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByLabel('What is on your mind?')).toHaveCount(0);
}

export async function writePost(page: Page, text: string): Promise<void> {
  await page.getByLabel('What is on your mind?').fill(text);
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(page.locator('.post-content', { hasText: text }).first()).toBeVisible();
}

// The posts on the page, newest first, as "author: content".
export async function feed(page: Page): Promise<string[]> {
  return page
    .locator('.post')
    .evaluateAll((items) =>
      items.map(
        (item) =>
          `${item.querySelector('.post-author')?.textContent ?? ''}: ${item.querySelector('.post-content')?.textContent ?? ''}`,
      ),
    );
}
