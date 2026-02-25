'use client';

export default function LoginVideoBackground() {
  return (
    <div className="login-video-background" aria-hidden="true">
      <video autoPlay muted loop playsInline className="h-full w-full object-cover" aria-hidden>
        <source src="/login-videos/Horses.mp4" type="video/mp4" />
        <source src="/login-videos/Horses.mov" type="video/quicktime" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80" />
    </div>
  );
}
