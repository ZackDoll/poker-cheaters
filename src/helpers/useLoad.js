import { useEffect, useState } from 'react'

// Runs an async loader whenever `key` changes. Returns { data, error, loading }.
// A result that arrives after the key changed or the page unmounted is ignored.
export function useLoad(loader, key) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  useEffect(() => {
    let cancelled = false
    setState({ data: null, error: null, loading: true })
    loader()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false })
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, error, loading: false })
      })
    return () => {
      cancelled = true
    }
    // The loader is recreated on every render; the key says when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}
