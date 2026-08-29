const { parseBudgetConstraints, isBudgetSearch } = require('../services/agent/agentService');

describe('budget-aware natural language agent parsing', () => {
  test('extracts laptop budget constraints from natural language', () => {
    const parsed = parseBudgetConstraints('Find a laptop under ₹70,000');

    expect(parsed.category).toBe('laptop');
    expect(parsed.maxPrice).toBe(70000);
    expect(parsed.minPrice).toBeNull();
  });

  test('extracts phone budget constraints and detects the budget intent', () => {
    const parsed = parseBudgetConstraints('Show phones below ₹30,000');

    expect(parsed.category).toBe('phone');
    expect(parsed.maxPrice).toBe(30000);
    expect(isBudgetSearch('Show phones below ₹30,000')).toBe(true);
  });

  test('recognizes headphone queries without misclassifying them as phones', () => {
    const parsed = parseBudgetConstraints('Find headphones between ₹2,000 and ₹5,000');

    expect(parsed.category).toBe('headphone');
    expect(parsed.minPrice).toBe(2000);
    expect(parsed.maxPrice).toBe(5000);
  });

  test('supports around-price queries for a product category', () => {
    const parsed = parseBudgetConstraints('Show me laptops around ₹60,000');

    expect(parsed.category).toBe('laptop');
    expect(parsed.minPrice).toBeGreaterThan(0);
    expect(parsed.maxPrice).toBeGreaterThan(parsed.minPrice);
  });

  test('supports cheapest product queries as a budget sort intent', () => {
    const parsed = parseBudgetConstraints('Give me the cheapest laptop');

    expect(parsed.category).toBe('laptop');
    expect(parsed.sort).toBe('cheapest');
  });
});
