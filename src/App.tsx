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
      {/* WC26 key-art color blocks: hard-edged, vivid, like the official branding */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-32 h-[34rem] w-[26rem] rotate-12 rounded-[5rem] bg-violet-700/60" />
        <div className="absolute -top-16 left-1/3 h-[30rem] w-[22rem] -rotate-12 rounded-[5rem] bg-rose-600/55" />
        <div className="absolute -right-28 -bottom-24 h-[30rem] w-[24rem] rotate-6 rounded-[5rem] bg-lime-500/45" />
        <div className="absolute -bottom-32 -left-24 h-[26rem] w-[22rem] -rotate-6 rounded-[5rem] bg-emerald-600/50" />
        <div className="absolute top-1/3 -right-20 h-[22rem] w-[18rem] rotate-12 rounded-[4rem] bg-red-700/40" />
        {/* dark wash so content keeps contrast */}
        <div className="absolute inset-0 bg-[#0c0a12]/55" />
        <span className="absolute -top-12 right-0 leading-none font-extrabold tracking-tighter text-white/[0.07] select-none"
          style={{ fontSize: '17rem' }}>
          26
        </span>
      </div>
      <header className="mb-5 flex items-center justify-between">
        <h1 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
          <span className="rounded-lg bg-white px-1.5 py-0.5 text-base leading-none font-extrabold tracking-tighter text-[#0c0a12]">
            26
          </span>
          <span>
            World Cup
            <span className="ml-2 text-xs font-medium tracking-widest text-neutral-400 uppercase">
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
        <div className="mx-auto flex max-w-md gap-1 rounded-2xl border border-white/10 bg-[#100e18]/90 p-1.5 shadow-xl shadow-black/50 backdrop-blur-md">
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
