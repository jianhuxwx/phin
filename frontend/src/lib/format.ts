/** Format a Winston value (string) to AR with up to 6 decimal places */
export function formatAR(value: string): string {
  const raw = (value || '0').trim()
  const ar = raw.includes('.')
    ? Number(raw)
    : Number(BigInt(raw || '0')) / 1e12

  if (!Number.isFinite(ar)) return '0 AR'
  if (ar === 0) return '0 AR'
  if (ar < 0.000001) return '<0.000001 AR'
  return `${ar.toFixed(6).replace(/\.?0+$/, '')} AR`
}

/** Format bytes to human-readable size */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`
}

/** Truncate a hash/address to first N + last N chars */
export function truncateHash(hash: string, head = 8, tail = 6): string {
  if (!hash) return ''
  if (hash.length <= head + tail + 3) return hash
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`
}

/** Format a Unix timestamp (seconds) to relative time string */
export function relativeTime(timestamp: number): string {
  const now = Date.now() / 1000
  const diff = now - timestamp
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/** Format a Unix timestamp (seconds) to a readable date string */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  })
}

/** Format a large number with commas */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

/** Format TTL seconds to human-readable */
export function formatTTL(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}
