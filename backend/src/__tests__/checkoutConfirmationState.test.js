const { isConfirmationResponse, isCancellationResponse, parseConfirmationResponse } = require('../controllers/agent.controller');
const { executeTool } = require('../services/agent/tools');

jest.mock('../services/order.service', () => ({
  getProfile: jest.fn(async () => ({
    fullName: 'Test User',
    phone: '9876543210',
    email: 'test@example.com',
    street: '1 Test Street',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
  })),
  profileStatus: jest.fn(() => ({ profileExists: true, profileComplete: true, missingFields: [], invalidFields: [] })),
  prepareOrder: jest.fn(async ({ productId }) => ({
    state: 'PENDING_CONFIRMATION',
    orderPreviewId: 'ORDER_PREVIEW_123',
    product: { id: productId, name: 'CodeCraft Laptop 162 Plus', price: 49999, currency: 'INR', stock: 12 },
    profile: {
      fullName: 'Test User',
      phone: '9876543210',
      email: 'test@example.com',
      street: '1 Test Street',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      address: '1 Test Street, Bengaluru, Karnataka, 560001',
    },
    quantity: 1,
    total: 49999,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  })),
  saveProfile: jest.fn(),
  profileFields: ['fullName', 'phone', 'email', 'street', 'city', 'state', 'pincode'],
  createOrder: jest.fn(),
  getOrdersForUser: jest.fn(),
  validateProfile: jest.fn(() => null),
}));

describe('checkout confirmation state handling', () => {
  test('accepts natural affirmative confirmation strings', () => {
    expect(isConfirmationResponse('Yes')).toBe(true);
    expect(isConfirmationResponse('Confirm')).toBe(true);
    expect(isConfirmationResponse('Place the order')).toBe(true);
    expect(isConfirmationResponse('Proceed')).toBe(true);
    expect(isConfirmationResponse('Buy it')).toBe(true);
    expect(isConfirmationResponse('Go ahead')).toBe(true);
    expect(isConfirmationResponse('Okay, confirm')).toBe(true);
  });

  test('accepts natural cancellation strings', () => {
    expect(isCancellationResponse('No')).toBe(true);
    expect(isCancellationResponse('Cancel')).toBe(true);
    expect(isCancellationResponse('Stop')).toBe(true);
    expect(isCancellationResponse('Don\'t buy')).toBe(true);
    expect(isCancellationResponse('Never mind')).toBe(true);
    expect(isCancellationResponse('Cancel the order')).toBe(true);
  });

  test('keeps unrelated messages out of the confirmation state', () => {
    expect(parseConfirmationResponse('Tell me more about the laptop')).toBe('pending');
    expect(parseConfirmationResponse('What is the return policy?')).toBe('pending');
  });

  test('maps confirmation actions to explicit state transitions', () => {
    expect(parseConfirmationResponse('Yes')).toBe('confirm');
    expect(parseConfirmationResponse('No')).toBe('cancel');
    expect(parseConfirmationResponse('Confirm')).toBe('confirm');
    expect(parseConfirmationResponse('Cancel')).toBe('cancel');
  });

  test('persists the pending confirmation state from prepareOrder', async () => {
    const context = {
      userId: '507f1f77bcf86cd799439011',
      merchantId: '507f1f77bcf86cd799439012',
    };

    const result = await executeTool('prepareOrder', {
      productId: '507f1f77bcf86cd799439013',
      quantity: 1,
    }, context);

    expect(result.state).toBe('PENDING_CONFIRMATION');
    expect(context.pendingOrder).toEqual(expect.objectContaining({
      state: 'PENDING_CONFIRMATION',
      product: expect.objectContaining({ id: '507f1f77bcf86cd799439013' }),
    }));
  });
});
