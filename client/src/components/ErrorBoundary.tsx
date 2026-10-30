import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-heading font-semibold text-t1">Что-то пошло не так</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-control bg-primary px-4 py-2.5 font-medium text-white"
          >
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}