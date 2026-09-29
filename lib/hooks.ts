'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { supabase } from '@/lib/supabase'

/**
 * Quem está com a sala aberta agora (Supabase Realtime Presence).
 * Retorna null até a primeira sincronização.
 */
export function usePresenca(
  roomId: string | undefined,
  playerId: string | null
) {
  const [online, setOnline] =
    useState<Set<string> | null>(null)

  useEffect(() => {
    if (!roomId || !playerId) return

    const channel = supabase.channel(
      `presenca-${roomId}`,
      {
        config: {
          presence: { key: playerId },
        },
      }
    )

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnline(
          new Set(Object.keys(channel.presenceState()))
        )
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ player_id: playerId })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, playerId])

  return online
}

/** Date.now() atualizado a cada `intervaloMs`. */
export function useAgora(intervaloMs = 500) {
  const [agora, setAgora] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(
      () => setAgora(Date.now()),
      intervaloMs
    )

    return () => clearInterval(id)
  }, [intervaloMs])

  return agora
}

/** Pequena mensagem flutuante que some sozinha. */
export function useAviso() {
  const [aviso, setAviso] = useState<string | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout>>(null)

  const avisar = useCallback((mensagem: string) => {
    setAviso(mensagem)

    if (timeout.current) clearTimeout(timeout.current)

    timeout.current = setTimeout(
      () => setAviso(null),
      2600
    )
  }, [])

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current)
    },
    []
  )

  return { aviso, avisar }
}
