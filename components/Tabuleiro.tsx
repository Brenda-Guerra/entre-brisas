'use client'

import {
  Fragment,
  useState,
  type CSSProperties,
} from 'react'

import {
  corDoJogador,
  letraColuna,
  nomeCoordenada,
} from '@/lib/game'
import type { Player, Round, Vote } from '@/lib/types'
import { LogoIcone } from '@/components/ui'

export type Celula = {
  linha: number
  coluna: number
}

type Props = {
  gridSize: number
  colunas: string[]
  linhas: string[]
  rounds: Round[]
  votos?: Vote[]
  players: Player[]
  /** Carta secreta — só é passada para quem está dando a pista. */
  alvo?: Celula | null
  selecionada?: Celula | null
  podeSelecionar?: boolean
  onSelecionar?: (celula: Celula) => void
  compacto?: boolean
}

export function Tabuleiro({
  gridSize,
  colunas,
  linhas,
  rounds,
  votos = [],
  players,
  alvo = null,
  selecionada = null,
  podeSelecionar = false,
  onSelecionar,
  compacto = false,
}: Props) {
  const [foco, setFoco] = useState<Celula | null>(null)

  const jogadas = new Map<string, Round>()

  for (const round of rounds) {
    if (
      round.status === 'correct' ||
      round.status === 'wrong' ||
      round.status === 'timeout'
    ) {
      jogadas.set(
        `${round.row_index}-${round.column_index}`,
        round
      )
    }
  }

  const iluminada = foco ?? selecionada ?? alvo

  return (
    <div className="tabuleiro-caixa">
      <div
        className={`tabuleiro ${compacto ? 'compacto' : ''}`}
        style={{ '--n': gridSize } as CSSProperties}
        onMouseLeave={() => setFoco(null)}
      >
        <div className="tab-canto">
          <LogoIcone tamanho={compacto ? 26 : 38} />
        </div>

        {colunas.map((palavra, coluna) => (
          <div
            key={`c-${coluna}`}
            className={`tab-cabeca tab-coluna ${
              iluminada?.coluna === coluna ? 'acesa' : ''
            }`}
          >
            <span className="tab-marca">
              {letraColuna(coluna)}
            </span>
            <span
              className="tab-palavra"
              style={{ '--len': palavra.length } as CSSProperties}
            >
              {palavra}
            </span>
          </div>
        ))}

        {linhas.map((palavra, linha) => (
          <Fragment key={`l-${linha}`}>
            <div
              className={`tab-cabeca tab-linha ${
                iluminada?.linha === linha ? 'acesa' : ''
              }`}
            >
              <span className="tab-marca">{linha + 1}</span>
              <span
              className="tab-palavra"
              style={{ '--len': palavra.length } as CSSProperties}
            >
              {palavra}
            </span>
            </div>

            {Array.from({ length: gridSize }).map((_, coluna) => {
              const jogada = jogadas.get(`${linha}-${coluna}`)
              const coord = nomeCoordenada(linha, coluna)
              const ehAlvo =
                alvo?.linha === linha && alvo?.coluna === coluna
              const ehSelecionada =
                selecionada?.linha === linha &&
                selecionada?.coluna === coluna
              const votosCelula = votos.filter(
                (vote) =>
                  vote.row_index === linha &&
                  vote.column_index === coluna
              )
              const clicavel = podeSelecionar && !jogada

              let classe = 'tab-celula'
              if (jogada?.status === 'correct') classe += ' certa'
              else if (jogada) classe += ' errada'
              else classe += ' livre'
              if (ehAlvo) classe += ' alvo'
              if (ehSelecionada) classe += ' selecionada'
              if (clicavel) classe += ' clicavel'

              return (
                <button
                  key={coord}
                  type="button"
                  className={classe}
                  disabled={!clicavel}
                  onClick={() =>
                    clicavel &&
                    onSelecionar?.({ linha, coluna })
                  }
                  onMouseEnter={() =>
                    !compacto && setFoco({ linha, coluna })
                  }
                  aria-label={`Célula ${coord}`}
                >
                  {jogada ? (
                    <>
                      <span
                        className="cel-pista"
                        style={
                          {
                            '--len': (jogada.association ?? '—').length,
                          } as CSSProperties
                        }
                      >
                        {jogada.association ?? '—'}
                      </span>
                      <span className="cel-coord">{coord}</span>
                      {jogada.status !== 'correct' && (
                        <span className="cel-x" aria-hidden="true">
                          ✕
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="cel-coord-grande">{coord}</span>
                      {ehAlvo && (
                        <span className="cel-etiqueta">
                          sua carta
                        </span>
                      )}
                    </>
                  )}

                  {votosCelula.length > 0 && (
                    <span className="cel-votos">
                      {votosCelula.map((vote) => {
                        const jogador = players.find(
                          (player) => player.id === vote.player_id
                        )

                        return (
                          <span
                            key={vote.id}
                            className="cel-voto"
                            title={jogador?.name}
                            style={{
                              background: corDoJogador(
                                players,
                                vote.player_id
                              ),
                            }}
                          >
                            {jogador?.name.charAt(0).toUpperCase()}
                          </span>
                        )
                      })}
                    </span>
                  )}
                </button>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
