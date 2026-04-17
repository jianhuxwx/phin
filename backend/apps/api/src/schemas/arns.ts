import { paginationSchema, walletAddressSchema } from './common';

export const listArnsSchema = {
  querystring: {
    type: 'object',
    properties: {
      page: paginationSchema.properties.page,
      limit: paginationSchema.properties.limit,
      ownerAddress: walletAddressSchema,
      q: { type: 'string', minLength: 1 }
    }
  }
};

export const getArnsByNameSchema = {
  params: {
    type: 'object',
    properties: {
      name: { type: 'string' }
    },
    required: ['name']
  }
};

export const getArnsHistorySchema = getArnsByNameSchema;
