const jwt = require('jsonwebtoken');
const request = require('supertest');

const app = require('../app');
const Conversation = require('../models/Conversation');
const Product = require('../models/Product');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Cart = require('../models/Cart');
const RazorpayProvider = require('../services/razorpay.provider');

jest.mock('../models/Conversation');
jest.mock('../models/Product');
jest.mock('../models/Payment');
jest.mock('../models/User');
jest.mock('../models/Cart');
jest.mock('../services/razorpay.provider');

const JWT_SECRET = 'test-secret';
const makeToken = (userId = '507f1f77bcf86cd799439011', role = 'CUSTOMER') => jwt.sign({ userId, role }, JWT_SECRET);

beforeAll(() => {
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
  process.env.RAZORPAY_KEY_SECRET = 'secret_123';
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/agent/order/confirm', () => {
  test('creates a real Razorpay payment session for a valid pending AI order instead of returning 409', async () => {
    const userId = '507f1f77bcf86cd799439011';
    const merchantId = '507f1f77bcf86cd799439012';
    const productId = '507f1f77bcf86cd799439013';

    const conversation = {
      sessionId: 'session_123',
      userId,
      merchantId,
      orderState: 'PENDING_CONFIRMATION',
      pendingOrder: {
        state: 'PENDING_CONFIRMATION',
        product: {
          id: productId,
          name: 'Laptop',
          price: 50000,
          currency: 'INR',
        },
        quantity: 1,
        total: 50000,
        profile: {
          fullName: 'Test User',
          phone: '9876543210',
          email: 'test@example.com',
          street: 'Main Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
      },
      save: jest.fn().mockResolvedValue(true),
    };

    Conversation.findOne.mockResolvedValue(conversation);
    Cart.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        items: [{ productId, quantity: 1, source: 'customer' }],
      }),
    });
    Product.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: productId,
        merchantId,
        active: true,
        name: 'Laptop',
        price: 50000,
        currency: 'INR',
        stock: 10,
      }),
    });
    User.buildCustomerProfile.mockImplementation((user) => ({
      fullName: user?.profile?.fullName || user?.name || '',
      phone: user?.profile?.phone || '',
      email: user?.profile?.email || user?.email || '',
      street: user?.profile?.street || '',
      building: user?.profile?.building || '',
      landmark: user?.profile?.landmark || '',
      city: user?.profile?.city || '',
      state: user?.profile?.state || '',
      pincode: user?.profile?.pincode || '',
      address: [user?.profile?.street, user?.profile?.building, user?.profile?.landmark].filter(Boolean).join(', '),
    }));
    User.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: userId,
        name: 'Test User',
        email: 'test@example.com',
        profile: {
          fullName: 'Test User',
          phone: '9876543210',
          email: 'test@example.com',
          street: 'Main Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
      }),
    });
    Payment.findOne.mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });
    Payment.create.mockResolvedValue({
      _id: 'payment_123',
      userId,
      merchantId,
      amount: 50000,
      currency: 'INR',
      status: 'PENDING',
      verified: false,
      save: jest.fn().mockResolvedValue(true),
    });
    RazorpayProvider.getConfig.mockReturnValue({ keyId: 'rzp_test_123', keySecret: 'secret_123' });
    RazorpayProvider.createOrder.mockResolvedValue({
      order: { id: 'order_rzp_123', amount: 5000000 },
      keyId: 'rzp_test_123',
    });

    const response = await request(app)
      .post('/api/agent/order/confirm')
      .set('Authorization', `Bearer ${makeToken(userId)}`)
      .send({ sessionId: 'session_123' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.paymentSession).toMatchObject({
      keyId: 'rzp_test_123',
      razorpayOrderId: 'order_rzp_123',
      amount: 5000000,
      currency: 'INR',
    });
  });
});
