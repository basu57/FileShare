const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Send email using nodemailer
 * @param {Object} options - Email options
 * @param {String} options.to - Recipient email
 * @param {String} options.subject - Email subject
 * @param {String} options.text - Plain text email content
 * @param {String} options.html - HTML email content
 */
const sendEmail = async (options) => {
  try {
    // Create a transporter
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Define email options
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent: ${info.messageId}`);
    
    return true;
  } catch (error) {
    logger.error(`Error sending email: ${error.message}`);
    return false;
  }
};

/**
 * Send OTP verification email
 * @param {String} email - Recipient email
 * @param {String} name - Recipient name
 * @param {String} otp - One-time password
 */
const sendOTPEmail = async (email, name, otp) => {
  const subject = 'Email Verification OTP';
  const text = `Hello ${name},\n\nYour OTP for email verification is: ${otp}\n\nThis OTP will expire in ${process.env.OTP_EXPIRE_MINUTES} minutes.\n\nRegards,\nSecure Doc Share Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333;">Email Verification</h2>
      <p>Hello ${name},</p>
      <p>Your OTP for email verification is:</p>
      <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
        ${otp}
      </div>
      <p>This OTP will expire in ${process.env.OTP_EXPIRE_MINUTES} minutes.</p>
      <p>If you did not request this OTP, please ignore this email.</p>
      <p>Regards,<br>Secure Doc Share Team</p>
    </div>
  `;

  return await sendEmail({ to: email, subject, text, html });
};

module.exports = {
  sendEmail,
  sendOTPEmail
};
