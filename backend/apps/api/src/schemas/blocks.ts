import { txIdSchema, blockHeightSchema, paginationSchema } from './common';

export const listBlocksSchema = {
  querystring: paginationSchema
};

export const getBlockByIdSchema = {
  params: {
    type: 'object',
    properties: {
      id: txIdSchema
    },
    required: ['id']
  }
};

export const getBlockTransactionsSchema = {
  params: {
    type: 'object',
    properties: {
      id: txIdSchema
    },
    required: ['id']
  },
  querystring: paginationSchema
};

