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
    <div className="mx-auto max-w-xl px-4 pt-5 pb-28 lg:max-w-5xl">
      <div className="fixed inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-violet-600 via-rose-500 to-lime-400" />
      <header className="mb-5 flex items-center justify-between">
        <h1 className="flex items-baseline gap-2 text-lg font-extrabold tracking-tight">
          <span>⚽</span>
          <span>
            WC<span className="text-emerald-400">26</span>
            <span className="ml-2 text-xs font-medium tracking-widest text-neutral-500 uppercase">
              bet tracker
            </span>
          </span>
        </h1>
        <button className="text-xs text-neutral-600 transition-colors hover:text-neutral-300"
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
      {tab === 'new' && (
        <div className="mx-auto lg:max-w-xl">
          <NewBet />
        </div>
      )}
      {tab === 'history' && <History drill={drill} onDrillChange={setDrill} />}

      <nav className="fixed inset-x-0 bottom-3 px-4">
        <div className="mx-auto flex max-w-md gap-1 rounded-2xl border border-white/10 bg-[#101513]/90 p-1.5 shadow-xl shadow-black/50 backdrop-blur-md">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex grow flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
                tab === t.id
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-neutral-500 hover:text-neutral-300'
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
