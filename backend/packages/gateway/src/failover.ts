import { GraphQLClient } from 'graphql-request';
import { createGatewayClient } from './client';

export interface GatewayStatusEntry {
  url: string;
  healthy: boolean;
  active: boolean;
}

export class GatewayPool {
  private readonly gateways: string[];
  private readonly clients: Map<string, GraphQLClient>;
  private activeIndex = 0;
  private unhealthy: Set<string> = new Set();

  constructor(urls: string[]) {
    if (!urls.length) {
      throw new Error('GatewayPool requires at least one gateway URL');
    }
    this.gateways = urls;
    this.clients = new Map(urls.map((url) => [url, createGatewayClient(url)]));
  }

  getClient(): GraphQLClient {
    const activeUrl = this.gateways[this.activeIndex];
    const client = this.clients.get(activeUrl);
    if (!client) {
      throw new Error('No active gateway client available');
    }
    return client;
  }

  reportFailure(url: string): void {
    if (!this.gateways.includes(url)) {
      return;
    }

    this.unhealthy.add(url);

    if (this.gateways[this.activeIndex] === url) {
      for (let i = 0; i < this.gateways.length; i += 1) {
        const idx = (this.activeIndex + 1 + i) % this.gateways.length;
        const candidate = this.gateways[idx];
        if (!this.unhealthy.has(candidate)) {
          this.activeIndex = idx;
          break;
        }
      }
    }
  }

  getStatus(): GatewayStatusEntry[] {
    const activeUrl = this.gateways[this.activeIndex];
    return this.gateways.map((url) => ({
      url,
      healthy: !this.unhealthy.has(url),
      active: url === activeUrl
    }));
  }
}

