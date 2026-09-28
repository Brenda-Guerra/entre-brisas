import Link from 'next/link'

export default function Home() {
  return (
    <main className="main-page">
      <header className="game-header">
        <h1 className="game-logo">
          Entre Brisas
        </h1>
      </header>

      <section className="page-content hero">
        <h2 className="hero-title">
          CONECTE
          <br />
          <span>AS BRISAS</span>
        </h2>

        <p className="hero-subtitle">
          Combine palavras, dê brisas e descubra
          as coordenadas junto com seus amigos.
        </p>

        <div className="buttons">
          <Link href="/criar">
            <button className="btn btn-primary">
              Criar uma sala
            </button>
          </Link>

          <Link href="/entrar">
            <button className="btn btn-secondary">
              Entrar em uma sala
            </button>
          </Link>
        </div>
      </section>
    </main>
  )
}