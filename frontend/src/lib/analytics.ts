import type { AnyRouter } from "@tanstack/react-router"
import mixpanel from "mixpanel-browser"

// Bots with rotating user agents and IP addresses kept loading a single URL
// and inflating Mixpanel page views. Real visitors interact with the page
// (move the pointer, scroll, type); these bots do not. So instead of letting
// Mixpanel fire a page view automatically on load, we hold each page view
// until the first interaction and drop it entirely for automated browsers,
// which report navigator.webdriver even when they spoof their user agent.

const INTERACTION_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
] as const

let humanConfirmed = false
let pageViewPending = false
let lastTrackedHref: string | null = null

function recordPageView(): void {
  const href = window.location.href
  if (href === lastTrackedHref) return
  lastTrackedHref = href
  mixpanel.track_pageview()
}

function requestPageView(): void {
  if (navigator.webdriver) return
  if (humanConfirmed) {
    recordPageView()
    return
  }
  pageViewPending = true
}

function confirmHuman(): void {
  if (humanConfirmed) return
  humanConfirmed = true
  INTERACTION_EVENTS.forEach((event) =>
    window.removeEventListener(event, confirmHuman, true),
  )
  if (pageViewPending) {
    pageViewPending = false
    recordPageView()
  }
}

export function initPageViewTracking(router: AnyRouter): void {
  if (navigator.webdriver) return
  INTERACTION_EVENTS.forEach((event) =>
    window.addEventListener(event, confirmHuman, {
      capture: true,
      passive: true,
    }),
  )
  requestPageView()
  router.subscribe("onResolved", ({ hrefChanged }) => {
    if (hrefChanged) requestPageView()
  })
}
