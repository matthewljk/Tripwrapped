'use client';

/**
 * Cover shown above the Amplify Authenticator (sign-in/sign-up).
 * SoTrav-inspired: bold title, short tagline, same theme and Icon.
 */
export default function LoginCover() {
  return (
    <div className="flex flex-col items-center justify-center px-6 pt-8 pb-4 text-center">
      <img
        src="/login-videos/Icon.png"
        alt=""
        className="h-20 w-20 shrink-0 rounded-2xl object-contain sm:h-24 sm:w-24"
        width={96}
        height={96}
      />
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
        TripWrapped
      </h1>
      <p className="mt-2 text-sm text-slate-500 sm:text-base">
        Collecting your memories
      </p>
    </div>
  );
}
