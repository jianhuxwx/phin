export const searchSchema = {
  querystring: {
    type: 'object',
    properties: {
      q: { type: 'string' },
    },
    required: ['q']
  }
};

export const searchSuggestSchema = {
  querystring: {
    type: 'object',
    properties: {
      q: { type: 'string' }
    },
    required: ['q']
  }
};
