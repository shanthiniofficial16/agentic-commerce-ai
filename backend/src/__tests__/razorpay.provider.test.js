const Razorpay = require('razorpay');
const { createOrder } = require('../services/razorpay.provider');

jest.mock('razorpay');

describe('razorpay.provider createOrder', () => {
  beforeAll(() => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
    process.env.RAZORPAY_KEY_SECRET = 'secret_123';
  });

  test('uses the paise amount value as-is when creating a Razorpay order', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'order_123', amount: 4751000 });
    Razorpay.mockImplementation(() => ({
      orders: { create },
    }));

    const result = await createOrder({ amount: 4751000, currency: 'INR', receipt: 'debug_receipt_123' });

    expect(create).toHaveBeenCalledWith({
      amount: 4751000,
      currency: 'INR',
      receipt: 'debug_receipt_123',
    });
    expect(result.order.id).toBe('order_123');
  });
});
