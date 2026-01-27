import { expect, test } from "@playwright/test"

test.use({ storageState: { cookies: [], origins: [] } })

test("Shows GitHub sign-in button", async ({ page }) => {
  await page.goto("/login")
  await expect(
    page.getByRole("button", { name: "Sign in with GitHub" }),
  ).toBeVisible()
})

test("Clicking sign-in navigates to GitHub OAuth", async ({ page }) => {
  await page.goto("/login")

  const [nav] = await Promise.all([
    page.waitForNavigation(),
    page.getByRole("button", { name: "Sign in with GitHub" }).click(),
  ])

  expect(nav?.url() || page.url()).toContain(
    "https://github.com/login/oauth/authorize",
  )
})

test("Already authenticated users are redirected off /login", async ({ page }) => {
  // Simulate an existing session by seeding a token; the frontend only checks presence
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "dummy-token")
  })

  await page.goto("/login")
  await page.waitForURL("/")
})
