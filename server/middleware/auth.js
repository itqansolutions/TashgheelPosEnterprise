const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');

module.exports = async function (req, res, next) {
    const token = req.header('x-auth-token');
    if (!token) return res.status(401).json({ msg: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
        req.user = decoded.user;
        req.tenantId = decoded.user.tenantId;

        // Check subscription/trial status
        const tenant = await Tenant.findById(req.tenantId);
        if (!tenant) return res.status(401).json({ msg: 'Tenant not found' });

        const now = new Date();
        if (!tenant.isSubscribed && now > tenant.trialEndsAt) {
            console.warn(`Trial expired for tenant ${tenant._id}. Trial ended ${tenant.trialEndsAt}`);
            return res.status(403).json({ msg: 'Trial expired. Please subscribe.', code: 'TRIAL_EXPIRED' });
        }

        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
