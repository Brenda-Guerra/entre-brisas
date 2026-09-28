'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

import { supabase } from '@/lib/supabase'
import {
  gerarCodigoSala,
  salvarJogador,
} from '@/lib/game'

export default function CriarSala() {
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [gridSize, setGridSize] = useState('4')
  const [turnTime, setTurnTime] = useState('120')

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function gerarCodigoUnico() {
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const codigo = gerarCodigoSala()

      const { data } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', codigo)
        .maybeSingle()

      if (!data) {
        return codigo
      }
    }

    throw new Error(
      'Não foi possível gerar um código de sala.'
    )
  }

  async function criarSala(event: FormEvent) {
    event.preventDefault()

    if (!nome.trim()) {
      setErro('Digite seu nome.')
      return
    }

    try {
      setLoading(true)
      setErro('')

      const codigo = await gerarCodigoUnico()

      const tempo =
        turnTime === 'unlimited'
          ? null
          : Number(turnTime)

      // 1. Criar a sala
      const { data: sala, error: roomError } =
        await supabase
          .from('rooms')
          .insert({
            code: codigo,
            grid_size: Number(gridSize),
            turn_time: tempo,
            status: 'waiting',
          })
          .select()
          .single()

      if (roomError) {
        throw roomError
      }

      // 2. Criar anfitrião
      const {
        data: jogador,
        error: playerError,
      } = await supabase
        .from('players')
        .insert({
          room_id: sala.id,
          name: nome.trim(),
          is_host: true,
          connected: true,
          player_order: 1,
        })
        .select()
        .single()

      if (playerError) {
        throw playerError
      }

      // 3. Definir host da sala
      const { error: updateError } =
        await supabase
          .from('rooms')
          .update({
            host_id: jogador.id,
          })
          .eq('id', sala.id)

      if (updateError) {
        throw updateError
      }

      salvarJogador(codigo, jogador.id)

      router.push(`/sala/${codigo}`)
    } catch (error) {
      console.error(error)

      setErro(
        'Não foi possível criar a sala. Tente novamente.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="main-page">
      <header className="game-header">
        <h1 className="game-logo">
          Entre Pistas
        </h1>
      </header>

      <section className="page-content">
        <Link href="/" className="back-link">
          ← Voltar
        </Link>

        <div className="card">
          <h2 className="page-title">
            Criar sala
          </h2>

          <p className="page-description">
            Configure a partida e convide
            seus amigos.
          </p>

          <form onSubmit={criarSala}>
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
                maxLength={40}
                placeholder="Ex.: Talita"
              />
            </div>

            <div className="form-group">
              <label className="label">
                Tamanho da grade
              </label>

              <select
                className="select"
                value={gridSize}
                onChange={(event) =>
                  setGridSize(event.target.value)
                }
              >
                <option value="3">3 × 3</option>
                <option value="4">4 × 4</option>
                <option value="5">5 × 5</option>
                <option value="6">6 × 6</option>
              </select>
            </div>

            <div className="form-group">
              <label className="label">
                Tempo por jogador
              </label>

              <select
                className="select"
                value={turnTime}
                onChange={(event) =>
                  setTurnTime(event.target.value)
                }
              >
                <option value="60">
                  1 minuto
                </option>

                <option value="120">
                  2 minutos
                </option>

                <option value="180">
                  3 minutos
                </option>

                <option value="240">
                  4 minutos
                </option>

                <option value="300">
                  5 minutos
                </option>

                <option value="unlimited">
                  Ilimitado
                </option>
              </select>
            </div>

            {erro && (
              <div className="error">
                {erro}
              </div>
            )}

            <button
              className="btn btn-primary"
              disabled={loading}
              type="submit"
            >
              {loading
                ? 'Criando...'
                : 'Criar sala'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}