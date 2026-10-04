import {expect, test} from '../../fixtures';

test.describe('Account Settings: Delete account', () => {
  test('should delete the account after email and password confirmation', async ({
    page,
    freshAccount: {email, password},
    accountSettingsPage,
    loginPage,
  }) => {
    await page.setViewportSize({width: 393, height: 852});
    await accountSettingsPage.navigate();

    // The destructive action stays disabled until the email matches exactly.
    await accountSettingsPage.deleteAccountButton.click();
    const deleteCancelButton = page.getByRole('button', {name: 'Cancel'});
    await expect(deleteCancelButton).toBeVisible();
    expect(
      await deleteCancelButton.evaluate(
        (element) => getComputedStyle(element.parentElement!).paddingBottom,
      ),
    ).toBe('16px');
    await expect(accountSettingsPage.deleteConfirmButton).toBeDisabled();
    await accountSettingsPage.deleteEmailInput.fill(email);
    await expect(accountSettingsPage.deleteConfirmButton).toBeDisabled();

    // Wrong password is rejected and the dialog stays open.
    await accountSettingsPage.deletePasswordInput.fill('wrong-password');
    await accountSettingsPage.deleteConfirmButton.click();
    await expect(accountSettingsPage.deleteInvalidPasswordError).toBeVisible();

    // Correct password deletes the account and returns the signed-out user to login.
    await accountSettingsPage.deletePasswordInput.fill(password);
    await accountSettingsPage.deleteConfirmButton.click();

    await expect(page.getByText('Account deleted.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    // The account is really gone: re-login fails.
    await loginPage.navigate();
    await loginPage.login(email, password);
    await expect(loginPage.invalidCredentialsError).toBeVisible();
  });
});
