import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ShieldCheck, X } from 'lucide-react';
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
    await sleep(shouldReduceMotion ? 80 : 760);
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
      await sleep(shouldReduceMotion ? 120 : 1350);

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

  const mediumTransition = {
    duration: shouldReduceMotion ? 0.01 : 0.46,
    ease: [0.22, 1, 0.36, 1],
  };
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
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
          transition={mediumTransition}
          className="text-center"
        >
          <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/[0.08] px-3 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-accent">
            <ShieldCheck size={11} /> Secure OTP verification
          </div>
          <h1 className="font-heading text-2xl font-black">
            {isSuccess ? successTitle : title}
          </h1>
          <p className="mt-1.5 break-words text-sm leading-relaxed text-muted-foreground">
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
              exit={{ opacity: 0, scaleX: 0.24, scaleY: 0.76, filter: 'blur(3px)' }}
              transition={mediumTransition}
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
              initial={{ opacity: 0, scale: 0.55, rotate: -30 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.76 }}
              transition={mediumTransition}
              aria-label="Verifying code"
            >
              <motion.div
                className="otp-loader-outline"
                animate={shouldReduceMotion ? undefined : { rotate: 360 }}
                transition={{ duration: 1.25, ease: 'linear', repeat: Infinity }}
              />
              {!shouldReduceMotion && [0, 1, 2].map((dot) => (
                <motion.span
                  key={dot}
                  className="absolute h-1.5 w-1.5 rounded-full bg-accent"
                  animate={{
                    x: [0, Math.cos((dot * Math.PI * 2) / 3) * 39, 0],
                    y: [0, Math.sin((dot * Math.PI * 2) / 3) * 39, 0],
                    opacity: [0.2, 0.9, 0.2],
                    scale: [0.7, 1, 0.7],
                  }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: dot * 0.18, ease: 'easeInOut' }}
                />
              ))}
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
                : { type: 'spring', stiffness: 260, damping: 24 }}
              aria-label="Verification successful"
            >
              <motion.span
                className="otp-success-glow"
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: [0, 0.82, 0.46], scale: [0.2, 1, 1.2] }}
                transition={{ duration: shouldReduceMotion ? 0.01 : 1.05, ease: 'easeOut' }}
              />
              <motion.span
                className="otp-success-check"
                initial={{ rotate: -18, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: shouldReduceMotion ? 0.01 : 0.48, ease: [0.22, 1, 0.36, 1] }}
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
          className="font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
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
