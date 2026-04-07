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

  // GitHub may redirect to /login before /login/oauth/authorize if the browser
  // isn't already signed into GitHub; just verify we landed on github.com with
  // the OAuth path somewhere in the URL (possibly URL-encoded in return_to).
  const url = decodeURIComponent(nav?.url() || page.url())
  expect(url).toContain("github.com")
  expect(url).toMatch(/login\/oauth\/authorize|oauth\/authorize/)
})

test("Already authenticated users are redirected off /login", async ({ page }) => {
  // Simulate an existing session by seeding a token; the frontend only checks presence
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "dummy-token")
  })

  await page.goto("/login")
  await page.waitForURL((url) => url.pathname === "/")
})
