// Generate 6 digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// OTP expiry - 5 minutes from now
const getOTPExpiry = () => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 5);
  return expiry;
};

// For now we console log OTP (later replace with Twilio/MSG91)
const sendOTP = async (phone, otp) => {
  console.log(`📱 OTP for ${phone}: ${otp}`);
  // TODO: Integrate MSG91 or Twilio here
  return true;
};

module.exports = { generateOTP, getOTPExpiry, sendOTP };