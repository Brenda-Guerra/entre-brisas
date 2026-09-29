'use client'

import { useEffect, useSyncExternalStore } from 'react'

import {
  assinarSom,
  definirMudo,
  estaMudo,
  iniciarMusica,
  somAtivo,
} from '@/lib/som'

export function useMudo() {
  return useSyncExternalStore(assinarSom, estaMudo, () => false)
}

/** Liga a música na primeira interação com a página (regra dos navegadores). */
export function SomGlobal() {
  useEffect(() => {
    const eventos = ['pointerdown', 'keydown'] as const

    function remover() {
      eventos.forEach((evento) =>
        window.removeEventListener(evento, iniciar)
      )
    }

    function iniciar() {
      if (estaMudo()) return

      iniciarMusica()

      setTimeout(() => {
        if (somAtivo()) remover()
      }, 400)
    }

    eventos.forEach((evento) =>
      window.addEventListener(evento, iniciar)
    )

    return remover
  }, [])

  return null
}

export function BotaoSom() {
  const mudo = useMudo()

  return (
    <button
      type="button"
      className="botao-som"
      onClick={() => definirMudo(!mudo)}
      aria-label={mudo ? 'Ligar som' : 'Desligar som'}
      title={mudo ? 'Ligar som' : 'Desligar som'}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M4 9.5h3.5L12 5v14l-4.5-4.5H4z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {mudo ? (
          <path
            d="M16 9.5l5 5m0-5l-5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ) : (
          <>
            <path
              d="M15.5 9a4 4 0 0 1 0 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M18.2 6.5a7.5 7.5 0 0 1 0 11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
    </button>
  )
}
