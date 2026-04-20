type BlockEventListener = (block: unknown) => void

class PhinWebSocket {
  private ws: WebSocket | null = null
  private listeners: Set<BlockEventListener> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private url: string

  constructor(url: string) {
    this.url = url
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    try {
      this.ws = new WebSocket(this.url)
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'block') {
            this.listeners.forEach((fn) => fn(msg.data))
          }
        } catch {
          // ignore malformed messages
        }
      }
      this.ws.onclose = () => {
        this.reconnectTimer = setTimeout(() => this.connect(), 5000)
      }
      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch {
      // WebSocket not available (SSR) — no-op
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  subscribe(fn: BlockEventListener) {
    this.listeners.add(fn)
    if (this.listeners.size === 1) this.connect()
    return () => {
      this.listeners.delete(fn)
      if (this.listeners.size === 0) this.disconnect()
    }
  }
}

// Singleton — only created client-side
let instance: PhinWebSocket | null = null

export function getWsClient(): PhinWebSocket | null {
  if (typeof window === 'undefined') return null
  if (!instance) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'
    instance = new PhinWebSocket(`${wsUrl}/v1/ws`)
  }
  return instance
}
