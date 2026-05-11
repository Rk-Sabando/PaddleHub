import { test, expect } from "@playwright/test";

// TODO: Use Clerk's testing tokens for authenticated flows.
test("landing page renders sign-in link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
});
