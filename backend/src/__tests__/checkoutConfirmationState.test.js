const { isConfirmationResponse, isCancellationResponse, parseConfirmationResponse } = require('../controllers/agent.controller');

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
});
