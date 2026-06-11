import { useState } from 'react'
import { AuthGate } from './components/AuthGate'
import { DataProvider, useData } from './lib/data'
import type { Drill } from './lib/filters'
import { supabase } from './lib/supabase'
import { Dashboard } from './screens/Dashboard'
import { History } from './screens/History'
import { NewBet } from './screens/NewBet'
import { OpenBets } from './screens/OpenBets'

type Tab = 'dashboard' | 'open' | 'new' | 'history'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'dashboard', icon: '📊', label: 'Stats' },
  { id: 'open', icon: '⏳', label: 'Open' },
  { id: 'new', icon: '➕', label: 'New' },
  { id: 'history', icon: '📜', label: 'History' },
]

export default function App() {
  return (
    <AuthGate>
      <DataProvider>
        <Shell />
      </DataProvider>
    </AuthGate>
  )
}

function Shell() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [drill, setDrill] = useState<Drill | null>(null)
  const { loadError, refresh } = useData()

  return (
    <div className="mx-auto max-w-xl px-4 pt-4 pb-24">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-base font-bold">⚽ WC 2026 Bet Tracker</h1>
        <button className="text-xs text-neutral-500 hover:text-neutral-300"
          onClick={() => void supabase?.auth.signOut()}>
          log out
        </button>
      </header>

      {loadError && (
        <div className="card mb-4 border-red-900">
          <p className="text-sm text-red-400">Couldn't load your data: {loadError}</p>
          <button className="btn-ghost mt-2" onClick={() => void refresh()}>Retry</button>
        </div>
      )}

      {tab === 'dashboard' && (
        <Dashboard
          onDrill={(d) => {
            setDrill(d)
            setTab('history')
          }}
        />
      )}
      {tab === 'open' && <OpenBets />}
      {tab === 'new' && <NewBet />}
      {tab === 'history' && <History drill={drill} onDrillChange={setDrill} />}

      <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex grow flex-col items-center gap-0.5 py-2 text-xs ${
                tab === t.id ? 'text-emerald-400' : 'text-neutral-500'
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
