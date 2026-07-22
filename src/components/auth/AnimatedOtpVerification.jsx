import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';

import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const sleep = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

async function playHaptic(type) {
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({
      type: type === 'success' ? NotificationType.Success : NotificationType.Error,
    });
  } catch {
    // Haptics are an enhancement and are unavailable in a regular browser.
  }
}

/**
 * OTP entry that morphs into a verification loader and then a success check.
 * Verification starts only after every digit is present and the success state is
 * shown only after the server accepts the code.
 */
export default function AnimatedOtpVerification({
  value,
  onChange,
  onVerify,
  onVerified,
  onError,
  onResend,
  resendDisabled = false,
  resendLabel = 'Resend',
  destination,
  codeLength = 6,
  notice = '',
  title = "Let's verify your email",
  successTitle = 'Verified successfully',
  successDescription = 'Your email has been verified.',
}) {
  const shouldReduceMotion = useReducedMotion();
  const [phase, setPhase] = useState('input');
  const [isResending, setIsResending] = useState(false);
  const mountedRef = useRef(true);
  const attemptRef = useRef('');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resetAfterError = useCallback(async () => {
    await sleep(shouldReduceMotion ? 80 : 520);
    if (!mountedRef.current) return;
    attemptRef.current = '';
    onChange('');
    setPhase('input');
  }, [onChange, shouldReduceMotion]);

  const verify = useCallback(async (code) => {
    if (phase !== 'input' || attemptRef.current === code) return;

    attemptRef.current = code;
    setPhase('verifying');

    try {
      const result = await onVerify(code);
      if (!mountedRef.current) return;

      setPhase('success');
      void playHaptic('success');
      await sleep(shouldReduceMotion ? 120 : 900);

      if (mountedRef.current) await onVerified?.(result);
    } catch (error) {
      if (!mountedRef.current) return;
      setPhase('error');
      void playHaptic('error');
      onError?.(error);
      await resetAfterError();
    }
  }, [onError, onVerified, onVerify, phase, resetAfterError, shouldReduceMotion]);

  const handleChange = useCallback((nextValue) => {
    if (phase !== 'input') return;
    onChange(nextValue);
    if (nextValue.length === codeLength) void verify(nextValue);
  }, [codeLength, onChange, phase, verify]);

  const handleResend = useCallback(async () => {
    if (!onResend || resendDisabled || isResending || phase !== 'input') return;
    setIsResending(true);
    try {
      await onResend();
      if (mountedRef.current) {
        attemptRef.current = '';
        onChange('');
      }
    } catch (error) {
      if (mountedRef.current) onError?.(error);
    } finally {
      if (mountedRef.current) setIsResending(false);
    }
  }, [isResending, onChange, onError, onResend, phase, resendDisabled]);

  const fastTransition = { duration: shouldReduceMotion ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] };
  const isSuccess = phase === 'success';

  return (
    <section
      className={`otp-verification-panel otp-phase-${phase}`}
      aria-busy={phase === 'verifying'}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isSuccess ? 'success-copy' : 'verification-copy'}
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -6 }}
          transition={fastTransition}
          className="text-center"
        >
          <h1 className="font-heading font-bold text-2xl">
            {isSuccess ? successTitle : title}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5 break-words">
            {isSuccess
              ? successDescription
              : `Enter the ${codeLength}-digit code sent to ${destination}`}
          </p>
        </motion.div>
      </AnimatePresence>

      <div className="otp-motion-stage">
        <AnimatePresence mode="wait" initial={false}>
          {(phase === 'input' || phase === 'error') && (
            <motion.div
              key="otp-input"
              layoutId="otp-verification-core"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={phase === 'error'
                ? { opacity: 1, scale: 1, x: shouldReduceMotion ? 0 : [0, -9, 8, -6, 4, 0] }
                : { opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scaleX: 0.2, scaleY: 0.72, filter: 'blur(3px)' }}
              transition={fastTransition}
            >
              <InputOTP
                maxLength={codeLength}
                value={value}
                onChange={handleChange}
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern={REGEXP_ONLY_DIGITS}
                disabled={phase !== 'input'}
                containerClassName="otp-motion-group"
                aria-label={`${codeLength}-digit verification code`}
              >
                <InputOTPGroup className="otp-motion-group">
                  {Array.from({ length: codeLength }, (_, index) => (
                    <InputOTPSlot key={index} index={index} className="otp-motion-slot" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </motion.div>
          )}

          {phase === 'verifying' && (
            <motion.div
              key="otp-loader"
              layoutId="otp-verification-core"
              className="otp-loader-shell"
              initial={{ opacity: 0, scale: 0.55, rotate: -35 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.72 }}
              transition={fastTransition}
              aria-label="Verifying code"
            >
              <motion.div
                className="otp-loader-outline"
                animate={shouldReduceMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 0.82, ease: 'linear', repeat: Infinity }}
              />
              <span className="otp-loader-dot" />
            </motion.div>
          )}

          {phase === 'success' && (
            <motion.div
              key="otp-success"
              layoutId="otp-verification-core"
              className="otp-success-shell"
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={shouldReduceMotion
                ? { duration: 0.01 }
                : { type: 'spring', stiffness: 420, damping: 24 }}
              aria-label="Verification successful"
            >
              <motion.span
                className="otp-success-glow"
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: [0, 0.85, 0.5], scale: [0.2, 1, 1.18] }}
                transition={{ duration: shouldReduceMotion ? 0.01 : 0.72, ease: 'easeOut' }}
              />
              <motion.span
                className="otp-success-check"
                initial={{ rotate: -20 }}
                animate={{ rotate: 0 }}
              >
                <Check size={27} strokeWidth={3.2} />
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'error' && (
          <motion.span
            className="otp-error-badge"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
          >
            <X size={15} strokeWidth={3} />
          </motion.span>
        )}
      </div>

      <div className={`otp-resend-row ${isSuccess ? 'invisible' : ''}`}>
        <span>Didn't receive the code?</span>{' '}
        <button
          type="button"
          onClick={handleResend}
          disabled={!onResend || resendDisabled || isResending || phase !== 'input'}
          className="text-accent font-semibold hover:underline disabled:text-muted-foreground disabled:no-underline disabled:cursor-not-allowed"
        >
          {isResending ? 'Sending...' : resendLabel}
        </button>
      </div>

      {notice && phase === 'input' && (
        <p className="otp-notice" role="status">{notice}</p>
      )}
    </section>
  );
}
