const ERROR_MESSAGE_MAP = {
  AI_PROVIDER_ERROR: 'The AI shopping assistant is temporarily unavailable. Please try again in a moment.',
  AI_TIMEOUT: 'The AI shopping assistant took too long to respond. Please try again.',
  AI_NETWORK_ERROR: 'The AI shopping assistant is temporarily unavailable. Please try again.',
  AI_NOT_CONFIGURED: 'The AI shopping assistant is not available right now.',
  AI_RATE_LIMITED: 'The AI shopping assistant is busy. Please try again in a few moments.',
  AI_AUTH_FAILED: 'The AI shopping assistant authentication failed. Please try again.',
  AI_INVALID_RESPONSE: 'The AI shopping assistant returned an invalid response. Please try again.',
  AI_TOOL_LIMIT: 'The AI shopping assistant could not finish that request. Please try again.',

  PRODUCT_NOT_FOUND: 'We could not find that product in the current catalog.',
  OUT_OF_STOCK: 'This product is out of stock right now.',
  PRICE_CHANGED: 'This product price changed while preparing the order. Please try again.',
  PROFILE_REQUIRED: 'I need a few delivery details before checkout can continue.',
  ORDER_NOT_READY: 'There is no order ready for confirmation right now.',
  ORDER_PREVIEW_EXPIRED: 'That order preview has expired. Please try again.',
  PAYMENT_FAILED: 'Payment could not be completed. Please try again.',
  RAZORPAY_ORDER_CREATION_FAILED: 'Razorpay could not create the payment order right now. Please try again.',
  PAYMENT_NOT_CONFIGURED: 'Secure payment is not configured. Add valid Razorpay test credentials before continuing.',
  PAYMENT_VERIFICATION_FAILED: 'Payment could not be verified. Your order has not been marked as paid.',

  UNAUTHORIZED: 'Please sign in to continue.',
  INVALID_TOKEN: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to do that.',
  VALIDATION_ERROR: 'Please check the details you entered and try again.',
  PROFILE_INVALID: 'Please complete your delivery profile to continue.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  USER_EXISTS: 'An account with that email already exists.',
  MERCHANT_NOT_FOUND: 'No active store is available for this request.',

  DATABASE_ERROR: 'We are having trouble reaching the database. Please try again later.',
  DB_CONNECTION_ERROR: 'We are having trouble reaching the database. Please try again later.',
  INTERNAL_SERVER_ERROR: 'Something went wrong on our side. Please try again in a moment.',
  SERVER_ERROR: 'Something went wrong on our side. Please try again in a moment.',
  AGENT_FAILED: 'The shopping assistant could not process that request. Please try again.',
  ORDER_FAILED: 'The order could not be placed right now. Please try again.',
  FETCH_FAILED: 'We could not load that information right now. Please try again.',
};

const getUserFacingErrorMessage = (code, fallback = 'Something went wrong. Please try again.') => {
  if (!code || typeof code !== 'string') return fallback;
  const message = ERROR_MESSAGE_MAP[code];
  if (message) return message;
  const normalizedCode = code.toUpperCase();
  return ERROR_MESSAGE_MAP[normalizedCode] || fallback;
};

const sanitizeErrorPayload = (error, fallback = 'Something went wrong. Please try again.') => {
  const code = error?.code || error?.name || 'INTERNAL_SERVER_ERROR';
  const message = getUserFacingErrorMessage(code, fallback);
  return { code, message };
};

module.exports = {
  ERROR_MESSAGE_MAP,
  getUserFacingErrorMessage,
  sanitizeErrorPayload,
};
