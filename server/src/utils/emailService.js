const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const logger = require('../config/logger');

// Initialize email service based on environment
const emailService = process.env.EMAIL_SERVICE === 'resend' ? 'resend' : 'nodemailer';

let transporter;
let resend;

// Initialize Nodemailer transporter
if (emailService === 'nodemailer' && process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
}

// Initialize Resend
if (emailService === 'resend') {
  resend = new Resend(process.env.RESEND_API_KEY);
}

// Generic email sending function
const sendEmail = async (to, subject, html, text = null) => {
  try {
    if (emailService === 'resend') {
      const { data, error } = await resend.emails.send({
        from: process.env.FROM_EMAIL || process.env.RESEND_FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      });
      
      if (error) {
        logger.error('Resend email error:', error);
        throw error;
      }
      
      logger.info(`Email sent via Resend to ${to}: ${subject}`);
      return data;
    } else {
      if (!transporter) {
        const err = new Error('Email transport not configured (missing SMTP_HOST or EMAIL_SERVICE config)');
        err.code = 'EMAIL_NOT_CONFIGURED';
        throw err;
      }
      const mailOptions = {
        from: process.env.FROM_EMAIL,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text,
      };
      
      const result = await transporter.sendMail(mailOptions);
      logger.info(`Email sent via Nodemailer to ${to}: ${subject}`);
      return result;
    }
  } catch (error) {
    logger.error('Email sending failed:', error);
    throw error;
  }
};

// Password reset email
const sendPasswordResetEmail = async (email, token, userName) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset - TechFest Management</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello ${userName},</p>
          <p>You requested a password reset for your TechFest Management Portal account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">${resetUrl}</p>
          <div class="warning">
            <strong>Important:</strong> This link will expire in 1 hour for security reasons. If you didn't request this password reset, please ignore this email.
          </div>
          <p>If you have any issues, please contact the support team.</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>TechFest Management Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Password Reset Request
    
    Hello ${userName},
    
    You requested a password reset for your TechFest Management Portal account.
    
    Click the link below to reset your password:
    ${resetUrl}
    
    This link will expire in 1 hour for security reasons. If you didn't request this password reset, please ignore this email.
    
    If you have any issues, please contact the support team.
    
    Best regards,
    TechFest Management Team
  `;

  return sendEmail(email, 'Password Reset - TechFest Management', html, text);
};

// Email verification email
const sendEmailVerificationEmail = async (email, token, userName) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Email Verification - TechFest Management</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verification</h1>
        </div>
        <div class="content">
          <p>Welcome to TechFest Management Portal, ${userName}!</p>
          <p>Thank you for registering. Please verify your email address to activate your account.</p>
          <p>Click the button below to verify your email:</p>
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email</a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">${verificationUrl}</p>
          <div class="info">
            <strong>Note:</strong> This link will expire in 24 hours. If you didn't create an account, please ignore this email.
          </div>
          <p>If you have any issues, please contact the support team.</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>TechFest Management Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Email Verification
    
    Welcome to TechFest Management Portal, ${userName}!
    
    Thank you for registering. Please verify your email address to activate your account.
    
    Click the link below to verify your email:
    ${verificationUrl}
    
    This link will expire in 24 hours. If you didn't create an account, please ignore this email.
    
    If you have any issues, please contact the support team.
    
    Best regards,
    TechFest Management Team
  `;

  return sendEmail(email, 'Email Verification - TechFest Management', html, text);
};

// Bulk user creation email
const sendBulkUserCredentialsEmail = async (email, userName, temporaryPassword, role) => {
  const loginUrl = `${process.env.CLIENT_URL}/login`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to TechFest Management Portal</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .credentials { background: #e8f5e8; border: 1px solid #c3e6c3; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to TechFest Management Portal</h1>
        </div>
        <div class="content">
          <p>Hello ${userName},</p>
          <p>Your account has been created for the TechFest Management Portal with the role of <strong>${role}</strong>.</p>
          
          <div class="credentials">
            <h3>Your Login Credentials:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 5px; border-radius: 3px;">${temporaryPassword}</code></p>
          </div>
          
          <p>Click the button below to login:</p>
          <div style="text-align: center;">
            <a href="${loginUrl}" class="button">Login to Portal</a>
          </div>
          
          <div class="warning">
            <strong>Important:</strong> Please change your password after your first login for security reasons.
          </div>
          
          <p>If you have any issues accessing your account, please contact the support team.</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>TechFest Management Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Welcome to TechFest Management Portal
    
    Hello ${userName},
    
    Your account has been created for the TechFest Management Portal with the role of ${role}.
    
    Your Login Credentials:
    Email: ${email}
    Temporary Password: ${temporaryPassword}
    
    Login URL: ${loginUrl}
    
    Important: Please change your password after your first login for security reasons.
    
    If you have any issues accessing your account, please contact the support team.
    
    Best regards,
    TechFest Management Team
  `;

  return sendEmail(email, 'Welcome to TechFest Management Portal', html, text);
};

// Referral invitation email
const sendReferralInvitationEmail = async (email, referrerName, referralCode) => {
  const registrationUrl = `${process.env.CLIENT_URL}/register?ref=${referralCode}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invitation to Join TechFest Management Portal</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        .invitation { background: #e8f5e8; border: 1px solid #c3e6c3; padding: 20px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>You're Invited!</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <div class="invitation">
            <p><strong>${referrerName}</strong> has invited you to join the TechFest Management Portal!</p>
            <p>TechFest is an exciting event where you can participate in various competitions, workshops, and activities.</p>
          </div>
          
          <p>Click the button below to register:</p>
          <div style="text-align: center;">
            <a href="${registrationUrl}" class="button">Register Now</a>
          </div>
          
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; background: #e9ecef; padding: 10px; border-radius: 5px;">${registrationUrl}</p>
          
          <p>Your referral code: <strong>${referralCode}</strong></p>
          
          <p>If you have any questions, feel free to reach out to ${referrerName} or our support team.</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>TechFest Management Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    You're Invited!
    
    Hello,
    
    ${referrerName} has invited you to join the TechFest Management Portal!
    
    TechFest is an exciting event where you can participate in various competitions, workshops, and activities.
    
    Register here: ${registrationUrl}
    
    Your referral code: ${referralCode}
    
    If you have any questions, feel free to reach out to ${referrerName} or our support team.
    
    Best regards,
    TechFest Management Team
  `;

  return sendEmail(email, 'Invitation to Join TechFest Management Portal', html, text);
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
  sendBulkUserCredentialsEmail,
  sendReferralInvitationEmail,
};