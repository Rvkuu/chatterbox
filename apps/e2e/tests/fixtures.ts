// Test-only values from docs/acceptance-tests.md section 3. They are not real accounts.
export const USER_A = {
  email: 'ada@example.com',
  username: 'ada_l',
  password: 'correct horse battery staple',
};
export const USER_B = {
  email: 'grace@example.com',
  username: 'grace_h',
  password: 'another long test passphrase',
};

export type TestUser = typeof USER_A;
