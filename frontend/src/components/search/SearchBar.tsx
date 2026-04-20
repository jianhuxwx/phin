'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { search, searchSuggest } from '@/lib/api'

export default function SearchBar() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return }
    try {
      const res = await searchSuggest(q)
      setSuggestions(Array.isArray(res) ? res.slice(0, 6) : [])
    } catch {
      setSuggestions([])
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }

  const navigate = useCallback(async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setOpen(false)
    try {
      const result = await search(q.trim())
      if (!result.target) throw new Error('not found')
      switch (result.type) {
        case 'transaction': router.push(`/tx/${result.target}`); break
        case 'wallet':      router.push(`/wallet/${result.target}`); break
        case 'block':       router.push(`/block/${result.target}`); break
        case 'arns':        router.push(`/arns/${result.target}`); break
        default:            throw new Error('not found')
      }
    } catch {
      // Try direct navigation as fallback
      if (/^\d+$/.test(q.trim())) router.push(`/block/${q.trim()}`)
      else if (q.trim().length === 43) router.push(`/tx/${q.trim()}`)
      else router.push(`/arns/${q.trim()}`)
    } finally {
      setLoading(false)
    }
  }, [router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(query)
  }

  const handleSuggestion = (name: string) => {
    setQuery(name)
    setOpen(false)
    router.push(`/arns/${name}`)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.closest('form')?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-2xl">
      <div className="flex items-center bg-bg-card border border-bg-border rounded-lg overflow-hidden focus-within:border-accent transition-colors">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          placeholder="Search by TX ID, wallet, block height, or ArNS name…"
          className="flex-1 bg-transparent px-4 py-2.5 text-sm text-tx-primary placeholder-tx-muted outline-none font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 text-sm text-tx-muted hover:text-tx-primary transition-colors border-l border-bg-border"
          aria-label="Search"
        >
          {loading ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
            </svg>
          )}
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 mt-1 bg-bg-card border border-bg-border rounded-lg overflow-hidden z-50 shadow-xl">
          {suggestions.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => handleSuggestion(name)}
                className="w-full text-left px-4 py-2.5 text-sm font-mono text-tx-hash hover:bg-bg-border hover:text-tx-primary transition-colors"
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}
