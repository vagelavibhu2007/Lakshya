const { Resend } = require('resend');
const logger = require('../config/logger');

let resendClient = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getClient = () => {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn('RESEND_API_KEY not set — email sending disabled.');
    return null;
  }
  resendClient = new Resend(key);
  return resendClient;
};

/**
 * Send an email using Resend with retry logic for rate limits.
 * @param {Object} opts
 * @param {string|string[]} opts.to - Recipient(s)
 * @param {string} opts.subject - Email subject
 * @param {string} opts.html - HTML content
 * @param {number} [retryCount=0] - Current retry attempt
 * @returns {Promise<{data: any, error: any}>}
 */
const sendEmail = async ({ to, subject, html }, retryCount = 0) => {
  const client = getClient();
  if (!client) return { data: null, error: { message: 'Resend client not initialized' } };

  const from = 'noreply@mail.lakshya-mngt.online';
  const textFallback = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  try {
    const response = await client.emails.send({
      from: `Lakshya <${from}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: textFallback,
    });

    // Handle Rate Limit (429)
    if (response.error && (response.error.statusCode === 429 || response.error.name === 'rate_limit_exceeded')) {
      if (retryCount < 3) {
        const backoff = 2000 * (retryCount + 1); // 2 seconds as requested
        logger.warn(`Rate limit hit for ${to}. Retrying in ${backoff}ms... (Attempt ${retryCount + 1}/3)`);
        await sleep(backoff);
        return sendEmail({ to, subject, html }, retryCount + 1);
      }
    }

    return response;
  } catch (err) {
    // Some errors might throw instead of returning an error object
    if (err.statusCode === 429 || err.name === 'rate_limit_exceeded') {
      if (retryCount < 3) {
        const backoff = 2000 * (retryCount + 1);
        logger.warn(`Rate limit exception for ${to}. Retrying in ${backoff}ms... (Attempt ${retryCount + 1}/3)`);
        await sleep(backoff);
        return sendEmail({ to, subject, html }, retryCount + 1);
      }
    }
    return { data: null, error: { message: err.message } };
  }
};

/**
 * Send emails to multiple recipients individually with full logging, summary, and rate limiting.
 * @param {string[]} emailList
 * @param {string} subject
 * @param {string} html
 * @returns {Promise<Object>} Summary of the operation
 */
const sendBatchEmails = async (emailList, subject, html) => {
  const summary = {
    successCount: 0,
    failureCount: 0,
    failures: []
  };

  if (!emailList || !emailList.length) {
    logger.warn('sendBatchEmails called with empty list');
    return summary;
  }

  logger.info(`Starting rate-limited batch send to ${emailList.length} recipients...`);

  // Use for...of loop with await as requested for maximum reliability/debugging per email
  for (const email of emailList) {
    const { data, error } = await sendEmail({ to: email, subject, html });

    if (error) {
      summary.failureCount++;
      summary.failures.push({ email, error: error.message || 'Unknown error' });
      logger.error(`[FAIL] Recipient: ${email} | Error: ${error.message}${error.statusCode ? ` | Status: ${error.statusCode}` : ''}`);
    } else {
      summary.successCount++;
      logger.info(`[SUCCESS] Recipient: ${email} | ID: ${data.id} | Status: 200`);
    }

    // IMPORTANT: Respect Resend rate limit (max 2/sec)
    // 600ms = ~1.6 emails/sec (safe buffer below 2/sec limit)
    await sleep(700 + Math.random() * 200);
  }

  logger.info(`Batch complete! Success: ${summary.successCount}, Failures: ${summary.failureCount}`);
  return summary;
};

module.exports = { sendEmail, sendBatchEmails };