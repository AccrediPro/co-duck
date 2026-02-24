'use client';

/**
 * Global error boundary — catches errors in the root layout itself.
 * Must include its own <html> and <body> tags since the root layout has failed.
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
      <body
        style={{
          margin: 0,
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#fafafa',
          color: '#1a1a1a',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#666', marginBottom: 24 }}>
            A critical error occurred. Please try refreshing the page.
          </p>
          {error.digest && (
            <p style={{ color: '#999', fontSize: 12, marginBottom: 16 }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '10px 24px',
              fontSize: 14,
              cursor: 'pointer',
              border: '1px solid #ddd',
              borderRadius: 6,
              backgroundColor: '#fff',
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
