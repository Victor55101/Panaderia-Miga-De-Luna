import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Module crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '3rem 2rem',
          textAlign: 'center',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          maxWidth: '560px',
          margin: '3rem auto'
        }}>
          <div style={{
            width: '64px', height: '64px',
            borderRadius: '50%',
            background: 'var(--color-error-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            fontSize: '2rem'
          }}>⚠️</div>
          <h2 style={{ color: 'var(--color-dark)', marginBottom: '0.75rem', fontFamily: 'var(--font-display)' }}>
            Error al cargar módulo
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {this.state.error?.message || 'Ocurrió un error inesperado. Revisa la consola para más detalles.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
