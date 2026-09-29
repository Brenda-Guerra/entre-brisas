'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState, type FormEvent } from 'react'

import { supabase } from '@/lib/supabase'
import { obterJogador, salvarJogador } from '@/lib/game'
import { Logo } from '@/components/ui'
import { BotaoSom } from '@/components/Som'

export default function EntrarSala() {
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

        <Suspense fallback={<div className="cartao cartao-form" />}>
          <FormularioEntrar />
        </Suspense>
      </section>
    </main>
  )
}

function FormularioEntrar() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState(
    (searchParams.get('codigo') ?? '').toUpperCase().slice(0, 6)
  )

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function entrar(event: FormEvent) {
    event.preventDefault()

    const codigoLimpo = codigo.trim().toUpperCase()

    if (!nome.trim()) {
      setErro('Digite seu nome.')
      return
    }

    if (codigoLimpo.length !== 6) {
      setErro('O código tem 6 caracteres.')
      return
    }

    try {
      setLoading(true)
      setErro('')

      const { data: sala, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', codigoLimpo)
        .maybeSingle()

      if (roomError) throw roomError

      if (!sala) {
        setErro('Sala não encontrada. Confira o código.')
        setLoading(false)
        return
      }

      const { data: jogadores, error: jogadoresError } = await supabase
        .from('players')
        .select('id, player_order')
        .eq('room_id', sala.id)

      if (jogadoresError) throw jogadoresError

      // Já participo desta sala neste aparelho? Então só volto para ela.
      const idSalvo = obterJogador(codigoLimpo)

      if (idSalvo && jogadores?.some((jogador) => jogador.id === idSalvo)) {
        await supabase
          .from('players')
          .update({ connected: true, name: nome.trim() })
          .eq('id', idSalvo)

        router.push(`/sala/${codigoLimpo}`)
        return
      }

      if (sala.status !== 'waiting') {
        setErro('Essa partida já começou. Espere ela terminar.')
        setLoading(false)
        return
      }

      const maiorOrdem = (jogadores ?? []).reduce(
        (maior, jogador) => Math.max(maior, jogador.player_order ?? 0),
        0
      )

      const { data: jogador, error: playerError } = await supabase
        .from('players')
        .insert({
          room_id: sala.id,
          name: nome.trim(),
          is_host: false,
          connected: true,
          player_order: maiorOrdem + 1,
        })
        .select()
        .single()

      if (playerError) throw playerError

      salvarJogador(codigoLimpo, jogador.id)

      router.push(`/sala/${codigoLimpo}`)
    } catch (error) {
      console.error(error)
      setErro('Não foi possível entrar na sala.')
      setLoading(false)
    }
  }

  return (
    <div className="cartao cartao-form">
      <h1 className="titulo-pagina">Entrar</h1>
      <p className="descricao-pagina">
        Digite o código que o anfitrião compartilhou.
      </p>

      <form onSubmit={entrar}>
        <div className="campo">
          <label className="rotulo" htmlFor="codigo">
            Código da sala
          </label>
          <input
            id="codigo"
            className="input input-codigo"
            value={codigo}
            onChange={(event) =>
              setCodigo(
                event.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, '')
                  .slice(0, 6)
              )
            }
            placeholder="ABC123"
            maxLength={6}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="campo">
          <label className="rotulo" htmlFor="nome">
            Seu nome
          </label>
          <input
            id="nome"
            className="input"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Como te chamam?"
            maxLength={40}
            autoComplete="nickname"
            autoFocus={codigo.length === 6}
          />
        </div>

        {erro && <div className="erro">{erro}</div>}

        <button
          type="submit"
          className="btn btn-rosa btn-grande"
          disabled={loading}
        >
          {loading ? 'Entrando…' : 'Entrar na sala'}
        </button>
      </form>
    </div>
  )
}
