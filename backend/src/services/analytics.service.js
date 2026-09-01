const Order = require('../models/Order');
const AgentAction = require('../models/AgentAction');

const getMerchantAnalytics = async (merchantId, dateFilter = null) => {
  const dateQuery = dateFilter?.startDate || dateFilter?.endDate ? {} : null;
  if (dateQuery) {
    if (dateFilter.startDate) dateQuery.$gte = new Date(dateFilter.startDate);
    if (dateFilter.endDate) { const endDate = new Date(dateFilter.endDate); endDate.setDate(endDate.getDate() + 1); dateQuery.$lt = endDate; }
  }
  const query = { merchantId, status: { $in: ['COMPLETED', 'PAID'] }, paymentStatus: { $in: ['DEMO_PAID', 'PAID'] } };
  if (dateQuery) query.createdAt = dateQuery;
  const successfulOrders = await Order.find(query).lean();
  const items = successfulOrders.flatMap((order) => order.items || []);
  const totalRevenue = successfulOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const originalRevenue = items.filter((item) => item.source === 'customer' || !item.source).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const crossSellRevenue = items.filter((item) => item.source === 'ai_cross_sell').reduce((sum, item) => sum + Number(item.aiIncrementalAmount || (item.price || 0) * (item.quantity || 0)), 0);
  const upsellRevenue = items.filter((item) => item.source === 'ai_upsell').reduce((sum, item) => sum + Number(item.aiIncrementalAmount || 0), 0);
  const aiIncrementalRevenue = crossSellRevenue + upsellRevenue;
  const aiAssistedOrders = successfulOrders.filter((order) => (order.items || []).some((item) => ['ai_cross_sell', 'ai_upsell'].includes(item.source)));
  const actionQuery = { merchantId, action: { $in: ['CROSS_SELL_RECOMMENDED', 'UPSELL_RECOMMENDED', 'CROSS_SELL_ACCEPTED', 'UPSELL_ACCEPTED', 'CROSS_SELL_REJECTED', 'UPSELL_REJECTED'] } };
  if (dateQuery) actionQuery.createdAt = dateQuery;
  const actions = await AgentAction.find(actionQuery).lean();
  const shown = actions.filter((action) => action.action.endsWith('RECOMMENDED')).length;
  const accepted = actions.filter((action) => action.action.endsWith('ACCEPTED')).length;
  const rejected = actions.filter((action) => action.action.endsWith('REJECTED')).length;
  const safePercent = (value, total) => total ? Number(((value / total) * 100).toFixed(2)) : 0;
  return {
    totalSuccessfulOrders: successfulOrders.length,
    totalSuccessfulRevenue: totalRevenue,
    originalCustomerRevenue: originalRevenue,
    aiIncrementalRevenue,
    crossSellRevenue,
    upsellRevenue,
    recommendationsShown: shown,
    recommendationsAccepted: accepted,
    recommendationsRejected: rejected,
    recommendationConversionRate: safePercent(accepted, shown),
    averageOrderValue: successfulOrders.length ? totalRevenue / successfulOrders.length : 0,
    averageAiAssistedOrderValue: aiAssistedOrders.length ? aiAssistedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0) / aiAssistedOrders.length : 0,
    averageAiRevenuePerAiAssistedOrder: aiAssistedOrders.length ? aiIncrementalRevenue / aiAssistedOrders.length : 0,
    aiRevenueContributionPercentage: safePercent(aiIncrementalRevenue, totalRevenue),
  };
};

module.exports = { getMerchantAnalytics };
