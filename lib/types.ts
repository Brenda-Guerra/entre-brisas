export type RoomStatus = 'waiting' | 'playing' | 'finished'

export type RoomResult = 'victory' | 'defeat' | 'ended'

export type Room = {
  id: string
  code: string
  host_id: string | null
  grid_size: number
  turn_time: number | null
  /** false = sem vidas: só termina ao completar o tabuleiro ou encerrar */
  lives_enabled: boolean
  status: RoomStatus
  result: RoomResult | null
  started_at: string | null
  finished_at: string | null
}

export type Player = {
  id: string
  room_id: string
  name: string
  player_order: number | null
  connected: boolean
  is_host: boolean
  joined_at: string
}

export type GameWord = {
  id: string
  room_id: string
  word_id: number | null
  word: string
  position_type: 'row' | 'column'
  position_index: number
}

export type RoundStatus =
  | 'thinking'
  | 'guessing'
  | 'correct'
  | 'wrong'
  | 'timeout'
  | 'skipped'

export type Round = {
  id: string
  room_id: string
  round_number: number
  current_player_id: string | null
  row_index: number
  column_index: number
  association: string | null
  status: RoundStatus
  guess_row: number | null
  guess_column: number | null
  phase_started_at: string
  created_at: string
}

export type Vote = {
  id: string
  room_id: string
  round_id: string
  player_id: string
  row_index: number
  column_index: number
  created_at: string
}
