const cron = require('node-cron');
const { User } = require('../models/User');
const { PointsLedger } = require('../models/PointsLedger');
const Team = require('../models/Team');
const { sendEmail, sendBatchEmails } = require('../utils/resendMailer');
const logger = require('../config/logger');

/**
 * Build leaderboard HTML email.
 */
const buildLeaderboardEmail = (leaderboard) => {
  const rows = leaderboard
    .slice(0, 20) // top 20
    .map(
      (entry, i) =>
        `<tr style="border-bottom:1px solid #2d3a5a;">
          <td style="padding:10px 15px;color:${i === 0 ? '#facc15' : i === 1 ? '#d1d5db' : i === 2 ? '#d97706' : '#9ca3af'};font-weight:bold;">
            ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
          </td>
          <td style="padding:10px 15px;color:#f1f5f9;font-weight:600;">${entry.name}</td>
          <td style="padding:10px 15px;color:#9ca3af;">${entry.teamName || '—'}</td>
          <td style="padding:10px 15px;color:#818cf8;font-weight:bold;text-align:right;">${entry.totalPoints} pts</td>
        </tr>`
    )
    .join('');

  return `
    <div style="max-width:600px;margin:0 auto;background:#0f0f23;border-radius:12px;overflow:hidden;font-family:Arial,sans-serif;">
      <div style="background:linear-gradient(135deg,#6366f1,#ec4899);padding:25px 30px;">
        <h1 style="margin:0;color:white;font-size:22px;">🏆 Weekly Leaderboard</h1>
        <p style="margin:5px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">TechFest 2026 — Top performers this week</p>
      </div>
      <div style="padding:20px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid #6366f1;">
              <th style="padding:10px 15px;color:#818cf8;text-align:left;font-size:12px;text-transform:uppercase;">Rank</th>
              <th style="padding:10px 15px;color:#818cf8;text-align:left;font-size:12px;text-transform:uppercase;">Name</th>
              <th style="padding:10px 15px;color:#818cf8;text-align:left;font-size:12px;text-transform:uppercase;">Team</th>
              <th style="padding:10px 15px;color:#818cf8;text-align:right;font-size:12px;text-transform:uppercase;">Points</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${leaderboard.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">No points recorded yet — keep pushing!</p>' : ''}
      </div>
      <div style="padding:15px 30px;background:#1a1a2e;text-align:center;">
        <p style="margin:0;color:#6b7280;font-size:12px;">TechFest Management System · Weekly Digest</p>
      </div>
    </div>
  `;
};

/**
 * Start weekly leaderboard cron job.
 * Runs every Monday at 9:00 AM.
 */
const startWeeklyLeaderboardCron = () => {
  // Cron: At 09:00 on Monday
  cron.schedule('0 9 * * 1', async () => {
    logger.info('⏰ Running weekly leaderboard email cron...');

    try {
      // Build leaderboard
      const leaderboard = await User.aggregate([
        { $match: { role: { $in: ['volunteer', 'campus_ambassador'] }, isActive: true } },
        {
          $lookup: {
            from: 'pointsledgers',
            localField: '_id',
            foreignField: 'userId',
            as: 'pointsEntries',
          },
        },
        { $addFields: { totalPoints: { $sum: '$pointsEntries.points' } } },
        {
          $lookup: {
            from: 'teams',
            localField: 'teamId',
            foreignField: '_id',
            as: 'team',
          },
        },
        { $unwind: { path: '$team', preserveNullAndEmptyArrays: true } },
        { $sort: { totalPoints: -1 } },
        {
          $project: {
            name: 1,
            email: 1,
            role: 1,
            teamName: '$team.name',
            totalPoints: 1,
          },
        },
      ]);

      // Get all active users' emails
      const allUsers = await User.find({ isActive: true }).select('email');
      const emails = allUsers.map((u) => u.email).filter(Boolean);

      if (emails.length === 0) {
        logger.info('No active users to email');
        return;
      }

      const html = buildLeaderboardEmail(leaderboard);

      await sendBatchEmails(emails, '🏆 TechFest Weekly Leaderboard', html);

      logger.info(`Weekly leaderboard email sent to ${emails.length} users`);
    } catch (err) {
      logger.error('Weekly leaderboard cron failed:', err.message);
    }
  });

  logger.info('📅 Weekly leaderboard cron scheduled (Mondays at 9:00 AM)');
};

module.exports = { startWeeklyLeaderboardCron };