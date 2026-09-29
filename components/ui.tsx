import type { CSSProperties, ReactNode } from 'react'

export function LogoIcone({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <svg
      className="logo-icone"
      width={tamanho}
      height={tamanho}
      viewBox="0 0 44 44"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="12"
        width="24"
        height="24"
        rx="6"
        fill="var(--blue)"
        stroke="var(--ink)"
        strokeWidth="2.5"
      />
      <rect
        x="16"
        y="4"
        width="24"
        height="24"
        rx="6"
        fill="var(--pink)"
        stroke="var(--ink)"
        strokeWidth="2.5"
      />
      <path
        d="M21 13.5h11a3 3 0 1 0-3-3"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M21 19h14a3 3 0 1 1-3 3"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Logo({
  compacto = false,
}: {
  compacto?: boolean
}) {
  return (
    <div className={`logo ${compacto ? 'logo-compacto' : ''}`}>
      <LogoIcone tamanho={compacto ? 32 : 42} />
      <span className="logo-texto">
        Entre <em>Brisas</em>
      </span>
    </div>
  )
}

export function Avatar({
  nome,
  cor,
  tamanho = 'md',
  online,
}: {
  nome: string
  cor: string
  tamanho?: 'sm' | 'md' | 'lg'
  online?: boolean
}) {
  return (
    <span
      className={`avatar avatar-${tamanho}`}
      style={{ '--avatar': cor } as CSSProperties}
    >
      {nome.charAt(0).toUpperCase()}

      {online !== undefined && (
        <span
          className={`avatar-status ${online ? 'on' : 'off'}`}
          title={online ? 'Online' : 'Offline'}
        />
      )}
    </span>
  )
}

export function Aviso({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null

  return (
    <div className="aviso" role="status">
      {mensagem}
    </div>
  )
}

export function Modal({
  titulo,
  children,
  aoFechar,
}: {
  titulo: string
  children: ReactNode
  aoFechar: () => void
}) {
  return (
    <div className="modal-fundo" onClick={aoFechar}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="modal-titulo">{titulo}</h3>
        {children}
      </div>
    </div>
  )
}

export function Carregando({ texto }: { texto: string }) {
  return (
    <main className="tela-centro">
      <div className="carregando">
        <div className="carregando-tiles">
          <span />
          <span />
          <span />
        </div>
        <p>{texto}</p>
      </div>
    </main>
  )
}
