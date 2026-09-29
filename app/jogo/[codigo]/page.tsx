'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useParams, useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'
import {
  TEMPO_REVELACAO_MS,
  apurarVotos,
  avancarJogo,
  corDoJogador,
  encerrarRodada,
  esquecerJogador,
  finalizarPartida,
  nomeCoordenada,
  obterJogador,
  ordenarJogadores,
  ordenarRodadas,
  resumoPartida,
  rodadaEstaAtiva,
  rodadaFoiResolvida,
  sairDaSala,
  validarPista,
} from '@/lib/game'
import { useAgora, useAviso, usePresenca } from '@/lib/hooks'
import type {
  GameWord,
  Player,
  Room,
  Round,
  RoundStatus,
  Vote,
} from '@/lib/types'
import { Tabuleiro, type Celula } from '@/components/Tabuleiro'
import { TelaFinal } from '@/components/TelaFinal'
import { BotaoSom } from '@/components/Som'
import { tocarEfeito } from '@/lib/som'
import {
  Avatar,
  Aviso,
  Carregando,
  Logo,
  Modal,
} from '@/components/ui'

export default function Jogo() {
  const params = useParams()
  const router = useRouter()

  const codigo = String(params.codigo).toUpperCase()

  const [meuPlayerId, setMeuPlayerId] = useState<string | null>(null)
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [palavras, setPalavras] = useState<GameWord[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [votes, setVotes] = useState<Vote[]>([])

  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const [pista, setPista] = useState('')
  const [erroPista, setErroPista] = useState('')
  const [selecao, setSelecao] = useState<
    (Celula & { roundId: string }) | null
  >(null)
  const [ocupado, setOcupado] = useState(false)
  const [modal, setModal] = useState<'sair' | 'encerrar' | 'menu' | null>(
    null
  )

  const { aviso, avisar } = useAviso()
  const agora = useAgora(250)
  const online = usePresenca(room?.id, meuPlayerId)
  const processando = useRef(new Set<string>())

  const roomId = room?.id

  /* ---------------------------------------------------------------- */
  /* Busca de dados                                                   */
  /* ---------------------------------------------------------------- */

  const buscarSala = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (data) setRoom(data)
  }, [])

  const buscarJogadores = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', id)

    if (data) setPlayers(data)
  }, [])

  const buscarRodadas = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('game_rounds')
      .select('*')
      .eq('room_id', id)
      .order('round_number', { ascending: true })

    if (data) setRounds(data)
  }, [])

  const buscarVotos = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('game_votes')
      .select('*')
      .eq('room_id', id)

    if (data) setVotes(data)
  }, [])

  const buscarPalavras = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('game_words')
      .select('*')
      .eq('room_id', id)

    if (data) setPalavras(data)
  }, [])

  // Carga inicial
  useEffect(() => {
    let cancelado = false

    async function carregar() {
      const playerId = obterJogador(codigo)

      if (!playerId) {
        router.replace(`/entrar?codigo=${codigo}`)
        return
      }

      const { data: sala, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', codigo)
        .maybeSingle()

      if (cancelado) return

      if (error || !sala) {
        setErro(error ? 'Erro ao carregar a partida.' : 'Sala não encontrada.')
        setLoading(false)
        return
      }

      if (sala.status === 'waiting') {
        router.replace(`/sala/${codigo}`)
        return
      }

      const { data: eu } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .eq('room_id', sala.id)
        .maybeSingle()

      if (!eu) {
        esquecerJogador(codigo)
        router.replace(`/entrar?codigo=${codigo}`)
        return
      }

      if (!eu.connected) {
        await supabase
          .from('players')
          .update({ connected: true })
          .eq('id', playerId)
      }

      await Promise.all([
        buscarJogadores(sala.id),
        buscarRodadas(sala.id),
        buscarVotos(sala.id),
        buscarPalavras(sala.id),
      ])

      if (cancelado) return

      setMeuPlayerId(playerId)
      setRoom(sala)
      setLoading(false)
    }

    carregar()

    return () => {
      cancelado = true
    }
  }, [
    codigo,
    router,
    buscarJogadores,
    buscarRodadas,
    buscarVotos,
    buscarPalavras,
  ])

  // Tempo real
  useEffect(() => {
    if (!roomId) return

    const filtro = `room_id=eq.${roomId}`

    const channel = supabase
      .channel(`jogo-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        () => buscarSala(roomId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: filtro },
        () => buscarJogadores(roomId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_rounds', filter: filtro },
        () => buscarRodadas(roomId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_votes', filter: filtro },
        () => buscarVotos(roomId)
      )
      .subscribe((status) => {
        // Recarrega tudo ao (re)conectar, para não perder nada
        if (status === 'SUBSCRIBED') {
          buscarSala(roomId)
          buscarJogadores(roomId)
          buscarRodadas(roomId)
          buscarVotos(roomId)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, buscarSala, buscarJogadores, buscarRodadas, buscarVotos])

  // Host reiniciou → todos voltam para o lobby
  useEffect(() => {
    if (room?.status === 'waiting') {
      router.replace(`/sala/${codigo}`)
    }
  }, [room?.status, codigo, router])

  /* ---------------------------------------------------------------- */
  /* Estado derivado                                                  */
  /* ---------------------------------------------------------------- */

  const rodadasOrdenadas = useMemo(() => ordenarRodadas(rounds), [rounds])
  const ultimaRodada = rodadasOrdenadas.at(-1) ?? null
  // Só existe rodada em andamento enquanto a partida está rolando
  const ativa =
    room?.status === 'playing' && rodadaEstaAtiva(ultimaRodada)
      ? ultimaRodada
      : null
  const ultimaResolvida =
    [...rodadasOrdenadas].reverse().find(rodadaFoiResolvida) ?? null

  const ordenados = useMemo(() => ordenarJogadores(players), [players])
  const conectados = ordenados.filter((player) => player.connected)

  const jogadorDaVez = ativa
    ? players.find((player) => player.id === ativa.current_player_id) ?? null
    : null

  const souDaVez = !!ativa && ativa.current_player_id === meuPlayerId
  const souHost = !!room && room.host_id === meuPlayerId

  const adivinhadores = useMemo(
    () =>
      players.filter(
        (player) =>
          player.connected &&
          player.id !== ativa?.current_player_id &&
          (!online || online.has(player.id))
      ),
    [players, ativa?.current_player_id, online]
  )

  const votosRodada = useMemo(
    () =>
      votes.filter(
        (vote) =>
          vote.round_id === ativa?.id &&
          adivinhadores.some((player) => player.id === vote.player_id)
      ),
    [votes, ativa?.id, adivinhadores]
  )

  const meuVoto = votosRodada.find((vote) => vote.player_id === meuPlayerId)
  const souAdivinhador = adivinhadores.some(
    (player) => player.id === meuPlayerId
  )

  const selecionada =
    selecao && selecao.roundId === ativa?.id ? selecao : null

  const colunas = palavras
    .filter((item) => item.position_type === 'column')
    .sort((a, b) => a.position_index - b.position_index)
    .map((item) => item.word)

  const linhas = palavras
    .filter((item) => item.position_type === 'row')
    .sort((a, b) => a.position_index - b.position_index)
    .map((item) => item.word)

  const resumo = resumoPartida(
    { grid_size: room?.grid_size ?? 0, lives_enabled: room?.lives_enabled ?? true },
    rounds
  )

  // Pistas já dadas nesta partida (não podem se repetir)
  const pistasUsadas = rodadasOrdenadas.filter((round) => round.association)

  const inicioFase = ativa ? Date.parse(ativa.phase_started_at) : 0

  const restante =
    room?.turn_time && ativa
      ? Math.max(
          0,
          Math.min(
            room.turn_time,
            Math.ceil((inicioFase + room.turn_time * 1000 - agora) / 1000)
          )
        )
      : null

  // O resultado da última rodada fica na tela até a próxima começar
  const emRevelacao =
    !!ultimaResolvida &&
    ((!!ativa &&
      ativa.round_number > ultimaResolvida.round_number &&
      agora < inicioFase) ||
      (room?.status === 'finished' &&
        room.result !== 'ended' &&
        !!room.finished_at &&
        agora < Date.parse(room.finished_at) + TEMPO_REVELACAO_MS))

  /* ---------------------------------------------------------------- */
  /* Sons                                                             */
  /* ---------------------------------------------------------------- */

  const ultimoSom = useRef({ tique: '', resultado: '', vez: '' })

  // Tique nos últimos 10 segundos (mais agudo nos 3 finais)
  useEffect(() => {
    if (!ativa || emRevelacao || restante === null) return
    if (restante > 10 || restante <= 0) return

    const chave = `${ativa.id}:${ativa.status}:${restante}`
    if (ultimoSom.current.tique === chave) return
    ultimoSom.current.tique = chave

    tocarEfeito(restante <= 3 ? 'tiqueUrgente' : 'tique')
  }, [ativa, emRevelacao, restante])

  // Resultado da rodada
  useEffect(() => {
    if (!emRevelacao || !ultimaResolvida) return
    if (ultimoSom.current.resultado === ultimaResolvida.id) return
    ultimoSom.current.resultado = ultimaResolvida.id

    if (ultimaResolvida.status === 'correct') tocarEfeito('acerto')
    else if (ultimaResolvida.status !== 'skipped') tocarEfeito('erro')
  }, [emRevelacao, ultimaResolvida])

  // Chegou a minha vez
  useEffect(() => {
    if (!ativa || !souDaVez || emRevelacao) return
    if (ultimoSom.current.vez === ativa.id) return
    ultimoSom.current.vez = ativa.id

    tocarEfeito('suaVez')
  }, [ativa, souDaVez, emRevelacao])

  /* ---------------------------------------------------------------- */
  /* Resolução automática das rodadas                                 */
  /* ---------------------------------------------------------------- */

  const concluirRodada = useCallback(
    async (
      round: Round,
      dados: Partial<Round>,
      atrasoMs = TEMPO_REVELACAO_MS
    ) => {
      if (!room) return

      const chave = `${round.id}:${round.status}`
      if (processando.current.has(chave)) return
      processando.current.add(chave)

      try {
        const atualizada = await encerrarRodada(round, dados)
        if (!atualizada) return

        await avancarJogo({
          room,
          players,
          rounds: rounds.map((item) =>
            item.id === atualizada.id ? atualizada : item
          ),
          onlineIds: online,
          atrasoMs,
        })
      } catch (error) {
        console.error(error)
        processando.current.delete(chave)
      }
    },
    [room, players, rounds, online]
  )

  const apurar = useCallback(
    (round: Round, votos: Vote[]) => {
      const escolha = apurarVotos(votos)

      let status: RoundStatus = 'timeout'

      if (escolha) {
        status =
          escolha.linha === round.row_index &&
          escolha.coluna === round.column_index
            ? 'correct'
            : 'wrong'
      }

      return concluirRodada(round, {
        status,
        guess_row: escolha?.linha ?? null,
        guess_column: escolha?.coluna ?? null,
      })
    },
    [concluirRodada]
  )

  // Todos votaram → apura
  useEffect(() => {
    if (!ativa || ativa.status !== 'guessing') return
    if (adivinhadores.length === 0) return

    const todosVotaram = adivinhadores.every((player) =>
      votosRodada.some((vote) => vote.player_id === player.id)
    )

    if (todosVotaram) apurar(ativa, votosRodada)
  }, [ativa, adivinhadores, votosRodada, apurar])

  // Tempo esgotado
  useEffect(() => {
    if (!ativa || restante !== 0) return

    if (ativa.status === 'thinking') {
      concluirRodada(ativa, { status: 'timeout' })
    } else {
      apurar(ativa, votosRodada)
    }
  }, [ativa, restante, votosRodada, apurar, concluirRodada])

  // Segurança: se a partida ficou sem rodada ativa (ex.: queda de conexão
  // no meio da troca de rodada), alguém cria a próxima.
  useEffect(() => {
    if (!room || room.status !== 'playing' || ativa || !ultimaRodada) return

    const id = setTimeout(() => {
      const chave = `recuperar:${ultimaRodada.id}`
      if (processando.current.has(chave)) return
      processando.current.add(chave)

      avancarJogo({ room, players, rounds, onlineIds: online, atrasoMs: 0 })
        .catch((error) => {
          console.error(error)
          processando.current.delete(chave)
        })
    }, 5000)

    return () => clearTimeout(id)
  }, [room, ativa, ultimaRodada, players, rounds, online])

  /* ---------------------------------------------------------------- */
  /* Ações                                                            */
  /* ---------------------------------------------------------------- */

  async function enviarPista(event: FormEvent) {
    event.preventDefault()

    if (!ativa || !souDaVez || ativa.status !== 'thinking') return

    const problema = validarPista(
      pista,
      palavras.map((item) => item.word),
      pistasUsadas.map((round) => round.association ?? '')
    )

    if (problema) {
      setErroPista(problema)
      return
    }

    setOcupado(true)

    const { error } = await supabase
      .from('game_rounds')
      .update({
        association: pista.trim(),
        status: 'guessing',
        phase_started_at: new Date().toISOString(),
      })
      .eq('id', ativa.id)
      .eq('status', 'thinking')

    setOcupado(false)

    if (error) {
      console.error(error)
      avisar('Não foi possível enviar a pista.')
      return
    }

    setPista('')
    setErroPista('')
  }

  async function confirmarPalpite() {
    if (!ativa || !room || !meuPlayerId || !selecionada) return

    setOcupado(true)

    const { error } = await supabase.from('game_votes').upsert(
      {
        room_id: room.id,
        round_id: ativa.id,
        player_id: meuPlayerId,
        row_index: selecionada.linha,
        column_index: selecionada.coluna,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'round_id,player_id' }
    )

    setOcupado(false)

    if (error) {
      console.error(error)
      avisar('Não foi possível enviar o palpite.')
    }
  }

  async function pularVez() {
    if (!ativa) return

    setOcupado(true)
    await concluirRodada(ativa, { status: 'skipped' }, 1500)
    setOcupado(false)
    avisar('Vez pulada. A carta voltou para o baralho.')
  }

  async function encerrar() {
    if (!room) return

    setModal(null)
    setOcupado(true)

    try {
      await finalizarPartida(room.id, 'ended')
    } catch (error) {
      console.error(error)
      avisar('Não foi possível encerrar a partida.')
    } finally {
      setOcupado(false)
    }
  }

  async function jogarNovamente() {
    if (!room) return

    setOcupado(true)

    const { error } = await supabase
      .from('rooms')
      .update({
        status: 'waiting',
        result: null,
        started_at: null,
        finished_at: null,
      })
      .eq('id', room.id)

    if (error) {
      console.error(error)
      setOcupado(false)
      avisar('Não foi possível reiniciar a sala.')
      return
    }

    router.replace(`/sala/${codigo}`)
  }

  async function sair() {
    if (!room || !meuPlayerId) {
      router.push('/')
      return
    }

    setOcupado(true)

    try {
      if (ativa && souDaVez && room.status === 'playing') {
        const atualizada = await encerrarRodada(ativa, { status: 'skipped' })

        if (atualizada) {
          await avancarJogo({
            room,
            players: players.map((player) =>
              player.id === meuPlayerId
                ? { ...player, connected: false }
                : player
            ),
            rounds: rounds.map((item) =>
              item.id === atualizada.id ? atualizada : item
            ),
            onlineIds: online,
            atrasoMs: 1500,
          })
        }
      }

      await sairDaSala(room, meuPlayerId, players)
    } catch (error) {
      console.error(error)
    }

    router.push('/')
  }

  /* ---------------------------------------------------------------- */
  /* Renderização                                                     */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return <Carregando texto="Preparando o tabuleiro…" />
  }

  if (erro || !room) {
    return (
      <main className="tela-centro">
        <div className="cartao cartao-mensagem">
          <h2>Partida indisponível</h2>
          <p>{erro}</p>
          <button className="btn btn-primario" onClick={() => router.push('/')}>
            Voltar ao início
          </button>
        </div>
      </main>
    )
  }

  if (room.status === 'finished' && !emRevelacao) {
    return (
      <>
        <TelaFinal
          room={room}
          players={players}
          rounds={rounds}
          colunas={colunas}
          linhas={linhas}
          meuPlayerId={meuPlayerId}
          souHost={souHost}
          ocupado={ocupado}
          onJogarNovamente={jogarNovamente}
          onSair={sair}
        />
        <Aviso mensagem={aviso} />
      </>
    )
  }

  const alertaTempo = restante !== null && restante <= 10 && !emRevelacao
  const faltamJogadores = conectados.length < 2

  return (
    <main className="jogo">
      <header className="jogo-topo">
        <div className="jogo-topo-esq">
          <Logo compacto />
          <span className="pilula pilula-clara">Sala {codigo}</span>
        </div>

        <div className="jogo-topo-dir">
          <div className="indicador" title="Cartas acertadas">
            <span className="indicador-rotulo">Acertos</span>
            <strong>
              {resumo.acertos}
              <small>/{resumo.total}</small>
            </strong>
          </div>

          {resumo.comVidas ? (
            <div className="indicador" title="Vidas restantes">
              <span className="indicador-rotulo">Vidas</span>
              <span className="vidas">
                {Array.from({ length: resumo.vidas }).map((_, i) => (
                  <span
                    key={i}
                    className={`vida ${i < resumo.vidasRestantes ? '' : 'perdida'}`}
                  >
                    ♥
                  </span>
                ))}
              </span>
            </div>
          ) : (
            <div className="indicador" title="Erros (partida sem vidas)">
              <span className="indicador-rotulo">Erros</span>
              <strong>{resumo.erros}</strong>
            </div>
          )}

          <div
            className={`relogio ${alertaTempo ? 'alerta' : ''}`}
            title="Tempo da fase"
          >
            {restante === null
              ? '∞'
              : `${Math.floor(restante / 60)}:${String(restante % 60).padStart(2, '0')}`}
          </div>

          <BotaoSom />

          <button
            type="button"
            className="botao-som botao-menu"
            onClick={() => setModal('menu')}
            aria-label="Menu"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div className="jogo-corpo">
        <section className="jogo-principal">
          {/* ------------------------ Painel da rodada ------------------------ */}
          <div className="painel-rodada">
            <div className="painel-rodada-cabeca">
              <span className="pilula">
                Rodada {ultimaRodada?.round_number ?? 1}
              </span>
              <span className="painel-rodada-fase">
                {ativa?.status === 'thinking' && 'Criando a pista'}
                {ativa?.status === 'guessing' && 'Hora dos palpites'}
                {!ativa && 'Preparando…'}
              </span>
            </div>

            {faltamJogadores && (
              <div className="faixa faixa-alerta">
                Só resta você na partida.{' '}
                {souHost
                  ? 'Encerre a partida ou aguarde alguém voltar.'
                  : 'Aguarde alguém voltar.'}
              </div>
            )}

            {ativa?.status === 'thinking' && souDaVez && (
              <form className="minha-carta" onSubmit={enviarPista}>
                <div className="carta-coordenada">
                  <span className="carta-canto">
                    {nomeCoordenada(ativa.row_index, ativa.column_index)}
                  </span>
                  <span className="carta-grande">
                    {nomeCoordenada(ativa.row_index, ativa.column_index)}
                  </span>
                </div>

                <div className="minha-carta-corpo">
                  <p className="painel-sobre">Sua carta secreta</p>
                  <p className="combinacao">
                    <span className="chip chip-azul">
                      {colunas[ativa.column_index]}
                    </span>
                    <span className="combinacao-mais">+</span>
                    <span className="chip chip-rosa">
                      {linhas[ativa.row_index]}
                    </span>
                  </p>

                  <div className="campo-pista">
                    <input
                      className="input input-pista"
                      value={pista}
                      onChange={(event) => {
                        setPista(event.target.value)
                        setErroPista('')
                      }}
                      placeholder="Sua pista"
                      maxLength={30}
                      autoFocus
                      autoComplete="off"
                      disabled={emRevelacao}
                    />
                    <button
                      className="btn btn-primario btn-auto"
                      disabled={ocupado || emRevelacao || !pista.trim()}
                      type="submit"
                    >
                      Enviar pista
                    </button>
                  </div>

                  {erroPista && <p className="erro-inline">{erroPista}</p>}
                </div>
              </form>
            )}

            {ativa?.status === 'thinking' && !souDaVez && (
              <div className="estado-espera">
                {jogadorDaVez && (
                  <Avatar
                    nome={jogadorDaVez.name}
                    cor={corDoJogador(players, jogadorDaVez.id)}
                    tamanho="lg"
                  />
                )}
                <div>
                  <p className="estado-titulo">
                    <strong>{jogadorDaVez?.name ?? 'Alguém'}</strong> está
                    pensando numa pista
                    <span className="pontinhos">
                      <i />
                      <i />
                      <i />
                    </span>
                  </p>
                  <p className="texto-suave">
                    Enquanto isso, olhe o tabuleiro e imagine as conexões.
                  </p>
                </div>
              </div>
            )}

            {ativa?.status === 'guessing' && (
              <div className="pista-revelada">
                <div className="pista-cartao">
                  <span className="pista-rotulo">
                    Pista de {jogadorDaVez?.name ?? 'alguém'}
                  </span>
                  <span className="pista-palavra">{ativa.association}</span>
                </div>

                <div className="pista-lado">
                  {souDaVez && (
                    <p className="estado-titulo">
                      Sua carta é{' '}
                      <strong>
                        {nomeCoordenada(ativa.row_index, ativa.column_index)}
                      </strong>
                      . Torça pelos palpites!
                    </p>
                  )}

                  {souAdivinhador && (
                    <>
                      <p className="estado-titulo">
                        {selecionada
                          ? meuVoto &&
                            meuVoto.row_index === selecionada.linha &&
                            meuVoto.column_index === selecionada.coluna
                            ? 'Palpite enviado! Você ainda pode mudar.'
                            : `Confirmar ${nomeCoordenada(selecionada.linha, selecionada.coluna)}?`
                          : meuVoto
                            ? `Seu palpite: ${nomeCoordenada(meuVoto.row_index, meuVoto.column_index)}`
                            : 'Toque na casa que combina com a pista.'}
                      </p>

                      {selecionada &&
                        !(
                          meuVoto &&
                          meuVoto.row_index === selecionada.linha &&
                          meuVoto.column_index === selecionada.coluna
                        ) && (
                          <button
                            className="btn btn-rosa btn-auto"
                            onClick={confirmarPalpite}
                            disabled={ocupado || emRevelacao}
                          >
                            Confirmar palpite
                          </button>
                        )}
                    </>
                  )}

                  {!souDaVez && !souAdivinhador && (
                    <p className="estado-titulo">Acompanhe os palpites.</p>
                  )}

                  <div className="progresso-votos">
                    <span>
                      Palpites: {votosRodada.length}/{adivinhadores.length}
                    </span>
                    <div className="barra">
                      <div
                        className="barra-preenchida"
                        style={{
                          width: `${
                            adivinhadores.length
                              ? (votosRodada.length / adivinhadores.length) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ------------------------ Tabuleiro ------------------------ */}
          <Tabuleiro
            gridSize={room.grid_size}
            colunas={colunas}
            linhas={linhas}
            rounds={rounds}
            players={players}
            votos={ativa?.status === 'guessing' ? votosRodada : []}
            alvo={
              souDaVez && ativa
                ? { linha: ativa.row_index, coluna: ativa.column_index }
                : null
            }
            selecionada={selecionada}
            podeSelecionar={
              ativa?.status === 'guessing' && souAdivinhador && !emRevelacao
            }
            onSelecionar={(celula) =>
              ativa && setSelecao({ ...celula, roundId: ativa.id })
            }
          />
        </section>

        {/* ------------------------ Lateral ------------------------ */}
        <aside className="jogo-lateral">
          <div className="bloco bloco-jogadores">
            <h2 className="bloco-titulo">Jogadores</h2>

            <ul className="lista-jogadores">
              {ordenados
                .filter((player) => player.connected)
                .map((player) => {
                  const daVez = player.id === ativa?.current_player_id
                  const votou = votosRodada.some(
                    (vote) => vote.player_id === player.id
                  )
                  const estaOnline = !online || online.has(player.id)

                  return (
                    <li
                      key={player.id}
                      className={`jogador ${daVez ? 'da-vez' : ''} ${
                        estaOnline ? '' : 'offline'
                      }`}
                    >
                      <Avatar
                        nome={player.name}
                        cor={corDoJogador(players, player.id)}
                        online={estaOnline}
                      />

                      <span className="jogador-nome">
                        {player.name}
                        {player.id === meuPlayerId && <em>você</em>}
                      </span>

                      {room.host_id === player.id && (
                        <span className="coroa" title="Anfitrião">
                          ♛
                        </span>
                      )}

                      {daVez && <span className="tag tag-amarela">vez</span>}

                      {!daVez && ativa?.status === 'guessing' && (
                        <span className={`tag ${votou ? 'tag-verde' : 'tag-clara'}`}>
                          {votou ? 'votou' : '…'}
                        </span>
                      )}
                    </li>
                  )
                })}
            </ul>
          </div>

          <div className="bloco bloco-pistas">
            <h2 className="bloco-titulo">Pistas usadas</h2>

            {pistasUsadas.length === 0 ? (
              <p className="texto-suave">
                Nenhuma ainda. Cada pista só pode ser usada uma vez.
              </p>
            ) : (
              <ul className="pistas-usadas">
                {[...pistasUsadas].reverse().map((round) => (
                  <li key={round.id} className={`pista-usada ${round.status}`}>
                    <span className="pista-usada-palavra">
                      {round.association}
                    </span>
                    <span className="pista-usada-info">
                      {round.status === 'correct' &&
                        `✓ ${nomeCoordenada(round.row_index, round.column_index)}`}
                      {(round.status === 'wrong' || round.status === 'timeout') &&
                        '✕ errou'}
                      {round.status === 'guessing' && 'em jogo'}
                      {round.status === 'skipped' && 'pulada'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bloco bloco-acoes">
            {souHost && room.status === 'playing' && (
              <>
                <button
                  className="btn btn-claro btn-pequeno"
                  onClick={pularVez}
                  disabled={!ativa || ocupado || emRevelacao}
                  title="Útil quando alguém saiu ou travou"
                >
                  Pular a vez de {jogadorDaVez?.name ?? '…'}
                </button>
                <button
                  className="btn btn-claro btn-pequeno"
                  onClick={() => setModal('encerrar')}
                  disabled={ocupado}
                >
                  Encerrar partida
                </button>
              </>
            )}

            <button
              className="btn btn-fantasma btn-pequeno"
              onClick={() => setModal('sair')}
              disabled={ocupado}
            >
              Sair da sala
            </button>
          </div>
        </aside>
      </div>

      {/* ------------------------ Revelação ------------------------ */}
      {emRevelacao && ultimaResolvida && (
        <Revelacao
          round={ultimaResolvida}
          autor={players.find(
            (player) => player.id === ultimaResolvida.current_player_id
          )}
          colunas={colunas}
          linhas={linhas}
          comVidas={resumo.comVidas}
        />
      )}

      {modal === 'menu' && (
        <Modal titulo="Menu" aoFechar={() => setModal(null)}>
          <div className="menu-acoes">
            {souHost && room.status === 'playing' && (
              <>
                <button
                  className="btn btn-claro"
                  onClick={() => {
                    setModal(null)
                    pularVez()
                  }}
                  disabled={!ativa || ocupado || emRevelacao}
                >
                  Pular a vez de {jogadorDaVez?.name ?? '…'}
                </button>
                <button
                  className="btn btn-claro"
                  onClick={() => setModal('encerrar')}
                >
                  Encerrar partida
                </button>
              </>
            )}
            <button className="btn btn-vermelho" onClick={() => setModal('sair')}>
              Sair da sala
            </button>
          </div>
        </Modal>
      )}

      {modal === 'sair' && (
        <Modal titulo="Sair da partida?" aoFechar={() => setModal(null)}>
          <p className="texto-suave">
            {souDaVez
              ? 'É a sua vez — ela será pulada e a carta volta para o baralho.'
              : 'Você não poderá voltar para esta partida.'}
          </p>
          <div className="modal-acoes">
            <button className="btn btn-claro" onClick={() => setModal(null)}>
              Ficar
            </button>
            <button className="btn btn-vermelho" onClick={sair} disabled={ocupado}>
              Sair
            </button>
          </div>
        </Modal>
      )}

      {modal === 'encerrar' && (
        <Modal titulo="Encerrar a partida?" aoFechar={() => setModal(null)}>
          <p className="texto-suave">
            Todos irão para a tela de resultado com o placar atual.
          </p>
          <div className="modal-acoes">
            <button className="btn btn-claro" onClick={() => setModal(null)}>
              Continuar jogando
            </button>
            <button className="btn btn-vermelho" onClick={encerrar}>
              Encerrar
            </button>
          </div>
        </Modal>
      )}

      <Aviso mensagem={aviso} />
    </main>
  )
}

function Revelacao({
  round,
  autor,
  colunas,
  linhas,
  comVidas,
}: {
  round: Round
  autor: Player | undefined
  colunas: string[]
  linhas: string[]
  comVidas: boolean
}) {
  const palpite =
    round.guess_row !== null && round.guess_column !== null
      ? nomeCoordenada(round.guess_row, round.guess_column)
      : null

  const conteudo = {
    correct: { selo: 'Acertaram!', classe: 'certo' },
    wrong: { selo: 'Não era essa…', classe: 'errado' },
    timeout: { selo: 'Tempo esgotado', classe: 'errado' },
    skipped: { selo: 'Vez pulada', classe: 'neutro' },
    thinking: { selo: '', classe: 'neutro' },
    guessing: { selo: '', classe: 'neutro' },
  }[round.status]

  const penalidade = comVidas ? ' Uma vida a menos.' : ''

  return (
    <div className="revelacao-fundo">
      <div className={`revelacao ${conteudo.classe}`}>
        <span className="revelacao-selo">{conteudo.selo}</span>

        {round.status === 'correct' && (
          <>
            <p className="revelacao-pista">“{round.association}”</p>
            <p className="revelacao-texto">
              {autor?.name ?? 'Alguém'} ligou{' '}
              <strong>{colunas[round.column_index]}</strong> +{' '}
              <strong>{linhas[round.row_index]}</strong> — casa{' '}
              <strong>
                {nomeCoordenada(round.row_index, round.column_index)}
              </strong>
            </p>
          </>
        )}

        {/* No erro a coordenada certa NÃO é revelada: a carta volta ao baralho */}
        {(round.status === 'wrong' || round.status === 'timeout') && (
          <>
            {round.association && (
              <p className="revelacao-pista">“{round.association}”</p>
            )}
            <p className="revelacao-texto">
              {round.status === 'wrong' && palpite
                ? `O grupo escolheu ${palpite}, mas a pista de ${autor?.name ?? 'alguém'} era para outra casa.`
                : `${autor?.name ?? 'Alguém'} ficou sem tempo.`}
            </p>
            <p className="revelacao-detalhe">
              A carta volta para o baralho.{penalidade}
            </p>
          </>
        )}

        {round.status === 'skipped' && (
          <p className="revelacao-texto">
            A carta de {autor?.name ?? 'alguém'} voltou para o baralho.
          </p>
        )}
      </div>
    </div>
  )
}
