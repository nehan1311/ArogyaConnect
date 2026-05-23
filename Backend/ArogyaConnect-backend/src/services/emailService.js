const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};

const sendPasswordResetEmail = async (email, resetURL) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin-bottom: 16px;">Telehealth Password Reset</h2>
      <p>We received a request to reset your password.</p>
      <p>This link is valid for 10 minutes.</p>
      <p>
        <a href="${resetURL}" style="color: #2563eb;">Reset your password</a>
      </p>
      <p>If you did not request this, you can safely ignore this email.</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: "Telehealth — Password Reset Request",
    html,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  isEmailConfigured: () =>
    !!(
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    ),
};
