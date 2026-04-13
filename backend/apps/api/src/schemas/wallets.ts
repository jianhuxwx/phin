import { walletAddressSchema, paginationSchema } from './common';

export const getWalletSchema = {
  params: {
    type: 'object',
    properties: {
      address: walletAddressSchema
    },
    required: ['address']
  }
};

export const getWalletTransactionsSchema = {
  ...getWalletSchema,
  querystring: paginationSchema
};

export const getWalletFilesSchema = getWalletSchema;

export const getWalletArnsSchema = getWalletSchema;

