const twilio = require("twilio");

const isSMSConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER
  );

const getTwilioClient = () =>
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) {
    return phoneNumber;
  }

  const trimmedPhone = phoneNumber.trim();

  if (trimmedPhone.startsWith("+")) {
    return trimmedPhone;
  }

  return `+91${trimmedPhone}`;
};

const sendSMS = async ({ to, message }) => {
  const formattedTo = formatPhoneNumber(to);
  const response = await getTwilioClient().messages.create({
    body: message,
    from: process.env.TWILIO_FROM_NUMBER,
    to: formattedTo,
  });

  return response.sid;
};

module.exports = {
  sendSMS,
  isSMSConfigured,
};
