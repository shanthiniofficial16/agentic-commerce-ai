const Merchant = require('../models/Merchant');
const { getMerchantAnalytics } = require('../services/analytics.service');

const getAnalytics = async (req, res) => {
  try {
    const merchant = await Merchant.findOne({ userId: req.userId, isActive: true }).select('_id').lean();
    if (!merchant) return res.status(404).json({ success: false, error: { code: 'MERCHANT_NOT_FOUND', message: 'Merchant profile not found' } });
    const { startDate, endDate } = req.query;
    const dateFilter = startDate || endDate ? { startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null } : null;
    const analytics = await getMerchantAnalytics(merchant._id, dateFilter);
    return res.json({ success: true, data: { analytics } });
  } catch (error) {
    return res.status(500).json({ success: false, error: { code: 'ANALYTICS_FAILED', message: 'Analytics could not be loaded' } });
  }
};

module.exports = { getAnalytics };
