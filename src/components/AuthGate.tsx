import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!supabase) {
    return (
      <div className="mx-auto mt-16 max-w-md px-4">
        <div className="card space-y-2">
          <h1 className="text-lg font-semibold">Setup needed</h1>
          <p className="text-sm text-neutral-300">
            Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and
            fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> from
            your Supabase project, then restart the dev server. See the README for the full
            setup guide.
          </p>
        </div>
      </div>
    )
  }

  if (!ready) return null

  if (!session) {
    const sendLink = async (e: FormEvent) => {
      e.preventDefault()
      setSending(true)
      setError(null)
      const { error } = await supabase!.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      setSending(false)
      if (error) setError(error.message)
      else setSent(true)
    }
    return (
      <div className="mx-auto mt-16 max-w-md px-4">
        <div className="card space-y-4">
          <div>
            <h1 className="text-xl font-bold">⚽ WC 2026 Bet Tracker</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Log in with your email — you'll get a magic link, no password.
            </p>
          </div>
          {sent ? (
            <p className="text-sm text-emerald-400">
              Link sent to {email}. Open it on this device to log in.
            </p>
          ) : (
            <form onSubmit={sendLink} className="space-y-3">
              <input
                className="input"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn w-full" disabled={sending || !email}>
                {sending ? 'Sending…' : 'Send magic link'}
              </button>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </form>
          )}
        </div>
      </div>
    )
  }

  return <>{children}</>
}
