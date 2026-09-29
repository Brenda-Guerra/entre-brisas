import Link from 'next/link'

import { Logo } from '@/components/ui'
import { BotaoSom } from '@/components/Som'

const DEMO_COLUNAS = ['Praia', 'Noite', 'Café']
const DEMO_LINHAS = ['Sol', 'Música', 'Livro']
const DEMO_PISTAS: Record<string, string> = {
  '0-0': 'Verão',
  '1-1': 'Serenata',
  '2-2': 'Sebo',
}

export default function Home() {
  return (
    <main className="pagina">
      <header className="topo">
        <Logo />
        <BotaoSom />
      </header>

      <section className="conteudo conteudo-largo inicio">
        <div className="inicio-texto">
          <span className="sobretitulo">Jogo cooperativo de palavras</span>

          <h1 className="inicio-titulo">
            Pode
            <br />
            <span>brisar!</span>
          </h1>

          <p className="inicio-sub">
            Uma palavra para ligar a coluna à linha. Seus amigos precisam
            descobrir qual casa você quis dizer. Completem o tabuleiro juntos!
          </p>

          <div className="botoes botoes-inicio">
            <Link href="/criar" className="btn btn-primario btn-grande">
              Criar uma sala
            </Link>
            <Link href="/entrar" className="btn btn-rosa btn-grande">
              Entrar com código
            </Link>
          </div>

          <ul className="inicio-fatos">
            <li>
              <strong>2+</strong> jogadores
            </li>
            <li>
              <strong>3×3</strong> a <strong>6×6</strong>
            </li>
            <li>
              <strong>~15</strong> minutos
            </li>
          </ul>
        </div>

        <div className="inicio-demo" aria-hidden="true">
          <div className="demo-tabuleiro">
            <span className="demo-canto" />
            {DEMO_COLUNAS.map((palavra, i) => (
              <span key={palavra} className="demo-cabeca demo-coluna">
                <b>{'ABC'[i]}</b>
                {palavra}
              </span>
            ))}

            {DEMO_LINHAS.map((palavra, linha) => (
              <div key={palavra} className="demo-linha">
                <span className="demo-cabeca demo-lin">
                  <b>{linha + 1}</b>
                  {palavra}
                </span>
                {DEMO_COLUNAS.map((_, coluna) => {
                  const pista = DEMO_PISTAS[`${linha}-${coluna}`]

                  return (
                    <span
                      key={coluna}
                      className={`demo-celula ${pista ? 'cheia' : ''}`}
                      style={{ animationDelay: `${(linha + coluna) * 0.35}s` }}
                    >
                      {pista ?? `${'ABC'[coluna]}${linha + 1}`}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="demo-bolha">
            <small>pista</small>
            “Serenata”
          </div>
        </div>
      </section>
    </main>
  )
}
