import type { ApiArnsRecord, PaginatedResponse } from '../contracts';

import { ArnsRepository } from '../repositories/arns';
import { ApiHttpError } from '../lib/errors';

export class ArnsService {
  constructor(private readonly repository: ArnsRepository) {}

  async list(options: {
    page: number;
    limit: number;
    ownerAddress?: string;
    query?: string;
  }): Promise<PaginatedResponse<ApiArnsRecord>> {
    return await this.repository.list(options);
  }

  async getByName(name: string): Promise<ApiArnsRecord> {
    const record = await this.repository.getByName(name);
    if (!record) {
      throw new ApiHttpError(404, 'ArNS record not found');
    }
    return record;
  }

  async listByOwner(ownerAddress: string): Promise<ApiArnsRecord[]> {
    return await this.repository.listByOwner(ownerAddress);
  }

  async countByOwner(ownerAddress: string): Promise<number> {
    return await this.repository.countByOwner(ownerAddress);
  }
}
