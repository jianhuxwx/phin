'use client'

import { useGateways } from '@/lib/hooks'
import RelativeTime from '@/components/ui/RelativeTime'
import { Skeleton } from '@/components/ui/Skeleton'

function latencyColor(ms: number): string {
  if (ms < 100) return '#22c55e'
  if (ms < 300) return '#f59e0b'
  return '#ef4444'
}

function shortUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function GatewayStatusPanel() {
  const { data, isLoading } = useGateways()

  return (
    <div className="bg-bg-card border border-bg-border rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-tx-primary uppercase tracking-wider">Gateways</span>
        {data && (
          <span className="text-xs text-tx-muted">
            {data.filter((g) => g.healthy).length}/{data.length} online
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-1.5 w-full rounded" />
              </div>
            ))
          : (data ?? []).map((gw) => {
              const ms = gw.latencyMs ?? 0
              const color = gw.healthy ? latencyColor(ms) : '#ef4444'
              const barPct = gw.healthy ? Math.min(100, (ms / 500) * 100) : 100

              return (
                <div key={gw.url} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor: color,
                          boxShadow: gw.healthy ? `0 0 4px ${color}80` : undefined,
                        }}
                      />
                      <span className="text-xs text-tx-primary font-mono truncate max-w-[120px]">
                        {shortUrl(gw.url)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {gw.healthy && gw.latencyMs !== null ? (
                        <span className="text-xs font-mono" style={{ color }}>
                          {ms}ms
                        </span>
                      ) : (
                        <span className="text-xs text-red-400">down</span>
                      )}
                    </div>
                  </div>

                  {/* Latency bar */}
                  <div className="h-1 rounded-full bg-bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${barPct}%`, backgroundColor: color, opacity: gw.healthy ? 0.8 : 0.4 }}
                    />
                  </div>

                  {gw.lastChecked > 0 && (
                    <div className="text-[10px] text-tx-muted">
                      checked <RelativeTime
                        timestamp={
                          // lastChecked may be ms (Date.now()) or seconds — normalise to seconds
                          gw.lastChecked > 1e10 ? Math.floor(gw.lastChecked / 1000) : gw.lastChecked
                        }
                      />
                    </div>
                  )}
                </div>
              )
            })}
      </div>
    </div>
  )
}
