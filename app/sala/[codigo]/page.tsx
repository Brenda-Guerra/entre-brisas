'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import { useParams, useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'
import {
  ErroJogo,
  corDoJogador,
  esquecerJogador,
  formatarTempo,
  iniciarPartida,
  obterJogador,
  ordenarJogadores,
  sairDaSala,
  vidasTotais,
} from '@/lib/game'
import { useAviso, usePresenca } from '@/lib/hooks'
import type { Player, Room } from '@/lib/types'
import {
  Avatar,
  Aviso,
  Carregando,
  Logo,
} from '@/components/ui'
import { BotaoSom } from '@/components/Som'

export default function Sala() {
  const params = useParams()
  const router = useRouter()

  const codigo = String(params.codigo).toUpperCase()

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [meuPlayerId, setMeuPlayerId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [iniciando, setIniciando] = useState(false)
  const [erro, setErro] = useState('')

  const { aviso, avisar } = useAviso()
  const online = usePresenca(room?.id, meuPlayerId)

  const roomId = room?.id

  const carregarJogadores = useCallback(async (id: string) => {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', id)

    if (error) {
      console.error(error)
      return
    }

    setPlayers(data ?? [])
  }, [])

  const carregarSala = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (data) setRoom(data)
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
        setErro(error ? 'Erro ao carregar a sala.' : 'Sala não encontrada.')
        setLoading(false)
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

      await carregarJogadores(sala.id)

      if (cancelado) return

      setMeuPlayerId(playerId)
      setRoom(sala)
      setLoading(false)
    }

    carregar()

    return () => {
      cancelado = true
    }
  }, [codigo, router, carregarJogadores])

  // Tempo real: jogadores entrando/saindo e a sala mudando de status
  useEffect(() => {
    if (!roomId) return

    const channel = supabase
      .channel(`sala-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        () => carregarJogadores(roomId)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        () => carregarSala(roomId)
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          carregarJogadores(roomId)
          carregarSala(roomId)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, carregarJogadores, carregarSala])

  // Partida começou (ou terminou) → todos vão para a tela do jogo
  useEffect(() => {
    if (room?.status === 'playing' || room?.status === 'finished') {
      router.replace(`/jogo/${codigo}`)
    }
  }, [room?.status, codigo, router])

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(codigo)
      avisar('Código copiado!')
    } catch {
      avisar(`Código: ${codigo}`)
    }
  }

  async function compartilhar() {
    const url = `${window.location.origin}/entrar?codigo=${codigo}`
    const texto = `Bora jogar Entre Brisas! Código da sala: ${codigo}`

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Entre Brisas', text: texto, url })
        return
      } catch (error) {
        // Usuário cancelou o compartilhamento
        if ((error as Error).name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(`${texto}\n${url}`)
      avisar('Convite copiado!')
    } catch {
      avisar('Não foi possível copiar o convite.')
    }
  }

  async function sair() {
    if (room && meuPlayerId) {
      await sairDaSala(room, meuPlayerId, players)
    }

    router.push('/')
  }

  async function comecar() {
    if (!room) return

    setIniciando(true)

    try {
      await iniciarPartida(room)
      router.replace(`/jogo/${codigo}`)
    } catch (error) {
      console.error(error)
      avisar(
        error instanceof ErroJogo
          ? error.message
          : 'Não foi possível iniciar a partida.'
      )
      setIniciando(false)
    }
  }

  if (loading) {
    return <Carregando texto="Abrindo a sala…" />
  }

  if (erro || !room) {
    return (
      <main className="tela-centro">
        <div className="cartao cartao-mensagem">
          <h2>Sala indisponível</h2>
          <p>{erro}</p>
          <button className="btn btn-primario" onClick={() => router.push('/')}>
            Voltar ao início
          </button>
        </div>
      </main>
    )
  }

  const souHost = room.host_id === meuPlayerId
  const conectados = ordenarJogadores(players).filter(
    (player) => player.connected
  )
  const podeIniciar = conectados.length >= 2

  return (
    <main className="pagina">
      <header className="topo">
        <Logo />
        <BotaoSom />
      </header>

      <section className="conteudo conteudo-largo">
        <div className="lobby">
          <div className="lobby-principal">
            <div className="codigo-sala">
              <span className="codigo-rotulo">Código da sala</span>
              <button
                className="codigo-valor"
                onClick={copiarCodigo}
                title="Copiar código"
              >
                {codigo.split('').map((letra, i) => (
                  <span key={i}>{letra}</span>
                ))}
              </button>
              <span className="codigo-dica">Toque para copiar</span>
            </div>

            <div className="config-sala">
              <div className="config-item">
                <span className="config-rotulo">Tabuleiro</span>
                <strong>
                  {room.grid_size} × {room.grid_size}
                </strong>
              </div>
              <div className="config-item">
                <span className="config-rotulo">Tempo</span>
                <strong>{formatarTempo(room.turn_time)}</strong>
              </div>
              <div className="config-item">
                <span className="config-rotulo">Vidas</span>
                <strong>{vidasTotais(room.grid_size)}</strong>
              </div>
            </div>

            <div className="cartao">
              <div className="cartao-cabeca">
                <h2 className="cartao-titulo">Jogadores</h2>
                <span className="pilula">{conectados.length}</span>
              </div>

              <ul className="lista-jogadores lista-lobby">
                {conectados.map((player) => {
                  const estaOnline = !online || online.has(player.id)

                  return (
                    <li
                      key={player.id}
                      className={`jogador ${estaOnline ? '' : 'offline'}`}
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
                        <span className="tag tag-amarela">♛ anfitrião</span>
                      )}
                    </li>
                  )
                })}

                {conectados.length < 2 && (
                  <li className="jogador vaga">
                    <span className="avatar avatar-md avatar-vazio">?</span>
                    <span className="jogador-nome">
                      Esperando mais alguém…
                    </span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <aside className="lobby-lateral">
            <div className="cartao cartao-regras">
              <h2 className="cartao-titulo">Como jogar</h2>
              <ol className="passos">
                <li>
                  <span className="passo-num">1</span>
                  <p>
                    O tabuleiro tem palavras nas <strong>colunas</strong> e nas{' '}
                    <strong>linhas</strong>.
                  </p>
                </li>
                <li>
                  <span className="passo-num">2</span>
                  <p>
                    Na sua vez, você recebe uma casa secreta (ex.: B3) e dá{' '}
                    <strong>uma única palavra</strong> que ligue as duas.
                  </p>
                </li>
                <li>
                  <span className="passo-num">3</span>
                  <p>
                    Os outros votam na casa. Acertou? Ela é preenchida. Errou?
                    Perdem uma vida.
                  </p>
                </li>
                <li>
                  <span className="passo-num">4</span>
                  <p>
                    <strong>Vitória:</strong> completar o tabuleiro.{' '}
                    <strong>Derrota:</strong> ficar sem vidas.
                  </p>
                </li>
              </ol>
            </div>

            <div className="botoes">
              {souHost ? (
                <button
                  className="btn btn-primario btn-grande"
                  onClick={comecar}
                  disabled={!podeIniciar || iniciando}
                >
                  {iniciando
                    ? 'Embaralhando…'
                    : podeIniciar
                      ? 'Iniciar partida'
                      : 'Mínimo de 2 jogadores'}
                </button>
              ) : (
                <div className="aguardando">
                  <span className="pontinhos">
                    <i />
                    <i />
                    <i />
                  </span>
                  Aguardando o anfitrião iniciar
                </div>
              )}

              <button className="btn btn-rosa" onClick={compartilhar}>
                Convidar amigos
              </button>

              <button className="btn btn-fantasma" onClick={sair}>
                Sair da sala
              </button>
            </div>
          </aside>
        </div>
      </section>

      <Aviso mensagem={aviso} />
    </main>
  )
}
