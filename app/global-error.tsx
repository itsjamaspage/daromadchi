'use client'

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f0f0f', color: '#fff' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
        }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>500</h1>
          <p style={{ fontSize: '1rem', color: '#888', margin: 0 }}>
            Xatolik yuz berdi. Iltimos, sahifani qayta yuklang.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            Qayta urinish
          </button>
        </div>
      </body>
    </html>
  )
}
