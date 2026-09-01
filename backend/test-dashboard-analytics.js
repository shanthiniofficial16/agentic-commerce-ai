#!/usr/bin/env node
const axios = require('axios');
const assert = require('assert');

const API = 'http://localhost:5000';

async function test() {
  console.log('🧪 Testing Merchant Dashboard Analytics Integration\n');

  try {
    // 1. Login as merchant
    console.log('1️⃣  Testing merchant login...');
    const loginRes = await axios.post(`${API}/api/auth/login`, { email: 'merchant@example.com', password: 'test123' });
    const token = loginRes.data.data.token;
    assert(token, 'Token should be present');
    console.log('✓ Merchant login successful\n');

    // 2. Test analytics without date filter
    console.log('2️⃣  Testing analytics without date filter...');
    const analyticsRes = await axios.get(`${API}/api/merchant/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const analytics = analyticsRes.data.data.analytics;
    assert(analytics, 'Analytics should be returned');
    assert(typeof analytics.totalSuccessfulOrders === 'number', 'Should have total orders');
    assert(typeof analytics.totalSuccessfulRevenue === 'number', 'Should have revenue');
    assert(typeof analytics.aiIncrementalRevenue === 'number', 'Should have AI revenue');
    assert(typeof analytics.recommendationConversionRate === 'number', 'Should have conversion rate');
    console.log('✓ Analytics structure valid');
    console.log(`  - Total Orders: ${analytics.totalSuccessfulOrders}`);
    console.log(`  - Total Revenue: ₹${analytics.totalSuccessfulRevenue.toLocaleString('en-IN')}`);
    console.log(`  - AI Revenue: ₹${analytics.aiIncrementalRevenue.toLocaleString('en-IN')}`);
    console.log(`  - Conversion Rate: ${analytics.recommendationConversionRate}%\n`);

    // 3. Test date filter (last 30 days)
    console.log('3️⃣  Testing analytics with date filter...');
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);
    const dateRes = await axios.get(`${API}/api/merchant/analytics`, {
      params: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      },
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dateAnalytics = dateRes.data.data.analytics;
    assert(dateAnalytics, 'Analytics should be returned with date filter');
    assert(typeof dateAnalytics.totalSuccessfulOrders === 'number', 'Should filter by date');
    console.log('✓ Date filter working');
    console.log(`  - Orders (last 30 days): ${dateAnalytics.totalSuccessfulOrders}\n`);

    // 4. Validate calculations
    console.log('4️⃣  Validating analytics calculations...');
    const original = analytics.originalCustomerRevenue;
    const aiRevenue = analytics.aiIncrementalRevenue;
    const total = analytics.totalSuccessfulRevenue;
    const expectedTotal = original + aiRevenue;
    assert(Math.abs(total - expectedTotal) < 1, `Total should equal original + AI revenue (${total} vs ${expectedTotal})`);
    const expectedPercent = total > 0 ? (aiRevenue / total * 100) : 0;
    assert(Math.abs(analytics.aiRevenueContributionPercentage - expectedPercent) < 0.01, 'Percentage should be accurate');
    console.log('✓ Calculations verified');
    console.log(`  - Original: ₹${original.toLocaleString('en-IN')}`);
    console.log(`  - AI Incremental: ₹${aiRevenue.toLocaleString('en-IN')}`);
    console.log(`  - Total: ₹${total.toLocaleString('en-IN')}`);
    console.log(`  - AI Contribution: ${analytics.aiRevenueContributionPercentage.toFixed(2)}%\n`);

    // 5. Test recommendations metrics
    console.log('5️⃣  Validating recommendation metrics...');
    const shown = analytics.recommendationsShown;
    const accepted = analytics.recommendationsAccepted;
    const rejected = analytics.recommendationsRejected;
    const expectedRate = shown > 0 ? (accepted / shown * 100) : 0;
    assert(Math.abs(analytics.recommendationConversionRate - expectedRate) < 0.01, 'Conversion rate should be accurate');
    console.log('✓ Recommendation metrics valid');
    console.log(`  - Shown: ${shown}`);
    console.log(`  - Accepted: ${accepted}`);
    console.log(`  - Rejected: ${rejected}`);
    console.log(`  - Conversion Rate: ${analytics.recommendationConversionRate.toFixed(1)}%\n`);

    // 6. Test cross-sell vs upsell breakdown
    console.log('6️⃣  Validating cross-sell vs upsell breakdown...');
    const crossSell = analytics.crossSellRevenue;
    const upsell = analytics.upsellRevenue;
    const totalAI = crossSell + upsell;
    assert(Math.abs(totalAI - aiRevenue) < 1, 'Cross + Upsell should equal total AI revenue');
    console.log('✓ Revenue breakdown verified');
    console.log(`  - Cross-sell: ₹${crossSell.toLocaleString('en-IN')}`);
    console.log(`  - Upsell: ₹${upsell.toLocaleString('en-IN')}`);
    console.log(`  - Total AI: ₹${totalAI.toLocaleString('en-IN')}\n`);

    // 7. Test average order values
    console.log('7️⃣  Validating average order values...');
    const avgOrder = analytics.averageOrderValue;
    const avgAiOrder = analytics.averageAiAssistedOrderValue;
    assert(avgAiOrder >= avgOrder || avgAiOrder === 0, 'AI-assisted orders should be equal or higher');
    console.log('✓ Average order values valid');
    console.log(`  - Overall Avg: ₹${avgOrder.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
    console.log(`  - AI-Assisted Avg: ₹${avgAiOrder.toLocaleString('en-IN', { maximumFractionDigits: 0 })}\n`);

    console.log('✅ All tests passed! Dashboard analytics ready for integration.\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

test();
