import { useEffect, useState } from 'react'

/** Matches Tailwind's `md` breakpoint (768px). */
const MD_BREAKPOINT = 768

/**
 * Returns `true` when the viewport is below the `md` breakpoint.
 * Uses `matchMedia` so it stays in sync on resize.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}
