import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

// Catches render/lazy-load errors (e.g. a route chunk failing to download on a
// flaky connection) and shows a recoverable message instead of a blank screen.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept for observability; a real app would report this to a logging service.
    console.error('ErrorBoundary capturó un error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0B0D] px-4">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-[#F2F3F5]">Algo salió mal</h1>
          <p className="text-sm text-[#8B92A0] mt-2">
            No pudimos cargar esta sección. Revisa tu conexión e inténtalo de nuevo.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 bg-[#16C784] hover:bg-[#13B374] text-[#0A0B0D] font-semibold rounded-xl px-5 py-2.5 text-sm transition"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
