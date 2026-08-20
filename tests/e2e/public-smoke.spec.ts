import { expect, test } from "@playwright/test";

test("landing page is keyboard-accessible and invitation-only", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Purchasing Hub" }),
  ).toBeVisible();
  await expect(page.getByText("Accounts are invitation-only")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /sign up|register/i }),
  ).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
});

test("landing page remains usable at a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Purchasing Hub" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("authenticated critical routes render when an approved test state is supplied", async ({
  page,
}) => {
  test.skip(
    !process.env.PLAYWRIGHT_AUTH_STATE,
    "Requires a separately provisioned non-production Clerk storage state",
  );
  for (const route of [
    "/app",
    "/app/orders/new",
    "/app/orders",
    "/app/purchasing",
  ]) {
    await page.goto(route);
    await expect(page.locator("body")).not.toContainText("Application error");
  }
});
