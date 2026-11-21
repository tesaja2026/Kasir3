import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('didKasir runtime error', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <div className="rounded-full bg-destructive/10 p-4 text-destructive">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Halaman mengalami gangguan</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Silakan coba muat ulang halaman. Data toko tetap tersimpan.
            </p>
          </div>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Muat Ulang
          </Button>
        </div>
      </div>
    );
  }
}
