import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Entre Brisas',
    short_name: 'Entre Brisas',
    description: 'Jogo cooperativo e multiplayer de associação de palavras',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6efe1',
    theme_color: '#f6efe1',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
