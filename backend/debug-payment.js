const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('./src/app');
const Cart = require('./src/models/Cart');
const Product = require('./src/models/Product');
const Order = require('./src/models/Order');
const Payment = require('./src/models/Payment');
const razorpayProvider = require('./src/services/razorpay.provider');

process.env.JWT_SECRET = 'test-secret';
process.env.RAZORPAY_KEY_ID = 'rzp_test_123';
process.env.RAZORPAY_KEY_SECRET = 'secret_123';

const makeToken = (userId = 'user_123', role = 'CUSTOMER') => jwt.sign({ userId, role }, 'test-secret');

Cart.findOne = async () => ({
  userId: 'user_123',
  merchantId: 'merchant_123',
  items: [{ productId: 'product_123', quantity: 2, price: 500 }],
  subtotal: 1000,
  total: 1000,
});

Product.findById = async () => ({
  _id: 'product_123',
  merchantId: 'merchant_123',
  active: true,
  name: 'Wireless Mouse',
  price: 500,
  stock: 10,
  currency: 'INR',
});

Order.create = async (obj) => ({ ...obj, _id: 'order_123', save: async () => {} });
Payment.create = async (obj) => ({ ...obj, _id: 'payment_123', save: async () => {} });
razorpayProvider.getConfig = () => ({ keyId: 'rzp_test_123', keySecret: 'secret_123' });
razorpayProvider.createOrder = async () => ({ order: { id: 'order_rzp_123', amount: 100000 }, keyId: 'rzp_test_123' });

(async () => {
  const response = await request(app)
    .post('/api/payments/create-order')
    .set('Authorization', `Bearer ${makeToken()}`)
    .send({ merchantId: 'merchant_123' });

  console.log('STATUS', response.status);
  console.log(JSON.stringify(response.body, null, 2));
})();
