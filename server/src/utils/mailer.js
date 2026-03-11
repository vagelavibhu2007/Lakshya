const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    logger.warn('SMTP not configured — email sending disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
};

/**
 * Send an email.
 * @param {Object} opts
 * @param {string|string[]} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 * @param {string} [opts.text]
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const t = getTransporter();
  if (!t) {
    logger.warn('Email skipped (SMTP not configured)');
    return null;
  }

  const recipients = Array.isArray(to) ? to.join(', ') : to;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    const info = await t.sendMail({ from, to: recipients, subject, html, text });
    logger.info(`Email sent: ${info.messageId} → ${recipients}`);
    return info;
  } catch (err) {
    logger.error(`Email failed: ${err.message}`);
    throw err;
  }
};

module.exports = { sendEmail, getTransporter };