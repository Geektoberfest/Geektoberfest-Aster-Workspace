import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import pageService from '../../services/pageService'
import useDebounce from '../../hooks/useDebounce'
import Spinner from '../ui/Spinner'
import HighlightText from './HighlightText'
import { getErrorMessage } from '../../services/api'
import { formatDate } from '../../utils/date'

export default function SearchModal() {
  const searchOpen = useUiStore((s) => s.searchOpen)
  const setSearchOpen = useUiStore((s) => s.setSearchOpen)

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 250)
  const [scope, setScope] = useState('all') // 'all' | 'title'
  const [sort, setSort] = useState('relevance') // 'relevance' | 'updated'
  const [results, setResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const navigate = useNavigate()
  const inputRef = useRef(null)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(!useUiStore.getState().searchOpen)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen])

  useEffect(() => {
    if (searchOpen) {
      setQuery('')
      setResults([])
      setSearched(false)
      setSearchError(null)
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [searchOpen])

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!searchOpen || !q) {
      setResults([])
      setSearched(false)
      setSearchError(null)
      setIsSearching(false)
      return
    }

    let cancelled = false
    const seq = ++requestSeqRef.current

    setIsSearching(true)
    setSearchError(null)

    pageService
      .searchPages({ q, scope, sort })
      .then(({ data }) => {
        if (cancelled || seq !== requestSeqRef.current) return
        setResults(data.data.pages)
        setSearched(true)
        setSelectedIndex(0)
      })
      .catch((error) => {
        if (cancelled || seq !== requestSeqRef.current) return
        setResults([])
        setSearched(true)
        setSearchError(getErrorMessage(error, 'Could not complete the search'))
      })
      .finally(() => {
        if (!cancelled && seq === requestSeqRef.current) {
          setIsSearching(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, scope, sort, searchOpen])

  const openPage = (page) => {
    setSearchOpen(false)
    navigate(`/page/${page._id}`)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      openPage(results[selectedIndex])
    } else if (e.key === 'Escape') {
      setSearchOpen(false)
    }
  }

  if (!searchOpen) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[10vh]">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
        onKeyDown={onKeyDown}
      >
        {/* Search input header */}
        <div className="flex items-center gap-2.5 border-b border-zinc-200 px-4 dark:border-zinc-800">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={scope === 'title' ? 'Search page titles…' : 'Search pages and content…'}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
          {isSearching && <Spinner className="h-4 w-4 shrink-0" />}
          <kbd className="shrink-0 rounded border border-zinc-200 px-1.5 text-[10px] text-zinc-400 dark:border-zinc-700">ESC</kbd>
        </div>

        {/* Filter & Sort Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50/70 px-4 py-2 text-xs dark:border-zinc-800/80 dark:bg-zinc-900/60">
          {/* Scope filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Search in:</span>
            <div className="inline-flex rounded-md bg-zinc-200/70 p-0.5 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  scope === 'all'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Titles & content
              </button>
              <button
                type="button"
                onClick={() => setScope('title')}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  scope === 'title'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Titles only
              </button>
            </div>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Sort by:</span>
            <div className="inline-flex rounded-md bg-zinc-200/70 p-0.5 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setSort('relevance')}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  sort === 'relevance'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Relevance
              </button>
              <button
                type="button"
                onClick={() => setSort('updated')}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  sort === 'updated'
                    ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                Recently updated
              </button>
            </div>
          </div>
        </div>

        {/* Results / Empty / Loading / Error states */}
        <div className="max-h-80 overflow-y-auto p-2">
          {!query.trim() && (
            <p className="px-3 py-8 text-center text-sm text-zinc-400">
              Type to search across your page {scope === 'title' ? 'titles' : 'titles and content'}.
            </p>
          )}

          {query.trim() && isSearching && results.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-zinc-400">
              <Spinner className="h-4 w-4" />
              <span>Searching…</span>
            </div>
          )}

          {query.trim() && searchError && !isSearching && (
            <div className="px-3 py-8 text-center text-sm text-red-500">
              <p>{searchError}</p>
            </div>
          )}

          {query.trim() && searched && !isSearching && !searchError && results.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-zinc-400">
              <p>No results for “{query.trim()}”{scope === 'title' ? ' in titles' : ''}</p>
              {scope === 'title' && (
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className="mt-2 text-xs font-medium text-accent underline underline-offset-2 hover:opacity-80"
                >
                  Search in titles and content instead
                </button>
              )}
            </div>
          )}

          {results.map((page, index) => (
            <button
              key={page._id}
              onClick={() => openPage(page)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                index === selectedIndex ? 'bg-zinc-100 dark:bg-zinc-800' : ''
              }`}
            >
              <span className="mt-0.5 text-base leading-none">{page.icon || '📄'}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                  <HighlightText text={page.title || 'Untitled'} query={query} />
                </span>
                {page.snippet && (
                  <span className="mt-0.5 block truncate text-xs text-zinc-400">
                    <HighlightText text={page.snippet} query={query} />
                  </span>
                )}
              </span>
              {sort === 'updated' && page.updatedAt && (
                <span className="mt-0.5 shrink-0 text-[11px] text-zinc-400">
                  {formatDate(page.updatedAt)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}