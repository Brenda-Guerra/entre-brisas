import { supabase } from '@/lib/supabase'
import type {
  Player,
  Room,
  RoomResult,
  Round,
  RoundStatus,
  Vote,
} from '@/lib/types'

/* ------------------------------------------------------------------ */
/* Identidade local do jogador                                         */
/* ------------------------------------------------------------------ */

function chaveJogador(codigoSala: string) {
  return `entre-brisas-player-${codigoSala.toUpperCase()}`
}

export function salvarJogador(
  codigoSala: string,
  playerId: string
) {
  localStorage.setItem(
    chaveJogador(codigoSala),
    playerId
  )
}

export function obterJogador(codigoSala: string) {
  if (typeof window === 'undefined') return null

  return localStorage.getItem(
    chaveJogador(codigoSala)
  )
}

export function esquecerJogador(codigoSala: string) {
  localStorage.removeItem(chaveJogador(codigoSala))
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

export class ErroJogo extends Error {}

export function gerarCodigoSala(tamanho = 6) {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  let codigo = ''

  for (let i = 0; i < tamanho; i++) {
    codigo += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    )
  }

  return codigo
}

/** Fisher–Yates: embaralhamento sem viés. */
export function embaralhar<T>(lista: T[]) {
  const copia = [...lista]

  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }

  return copia
}

const LETRAS = 'ABCDEFGH'

export function letraColuna(indice: number) {
  return LETRAS.charAt(indice)
}

export function nomeCoordenada(
  linha: number,
  coluna: number
) {
  return `${letraColuna(coluna)}${linha + 1}`
}

export function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function formatarTempo(segundos: number | null) {
  if (segundos === null) return 'Ilimitado'

  const minutos = Math.floor(segundos / 60)
  const resto = segundos % 60

  if (resto === 0) return `${minutos} min`

  return `${minutos}:${String(resto).padStart(2, '0')}`
}

/** Cores fixas para os avatares, na ordem de entrada. */
const CORES_AVATAR = [
  '#3b6fd8',
  '#ec6a8c',
  '#f2a93b',
  '#2fb487',
  '#8b5cf6',
  '#ef5b3f',
  '#14a3b8',
  '#b4568f',
]

export function corDoJogador(
  players: Player[],
  playerId: string | null
) {
  const indice = ordenarJogadores(players).findIndex(
    (player) => player.id === playerId
  )

  return CORES_AVATAR[
    Math.max(0, indice) % CORES_AVATAR.length
  ]
}

/* ------------------------------------------------------------------ */
/* Regras                                                              */
/* ------------------------------------------------------------------ */

/** Tempo que o resultado de uma rodada fica na tela antes da próxima. */
export const TEMPO_REVELACAO_MS = 3500

export const ESTADOS_ATIVOS: RoundStatus[] = [
  'thinking',
  'guessing',
]

/** Estados que "gastam" a carta (a célula não volta para o baralho). */
const ESTADOS_JOGADOS: RoundStatus[] = [
  'correct',
  'wrong',
  'timeout',
]

export function rodadaEstaAtiva(round: Round | null | undefined) {
  return !!round && ESTADOS_ATIVOS.includes(round.status)
}

export function rodadaFoiResolvida(round: Round) {
  return ESTADOS_JOGADOS.includes(round.status) ||
    round.status === 'skipped'
}

export function ordenarJogadores(players: Player[]) {
  return [...players].sort((a, b) => {
    const ordemA = a.player_order ?? Number.MAX_SAFE_INTEGER
    const ordemB = b.player_order ?? Number.MAX_SAFE_INTEGER

    if (ordemA !== ordemB) return ordemA - ordemB

    return a.joined_at.localeCompare(b.joined_at)
  })
}

export function ordenarRodadas(rounds: Round[]) {
  return [...rounds].sort(
    (a, b) => a.round_number - b.round_number
  )
}

/** Quantos erros a equipe pode cometer antes de perder. */
export function vidasTotais(gridSize: number) {
  return gridSize
}

export function resumoPartida(
  gridSize: number,
  rounds: Round[]
) {
  const total = gridSize * gridSize
  const acertos = rounds.filter(
    (round) => round.status === 'correct'
  ).length
  const erros = rounds.filter(
    (round) =>
      round.status === 'wrong' ||
      round.status === 'timeout'
  ).length
  const vidas = vidasTotais(gridSize)

  return {
    total,
    acertos,
    erros,
    vidas,
    vidasRestantes: Math.max(0, vidas - erros),
    restantes: total - acertos - erros,
  }
}

