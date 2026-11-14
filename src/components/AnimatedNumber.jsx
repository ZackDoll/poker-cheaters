import { useEffect, useRef, useState } from 'react'
import { formatChips } from '../helpers/cards.js'

// Counts from the previous value to the new one. Respects reduced-motion by jumping.
function AnimatedNumber({ value, format = formatChips, duration = 600 }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)

  useEffect(() => {
    const start = from.current
    if (start === value) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      from.current = value
      setShown(value)
      return undefined
    }
    const began = performance.now()
    let frame
    function tick(now) {
      const t = Math.min(1, (now - began) / duration)
      const eased = 1 - (1 - t) ** 3
      const next = start + (value - start) * eased
      from.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span>{format(Math.round(shown))}</span>
}

export default AnimatedNumber
