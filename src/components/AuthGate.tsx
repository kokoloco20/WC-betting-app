import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup' | 'verify-sent' | 'forgot' | 'forgot-sent' | 'reset'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [mode, setMode] = useState<Mode>('signin')

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // user arrived via a password-reset email link
      if (event === 'PASSWORD_RECOVERY') setMode('reset')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabase) {
    return (
      <Frame>
        <h1 className="text-lg font-semibold">Setup needed</h1>
        <p className="text-sm text-neutral-300">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code>, fill in
          your project values and restart the dev server. See the README.
        </p>
      </Frame>
    )
  }

  if (!ready) return null
  if (session && mode === 'reset') return <ResetForm onDone={() => setMode('signin')} />
  if (session) return <>{children}</>

  return <AuthForms mode={mode} setMode={setMode} />
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-md px-4">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-32 h-[34rem] w-[26rem] rotate-12 rounded-[5rem] bg-violet-700/60" />
        <div className="absolute -right-28 -bottom-24 h-[30rem] w-[24rem] rotate-6 rounded-[5rem] bg-lime-500/45" />
        <div className="absolute -bottom-32 -left-24 h-[26rem] w-[22rem] -rotate-6 rounded-[5rem] bg-emerald-600/50" />
        <div className="absolute inset-0 bg-[#0c0a12]/55" />
      </div>
      <div className="card space-y-4 !p-6">{children}</div>
    </div>
  )
}

function Logo() {
  return (
    <div>
      <h1 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
        <span className="rounded-lg bg-white px-1.5 py-0.5 leading-none tracking-tighter text-[#0c0a12]">
          26
        </span>
        World Cup
        <span className="text-xs font-medium tracking-widest text-neutral-400 uppercase">
          bet tracker
        </span>
      </h1>
    </div>
  )
}

function AuthForms({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await supabase!.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) throw error
        setMode('verify-sent')
      } else if (mode === 'forgot') {
        const { error } = await supabase!.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setMode('forgot-sent')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg === 'Email not confirmed' ? 'Verify your email first — check your inbox.' : msg)
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'verify-sent') {
    return (
      <Frame>
        <Logo />
        <p className="text-2xl">📬</p>
        <p className="font-semibold">Check your inbox</p>
        <p className="text-sm text-neutral-300">
          We sent a verification link to <span className="text-neutral-100">{email}</span>. Click
          it, then come back and log in.
        </p>
        <button className="btn-ghost" onClick={() => setMode('signin')}>Back to log in</button>
      </Frame>
    )
  }

  if (mode === 'forgot-sent') {
    return (
      <Frame>
        <Logo />
        <p className="text-sm text-neutral-300">
          If an account exists for <span className="text-neutral-100">{email}</span>, a password
          reset link is on its way.
        </p>
        <button className="btn-ghost" onClick={() => setMode('signin')}>Back to log in</button>
      </Frame>
    )
  }

  return (
    <Frame>
      <Logo />
      <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1 text-sm font-medium">
        {(['signin', 'signup'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`grow rounded-lg py-1.5 transition-colors ${
              mode === m ? 'bg-emerald-500/20 text-emerald-300' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {m === 'signin' ? 'Log in' : 'Create account'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="lbl">Email</label>
          <input className="input" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        {mode !== 'forgot' && (
          <div>
            <label className="lbl">Password</label>
            <input className="input" type="password" required minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'} />
          </div>
        )}
        <button className="btn w-full" disabled={busy}>
          {busy ? 'One sec…'
            : mode === 'signin' ? 'Log in'
            : mode === 'signup' ? 'Create account'
            : 'Send reset link'}
        </button>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </form>
      {mode === 'signin' && (
        <button className="text-xs text-neutral-500 hover:text-neutral-300" onClick={() => setMode('forgot')}>
          Forgot your password?
        </button>
      )}
      {mode === 'forgot' && (
        <button className="text-xs text-neutral-500 hover:text-neutral-300" onClick={() => setMode('signin')}>
          ← Back to log in
        </button>
      )}
    </Frame>
  )
}

function ResetForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase!.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <Frame>
      <Logo />
      <p className="font-semibold">Choose a new password</p>
      <form onSubmit={submit} className="space-y-3">
        <input className="input" type="password" required minLength={8} autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        <button className="btn w-full" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </form>
    </Frame>
  )
}
