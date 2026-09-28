'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { salvarJogador } from '@/lib/game'

export default function EntrarSala() {
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function entrar(event: FormEvent) {
    event.preventDefault()

    const codigoLimpo = codigo
      .trim()
      .toUpperCase()

    if (!nome.trim()) {
      setErro('Digite seu nome.')
      return
    }

    if (!codigoLimpo) {
      setErro('Digite o código da sala.')
      return
    }

    try {
      setLoading(true)
      setErro('')

      const {
        data: sala,
        error: roomError,
      } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', codigoLimpo)
        .maybeSingle()

      if (roomError) {
        throw roomError
      }

      if (!sala) {
        setErro('Sala não encontrada.')
        return
      }

      if (sala.status !== 'waiting') {
        setErro(
          'Essa partida já foi iniciada.'
        )
        return
      }

      const {
        data: jogadores,
        error: countError,
      } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', sala.id)

      if (countError) {
        throw countError
      }

      const {
        data: jogador,
        error: playerError,
      } = await supabase
        .from('players')
        .insert({
          room_id: sala.id,
          name: nome.trim(),
          is_host: false,
          connected: true,
          player_order:
            (jogadores?.length ?? 0) + 1,
        })
        .select()
        .single()

      if (playerError) {
        throw playerError
      }

      salvarJogador(
        codigoLimpo,
        jogador.id
      )

      router.push(
        `/sala/${codigoLimpo}`
      )
    } catch (error) {
      console.error(error)

      setErro(
        'Não foi possível entrar na sala.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="main-page">
      <header className="game-header">
        <h1 className="game-logo">
          Entre Brisas
        </h1>
      </header>

      <section className="page-content">
        <Link href="/" className="back-link">
          ← Voltar
        </Link>

        <div className="card">
          <h2 className="page-title">
            Entrar
          </h2>

          <p className="page-description">
            Digite o código enviado pelo
            anfitrião.
          </p>

          <form onSubmit={entrar}>
            <div className="form-group">
              <label className="label">
                Seu nome
              </label>

              <input
                className="input"
                value={nome}
                onChange={(event) =>
                  setNome(event.target.value)
                }
                placeholder="Seu nome"
                maxLength={40}
              />
            </div>

            <div className="form-group">
              <label className="label">
                Código da sala
              </label>

              <input
                className="input room-code-input"
                value={codigo}
                onChange={(event) =>
                  setCodigo(
                    event.target.value
                      .toUpperCase()
                      .slice(0, 6)
                  )
                }
                placeholder="ABC123"
                maxLength={6}
              />
            </div>

            {erro && (
              <div className="error">
                {erro}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-secondary"
              disabled={loading}
            >
              {loading
                ? 'Entrando...'
                : 'Entrar na sala'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}