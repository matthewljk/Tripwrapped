'use client';

type Props = {
  onJoinTrip: () => void;
  onCreateTrip: () => void;
};

/**
 * Full-screen landing when unauthenticated: video background, cover (icon + title + tagline),
 * and two CTAs that open the auth modal.
 */
export default function LoginLanding({ onJoinTrip, onCreateTrip }: Props) {
  return (
    <div
      className="relative z-[1] flex min-h-dscreen flex-col items-center justify-center px-6 py-12"
      style={{
        paddingLeft: 'max(1.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(1.5rem, env(safe-area-inset-right))',
        paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex max-w-md flex-col items-center text-center">
        <img
          src="/login-videos/Icon.png"
          alt=""
          className="h-20 w-20 shrink-0 rounded-2xl object-contain sm:h-24 sm:w-24"
          width={96}
          height={96}
        />
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl md:text-6xl">
          TripWrapped
        </h1>
        <p className="mt-2 text-sm text-white/90 sm:text-lg">
          Collecting your memories
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onJoinTrip}
            className="min-h-[48px] min-w-[44px] rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-lg transition-all hover:bg-white/95 active:scale-[0.98] touch-manipulation sm:px-8"
          >
            Join a trip
          </button>
          <button
            type="button"
            onClick={onCreateTrip}
            className="min-h-[48px] min-w-[44px] rounded-xl border-2 border-white bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-[0.98] touch-manipulation sm:px-8"
          >
            Create a trip
          </button>
        </div>
        <p className="mt-5 text-sm text-white/70 sm:mt-6">
          Sign in or create an account to continue
        </p>
      </div>
    </div>
  );
}
