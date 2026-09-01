const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../app');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const razorpayProvider = require('../services/razorpay.provider');

jest.mock('../models/Cart');
jest.mock('../models/Product');
jest.mock('../models/Order');
jest.mock('../models/Payment');
jest.mock('../services/razorpay.provider');

const JWT_SECRET = 'test-secret';
const makeToken = (userId = 'user_123', role = 'CUSTOMER') => jwt.sign({ userId, role }, JWT_SECRET);

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
  process.env.RAZORPAY_KEY_SECRET = 'secret_123';
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/payments/create-order', () => {
  test('creates a Razorpay order for a valid cart', async () => {
    const cart = {
      userId: 'user_123',
      merchantId: 'merchant_123',
      items: [{ productId: 'product_123', quantity: 2, price: 500 }],
      subtotal: 1000,
      total: 1000,
    };

    Product.findById.mockResolvedValue({
      _id: 'product_123',
      merchantId: 'merchant_123',
      active: true,
      name: 'Wireless Mouse',
      price: 500,
      stock: 10,
      currency: 'INR',
    });

    Order.create.mockResolvedValue({
      _id: 'order_123',
      userId: 'user_123',
      merchantId: 'merchant_123',
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      items: [{ productId: 'product_123', productName: 'Wireless Mouse', quantity: 2, price: 500, source: 'customer' }],
      subtotal: 1000,
      total: 1000,
      currency: 'INR',
      razorpayOrderId: null,
      save: jest.fn(),
    });

    Payment.create.mockResolvedValue({
      _id: 'payment_123',
      userId: 'user_123',
      merchantId: 'merchant_123',
      amount: 1000,
      currency: 'INR',
      status: 'INITIATED',
      verified: false,
      save: jest.fn(),
    });

    razorpayProvider.getConfig.mockReturnValue({ keyId: 'rzp_test_123', keySecret: 'secret_123' });
    razorpayProvider.createOrder.mockResolvedValue({
      order: { id: 'order_rzp_123', amount: 100000 },
      keyId: 'rzp_test_123',
    });

    Cart.findOne.mockResolvedValue(cart);

    const response = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ merchantId: 'merchant_123' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      keyId: 'rzp_test_123',
      razorpayOrderId: 'order_rzp_123',
      currency: 'INR',
      internalOrderId: 'order_123',
    });
    expect(response.body.data.amount).toBe(100000);
    expect(razorpayProvider.createOrder).toHaveBeenCalled();
  });

  test('rejects invalid product', async () => {
    Cart.findOne.mockResolvedValue({
      userId: 'user_123',
      merchantId: 'merchant_123',
      items: [{ productId: 'product_missing', quantity: 1, price: 500 }],
      subtotal: 500,
      total: 500,
    });

    Product.findById.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ merchantId: 'merchant_123' });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  test('rejects insufficient inventory', async () => {
    Cart.findOne.mockResolvedValue({
      userId: 'user_123',
      merchantId: 'merchant_123',
      items: [{ productId: 'product_123', quantity: 5, price: 500 }],
      subtotal: 2500,
      total: 2500,
    });

    Product.findById.mockResolvedValue({
      _id: 'product_123',
      merchantId: 'merchant_123',
      active: true,
      name: 'Keyboard',
      price: 500,
      stock: 2,
      currency: 'INR',
    });

    const response = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ merchantId: 'merchant_123' });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('OUT_OF_STOCK');
  });

  test('rejects invalid amount mismatch', async () => {
    Cart.findOne.mockResolvedValue({
      userId: 'user_123',
      merchantId: 'merchant_123',
      items: [{ productId: 'product_123', quantity: 1, price: 500 }],
      subtotal: 500,
      total: 500,
    });

    Product.findById.mockResolvedValue({
      _id: 'product_123',
      merchantId: 'merchant_123',
      active: true,
      name: 'Keyboard',
      price: 500,
      stock: 10,
      currency: 'INR',
    });

    const response = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ merchantId: 'merchant_123', amount: 499 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_AMOUNT');
  });

  test('requires authentication', async () => {
    const response = await request(app)
      .post('/api/payments/create-order')
      .send({ merchantId: 'merchant_123' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test('returns an error when Razorpay order creation fails', async () => {
    Cart.findOne.mockResolvedValue({
      userId: 'user_123',
      merchantId: 'merchant_123',
      items: [{ productId: 'product_123', quantity: 1, price: 500 }],
      subtotal: 500,
      total: 500,
    });

    Product.findById.mockResolvedValue({
      _id: 'product_123',
      merchantId: 'merchant_123',
      active: true,
      name: 'Keyboard',
      price: 500,
      stock: 10,
      currency: 'INR',
    });

    Order.create.mockResolvedValue({
      _id: 'order_123',
      userId: 'user_123',
      merchantId: 'merchant_123',
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      items: [{ productId: 'product_123', productName: 'Keyboard', quantity: 1, price: 500, source: 'customer' }],
      subtotal: 500,
      total: 500,
      currency: 'INR',
      razorpayOrderId: null,
      save: jest.fn(),
    });

    Payment.create.mockResolvedValue({
      _id: 'payment_123',
      userId: 'user_123',
      merchantId: 'merchant_123',
      amount: 500,
      currency: 'INR',
      status: 'PENDING',
      verified: false,
      save: jest.fn(),
    });

    razorpayProvider.getConfig.mockReturnValue({ keyId: 'rzp_test_123', keySecret: 'secret_123' });
    razorpayProvider.createOrder.mockRejectedValue(new Error('Razorpay API failure'));

    const response = await request(app)
      .post('/api/payments/create-order')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ merchantId: 'merchant_123' });

    expect(response.status).toBe(502);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(/Razorpay/i);
  });
});
