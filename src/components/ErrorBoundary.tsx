"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary — catches rendering errors, shows fallback UI.
 * Prevents a single broken component from crashing the whole page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console (could be sent to monitoring service in production)
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReload = () => {
    // Clear any cached state that might have caused the error
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.controller?.postMessage("CLEAR_CACHE");
      }
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-cream p-4">
          <div className="max-w-md w-full text-center space-y-4 bg-white rounded-3xl p-8 shadow-lg border-2"
            style={{ borderColor: "rgba(139, 21, 56, 0.15)" }}>
            <div className="text-5xl">🌸</div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-arabic)", color: "var(--burgundy)" }}>
              حدث خطأ غير متوقع
            </h2>
            <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-arabic)" }}>
              نعتذر عن الإزعاج. يرجى تحديث الصفحة للمتابعة.
            </p>
            <button
              onClick={this.handleReload}
              className="w-full py-3 rounded-2xl font-bold text-white transition-all"
              style={{ background: "linear-gradient(135deg, var(--burgundy) 0%, var(--burgundy-dark) 100%)" }}
            >
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
