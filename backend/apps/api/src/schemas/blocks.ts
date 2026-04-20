import { blockIdSchema, paginationSchema, blockHeightSchema } from './common';

export const listBlocksSchema = {
  querystring: paginationSchema
};

export const getBlockByIdSchema = {
  params: {
    type: 'object',
    properties: {
      id: blockIdSchema
    },
    required: ['id']
  }
};

export const getBlockByHeightSchema = {
  params: {
    type: 'object',
    properties: {
      height: blockHeightSchema
    },
    required: ['height']
  }
};

export const getBlockTransactionsSchema = {
  params: {
    type: 'object',
    properties: {
      id: blockIdSchema
    },
    required: ['id']
  },
  querystring: {
    type: 'object',
    properties: {
      limit: paginationSchema.properties.limit
    }
  }
};
