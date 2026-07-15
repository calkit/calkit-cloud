// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("mixpanel-browser", () => ({
  default: { track_pageview: vi.fn() },
}))

function setWebdriver(value: boolean): void {
  Object.defineProperty(navigator, "webdriver", {
    value,
    configurable: true,
  })
}

function makeRouter() {
  let handler: ((event: { hrefChanged: boolean }) => void) | undefined
  return {
    subscribe: (
      _event: string,
      fn: (event: { hrefChanged: boolean }) => void,
    ) => {
      handler = fn
      return () => {}
    },
    navigate: (href: string, hrefChanged = true) => {
      window.history.pushState({}, "", href)
      handler?.({ hrefChanged })
    },
  }
}

async function load() {
  vi.resetModules()
  const mixpanel = (await import("mixpanel-browser")).default
  const { initPageViewTracking } = await import("./analytics")
  // biome-ignore lint/suspicious/noExplicitAny: test router stub
  return { mixpanel, initPageViewTracking: initPageViewTracking as any }
}

describe("initPageViewTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, "", "/")
    setWebdriver(false)
  })

  it("holds the landing page view until the first interaction", async () => {
    const { mixpanel, initPageViewTracking } = await load()
    const router = makeRouter()
    initPageViewTracking(router)
    expect(mixpanel.track_pageview).not.toHaveBeenCalled()
    window.dispatchEvent(new Event("pointermove"))
    expect(mixpanel.track_pageview).toHaveBeenCalledTimes(1)
  })

  it("tracks later navigations once the visitor is confirmed human", async () => {
    const { mixpanel, initPageViewTracking } = await load()
    const router = makeRouter()
    initPageViewTracking(router)
    window.dispatchEvent(new Event("scroll"))
    router.navigate("/projects")
    expect(mixpanel.track_pageview).toHaveBeenCalledTimes(2)
  })

  it("does not retrack a navigation to the same URL", async () => {
    const { mixpanel, initPageViewTracking } = await load()
    const router = makeRouter()
    initPageViewTracking(router)
    window.dispatchEvent(new Event("keydown"))
    router.navigate("/projects")
    router.navigate("/projects")
    expect(mixpanel.track_pageview).toHaveBeenCalledTimes(2)
  })

  it("never tracks for automated browsers, even after interaction", async () => {
    setWebdriver(true)
    const { mixpanel, initPageViewTracking } = await load()
    const router = makeRouter()
    initPageViewTracking(router)
    window.dispatchEvent(new Event("pointermove"))
    router.navigate("/projects")
    expect(mixpanel.track_pageview).not.toHaveBeenCalled()
  })
})
