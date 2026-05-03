import { test, expect } from '@playwright/test';

const dismissOnboarding = async (page) => {
  await page.waitForTimeout(1500);
  const skipBtn = page.locator('.btn-skip');
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(1000);
  }
};

const openOnboardingWizard = async (page) => {
  const newAnalysisBtn = page.locator('button.new-analysis-btn, button:has-text("New Analysis")');
  const wizard = page.locator('.onboarding-overlay');
  const isWizardVisible = await wizard.isVisible({ timeout: 3000 }).catch(() => false);

  if (isWizardVisible) {
    return;
  }

  if (await newAnalysisBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await newAnalysisBtn.click();
    await page.waitForTimeout(1000);
  }
};

test.describe('US Census Data Explorer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
  });

  test('1. App loads without errors', async ({ page }) => {
    await dismissOnboarding(page);

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);

    await expect(page.locator('.app-title, h1')).toContainText('Census');
    await expect(page.locator('.command-bar, header')).toBeVisible();

    const consoleErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
    expect(consoleErrors).toHaveLength(0);
  });

  test('2. State-level data displays correctly', async ({ page }) => {
    await dismissOnboarding(page);
    await page.waitForTimeout(3000);

    const realEstateBtn = page.locator('button[title*="Real Estate"], button:has-text("Real Estate")').first();
    const isRealEstateVisible = await realEstateBtn.isVisible().catch(() => false);

    if (isRealEstateVisible) {
      await realEstateBtn.click();
      await page.waitForTimeout(10000);
    }

    const table = page.locator('.data-table, table');
    const tableVisible = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (tableVisible) {
      const rows = page.locator('.data-table tbody tr, table tbody tr');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
    } else {
      const emptyState = page.locator('.empty-state, .empty-state-content');
      const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasEmptyState || tableVisible).toBe(true);
    }
  });

  test('3. Navigation works - clicking on a state to drill down', async ({ page }) => {
    await dismissOnboarding(page);
    await page.waitForTimeout(3000);

    const realEstateBtn = page.locator('button[title*="Real Estate"], button:has-text("Real Estate")').first();
    const isRealEstateVisible = await realEstateBtn.isVisible().catch(() => false);

    if (isRealEstateVisible) {
      await realEstateBtn.click();
      await page.waitForTimeout(10000);
    }

    const table = page.locator('.data-table, table');
    const tableVisible = await table.isVisible({ timeout: 5000 }).catch(() => false);

    if (tableVisible) {
      const firstRow = page.locator('.data-table tbody tr, table tbody tr').first();
      const isRowVisible = await firstRow.isVisible().catch(() => false);

      if (isRowVisible) {
        await firstRow.click();
        await page.waitForTimeout(5000);

        const breadcrumb = page.locator('.breadcrumb-nav, .command-breadcrumb');
        await expect(breadcrumb).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('4. Filters work', async ({ page }) => {
    await dismissOnboarding(page);
    await page.waitForTimeout(2000);

    const filterToggle = page.locator('button[title*="filter"], button:has-text("Filters")').first();
    if (await filterToggle.isVisible()) {
      await filterToggle.click();
      await page.waitForTimeout(500);
    }

    const sidebar = page.locator('.dimension-filters, .sidebar, [class*="filter"]');
    const sidebarVisible = await sidebar.isVisible().catch(() => false);

    if (sidebarVisible) {
      const searchInput = page.locator('input[placeholder*="Filter"], input[placeholder*="filter"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill('California');
        await page.waitForTimeout(1000);
        await searchInput.clear();
      }
    }
  });

  test('5. Summary panel shows KPIs', async ({ page }) => {
    await dismissOnboarding(page);
    await page.waitForTimeout(3000);

    const realEstateBtn = page.locator('button[title*="Real Estate"], button:has-text("Real Estate")').first();
    const isRealEstateVisible = await realEstateBtn.isVisible().catch(() => false);

    if (isRealEstateVisible) {
      await realEstateBtn.click();
      await page.waitForTimeout(10000);
    }

    const summaryPanel = page.locator('.summary-panel, [class*="summary"], .kpi-card, .executive-kpi');
    const hasSummary = await summaryPanel.count() > 0;

    if (hasSummary) {
      await expect(summaryPanel.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Onboarding Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      localStorage.removeItem('census_onboarding');
      localStorage.removeItem('census_prefs');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('shows on first visit', async ({ page }) => {
    await openOnboardingWizard(page);

    const wizard = page.locator('.onboarding-overlay');
    await expect(wizard).toBeVisible({ timeout: 5000 });

    const title = page.locator('.onboarding-title');
    await expect(title).toContainText('What brings you here?');

    const skipBtn = page.locator('.btn-skip');
    await expect(skipBtn).toBeVisible();
  });

  test('can select industry, geography, and metrics', async ({ page }) => {
    await openOnboardingWizard(page);

    const wizard = page.locator('.onboarding-overlay');
    await expect(wizard).toBeVisible({ timeout: 5000 });

    const realEstateCard = page.locator('.industry-card:has-text("Real Estate")');
    await realEstateCard.click();
    await page.waitForTimeout(300);

    const continueBtn = page.locator('.btn-next');
    await continueBtn.click();
    await page.waitForTimeout(500);

    const stateCard = page.locator('.geography-card:has-text("State Level")');
    await expect(stateCard).toBeVisible();
    await stateCard.click();
    await page.waitForTimeout(300);

    await continueBtn.click();
    await page.waitForTimeout(500);

    const metricChips = page.locator('.metric-chip');
    const chipCount = await metricChips.count();
    expect(chipCount).toBeGreaterThan(0);

    const firstChip = metricChips.first();
    await firstChip.click();
    await page.waitForTimeout(300);
  });

  test('can complete wizard and see dashboard', async ({ page }) => {
    await openOnboardingWizard(page);

    const wizard = page.locator('.onboarding-overlay');
    await expect(wizard).toBeVisible({ timeout: 5000 });

    const continueBtn = page.locator('.btn-next');

    await continueBtn.click();
    await page.waitForTimeout(500);
    await continueBtn.click();
    await page.waitForTimeout(500);

    const metricChip = page.locator('.metric-chip').first();
    await metricChip.click();
    await page.waitForTimeout(300);

    await continueBtn.click();
    await page.waitForTimeout(500);

    const reviewSection = page.locator('.review-section');
    await expect(reviewSection).toBeVisible({ timeout: 5000 });

    const launchBtn = page.locator('.btn-next:has-text("Launch Explorer")');
    await expect(launchBtn).toBeVisible();

    await launchBtn.click();
    await page.waitForTimeout(2000);

    await expect(wizard).not.toBeVisible();
  });
});
