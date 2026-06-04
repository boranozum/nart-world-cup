'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Check, Goal, MessageCircle, X, Zap } from 'lucide-react';
import { checkUsername, completeOnboarding } from './actions';

type Slide = { icon: typeof Goal; title: string; body: string };

const SLIDES: Slide[] = [
  {
    icon: Goal,
    title: 'Predict every match',
    body: 'Call the score, the first team to score, the minute of the first goal, and the Man of the Match — before kickoff.',
  },
  {
    icon: Zap,
    title: 'Rack up points',
    body: 'Nail the result for +3, the exact first-goal minute for +8, and more. Spend your 5 ×2 Boosters wisely — they last the whole tournament.',
  },
  {
    icon: MessageCircle,
    title: 'One league, all of TechNarts',
    body: 'Climb a single shared table, watch the match-day reveal, and talk trash in the comments — tag colleagues with @.',
  },
];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function OnboardingFlow({
  email,
  suggestedUsername,
  initialAvatarUrl,
}: {
  email: string;
  suggestedUsername: string;
  initialAvatarUrl: string | null;
}) {
  // step 0 = profile, 1..SLIDES.length = slides
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(suggestedUsername);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl);
  const [checked, setChecked] = useState<{ name: string; available: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const validFormat = USERNAME_RE.test(username);

  // Debounced availability check — only sets state inside the async callback.
  useEffect(() => {
    if (!validFormat) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { available } = await checkUsername(username);
      if (!cancelled) setChecked({ name: username, available });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, validFormat]);

  // Derive availability status during render (avoids setState-in-effect).
  const avail: 'idle' | 'invalid' | 'checking' | 'ok' | 'taken' =
    username.length === 0
      ? 'idle'
      : !validFormat
        ? 'invalid'
        : checked && checked.name === username
          ? checked.available
            ? 'ok'
            : 'taken'
          : 'checking';

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set('username', username);
    if (avatarFile) fd.set('avatar', avatarFile);
    if (initialAvatarUrl && !avatarFile) fd.set('avatarUrl', initialAvatarUrl);
    startTransition(async () => {
      const res = await completeOnboarding(fd);
      if (res?.error) {
        setError(res.error);
        setStep(0);
      }
      // success redirects server-side
    });
  }

  const totalSteps = SLIDES.length + 1;
  const canContinueProfile = avail === 'ok';

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-primary-strong text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1100px 560px at 12% -10%, #3b4daf55, transparent 60%), radial-gradient(900px 500px at 112% 18%, #f3712333, transparent 55%)',
        }}
      />

      {/* progress dots */}
      <div className="relative z-10 flex items-center justify-center gap-2 pt-8">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === step ? 'w-7 bg-accent' : i < step ? 'w-4 bg-white/60' : 'w-4 bg-white/20'
            }`}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-10">
        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-sm text-center"
            >
              <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight">
                Set up your profile
              </h1>
              <p className="mt-2 text-sm text-white/60">{email}</p>

              {/* avatar */}
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="group relative size-28 overflow-hidden rounded-full ring-2 ring-white/20 transition hover:ring-accent"
                >
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center bg-white/10 font-display text-4xl font-bold">
                      {(username || email)[0]?.toUpperCase()}
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/45 py-1.5 text-[11px] font-medium opacity-0 transition group-hover:opacity-100">
                    <Camera className="size-3.5" /> Change
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={pickAvatar}
                />
              </div>

              {/* username */}
              <div className="mt-8 text-left">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/60">
                  Username
                </label>
                <div className="relative">
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="your_handle"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 pr-10 font-medium outline-none transition placeholder:text-white/30 focus:border-accent focus:bg-white/10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {avail === 'ok' && <Check className="size-5 text-success" />}
                    {(avail === 'taken' || avail === 'invalid') && (
                      <X className="size-5 text-danger" />
                    )}
                  </span>
                </div>
                <p className="mt-1.5 h-4 text-xs">
                  {avail === 'checking' && <span className="text-white/40">Checking…</span>}
                  {avail === 'taken' && <span className="text-danger">Already taken</span>}
                  {avail === 'invalid' && (
                    <span className="text-white/40">3–20 letters, numbers or underscores</span>
                  )}
                  {avail === 'ok' && <span className="text-success">Available</span>}
                </p>
              </div>

              {error && (
                <p className="mt-3 rounded-lg bg-danger/15 px-4 py-2 text-sm text-red-200 ring-1 ring-danger/30">
                  {error}
                </p>
              )}

              <button
                onClick={() => setStep(1)}
                disabled={!canContinueProfile}
                className="mt-8 w-full rounded-full bg-accent px-7 py-3.5 font-semibold text-accent-foreground transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              >
                Continue
              </button>
            </motion.div>
          ) : (
            <SlideView
              key={`slide-${step}`}
              slide={SLIDES[step - 1]}
              isLast={step === SLIDES.length}
              pending={pending}
              onBack={() => setStep((s) => s - 1)}
              onNext={() => (step === SLIDES.length ? submit() : setStep((s) => s + 1))}
            />
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function SlideView({
  slide,
  isLast,
  pending,
  onBack,
  onNext,
}: {
  slide: Slide;
  isLast: boolean;
  pending: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const Icon = slide.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ duration: 0.35 }}
      className="w-full max-w-sm text-center"
    >
      <div className="mx-auto grid size-20 place-items-center rounded-2xl bg-accent/15 ring-1 ring-accent/30">
        <Icon className="size-9 text-accent" />
      </div>
      <h1 className="mt-7 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tight">
        {slide.title}
      </h1>
      <p className="mt-4 text-balance text-white/70">{slide.body}</p>

      <div className="mt-9 flex items-center justify-center gap-3">
        <button
          onClick={onBack}
          className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/70 transition hover:bg-white/10"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={pending}
          className="rounded-full bg-accent px-8 py-3.5 font-semibold text-accent-foreground transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
        >
          {isLast ? (pending ? 'Setting up…' : "Let's go") : 'Next'}
        </button>
      </div>
    </motion.div>
  );
}
