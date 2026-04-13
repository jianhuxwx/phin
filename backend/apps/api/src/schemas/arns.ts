export const listArnsSchema = {};

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

