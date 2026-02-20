import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application crashed:', error, errorInfo);
    // Future: Send to Sentry/LogRocket for monitoring
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  handleLogin = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-destructive/30 bg-card">
            <CardContent className="pt-8 pb-6 px-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-4 rounded-full bg-destructive/10 mb-4">
                  <AlertTriangle className="w-10 h-10 text-destructive" />
                </div>
                
                <h1 className="text-xl font-semibold mb-2">
                  Une erreur s'est produite
                </h1>
                
                <p className="text-muted-foreground text-sm mb-6">
                  L'application a rencontré un problème inattendu. 
                  Nos équipes ont été notifiées.
                </p>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <div className="w-full p-3 mb-6 rounded-lg bg-secondary/50 border border-white/5 overflow-x-auto">
                    <code className="text-xs text-destructive font-mono whitespace-pre-wrap break-all">
                      {this.state.error.message}
                    </code>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 w-full">
                  <Button 
                    onClick={this.handleReset} 
                    className="flex-1"
                    variant="default"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Recharger l'application
                  </Button>
                  <Button 
                    onClick={this.handleLogin} 
                    variant="outline"
                    className="flex-1"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Retour à la connexion
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
