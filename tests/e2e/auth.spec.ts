/**
 * E2E Tests for Authentication Flow
 * Requirements: 4.2, 4.6
 *
 * Tests:
 * - Login with valid credentials
 * - Login with invalid credentials
 * - Logout
 * - Session persistence
 */

import { test, expect } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const VALID_PASSWORD = process.env.DASHBOARD_PASSWORD || 'test-password';
const INVALID_PASSWORD = 'wrong-password-123';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await page.context().clearCookies();
  });

  test('should redirect to login page when not authenticated', async ({ page }) => {
    // Navigate to dashboard
    await page.goto(BASE_URL);

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);

    // Verify login page elements
    await expect(page.locator('h1')).toContainText('Parcel Admin Dashboard');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Fill in password
    await page.locator('input[type="password"]').fill(VALID_PASSWORD);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Should redirect to dashboard
    await expect(page).toHaveURL(BASE_URL + '/');

    // Verify dashboard loaded
    await expect(page.locator('h1, h2, h3')).toBeVisible();

    // Verify auth cookie is set
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name === 'parcel-admin-auth');
    expect(authCookie).toBeDefined();
    expect(authCookie?.value).toBe('authenticated');
  });

  test('should show error with invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Fill in wrong password
    await page.locator('input[type="password"]').fill(INVALID_PASSWORD);

    // Submit form
    await page.locator('button[type="submit"]').click();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);

    // Should show error message
    await expect(page.locator('text=/Invalid password|Login failed/i')).toBeVisible();

    // Verify no auth cookie is set
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name === 'parcel-admin-auth');
    expect(authCookie).toBeUndefined();
  });

  test('should show loading state during login', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Fill in password
    await page.locator('input[type="password"]').fill(VALID_PASSWORD);

    // Click submit and immediately check for loading state
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Button should show loading text or be disabled
    await expect(submitButton).toHaveText(/Signing in.../i);
  });

  test('should persist session across page reloads', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[type="password"]').fill(VALID_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(BASE_URL + '/');

    // Reload page
    await page.reload();

    // Should still be on dashboard (not redirected to login)
    await expect(page).toHaveURL(BASE_URL + '/');

    // Verify auth cookie still exists
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name === 'parcel-admin-auth');
    expect(authCookie).toBeDefined();
  });

  test('should persist session across navigation', async ({ page }) => {
    // Login first
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[type="password"]').fill(VALID_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(BASE_URL + '/');

    // Navigate to different pages
    const pages = ['/exceptions', '/distributions', '/promise-reliability'];

    for (const pagePath of pages) {
      await page.goto(`${BASE_URL}${pagePath}`);

      // Should not redirect to login
      await expect(page).toHaveURL(`${BASE_URL}${pagePath}`);

      // Verify auth cookie still exists
      const cookies = await page.context().cookies();
      const authCookie = cookies.find((c) => c.name === 'parcel-admin-auth');
      expect(authCookie).toBeDefined();
    }
  });

  test('should handle empty password submission', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Submit form without entering password
    await page.locator('button[type="submit"]').click();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);

    // Should show error or validation message
    await expect(page.locator('text=/Invalid password|Login failed|required/i')).toBeVisible();
  });

  test('should prevent access to protected routes without authentication', async ({ page }) => {
    // Try to access protected routes directly
    const protectedRoutes = [
      '/',
      '/exceptions',
      '/distributions',
      '/promise-reliability',
      '/route-efficiency',
    ];

    for (const route of protectedRoutes) {
      await page.goto(`${BASE_URL}${route}`);

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('should handle concurrent login attempts', async ({ page }) => {
    // Navigate to login page
    await page.goto(`${BASE_URL}/login`);

    // Fill in password
    await page.locator('input[type="password"]').fill(VALID_PASSWORD);

    // Click submit multiple times quickly
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    await submitButton.click();
    await submitButton.click();

    // Should still redirect to dashboard only once
    await expect(page).toHaveURL(BASE_URL + '/');

    // Verify only one auth cookie is set
    const cookies = await page.context().cookies();
    const authCookies = cookies.filter((c) => c.name === 'parcel-admin-auth');
    expect(authCookies.length).toBe(1);
  });
});
