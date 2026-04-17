export const txIdSchema = {
  type: 'string',
  pattern: '^[a-zA-Z0-9_-]{43}$'
};

export const walletAddressSchema = {
  type: 'string',
  pattern: '^[a-zA-Z0-9_-]{43}$'
};

export const blockHeightSchema = {
  type: 'integer',
  minimum: 0
};

export const paginationSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
  }
};

export const errorResponseSchema = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    statusCode: { type: 'number' }
  },
  required: ['error', 'statusCode']
};
