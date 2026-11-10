'use client';

// Dernier recours : remplace le layout racine si celui-ci échoue. Styles en ligne volontairement.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f5f2', color: '#102c32' }}>
        <main style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Le site est momentanément indisponible</h1>
          <p style={{ maxWidth: 420, color: '#4b6166' }}>Une erreur inattendue est survenue. Réessayez dans un instant.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 16, height: 44, padding: '0 20px', borderRadius: 10, border: 0, background: '#ea632e', color: '#0a1e22', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
