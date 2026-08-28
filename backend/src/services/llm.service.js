const { generateText } = require('./openrouter.provider');

const generateAgentReply = async ({ message, history = [], products = [] }) => {
  const catalog = products.map((product) => ({
    id: product._id.toString(),
    name: product.name,
    category: product.category,
    price: product.price,
    currency: product.currency,
    description: product.shortDescription || product.description,
    stock: product.stock,
  }));

  const messages = [
    {
      role: 'system',
      content: [
        'You are the commerce assistant for this marketplace.',
        'Answer using only the supplied product catalog when making product claims.',
        'Be concise, helpful, and never invent availability, prices, policies, or order actions.',
        `Product catalog JSON: ${JSON.stringify(catalog)}`,
      ].join('\n'),
    },
    ...history.map((item) => ({
      role: item.role === 'AGENT' ? 'assistant' : 'user',
      content: item.content,
    })),
    { role: 'user', content: message },
  ];

  return generateText({ messages });
};

module.exports = { generateAgentReply };