'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { supabase } from '@/lib/supabase'
import {
  gerarCodigoSala,
  salvarJogador,
  vidasTotais,
} from '@/lib/game'
import { Logo } from '@/components/ui'
import { BotaoSom } from '@/components/Som'

const TAMANHOS = [3, 4, 5, 6]

const TEMPOS = [
  { valor: '60', rotulo: '1 min' },
  { valor: '120', rotulo: '2 min' },
  { valor: '180', rotulo: '3 min' },
  { valor: '300', rotulo: '5 min' },
  { valor: 'unlimited', rotulo: '∞' },
]

export default function CriarSala() {
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [gridSize, setGridSize] = useState(4)
  const [turnTime, setTurnTime] = useState('120')

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function gerarCodigoUnico() {
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      const codigo = gerarCodigoSala()

      const { data, error } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', codigo)
        .maybeSingle()

      if (error) throw error
      if (!data) return codigo
    }

    throw new Error('Não foi possível gerar um código de sala.')
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

      const { data: sala, error: roomError } = await supabase
        .from('rooms')
        .insert({
          code: codigo,
          grid_size: gridSize,
          turn_time: turnTime === 'unlimited' ? null : Number(turnTime),
          status: 'waiting',
        })
        .select()
        .single()

      if (roomError) throw roomError

      const { data: jogador, error: playerError } = await supabase
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

      if (playerError) throw playerError

      const { error: updateError } = await supabase
        .from('rooms')
        .update({ host_id: jogador.id })
        .eq('id', sala.id)

      if (updateError) throw updateError

      salvarJogador(codigo, jogador.id)

      router.push(`/sala/${codigo}`)
    } catch (error) {
      console.error(error)
      setErro('Não foi possível criar a sala. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <main className="pagina">
      <header className="topo">
        <Link href="/" aria-label="Início">
          <Logo />
        </Link>
        <BotaoSom />
      </header>

      <section className="conteudo">
        <Link href="/" className="voltar">
          ← Voltar
        </Link>

        <div className="cartao cartao-form">
          <h1 className="titulo-pagina">Criar sala</h1>
          <p className="descricao-pagina">
            Escolha o tamanho do tabuleiro e o tempo de cada fase.
          </p>

          <form onSubmit={criarSala}>
            <div className="campo">
              <label className="rotulo" htmlFor="nome">
                Seu nome
              </label>
              <input
                id="nome"
                className="input"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                maxLength={40}
                placeholder="Como te chamam?"
                autoComplete="nickname"
              />
            </div>

            <div className="campo">
              <span className="rotulo">Tabuleiro</span>
              <div className="opcoes" role="radiogroup">
                {TAMANHOS.map((tamanho) => (
                  <button
                    key={tamanho}
                    type="button"
                    role="radio"
                    aria-checked={gridSize === tamanho}
                    className={`opcao ${gridSize === tamanho ? 'ativa' : ''}`}
                    onClick={() => setGridSize(tamanho)}
                  >
                    <span
                      className="mini-grade"
                      style={{ gridTemplateColumns: `repeat(${tamanho}, 1fr)` }}
                      aria-hidden="true"
                    >
                      {Array.from({ length: tamanho * tamanho }).map((_, i) => (
                        <i key={i} />
                      ))}
                    </span>
                    {tamanho}×{tamanho}
                  </button>
                ))}
              </div>
              <p className="dica">
                {gridSize * gridSize} cartas · {vidasTotais(gridSize)} vidas
              </p>
            </div>

            <div className="campo">
              <span className="rotulo">Tempo por fase</span>
              <div className="opcoes opcoes-tempo" role="radiogroup">
                {TEMPOS.map((tempo) => (
                  <button
                    key={tempo.valor}
                    type="button"
                    role="radio"
                    aria-checked={turnTime === tempo.valor}
                    className={`opcao ${turnTime === tempo.valor ? 'ativa' : ''}`}
                    onClick={() => setTurnTime(tempo.valor)}
                  >
                    {tempo.rotulo}
                  </button>
                ))}
              </div>
              <p className="dica">
                Vale para a pista e para os palpites. Acabou? Perde uma vida.
              </p>
            </div>

            {erro && <div className="erro">{erro}</div>}

            <button
              className="btn btn-primario btn-grande"
              disabled={loading}
              type="submit"
            >
              {loading ? 'Criando…' : 'Criar sala'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
