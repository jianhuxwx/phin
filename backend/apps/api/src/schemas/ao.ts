export const listAoProcessesSchema = {};

export const getAoProcessSchema = {
  params: {
    type: 'object',
    properties: {
      id: { type: 'string' }
    },
    required: ['id']
  }
};

export const getAoProcessMessagesSchema = getAoProcessSchema;

