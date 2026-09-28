export function gerarCodigoSala(tamanho = 6) {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

  let codigo = ''

  for (let i = 0; i < tamanho; i++) {
    codigo += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    )
  }

  return codigo
}

export function salvarJogador(
  codigoSala: string,
  playerId: string
) {
  localStorage.setItem(
    `entre-pistas-player-${codigoSala}`,
    playerId
  )
}

export function obterJogador(codigoSala: string) {
  return localStorage.getItem(
    `entre-pistas-player-${codigoSala}`
  )
}