/* eslint-disable react-refresh/only-export-components -- provider + hook live together */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { KNOCKOUT_RESULTS } from '../data/knockout-results'
import { deriveStatus } from './money'
import type { Bet, BetStatus, BetType, Bookmaker, KnockoutTeams, Leg, LegResult, Market, Player } from './types'

const DEFAULT_BOOKMAKERS = ['Bet365', 'Unibet', 'BetCity']

export interface NewLegInput {
  match_number: number | null
  market: Market
  player_id: string | null
  team_code: string | null
  line: string | null
  custom_event: string | null
}

export interface NewBetInput {
  bookmaker_id: string
  bet_type: BetType
  stake: number
  total_odds: number
  is_free_bet: boolean
  is_super_boost: boolean
  notes: string | null
  legs: NewLegInput[]
}

interface DataApi {
  loading: boolean
  loadError: string | null
  bookmakers: Bookmaker[]
  players: Map<string, Player>
  bets: Bet[]
  knockout: Map<number, KnockoutTeams>
  /** Remaining free-bet credit per bookmaker id. */
  freeBetBalances: Map<string, number>
  setFreeBetBalance: (bookmakerId: string, balance: number) => Promise<void>
  adjustFreeBetBalance: (bookmakerId: string, delta: number) => Promise<void>
  refresh: () => Promise<void>
  addBookmaker: (name: string) => Promise<void>
  addPlayer: (name: string, teamCode: string) => Promise<Player>
  /** Reuse an existing player by name (case-insensitive), or create one. Dedupe-safe across a loop. */
  getOrCreatePlayer: (name: string, teamCode: string) => Promise<string>
  addBet: (input: NewBetInput) => Promise<void>
  settleBet: (
    bet: Bet,
    legResults: Record<string, LegResult>,
    opts: { cashedOut?: boolean; payout: number },
  ) => Promise<void>
  updateBet: (
    betId: string,
    fields: Partial<
      Pick<Bet, 'stake' | 'total_odds' | 'bookmaker_id' | 'bet_type' | 'is_free_bet' | 'is_super_boost' | 'notes'>
    >,
  ) => Promise<void>
  reopenBet: (bet: Bet) => Promise<void>
  deleteBet: (betId: string) => Promise<void>
  setKnockoutTeams: (matchNumber: number, home: string | null, away: string | null) => Promise<void>
}

const DataCtx = createContext<DataApi | null>(null)

