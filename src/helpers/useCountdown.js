import { useEffect, useState } from 'react'

// Fraction of time left (1 down to 0) until `deadline` (epoch ms, already corrected for
// clock skew). Returns 0 when there is no deadline.
export function useCountdown(deadline) {
  const [fraction, setFraction] = useState(0)

  useEffect(() => {
    if (!deadline) return undefined
    const total = Math.max(1000, deadline - Date.now())
    let frame
    function tick() {
      const left = deadline - Date.now()
      setFraction(Math.max(0, Math.min(1, left / total)))
      if (left > 0) frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [deadline])

  return deadline ? fraction : 0
}
