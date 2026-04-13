import { txIdSchema } from './common';

export const getTransactionSchema = {
  params: {
    type: 'object',
    properties: {
      id: txIdSchema
    },
    required: ['id']
  }
};

export const getTransactionStatusSchema = getTransactionSchema;