export function useData(): DataApi {
  const ctx = useContext(DataCtx)
  if (!ctx) throw new Error('useData outside DataProvider')
  return ctx
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [bookmakers, setBookmakers] = useState<Bookmaker[]>([])
  const [players, setPlayers] = useState<Map<string, Player>>(new Map())
  const [bets, setBets] = useState<Bet[]>([])
  const [knockout, setKnockout] = useState<Map<number, KnockoutTeams>>(new Map())
  const [freeBetBalances, setFreeBetBalances] = useState<Map<string, number>>(new Map())
  const balancesRef = useRef<Map<string, number>>(new Map())
  const seeding = useRef(false)
  // authoritative players map, updated synchronously so a player created earlier
  // in a multi-leg submit is seen by later legs (avoids duplicate inserts)
  const playersRef = useRef<Map<string, Player>>(new Map())

  const refresh = useCallback(async () => {
    if (!supabase) return
    setLoadError(null)
    try {
      const first = await supabase.from('bookmakers').select('id, name').order('name')
      if (first.error) throw first.error
      let bk = first.data
      if ((!bk || bk.length === 0) && !seeding.current) {
        seeding.current = true // guard against the double-mount race
        const { error } = await supabase
          .from('bookmakers')
          .upsert(DEFAULT_BOOKMAKERS.map((name) => ({ name })), {
            onConflict: 'user_id,name',
            ignoreDuplicates: true,
          })
        if (error) throw error
        const again = await supabase.from('bookmakers').select('id, name').order('name')
        if (again.error) throw again.error
        bk = again.data
      }
      const [pl, bt, ko, fb] = await Promise.all([
        supabase.from('players').select('id, name, team_code').order('name'),
        supabase
          .from('bets')
          .select('*, legs(*)')
          .order('placed_at', { ascending: false }),
        supabase.from('knockout_teams').select('match_number, home_code, away_code'),
        supabase.from('free_bet_balances').select('bookmaker_id, balance'),
      ])
      if (pl.error) throw pl.error
      if (bt.error) throw bt.error
      if (ko.error) throw ko.error
      setBookmakers(bk ?? [])
      const playerMap = new Map((pl.data as Player[]).map((p) => [p.id, p]))
      playersRef.current = playerMap
      setPlayers(playerMap)
      setBets(bt.data as Bet[])
      // seed known knockout teams as defaults; a user's own edits override them
      const koMap = new Map<number, KnockoutTeams>()
      for (const [mn, t] of Object.entries(KNOCKOUT_RESULTS)) {
        koMap.set(Number(mn), { match_number: Number(mn), home_code: t.home_code, away_code: t.away_code })
      }
      for (const k of ko.data as KnockoutTeams[]) koMap.set(k.match_number, k)
      setKnockout(koMap)
      // free_bet_balances may not exist yet (migration 004) — degrade gracefully
      // rather than breaking the whole data load
      const balanceRows = fb.error ? [] : (fb.data as { bookmaker_id: string; balance: number }[])
      const balanceMap = new Map(balanceRows.map((r) => [r.bookmaker_id, Number(r.balance)]))
      balancesRef.current = balanceMap
      setFreeBetBalances(balanceMap)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // initial data fetch on mount; refresh sets state when responses arrive
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const addBookmaker = useCallback(
    async (name: string) => {
      const { error } = await supabase!.from('bookmakers').insert({ name })
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const addPlayer = useCallback(
    async (name: string, teamCode: string) => {
      const { data, error } = await supabase!
        .from('players')
        .insert({ name, team_code: teamCode })
        .select('id, name, team_code')
        .single()
      if (error) throw error
      const player = data as Player
      playersRef.current = new Map(playersRef.current).set(player.id, player)
      setPlayers(playersRef.current)
      return player
    },
    [],
  )

  const setFreeBetBalance = useCallback(async (bookmakerId: string, balance: number) => {
    const rounded = Math.round(balance * 100) / 100
    const { error } = await supabase!
      .from('free_bet_balances')
      .upsert({ bookmaker_id: bookmakerId, balance: rounded }, { onConflict: 'user_id,bookmaker_id' })
    if (error) throw error
    balancesRef.current = new Map(balancesRef.current).set(bookmakerId, rounded)
    setFreeBetBalances(balancesRef.current)
  }, [])

  const adjustFreeBetBalance = useCallback(
    async (bookmakerId: string, delta: number) => {
      const current = balancesRef.current.get(bookmakerId) ?? 0
      await setFreeBetBalance(bookmakerId, current + delta)
    },
    [setFreeBetBalance],
  )

  const getOrCreatePlayer = useCallback(
    async (name: string, teamCode: string) => {
      const key = name.trim().toLowerCase()
      for (const p of playersRef.current.values()) {
        if (p.name.toLowerCase() === key) return p.id
      }
      if (!teamCode) throw new Error(`Pick a team for new player “${name.trim()}”.`)
      return (await addPlayer(name.trim(), teamCode)).id
    },
    [addPlayer],
  )

  const addBet = useCallback(
    async (input: NewBetInput) => {
      const { legs, ...betFields } = input
      const { data, error } = await supabase!
        .from('bets')
        .insert(betFields)
        .select('id')
        .single()
      if (error) throw error
      const { error: legErr } = await supabase!
        .from('legs')
        .insert(legs.map((l) => ({ ...l, bet_id: data.id })))
      if (legErr) {
        // do not leave a legless bet behind
        await supabase!.from('bets').delete().eq('id', data.id)
        throw legErr
      }
      await refresh()
    },
    [refresh],
  )

  const settleBet = useCallback(
    async (bet: Bet, legResults: Record<string, LegResult>, opts: { cashedOut?: boolean; payout: number }) => {
      for (const leg of bet.legs) {
        const result = legResults[leg.id] ?? leg.result
        if (result !== leg.result) {
          const { error } = await supabase!.from('legs').update({ result }).eq('id', leg.id)
          if (error) throw error
        }
      }
      const results = bet.legs.map((l) => ({ result: legResults[l.id] ?? l.result }))
      const status: BetStatus = opts.cashedOut ? 'cashed_out' : deriveStatus(results)
      const settled = status !== 'pending'
      const { error } = await supabase!
        .from('bets')
        .update({
          status,
          payout: settled ? opts.payout : null,
          settled_at: settled ? new Date().toISOString() : null,
        })
        .eq('id', bet.id)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const updateBet = useCallback(
    async (
      betId: string,
      fields: Partial<
        Pick<Bet, 'stake' | 'total_odds' | 'bookmaker_id' | 'bet_type' | 'is_free_bet' | 'is_super_boost' | 'notes'>
      >,
    ) => {
      const { error } = await supabase!.from('bets').update(fields).eq('id', betId)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const reopenBet = useCallback(
    async (bet: Bet) => {
      const { error } = await supabase!
        .from('bets')
        .update({ status: 'pending', payout: null, settled_at: null })
        .eq('id', bet.id)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const deleteBet = useCallback(
    async (betId: string) => {
      const { error } = await supabase!.from('bets').delete().eq('id', betId)
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  const setKnockoutTeams = useCallback(
    async (matchNumber: number, home: string | null, away: string | null) => {
      const { error } = await supabase!
        .from('knockout_teams')
        .upsert(
          { match_number: matchNumber, home_code: home, away_code: away },
          { onConflict: 'user_id,match_number' },
        )
      if (error) throw error
      await refresh()
    },
    [refresh],
  )

  return (
    <DataCtx.Provider
      value={{
        loading,
        loadError,
        bookmakers,
        players,
        bets,
        knockout,
        freeBetBalances,
        setFreeBetBalance,
        adjustFreeBetBalance,
        refresh,
        addBookmaker,
        addPlayer,
        getOrCreatePlayer,
        addBet,
        settleBet,
        updateBet,
        reopenBet,
        deleteBet,
        setKnockoutTeams,
      }}
    >
      {children}
    </DataCtx.Provider>
  )
}

/** Legs typed as returned by the bets join. */
export type BetWithLegs = Bet & { legs: Leg[] }