export function classificacao(acertos: number, total: number) {
  const taxa = total === 0 ? 0 : acertos / total

  if (taxa === 1) {
    return {
      titulo: 'Tempestade perfeita',
      texto: 'Nenhuma carta perdida. Vocês pensam igual!',
    }
  }

  if (taxa >= 0.85) {
    return {
      titulo: 'Ventania',
      texto: 'Uma sintonia impressionante.',
    }
  }

  if (taxa >= 0.65) {
    return {
      titulo: 'Brisa forte',
      texto: 'Boas conexões, time afiado.',
    }
  }

  if (taxa >= 0.4) {
    return {
      titulo: 'Brisa leve',
      texto: 'Deu para sentir o vento. Dá para melhorar!',
    }
  }

  return {
    titulo: 'Calmaria',
    texto: 'O vento não soprou a favor desta vez.',
  }
}

export function validarPista(
  pista: string,
  palavrasTabuleiro: string[]
) {
  const limpa = pista.trim()

  if (!limpa) return 'Digite uma pista.'

  if (/\s/.test(limpa)) {
    return 'A pista precisa ser uma única palavra.'
  }

  if (limpa.length > 30) {
    return 'Pista muito longa.'
  }

  const usaPalavraDoTabuleiro = palavrasTabuleiro.some(
    (palavra) => normalizar(palavra) === normalizar(limpa)
  )

  if (usaPalavraDoTabuleiro) {
    return 'Não vale usar uma palavra do tabuleiro!'
  }

  return null
}

/**
 * Próximo jogador na ordem, pulando quem saiu (e quem está offline,
 * quando sabemos quem está online).
 */
export function proximoJogador(
  players: Player[],
  atualId: string | null,
  onlineIds: Set<string> | null
) {
  const ordenados = ordenarJogadores(players)

  let candidatos = ordenados.filter(
    (player) =>
      player.connected &&
      (!onlineIds || onlineIds.has(player.id))
  )

  if (candidatos.length === 0) {
    candidatos = ordenados.filter((player) => player.connected)
  }

  if (candidatos.length === 0) return null

  const indiceAtual = ordenados.findIndex(
    (player) => player.id === atualId
  )

  for (let passo = 1; passo <= ordenados.length; passo++) {
    const candidato =
      ordenados[(indiceAtual + passo) % ordenados.length]

    if (candidatos.includes(candidato)) return candidato
  }

  return candidatos[0]
}

function sortearCelulaLivre(gridSize: number, rounds: Round[]) {
  const ocupadas = new Set(
    rounds
      .filter(
        (round) =>
          ESTADOS_JOGADOS.includes(round.status) ||
          ESTADOS_ATIVOS.includes(round.status)
      )
      .map((round) => `${round.row_index}-${round.column_index}`)
  )

  const livres: { linha: number; coluna: number }[] = []

  for (let linha = 0; linha < gridSize; linha++) {
    for (let coluna = 0; coluna < gridSize; coluna++) {
      if (!ocupadas.has(`${linha}-${coluna}`)) {
        livres.push({ linha, coluna })
      }
    }
  }

  if (livres.length === 0) return null

  return livres[Math.floor(Math.random() * livres.length)]
}

/**
 * Apura os palpites: a célula mais votada vence.
 * Empate → vence a célula que recebeu o primeiro voto.
 */
export function apurarVotos(votes: Vote[]) {
  const contagem = new Map<
    string,
    { linha: number; coluna: number; votos: number; primeiro: string }
  >()

  for (const vote of votes) {
    const chave = `${vote.row_index}-${vote.column_index}`
    const atual = contagem.get(chave)

    if (atual) {
      atual.votos++
      if (vote.created_at < atual.primeiro) {
        atual.primeiro = vote.created_at
      }
    } else {
      contagem.set(chave, {
        linha: vote.row_index,
        coluna: vote.column_index,
        votos: 1,
        primeiro: vote.created_at,
      })
    }
  }

  const ordenadas = [...contagem.values()].sort(
    (a, b) =>
      b.votos - a.votos ||
      a.primeiro.localeCompare(b.primeiro)
  )

  return ordenadas[0] ?? null
}

/* ------------------------------------------------------------------ */
/* Ações no banco                                                      */
/* ------------------------------------------------------------------ */

async function criarRodada(
  room: Room,
  jogador: Player,
  rounds: Round[],
  atrasoMs: number
) {
  const celula = sortearCelulaLivre(room.grid_size, rounds)

  if (!celula) return

  const numero =
    rounds.reduce(
      (maior, round) => Math.max(maior, round.round_number),
      0
    ) + 1

  const { error } = await supabase.from('game_rounds').insert({
    room_id: room.id,
    round_number: numero,
    current_player_id: jogador.id,
    row_index: celula.linha,
    column_index: celula.coluna,
    status: 'thinking',
    phase_started_at: new Date(
      Date.now() + atrasoMs
    ).toISOString(),
  })

  // 23505 = outro jogador já criou esta rodada ao mesmo tempo
  if (error && error.code !== '23505') throw error
}

