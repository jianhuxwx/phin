'use client'

import { useEffect, useState } from 'react'
import { relativeTime } from '@/lib/format'

interface RelativeTimeProps {
  timestamp: number // Unix seconds
  className?: string
}

export default function RelativeTime({ timestamp, className }: RelativeTimeProps) {
  const [display, setDisplay] = useState(() => relativeTime(timestamp))

  useEffect(() => {
    setDisplay(relativeTime(timestamp))
    const interval = setInterval(() => setDisplay(relativeTime(timestamp)), 10_000)
    return () => clearInterval(interval)
  }, [timestamp])

  return (
    <time
      dateTime={new Date(timestamp * 1000).toISOString()}
      title={new Date(timestamp * 1000).toLocaleString()}
      className={className}
    >
      {display}
    </time>
  )
}
