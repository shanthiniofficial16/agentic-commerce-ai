const crypto = require('crypto');
const Razorpay = require('razorpay');

const isPlaceholder = (value) => !value || /your_|xxx|placeholder/i.test(value);

const getConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (isPlaceholder(keyId) || isPlaceholder(keySecret)) {
    throw Object.assign(new Error('Razorpay is not configured. Add valid test or live credentials before starting payment.'), { code: 'PAYMENT_NOT_CONFIGURED', status: 503 });
  }
  return { keyId, keySecret };
};

const getClient = () => {
  const { keyId, keySecret } = getConfig();
  return { client: new Razorpay({ key_id: keyId, key_secret: keySecret }), keyId };
};

const createOrder = async ({ amount, currency, receipt }) => {
  const { client, keyId } = getClient();
  const normalizedAmount = Math.round(Number(amount));
  const order = await client.orders.create({
    amount: normalizedAmount,
    currency: currency || 'INR',
    receipt,
  });
  return { order, keyId };
};

const verifySignature = ({ orderId, paymentId, signature }) => {
  const { keySecret } = getConfig();
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const received = Buffer.from(String(signature || ''));
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, received);
};

const fetchPayment = async (paymentId) => {
  const { client } = getClient();
  return client.payments.fetch(paymentId);
};

module.exports = { createOrder, verifySignature, fetchPayment, getConfig };
