const express = require('express');
const { User } = require('../models/User');
const { sendBatchEmails } = require('../utils/resendMailer');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const logger = require('../config/logger');

const router = express.Router();

router.use(verifyToken);
router.use(requireRole('admin'));

/**
 * GET /api/emails/preview-targets
 * Preview which emails will be targeted by roles and teams.
 */
router.get('/preview-targets', async (req, res, next) => {
  try {
    const { roles, teams } = req.query;
    
    // Convert comma-separated strings to arrays if they exist
    const rolesArr = roles ? roles.split(',').filter(Boolean) : [];
    const teamsArr = teams ? teams.split(',').filter(Boolean) : [];

    if (rolesArr.length === 0 && teamsArr.length === 0) {
      return res.json({ success: true, emails: [], count: 0 });
    }

    const query = { $or: [] };
    
    if (rolesArr.length > 0) {
      query.$or.push({ role: { $in: rolesArr } });
    }
    
    if (teamsArr.length > 0) {
      query.$or.push({ teamId: { $in: teamsArr } });
      query.$or.push({ secondaryTeamIds: { $in: teamsArr } });
    }

    const users = await User.find(query).select('email').lean();
    const emails = Array.from(new Set(users.map(u => u.email).filter(Boolean).map(e => e.toLowerCase())));

    res.json({ 
      success: true, 
      emails,
      count: emails.length 
    });
  } catch (err) {
    next(err);
  }
});
/**
 * POST /api/emails/send-bulk
 * Target users by roles, teams, or specific emails.
 */
router.post('/send-bulk', async (req, res, next) => {
  try {
    const { roles, teams, specificEmails, subject, html } = req.body;

    if (!subject || !html) {
      return res.status(400).json({ success: false, message: 'Subject and HTML content are required' });
    }

    let targetEmails = new Set();

    // 1. Add specific emails if provided
    if (specificEmails && Array.isArray(specificEmails)) {
      specificEmails.forEach(email => {
        if (email && email.includes('@')) targetEmails.add(email.trim().toLowerCase());
      });
    }

    // 2. Query users based on roles and teams
    const query = { $or: [] };
    
    if (roles && roles.length > 0) {
      query.$or.push({ role: { $in: roles } });
    }
    
    if (teams && teams.length > 0) {
      query.$or.push({ teamId: { $in: teams } });
      query.$or.push({ secondaryTeamIds: { $in: teams } });
    }

    if (query.$or.length > 0) {
      const users = await User.find(query).select('email').lean();
      users.forEach(u => {
        if (u.email) targetEmails.add(u.email.toLowerCase());
      });
    }

    const emailList = Array.from(targetEmails);

    if (emailList.length === 0) {
      return res.status(400).json({ success: false, message: 'No recipients found matching the criteria' });
    }

    // Send in background to avoid timeout
    // Note: sendBatchEmails now returns a summary and logs internally
    sendBatchEmails(emailList, subject, html)
      .then((summary) => {
        logger.info(`Bulk email sequence finished. Success: ${summary.successCount}, Failures: ${summary.failureCount}`);
      })
      .catch(err => logger.error(`Bulk email background task failed: ${err.message}`));

    res.json({ 
      success: true, 
      message: `Mail sending initiated for ${emailList.length} recipients. Check server logs for per-recipient status if needed.`,
      recipientCount: emailList.length 
    });

  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/emails/test-batch
 * Test endpoint to verify batch sending with a small list of emails.
 */
router.get('/test-batch', async (req, res, next) => {
  try {
    const testEmails = (req.query.emails || '').split(',').filter(e => e.includes('@'));
    
    if (testEmails.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide comma-separated emails in the query param: ?emails=test1@example.com,test2@example.com' 
      });
    }

    const subject = "🧪 Batch Mail Test - Techfest 2026";
    const html = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #6366f1;">Email System Audit</h2>
        <p>This is a test to verify the reliability of individual sending, logging, and error handling.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #666;">Generated at: ${new Date().toLocaleString()}</p>
      </div>
    `;

    const summary = await sendBatchEmails(testEmails, subject, html);

    res.json({
      success: true,
      message: 'Test batch completed',
      results: summary
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;