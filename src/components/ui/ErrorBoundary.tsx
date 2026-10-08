import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 my-2 border border-destructive/30 bg-destructive/5 rounded-xl text-destructive text-sm flex flex-col gap-3">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span>{this.props.fallbackTitle || 'Something went wrong rendering this component'}</span>
          </div>
          {this.state.error && (
            <p className="text-xs font-mono text-muted-foreground bg-muted/40 p-2 rounded max-h-24 overflow-y-auto break-all">
              {this.state.error.message || String(this.state.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 h-7"
              onClick={this.handleReset}
            >
              <RefreshCw className="w-3 h-3" />
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
