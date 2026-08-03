import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public props: Props;

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Terjadi Kesalahan Aplikasi</h2>
            <p className="text-sm text-slate-300">
              Sistem mendeteksi kendala pada antarmuka. Silakan muat ulang halaman untuk melanjutkan operasional Dapur Qomaruddin.
            </p>
            {this.state.error?.message && (
              <div className="p-3 bg-slate-900/80 rounded-lg text-left text-xs font-mono text-slate-400 overflow-x-auto border border-slate-800 max-h-32">
                {this.state.error.message}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30 active:scale-98"
            >
              <RefreshCw className="h-4 w-4" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return (this.props as Props).children;
  }
}

export default ErrorBoundary;
