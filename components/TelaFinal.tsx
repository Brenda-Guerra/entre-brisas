'use client'

import type { CSSProperties } from 'react'

import {
  classificacao,
  corDoJogador,
  nomeCoordenada,
  ordenarJogadores,
  ordenarRodadas,
  resumoPartida,
} from '@/lib/game'
import type { Player, Room, Round } from '@/lib/types'
import { Avatar } from '@/components/ui'
import { Tabuleiro } from '@/components/Tabuleiro'

type Props = {
  room: Room
  players: Player[]
  rounds: Round[]
  colunas: string[]
  linhas: string[]
  meuPlayerId: string | null
  souHost: boolean
  ocupado: boolean
  onJogarNovamente: () => void
  onSair: () => void
}

const TEXTOS = {
  victory: {
    selo: 'Vitória!',
    titulo: 'O tabuleiro foi completado',
    subtitulo: 'Todas as casas do tabuleiro foram preenchidas.',
  },
  defeat: {
    selo: 'Derrota',
    titulo: 'As brisas se perderam',
    subtitulo: 'As vidas acabaram antes de o tabuleiro ser completado.',
  },
  ended: {
    selo: 'Fim de jogo',
    titulo: 'Partida encerrada',
    subtitulo: 'O anfitrião encerrou a partida antes do fim.',
  },
}

/** Posições pseudoaleatórias, porém estáveis entre renderizações. */
function particulas(quantidade: number) {
  return Array.from({ length: quantidade }, (_, i) => ({
    left: (i * 37) % 100,
    delay: ((i * 53) % 40) / 10,
    duration: 3 + ((i * 29) % 30) / 10,
    rotate: (i * 71) % 360,
    cor: ['var(--blue)', 'var(--pink)', 'var(--yellow)', 'var(--green)'][i % 4],
  }))
}

export function TelaFinal({
  room,
  players,
  rounds,
  colunas,
  linhas,
  meuPlayerId,
  souHost,
  ocupado,
  onJogarNovamente,
  onSair,
}: Props) {
  const resultado = room.result ?? 'ended'
  const texto = TEXTOS[resultado]
  const resumo = resumoPartida(room, rounds)
  const nota = classificacao(resumo.acertos, resumo.erros)
  const historico = ordenarRodadas(rounds).filter(
    (round) =>
      round.status !== 'thinking' &&
      round.status !== 'guessing' &&
      // vez pulada antes de dar a pista não entra no histórico
      !(round.status === 'skipped' && !round.association),
  )

  const estatisticas = ordenarJogadores(players)
    .map((player) => {
      const dele = rounds.filter(
        (round) =>
          round.current_player_id === player.id &&
          round.status !== 'skipped' &&
          round.status !== 'thinking' &&
          round.status !== 'guessing',
      )

      return {
        player,
        pistas: dele.length,
        acertos: dele.filter((round) => round.status === 'correct').length,
      }
    })
    .filter((item) => item.pistas > 0 || item.player.connected)

  const destaque = [...estatisticas].sort(
    (a, b) => b.acertos - a.acertos || a.pistas - b.pistas,
  )[0]

  return (
    <main className={`final final-${resultado}`}>
      {resultado === 'victory' && (
        <div className="confete" aria-hidden="true">
          {particulas(46).map((p, i) => (
            <span
              key={i}
              style={
                {
                  left: `${p.left}%`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                  background: p.cor,
                  '--giro': `${p.rotate}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}

      {resultado === 'defeat' && (
        <div className="chuva" aria-hidden="true">
          {particulas(34).map((p, i) => (
            <span
              key={i}
              style={{
                left: `${p.left}%`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration / 2.4}s`,
              }}
            />
          ))}
        </div>
      )}

      <section className="final-conteudo">
        <div className="final-esq">
          <header className="final-topo">
            <span className="final-selo">{texto.selo}</span>
            <h1 className="final-titulo">{texto.titulo}</h1>
            <p className="final-subtitulo">{texto.subtitulo}</p>
          </header>

          <div className="final-numeros">
            <div className="numero numero-destaque">
              <span className="numero-valor">
                {resumo.acertos}
                <small>/{resumo.total}</small>
              </span>
              <span className="numero-rotulo">cartas acertadas</span>
            </div>

            <div className="numero">
              <span className="numero-valor">{resumo.erros}</span>
              <span className="numero-rotulo">erros</span>
            </div>

            <div className="numero">
              <span className="numero-valor">{historico.length}</span>
              <span className="numero-rotulo">rodadas</span>
            </div>
          </div>

          <div className="final-nota">
            <span className="final-nota-rotulo">Classificação</span>
            <strong>{nota.titulo}</strong>
            <span>{nota.texto}</span>
          </div>

          <div className="final-acoes">
            {souHost ? (
              <button
                className="btn btn-primario"
                onClick={onJogarNovamente}
                disabled={ocupado}
              >
                Jogar de novo
              </button>
            ) : (
              <div className="aguardando">
                Aguardando o anfitrião começar outra partida…
              </div>
            )}

            <button className="btn btn-claro" onClick={onSair}>
              Sair da sala
            </button>
          </div>
        </div>

        <div className="final-dir">
          <div className="final-bloco final-bloco-tabuleiro">
            <h2 className="bloco-titulo">Tabuleiro final</h2>
            <Tabuleiro
              compacto
              gridSize={room.grid_size}
              colunas={colunas}
              linhas={linhas}
              rounds={rounds}
              players={players}
            />
          </div>

          <div className="final-rodape">
            <div className="final-bloco">
              <h2 className="bloco-titulo">Jogadores</h2>

              <ul className="final-jogadores">
                {estatisticas.map(({ player, pistas, acertos }) => (
                  <li key={player.id}>
                    <Avatar
                      nome={player.name}
                      cor={corDoJogador(players, player.id)}
                      tamanho="sm"
                    />
                    <span className="final-jogador-nome">
                      {player.name}
                      {player.id === meuPlayerId && <em> (você)</em>}
                    </span>
                    {destaque?.player.id === player.id && acertos > 0 && (
                      <span className="tag tag-amarela">melhor brisa</span>
                    )}
                    <span className="final-jogador-placar">
                      {acertos}/{pistas}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="final-bloco">
              <h2 className="bloco-titulo">Pistas da partida</h2>

              {historico.length === 0 ? (
                <p className="texto-suave">Nenhuma pista foi dada.</p>
              ) : (
                <ol className="historico">
                  {historico.map((round) => {
                    const autor = players.find(
                      (player) => player.id === round.current_player_id,
                    )

                    return (
                      <li
                        key={round.id}
                        className={`historico-item ${round.status}`}
                      >
                        <span className="historico-coord">
                          {nomeCoordenada(round.row_index, round.column_index)}
                        </span>
                        <span className="historico-pista">
                          {round.association ?? 'sem pista'}
                          <small>{autor?.name ?? 'Jogador'}</small>
                        </span>
                        <span className="historico-resultado">
                          {round.status === 'correct' && '✓'}
                          {round.status === 'wrong' && '✕'}
                          {round.status === 'timeout' && '⏱'}
                          {round.status === 'skipped' && '↷'}
                        </span>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
