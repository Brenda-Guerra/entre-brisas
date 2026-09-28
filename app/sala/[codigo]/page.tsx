'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  useParams,
  useRouter,
} from 'next/navigation'

import { supabase } from '@/lib/supabase'
import { obterJogador } from '@/lib/game'

type Room = {
  id: string
  code: string
  host_id: string | null
  grid_size: number
  turn_time: number | null
  status: string
}

type Player = {
  id: string
  room_id: string
  name: string
  player_order: number | null
  connected: boolean
  is_host: boolean
}

export default function Sala() {
  const params = useParams()
  const router = useRouter()

  const codigo = String(
    params.codigo
  ).toUpperCase()

  const [room, setRoom] =
    useState<Room | null>(null)

  const [players, setPlayers] =
    useState<Player[]>([])

  const [meuPlayerId, setMeuPlayerId] =
    useState<string | null>(null)

  const [loading, setLoading] =
    useState(true)

  const [erro, setErro] =
    useState('')

  const carregarJogadores =
    useCallback(
      async (roomId: string) => {
        const {
          data,
          error,
        } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('player_order', {
            ascending: true,
          })
          .order('joined_at', {
            ascending: true,
          })

        if (error) {
          console.error(error)
          return
        }

        setPlayers(data ?? [])
      },
      []
    )

  useEffect(() => {
    async function carregarSala() {
      const playerId =
        obterJogador(codigo)

      setMeuPlayerId(playerId)

      const {
        data,
        error,
      } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', codigo)
        .maybeSingle()

      if (error) {
        console.error(error)
        setErro(
          'Erro ao carregar a sala.'
        )
        setLoading(false)
        return
      }

      if (!data) {
        setErro('Sala não encontrada.')
        setLoading(false)
        return
      }

      setRoom(data)

      await carregarJogadores(
        data.id
      )

      setLoading(false)
    }

    carregarSala()
  }, [codigo, carregarJogadores])

  useEffect(() => {
    if (!room) return

    const channel = supabase
      .channel(
        `players-${room.id}`
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          carregarJogadores(
            room.id
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(
        channel
      )
    }
  }, [
    room,
    carregarJogadores,
  ])

  async function copiarCodigo() {
    await navigator.clipboard.writeText(
      codigo
    )

    alert('Código copiado!')
  }

  async function compartilhar() {
    const url =
      window.location.href

    const texto =
      `Entre na minha sala do Entre Pistas!\n\n` +
      `Código: ${codigo}\n` +
      `${url}`

    if (navigator.share) {
      await navigator.share({
        title: 'Entre Pistas',
        text: texto,
        url,
      })

      return
    }

    await navigator.clipboard.writeText(
      texto
    )

    alert(
      'Convite copiado!'
    )
  }

  async function sair() {
    if (
      meuPlayerId &&
      room
    ) {
      await supabase
        .from('players')
        .update({
          connected: false,
        })
        .eq('id', meuPlayerId)
    }

    localStorage.removeItem(
      `entre-pistas-player-${codigo}`
    )

    router.push('/')
  }

  function formatarTempo(
    segundos: number | null
  ) {
    if (segundos === null) {
      return 'Ilimitado'
    }

    const minutos =
      segundos / 60

    return `${minutos} min`
  }

  if (loading) {
    return (
      <main className="main-page">
        <section className="page-content">
          <p className="waiting">
            Carregando sala...
          </p>
        </section>
      </main>
    )
  }

  if (erro || !room) {
    return (
      <main className="main-page">
        <section className="page-content">
          <div className="card">
            <h2>
              Sala indisponível
            </h2>

            <p>{erro}</p>

            <button
              className="btn btn-primary"
              onClick={() =>
                router.push('/')
              }
            >
              Voltar
            </button>
          </div>
        </section>
      </main>
    )
  }

  const souHost =
    room.host_id === meuPlayerId

  return (
    <main className="main-page">
      <header className="game-header">
        <h1 className="game-logo">
          Entre Pistas
        </h1>
      </header>

      <section className="page-content">
        <div className="room-code-box">
          <div className="room-code-label">
            Código da sala
          </div>

          <div className="room-code">
            {codigo}
          </div>
        </div>

        <div className="room-info">
          <div className="info-box">
            <div className="info-label">
              Grade
            </div>

            <div className="info-value">
              {room.grid_size} ×{' '}
              {room.grid_size}
            </div>
          </div>

          <div className="info-box">
            <div className="info-label">
              Tempo
            </div>

            <div className="info-value">
              {formatarTempo(
                room.turn_time
              )}
            </div>
          </div>
        </div>

        <h3 className="players-title">
          Jogadores ({players.length})
        </h3>

        <div className="players-list">
          {players.map(
            (player) => (
              <div
                className="player"
                key={player.id}
              >
                <div className="player-left">
                  <div className="player-avatar">
                    {player.name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div>
                    <strong>
                      {player.name}
                    </strong>

                    {player.id ===
                      meuPlayerId && (
                      <div className="you-badge">
                        Você
                      </div>
                    )}
                  </div>
                </div>

                {player.is_host && (
                  <span className="host-badge">
                    HOST
                  </span>
                )}
              </div>
            )
          )}
        </div>

        {!souHost && (
          <div className="waiting">
            Aguardando o anfitrião
            iniciar a partida...
          </div>
        )}

        <div className="buttons">
          {souHost && (
            <button
              className="btn btn-primary"
              onClick={() =>
                alert(
                  'Agora vamos implementar a partida.'
                )
              }
            >
              Iniciar partida
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={compartilhar}
          >
            Compartilhar sala
          </button>

          <button
            className="btn btn-light"
            onClick={copiarCodigo}
          >
            Copiar código
          </button>

          <button
            className="btn btn-light"
            onClick={sair}
          >
            Sair da sala
          </button>
        </div>
      </section>
    </main>
  )
}