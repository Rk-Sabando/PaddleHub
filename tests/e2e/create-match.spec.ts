import { test } from "@playwright/test";

test.skip("authenticated user can create a match", async ({ page: _page }) => {
  // TODO: sign in via Clerk testing token, fill /matches/new, assert match appears in list.
});
