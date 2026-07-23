import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ShieldCheck, Sparkles } from 'lucide-react';

export default function AuthExperienceShell({
  children,
  onBack,
  icon: Icon,
  title,
  subtitle,
  roleLabel,
  footer,
  compact = false,
}) {
  const reduceMotion = useReducedMotion();
  const float = reduceMotion
    ? {}
    : { y: [0, -14, 0], x: [0, 8, 0], scale: [1, 1.04, 1] };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-5 pb-10 text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/[0.10] blur-3xl"
          animate={float}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-28 top-1/3 h-72 w-72 rounded-full bg-purple-500/[0.07] blur-3xl"
          animate={reduceMotion ? {} : { y: [0, 18, 0], x: [0, -10, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
        />
        <div className="absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,hsl(var(--accent)/0.06),transparent)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col">
        <header className="flex items-center justify-between gap-3 pb-5 pt-[max(2.5rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Go back"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-card/85 text-muted-foreground backdrop-blur transition-all hover:text-foreground active:scale-95"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="truncate font-display text-xl font-black tracking-tight">
              SE<span className="text-accent">7</span>EN <span className="text-accent">FIT</span>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-muted-foreground backdrop-blur">
            <ShieldCheck size={11} className="text-accent" /> Secure access
          </span>
        </header>

        <motion.main
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.55, ease: [0.22, 1, 0.36, 1] }}
          className={`flex flex-1 flex-col ${compact ? 'justify-center pb-8' : 'pb-4'}`}
        >
          {(Icon || title || subtitle) && (
            <section className="mb-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                {Icon ? (
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-accent/25 bg-accent/[0.10] text-accent shadow-[0_14px_38px_rgba(34,197,94,0.10)]"
                    animate={reduceMotion ? {} : { rotate: [0, 2, -2, 0], scale: [1, 1.03, 1] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Icon size={25} />
                  </motion.div>
                ) : <span />}
                {roleLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/[0.08] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-accent">
                    <Sparkles size={11} /> {roleLabel}
                  </span>
                )}
              </div>
              {title && <h1 className="font-heading text-3xl font-black tracking-tight">{title}</h1>}
              {subtitle && <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
            </section>
          )}

          <section className="rounded-[28px] border border-border bg-card/90 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6">
            {children}
          </section>

          {footer && <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>}
        </motion.main>
      </div>
    </div>
  );
}
