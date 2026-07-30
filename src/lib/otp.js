import { verifyAuthOtp, resendAuthOtp } from '@/lib/authSessionSecurity';

export async function verifyOtpWithPurpose({ email, otpCode, purpose = 'login' }) {
  return verifyAuthOtp({ email, otpCode, purpose });
}

export async function resendOtpWithPurpose(email, purpose = 'login') {
  return resendAuthOtp(email, purpose);
}
