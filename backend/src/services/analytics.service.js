const Order = require('../models/Order');
const Payment = require('../models/Payment');
const AgentAction = require('../models/AgentAction');

const successfulOrderQuery = (merchantId, dateQuery) => ({
  merchantId,
  status: { $in: ['COMPLETED', 'PAID'] },
  paymentStatus: 'PAID',
  ...(dateQuery ? { createdAt: dateQuery } : {}),
});

const buildDateQuery = (dateFilter) => {
  if (!dateFilter?.startDate && !dateFilter?.endDate) return null;
  const query = {};
  if (dateFilter.startDate) query.$gte = new Date(dateFilter.startDate);
  if (dateFilter.endDate) {
    const endDate = new Date(dateFilter.endDate);
    endDate.setDate(endDate.getDate() + 1);
    query.$lt = endDate;
  }
  return query;
};

const toPeriodKey = (date) => {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
};

const formatPeriod = (period) => {
  const [year, month] = period.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

const getMerchantAnalytics = async (merchantId, dateFilter = null) => {
  const dateQuery = buildDateQuery(dateFilter);
  const [successfulOrders, payments, actions] = await Promise.all([
    Order.find(successfulOrderQuery(merchantId, dateQuery)).lean(),
    Payment.find({ merchantId, ...(dateQuery ? { createdAt: dateQuery } : {}) }).lean(),
    AgentAction.find({
      merchantId,
      action: { $in: ['CROSS_SELL_RECOMMENDED', 'UPSELL_RECOMMENDED', 'CROSS_SELL_ACCEPTED', 'UPSELL_ACCEPTED', 'CROSS_SELL_REJECTED', 'UPSELL_REJECTED'] },
      ...(dateQuery ? { createdAt: dateQuery } : {}),
    }).lean(),
  ]);

  const items = successfulOrders.flatMap((order) => order.items || []);
  const totalRevenue = successfulOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const originalRevenue = items.filter((item) => item.source === 'customer' || !item.source).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const crossSellRevenue = items.filter((item) => item.source === 'ai_cross_sell').reduce((sum, item) => sum + Number(item.aiIncrementalAmount || (item.price || 0) * (item.quantity || 0)), 0);
  const upsellRevenue = items.filter((item) => item.source === 'ai_upsell').reduce((sum, item) => sum + Number(item.aiIncrementalAmount || 0), 0);
  const aiIncrementalRevenue = crossSellRevenue + upsellRevenue;
  const aiAssistedOrders = successfulOrders.filter((order) => (order.items || []).some((item) => ['ai_cross_sell', 'ai_upsell'].includes(item.source)));
  const successfulPayments = payments.filter((payment) => payment.verified && ['VERIFIED_SUCCESS', 'SUCCESS'].includes(payment.status));
  const failedPayments = payments.filter((payment) => ['FAILED', 'CANCELLED'].includes(payment.status));
  const upsellAccepted = actions.filter((action) => action.action === 'UPSELL_ACCEPTED').length;
  const crossSellAccepted = actions.filter((action) => action.action === 'CROSS_SELL_ACCEPTED').length;
  const recommendationsShown = actions.filter((action) => action.action.endsWith('RECOMMENDED')).length;
  const recommendationsAccepted = upsellAccepted + crossSellAccepted;
  const safePercent = (value, total) => total ? Number(((value / total) * 100).toFixed(2)) : 0;

  const revenueByPeriod = new Map();
  successfulOrders.forEach((order) => {
    const period = toPeriodKey(order.createdAt);
    const bucket = revenueByPeriod.get(period) || { period, revenueWithoutAi: 0, revenueWithAi: 0 };
    const orderTotal = Number(order.total || 0);
    const orderAiRevenue = (order.items || []).filter((item) => ['ai_cross_sell', 'ai_upsell'].includes(item.source)).reduce((sum, item) => sum + Number(item.aiIncrementalAmount || (item.source === 'ai_cross_sell' ? item.price || 0 : 0) * Number(item.quantity || 0)), 0);
    bucket.revenueWithoutAi += orderTotal - orderAiRevenue;
    bucket.revenueWithAi += orderTotal;
    revenueByPeriod.set(period, bucket);
  });

  const successfulPaymentRevenue = successfulPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paymentAttempts = successfulPayments.length + failedPayments.length;
  const averageOrderValueBeforeAi = successfulOrders.length ? originalRevenue / successfulOrders.length : 0;
  const averageOrderValueAfterAi = successfulOrders.length ? totalRevenue / successfulOrders.length : 0;

  return {
    totalSuccessfulOrders: successfulOrders.length,
    totalSuccessfulRevenue: totalRevenue,
    revenueBeforeAi: originalRevenue,
    revenueAfterAi: totalRevenue,
    originalCustomerRevenue: originalRevenue,
    aiIncrementalRevenue,
    totalAiAttributedRevenue: aiIncrementalRevenue,
    crossSellRevenue,
    upsellRevenue,
    aiAssistedOrders: aiAssistedOrders.length,
    aiConversionRate: safePercent(aiAssistedOrders.length, successfulOrders.length),
    averageOrderValueBeforeAi,
    averageOrderValueAfterAi,
    averageAiRevenuePerAiAssistedOrder: aiAssistedOrders.length ? aiIncrementalRevenue / aiAssistedOrders.length : 0,
    aiRevenueGrowthPercentage: safePercent(aiIncrementalRevenue, originalRevenue),
    aiRevenueContributionPercentage: safePercent(aiIncrementalRevenue, totalRevenue),
    recommendationsShown,
    recommendationsAccepted,
    recommendationsRejected: actions.filter((action) => action.action.endsWith('REJECTED')).length,
    recommendationConversionRate: safePercent(recommendationsAccepted, recommendationsShown),
    upsellRecommendationsAccepted: upsellAccepted,
    crossSellRecommendationsAccepted: crossSellAccepted,
    successfulRazorpayPayments: successfulPayments.length,
    failedRazorpayPayments: failedPayments.filter((payment) => payment.status === 'FAILED').length,
    cancelledRazorpayPayments: payments.filter((payment) => payment.status === 'CANCELLED').length,
    razorpayRevenue: successfulPaymentRevenue,
    successfulPaymentRate: paymentAttempts ? safePercent(successfulPayments.length, paymentAttempts) : null,
    revenueComparison: [...revenueByPeriod.values()].sort((a, b) => a.period.localeCompare(b.period)).map((bucket) => ({ ...bucket, label: formatPeriod(bucket.period) })),
  };
};

module.exports = { getMerchantAnalytics };
