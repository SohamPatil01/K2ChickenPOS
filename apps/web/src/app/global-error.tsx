'use client';

/**
 * Catches errors in the root layout. Renders a minimal fallback so the app never shows a blank page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#f9fafb',
        }}>
          <div style={{
            maxWidth: 400,
            textAlign: 'center',
            backgroundColor: 'white',
            padding: 24,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: '#6b7280', marginBottom: 16 }}>
              The app failed to load. Try reloading the page.
            </p>
            <button
              onClick={() => reset()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                marginRight: 8,
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
