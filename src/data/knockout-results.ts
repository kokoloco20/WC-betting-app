// Real knockout match-ups as they become known, by match number.
// Seeded as defaults for everyone; a user's own edits (knockout_teams table)
// still override these. Round of 32 confirmed 2026-06-28; later rounds fill in
// as games are played.
export const KNOCKOUT_RESULTS: Record<number, { home_code: string; away_code: string }> = {
  // Round of 32
  73: { home_code: 'CAN', away_code: 'RSA' },
  74: { home_code: 'GER', away_code: 'PAR' },
  75: { home_code: 'NED', away_code: 'MAR' },
  76: { home_code: 'BRA', away_code: 'JPN' },
  77: { home_code: 'FRA', away_code: 'SWE' },
  78: { home_code: 'CIV', away_code: 'NOR' },
  79: { home_code: 'MEX', away_code: 'ECU' },
  80: { home_code: 'ENG', away_code: 'COD' },
  81: { home_code: 'USA', away_code: 'BIH' },
  82: { home_code: 'BEL', away_code: 'SEN' },
  83: { home_code: 'POR', away_code: 'CRO' },
  84: { home_code: 'ESP', away_code: 'AUT' },
  85: { home_code: 'SUI', away_code: 'ALG' },
  86: { home_code: 'ARG', away_code: 'CPV' },
  87: { home_code: 'COL', away_code: 'GHA' },
  88: { home_code: 'AUS', away_code: 'EGY' },
  // Round of 16
  89: { home_code: 'PAR', away_code: 'FRA' },
  90: { home_code: 'CAN', away_code: 'MAR' },
  91: { home_code: 'BRA', away_code: 'NOR' },
  92: { home_code: 'MEX', away_code: 'ENG' },
  93: { home_code: 'POR', away_code: 'ESP' },
  94: { home_code: 'USA', away_code: 'BEL' },
  95: { home_code: 'ARG', away_code: 'EGY' },
  96: { home_code: 'SUI', away_code: 'COL' },
}
