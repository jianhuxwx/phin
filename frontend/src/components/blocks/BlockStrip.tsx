'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ApiBlockSummary } from '@/lib/types'
import { useRecentBlocks } from '@/lib/hooks'
import { getWsClient } from '@/lib/ws'
import { getBlockByHeight, getBlocks } from '@/lib/api'
import { formatNumber, formatBytes, relativeTime } from '@/lib/format'
import { Skeleton } from '@/components/ui/Skeleton'

const PAGE_SIZE = 15
const SCROLL_AMOUNT = 540
const CARD_WIDTH = 176

function fullnessColor(pct: number): string {
  if (pct >= 80) return 'bg-red-500'
  if (pct >= 50) return 'bg-status-pending'
  return 'bg-status-confirmed'
}

function BlockCardSkeleton() {
  return (
    <div className="w-[168px] shrink-0 bg-bg-card border border-bg-border rounded-lg p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-10" />
      </div>
      <Skeleton className="h-1.5 w-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-2.5 w-8" />
        <Skeleton className="h-2.5 w-8" />
      </div>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-2.5 w-12" />
    </div>
  )
}

interface BlockCardProps {
  block: ApiBlockSummary
  isNew: boolean
  isActive: boolean
}

function BlockCard({ block, isNew, isActive }: BlockCardProps) {
  const pct = Math.min(100, Math.round((block.txCount / 1000) * 100))
  const weaveNum = Number(block.weaveSize)

  return (
    <div className="relative w-[168px] shrink-0 pt-3">
      {isActive && (
        <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
          <svg width="14" height="9" viewBox="0 0 14 9" fill="none" aria-hidden="true" className="text-accent drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
            <path d="M7 9L0.937822 0.75L13.0622 0.75L7 9Z" fill="currentColor" />
          </svg>
        </div>
      )}

      <Link
        href={`/block/${block.height}`}
        className={[
          'group flex flex-col gap-2 bg-bg-card border border-bg-border rounded-lg p-3',
          'hover:border-accent/40 hover:bg-white/[0.02] transition-colors duration-150',
          isNew ? 'block-strip-new' : '',
          isActive ? 'border-accent/70 shadow-[0_0_0_1px_rgba(232,180,76,0.28)]' : '',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-mono font-semibold text-accent group-hover:text-accent-hover transition-colors truncate">
            #{formatNumber(block.height)}
          </span>
          <span className="text-[10px] text-tx-muted shrink-0">{relativeTime(block.timestamp)}</span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="w-full h-1.5 bg-bg-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${fullnessColor(pct)}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-tx-muted uppercase tracking-wider">Full</span>
            <span className="text-[10px] font-mono text-tx-muted">{pct}%</span>
          </div>
        </div>

        <div className="text-xs font-mono text-tx-primary">
          {formatNumber(block.txCount)} txs
        </div>

        {weaveNum > 0 && (
          <div className="text-[10px] font-mono text-tx-muted">
            {formatBytes(weaveNum)}
          </div>
        )}
      </Link>
    </div>
  )
}

export default function BlockStrip() {
  const pathname = usePathname()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [blocks, setBlocks] = useState<ApiBlockSummary[]>([])
  const [newBlockId, setNewBlockId] = useState<string | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [visibleRange, setVisibleRange] = useState<{ first: number; last: number } | null>(null)

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingMoreRef = useRef(false)
  const blocksRef = useRef<ApiBlockSummary[]>([])
  const targetHeightRef = useRef<number | null>(null)
  const aligningTargetRef = useRef(false)

  const { data, isLoading, mutate } = useRecentBlocks(PAGE_SIZE)

  useEffect(() => {
    if (data?.data && data.data.length > 0) {
      setBlocks(data.data)
      blocksRef.current = data.data
      hasMoreRef.current = data.pagination.hasNextPage
    }
  }, [data])

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return

    loadingMoreRef.current = true
    setLoadingMore(true)

    try {
      const nextPage = pageRef.current + 1
      const res = await getBlocks(nextPage, PAGE_SIZE)

      setBlocks((prev) => {
        const existingIds = new Set(prev.map((b) => b.id))
        const fresh = res.data.filter((b) => !existingIds.has(b.id))
        const next = [...prev, ...fresh]
        blocksRef.current = next
        return next
      })

      pageRef.current = nextPage
      hasMoreRef.current = res.pagination.hasNextPage
    } catch {
      // Ignore load failures and allow a later retry on scroll.
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [])

  const updateVisibleRange = useCallback(() => {
    const el = scrollRef.current
    const list = blocksRef.current
    if (!el || list.length === 0) return

    const padding = 16
    const firstIdx = Math.max(0, Math.floor((el.scrollLeft - padding) / CARD_WIDTH))
    const lastIdx = Math.min(
      list.length - 1,
      Math.floor((el.scrollLeft + el.clientWidth - padding) / CARD_WIDTH)
    )

    if (list[firstIdx] && list[lastIdx]) {
      setVisibleRange({ first: list[firstIdx].height, last: list[lastIdx].height })
    }
  }, [])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
    updateVisibleRange()

    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 400) {
      loadMore()
    }
  }, [loadMore, updateVisibleRange])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    el.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    handleScroll()
  }, [blocks, handleScroll])

  useEffect(() => {
    const client = getWsClient()
    if (!client) return

    const unsub = client.subscribe((incoming) => {
      const block = incoming as ApiBlockSummary

      setBlocks((prev) => {
        if (prev.some((b) => b.id === block.id)) return prev
        const next = [block, ...prev]
        blocksRef.current = next
        return next
      })

      setNewBlockId(block.id)
      setTimeout(() => setNewBlockId(null), 600)
      scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' })
      mutate()
    })

    return unsub
  }, [mutate])

  function scrollLeft() {
    scrollRef.current?.scrollBy({ left: -SCROLL_AMOUNT, behavior: 'smooth' })
  }

  function scrollRight() {
    scrollRef.current?.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' })
  }

  const showSkeletons = isLoading && blocks.length === 0
  const activeBlockHeight = (() => {
    const match = pathname.match(/^\/block\/(\d+)$/)
    return match ? Number(match[1]) : null
  })()

  const scrollToBlockHeight = useCallback((height: number) => {
    const el = scrollRef.current
    const list = blocksRef.current
    if (!el || list.length === 0) return false

    const index = list.findIndex((block) => block.height === height)
    if (index === -1) return false

    const targetLeft = Math.max(0, index * CARD_WIDTH - (el.clientWidth / 2 - CARD_WIDTH / 2))
    el.scrollTo({
      left: targetLeft,
      behavior: 'smooth',
    })
    return true
  }, [])

  const ensureBlockVisible = useCallback(async (height: number) => {
    if (aligningTargetRef.current) return
    aligningTargetRef.current = true
    targetHeightRef.current = height

    try {
      if (scrollToBlockHeight(height)) return

      const targetBlock = await getBlockByHeight(height)
      setBlocks((prev) => {
        if (prev.some((block) => block.id === targetBlock.id)) {
          blocksRef.current = prev
          return prev
        }

        const next = [...prev, targetBlock].sort((a, b) => b.height - a.height)
        blocksRef.current = next
        return next
      })
    } catch {
      // Ignore target lookup failures and leave the strip in its current state.
    } finally {
      aligningTargetRef.current = false
    }
  }, [scrollToBlockHeight])

  useEffect(() => {
    if (activeBlockHeight == null) {
      targetHeightRef.current = null
      return
    }

    void ensureBlockVisible(activeBlockHeight)
  }, [activeBlockHeight, ensureBlockVisible])

  useEffect(() => {
    if (targetHeightRef.current == null) return
    if (scrollToBlockHeight(targetHeightRef.current)) {
      targetHeightRef.current = null
    }
  }, [blocks, scrollToBlockHeight])

  return (
    <div className="border-b border-bg-border bg-bg-card">
      <div className="relative">
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            aria-label="Scroll blocks left"
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center w-9
                       bg-gradient-to-r from-bg-card via-bg-card/80 to-transparent
                       text-tx-muted hover:text-tx-primary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-auto pt-3 px-4 pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {showSkeletons
            ? Array.from({ length: 8 }).map((_, i) => <BlockCardSkeleton key={i} />)
            : blocks.map((block) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  isNew={block.id === newBlockId}
                  isActive={block.height === activeBlockHeight}
                />
              ))}

          {loadingMore && (
            <>
              <BlockCardSkeleton />
              <BlockCardSkeleton />
              <BlockCardSkeleton />
            </>
          )}
        </div>

        {canScrollRight && (
          <button
            onClick={scrollRight}
            aria-label="Scroll blocks right"
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center w-9
                       bg-gradient-to-l from-bg-card via-bg-card/80 to-transparent
                       text-tx-muted hover:text-tx-primary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {visibleRange && (
        <div className="px-4 pb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] text-tx-muted font-mono">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="text-accent shrink-0">
              <path d="M5 1v8M2 6l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              Block{' '}
              <span className="text-tx-primary">#{formatNumber(visibleRange.first)}</span>
              {visibleRange.first !== visibleRange.last && (
                <>
                  {' '}—{' '}
                  <span className="text-tx-primary">#{formatNumber(visibleRange.last)}</span>
                </>
              )}
            </span>
          </div>
          {!hasMoreRef.current && (
            <span className="text-[10px] text-tx-muted font-mono">Genesis reached</span>
          )}
        </div>
      )}
    </div>
  )
}
