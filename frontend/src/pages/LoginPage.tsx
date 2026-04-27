export function LoginPage() {
  const handleGoogleLogin = () => {
    window.location.href = '/api/v1/auth/google/login'
  }

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Warm glow behind the guitar icon */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div
          className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full blur-[120px]"
          style={{ background: 'oklch(0.80 0.175 72 / 0.08)' }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 relative">
        {/* Icon */}
        <div className="animate-fade-up mb-10">
          <div
            className="w-24 h-24 rounded-[28px] flex items-center justify-center mx-auto"
            style={{
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent-border)',
            }}
          >
            {/* Guitar body SVG — more distinctive than lucide Guitar */}
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
              <path
                d="M28 6C28 6 34 8 36 14C38 20 35 25 31 28C28.5 30 28 32 29 34C30 36 30 38 28 40C26 42 23 42 21 40C19 38 19 36 20 34C21 32 20.5 30 18 28C14 25 11 20 13 14C15 8 21 6 28 6Z"
                stroke="var(--accent)"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="22" cy="34" r="3.5" fill="var(--accent)" opacity="0.3" />
              <path d="M22 28 L22 22" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M19 16 L25 16" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M19 19 L25 19" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M20 22 L24 22" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <div className="animate-fade-up delay-100 text-center mb-3">
          <h1
            className="text-4xl font-black tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Guitar Tracker
          </h1>
        </div>

        <p
          className="animate-fade-up delay-150 text-center text-[15px] mb-14"
          style={{ color: 'var(--text-secondary)', maxWidth: '26ch' }}
        >
          Track your practice. Hear how far you've come.
        </p>

        {/* Google sign-in */}
        <div className="animate-fade-up delay-200 w-full max-w-xs">
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 h-14 rounded-2xl text-[15px] font-semibold transition-all duration-150 active:scale-[0.97]"
            style={{
              fontFamily: 'var(--font-display)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-base)',
              color: 'var(--text-primary)',
            }}
          >
            <GoogleIcon />
            Continue with Google
          </button>
        </div>

        <p
          className="animate-fade-up delay-250 text-center text-xs mt-8 px-6"
          style={{ color: 'var(--text-tertiary)', maxWidth: '36ch' }}
        >
          By continuing you agree to our Terms of Service and Privacy Policy
        </p>
      </div>

      {/* Bottom string accent */}
      <div className="relative h-px mx-8 mb-12" style={{ background: 'var(--border-subtle)' }}>
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-px w-16 h-px"
          style={{ background: 'var(--accent)', opacity: 0.5 }}
        />
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