export async function finalizarPartida(
  roomId: string,
  result: RoomResult
) {
  const { error } = await supabase
    .from('rooms')
    .update({
      status: 'finished',
      result,
      finished_at: new Date().toISOString(),
    })
    .eq('id', roomId)
    .eq('status', 'playing')

  if (error) throw error

  // Fecha a rodada que estava aberta (ex.: anfitrião encerrou no meio),
  // para o relógio parar para todo mundo.
  const { error: rodadaError } = await supabase
    .from('game_rounds')
    .update({ status: 'skipped' })
    .eq('room_id', roomId)
    .in('status', ESTADOS_ATIVOS)

  if (rodadaError) throw rodadaError
}

/**
 * Encerra a rodada somente se ela ainda estiver ativa.
 * Retorna null se outro jogador já a encerrou (evita resolução dupla).
 */
export async function encerrarRodada(
  round: Round,
  dados: Partial<Round>
) {
  const { data, error } = await supabase
    .from('game_rounds')
    .update(dados)
    .eq('id', round.id)
    .in('status', ESTADOS_ATIVOS)
    .select()

  if (error) throw error

  return (data?.[0] as Round | undefined) ?? null
}

/** Depois de uma rodada terminar: fim de jogo ou próxima rodada. */
export async function avancarJogo({
  room,
  players,
  rounds,
  onlineIds,
  atrasoMs = TEMPO_REVELACAO_MS,
}: {
  room: Room
  players: Player[]
  rounds: Round[]
  onlineIds: Set<string> | null
  atrasoMs?: number
}) {
  // A partida pode ter sido encerrada enquanto esta rodada terminava
  const { data: sala, error: salaError } = await supabase
    .from('rooms')
    .select('status')
    .eq('id', room.id)
    .maybeSingle()

  if (salaError) throw salaError
  if (sala?.status !== 'playing') return

  const resumo = resumoPartida(room.grid_size, rounds)

  if (resumo.erros >= resumo.vidas) {
    await finalizarPartida(room.id, 'defeat')
    return
  }

  if (resumo.restantes === 0) {
    await finalizarPartida(room.id, 'victory')
    return
  }

  const ultima = ordenarRodadas(rounds).at(-1)

  const proximo = proximoJogador(
    players,
    ultima?.current_player_id ?? null,
    onlineIds
  )

  if (!proximo) {
    await finalizarPartida(room.id, 'ended')
    return
  }

  await criarRodada(room, proximo, rounds, atrasoMs)
}

export async function iniciarPartida(room: Room) {
  const { data: jogadores, error: jogadoresError } =
    await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .eq('connected', true)

  if (jogadoresError) throw jogadoresError

  if (!jogadores || jogadores.length < 2) {
    throw new ErroJogo(
      'São necessários pelo menos 2 jogadores para começar.'
    )
  }

  const quantidade = room.grid_size * 2

  const { data: palavras, error: palavrasError } =
    await supabase
      .from('words')
      .select('id, word')
      .eq('active', true)

  if (palavrasError) throw palavrasError

  if (!palavras || palavras.length < quantidade) {
    throw new ErroJogo(
      `O banco precisa de pelo menos ${quantidade} palavras cadastradas.`
    )
  }

  const sorteadas = embaralhar(palavras).slice(0, quantidade)

  // Limpa uma partida anterior da mesma sala (os votos caem em cascata)
  const { error: limparRodadas } = await supabase
    .from('game_rounds')
    .delete()
    .eq('room_id', room.id)

  if (limparRodadas) throw limparRodadas

  const { error: limparPalavras } = await supabase
    .from('game_words')
    .delete()
    .eq('room_id', room.id)

  if (limparPalavras) throw limparPalavras

  const { error: palavrasInsertError } = await supabase
    .from('game_words')
    .insert(
      sorteadas.map((item, indice) => {
        const ehColuna = indice < room.grid_size

        return {
          room_id: room.id,
          word_id: item.id,
          word: item.word,
          position_type: ehColuna ? 'column' : 'row',
          position_index: ehColuna
            ? indice
            : indice - room.grid_size,
        }
      })
    )

  if (palavrasInsertError) throw palavrasInsertError

  const primeiro =
    jogadores[Math.floor(Math.random() * jogadores.length)]

  await criarRodada(room, primeiro as Player, [], 0)

  const { error: roomError } = await supabase
    .from('rooms')
    .update({
      status: 'playing',
      result: null,
      started_at: new Date().toISOString(),
      finished_at: null,
    })
    .eq('id', room.id)

  if (roomError) throw roomError
}

/** Marca o jogador como fora da sala e passa a coroa, se ele for o host. */
export async function sairDaSala(
  room: Room,
  playerId: string,
  players: Player[]
) {
  await supabase
    .from('players')
    .update({ connected: false, is_host: false })
    .eq('id', playerId)

  if (room.host_id === playerId) {
    const novoHost = ordenarJogadores(players).find(
      (player) => player.connected && player.id !== playerId
    )

    if (novoHost) {
      await supabase
        .from('players')
        .update({ is_host: true })
        .eq('id', novoHost.id)

      await supabase
        .from('rooms')
        .update({ host_id: novoHost.id })
        .eq('id', room.id)
    }
  }

  esquecerJogador(room.code)
}
