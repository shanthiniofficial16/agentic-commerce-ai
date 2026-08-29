const { getUserFacingErrorMessage } = require('../utils/errorMessageMap');

describe('user facing error mapping', () => {
  test('maps catalog and auth failures to safe messages', () => {
    expect(getUserFacingErrorMessage('PRODUCT_NOT_FOUND')).toContain('catalog');
    expect(getUserFacingErrorMessage('OUT_OF_STOCK')).toContain('out of stock');
    expect(getUserFacingErrorMessage('INVALID_TOKEN')).toContain('sign in');
    expect(getUserFacingErrorMessage('AI_PROVIDER_ERROR')).toContain('temporarily unavailable');
  });

  test('falls back to a generic safe message for unknown errors', () => {
    expect(getUserFacingErrorMessage('UNEXPECTED_ERROR')).toContain('Something went wrong');
  });
});
