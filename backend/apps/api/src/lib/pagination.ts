export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export function getPagination(input: PaginationInput): PaginationOptions {
  const page = Number.isInteger(input.page) && (input.page as number) > 0
    ? (input.page as number)
    : DEFAULT_PAGE;
  const requestedLimit = Number.isInteger(input.limit) && (input.limit as number) > 0
    ? (input.limit as number)
    : DEFAULT_LIMIT;

  return {
    page,
    limit: Math.min(requestedLimit, MAX_LIMIT)
  };
}
