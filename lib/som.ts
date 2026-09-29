'use client'

/*
 * Som do jogo, gerado com Web Audio API (sem arquivos de áudio).
 * - Música ambiente: acordes suaves + notinhas soltas com eco.
 * - Efeitos: tique do relógio, acerto, erro, "sua vez".
 *
 * Navegadores só liberam áudio depois de um clique/toque, então a
 * música começa na primeira interação com a página.
 */

const CHAVE = 'entre-brisas-som'

type Efeito = 'tique' | 'tiqueUrgente' | 'acerto' | 'erro' | 'suaVez'

/* ------------------------------------------------------------------ */
/* Preferência (mudo ou não), compartilhada entre componentes          */
/* ------------------------------------------------------------------ */

let mudo: boolean | null = null
const ouvintes = new Set<() => void>()

export function estaMudo() {
  if (mudo === null) {
    try {
      mudo = localStorage.getItem(CHAVE) === 'off'
    } catch {
      mudo = false
    }
  }

  return mudo
}

export function assinarSom(ouvinte: () => void) {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function definirMudo(valor: boolean) {
  mudo = valor

  try {
    localStorage.setItem(CHAVE, valor ? 'off' : 'on')
  } catch {
    // sem armazenamento: vale só nesta visita
  }

  ouvintes.forEach((ouvinte) => ouvinte())

  if (valor) motor.pararMusica()
  else motor.tocarMusica()
}

/* ------------------------------------------------------------------ */
/* Motor de áudio                                                      */
/* ------------------------------------------------------------------ */

function freq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Cmaj9 → Am9 → Fmaj7(#11) → Gsus2
const ACORDES = [
  [48, 55, 59, 64],
  [45, 52, 55, 60],
  [41, 48, 52, 57],
  [43, 50, 57, 62],
]

// Pentatônica de Dó, oitava alta, para as notinhas soltas
const MELODIA = [72, 74, 76, 79, 81, 84]

const DURACAO_COMPASSO = 5.2
const VOLUME_MUSICA = 0.2

class MotorSom {
  private ctx: AudioContext | null = null
  private mestre: GainNode | null = null
  private musica: GainNode | null = null
  private efeitos: GainNode | null = null
  private agendador: ReturnType<typeof setInterval> | null = null
  private proximoCompasso = 0
  private compasso = 0

  private preparar() {
    if (typeof window === 'undefined') return null

    if (!this.ctx) {
      const Contexto =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext

      if (!Contexto) return null

      const ctx = new Contexto()

      this.mestre = ctx.createGain()
      this.mestre.gain.value = 0.9
      this.mestre.connect(ctx.destination)

      this.musica = ctx.createGain()
      this.musica.gain.value = 0
      this.musica.connect(this.mestre)

      // Eco suave só na música
      const eco = ctx.createDelay(1)
      eco.delayTime.value = 0.42
      const filtroEco = ctx.createBiquadFilter()
      filtroEco.type = 'lowpass'
      filtroEco.frequency.value = 1600
      const retorno = ctx.createGain()
      retorno.gain.value = 0.35
      const molhado = ctx.createGain()
      molhado.gain.value = 0.4

      this.musica.connect(eco)
      eco.connect(filtroEco)
      filtroEco.connect(retorno)
      retorno.connect(eco)
      filtroEco.connect(molhado)
      molhado.connect(this.mestre)

      this.efeitos = ctx.createGain()
      this.efeitos.gain.value = 0.55
      this.efeitos.connect(this.mestre)

      this.ctx = ctx
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }

    return this.ctx
  }

  get ativo() {
    return this.ctx?.state === 'running'
  }

  tocarMusica() {
    if (estaMudo()) return

    const ctx = this.preparar()
    if (!ctx || !this.musica || this.agendador) return

    this.proximoCompasso = ctx.currentTime + 0.15
    this.musica.gain.cancelScheduledValues(ctx.currentTime)
    this.musica.gain.setValueAtTime(this.musica.gain.value, ctx.currentTime)
    this.musica.gain.linearRampToValueAtTime(VOLUME_MUSICA, ctx.currentTime + 4)

    this.agendar()
    this.agendador = setInterval(() => this.agendar(), 300)
  }

  pararMusica() {
    if (this.agendador) {
      clearInterval(this.agendador)
      this.agendador = null
    }

    if (this.ctx && this.musica) {
      const agora = this.ctx.currentTime
      this.musica.gain.cancelScheduledValues(agora)
      this.musica.gain.setValueAtTime(this.musica.gain.value, agora)
      this.musica.gain.linearRampToValueAtTime(0, agora + 0.6)
    }
  }

  private agendar() {
    if (!this.ctx) return

    while (this.proximoCompasso < this.ctx.currentTime + 1.5) {
      this.tocarCompasso(this.proximoCompasso, this.compasso % ACORDES.length)
      this.proximoCompasso += DURACAO_COMPASSO
      this.compasso++
    }
  }

  private tocarCompasso(inicio: number, indice: number) {
    const ctx = this.ctx
    if (!ctx || !this.musica) return

    const fim = inicio + DURACAO_COMPASSO

    // Pad: acorde com ataque lento e filtro fechado
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.frequency.value = 850
    filtro.connect(this.musica)

    for (const nota of ACORDES[indice]) {
      for (const [tipo, desafino, volume] of [
        ['sine', 0, 0.055],
        ['triangle', 6, 0.025],
      ] as const) {
        const osc = ctx.createOscillator()
        osc.type = tipo
        osc.frequency.value = freq(nota)
        osc.detune.value = desafino

        const env = ctx.createGain()
        env.gain.setValueAtTime(0, inicio)
        env.gain.linearRampToValueAtTime(volume, inicio + 1.8)
        env.gain.setValueAtTime(volume, fim - 0.4)
        env.gain.linearRampToValueAtTime(0, fim + 1.6)

        osc.connect(env)
        env.connect(filtro)
        osc.start(inicio)
        osc.stop(fim + 1.7)
      }
    }

    // Notinhas soltas, tipo sininho de vento
    const passo = DURACAO_COMPASSO / 8

    for (let i = 1; i < 8; i++) {
      if (Math.random() > 0.38) continue

      const nota = MELODIA[Math.floor(Math.random() * MELODIA.length)]
      const t = inicio + i * passo + Math.random() * 0.05

      this.nota(freq(nota), t, 1.8, 0.05, 'sine', this.musica)
    }
  }

  private nota(
    frequencia: number,
    inicio: number,
    duracao: number,
    volume: number,
    tipo: OscillatorType,
    destino: AudioNode
  ) {
    const ctx = this.ctx
    if (!ctx) return

    const osc = ctx.createOscillator()
    osc.type = tipo
    osc.frequency.value = frequencia

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, inicio)
    env.gain.linearRampToValueAtTime(volume, inicio + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao)

    osc.connect(env)
    env.connect(destino)
    osc.start(inicio)
    osc.stop(inicio + duracao + 0.05)
  }

  efeito(tipo: Efeito) {
    if (estaMudo()) return

    const ctx = this.preparar()
    if (!ctx || !this.efeitos) return

    const t = ctx.currentTime + 0.01
    const saida = this.efeitos

    switch (tipo) {
      case 'tique':
        this.nota(1175, t, 0.12, 0.35, 'triangle', saida)
        break

      case 'tiqueUrgente':
        this.nota(1568, t, 0.1, 0.4, 'triangle', saida)
        this.nota(1568, t + 0.14, 0.1, 0.32, 'triangle', saida)
        break

      case 'acerto':
        ;[72, 76, 79, 84].forEach((nota, i) =>
          this.nota(freq(nota), t + i * 0.085, 0.7, 0.3, 'triangle', saida)
        )
        break

      case 'erro':
        this.nota(freq(55), t, 0.35, 0.3, 'triangle', saida)
        this.nota(freq(50), t + 0.2, 0.6, 0.3, 'triangle', saida)
        break

      case 'suaVez':
        this.nota(freq(79), t, 0.6, 0.25, 'sine', saida)
        this.nota(freq(84), t + 0.13, 0.9, 0.25, 'sine', saida)
        break
    }
  }
}

const motor = new MotorSom()

export function tocarEfeito(tipo: Efeito) {
  motor.efeito(tipo)
}

export function iniciarMusica() {
  motor.tocarMusica()
}

export function somAtivo() {
  return motor.ativo
}
