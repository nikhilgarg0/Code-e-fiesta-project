"use client";

import React, { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangleIcon, RefreshCwIcon } from "./Icons";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  isPanel?: boolean;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AutoMedic ErrorBoundary] Captured error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.isPanel) {
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950 text-center border border-zinc-800 rounded-lg m-2">
            <div className="w-10 h-10 rounded-full bg-rose-950/60 border border-rose-700/50 flex items-center justify-center text-rose-400 mb-3">
              <AlertTriangleIcon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200">
              {this.props.fallbackTitle || "Panel Temporarily Unavailable"}
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs">
              {this.props.fallbackMessage ||
                "This component encountered an unexpected error. Other dashboard panels remain fully functional."}
            </p>
            <button
              onClick={this.handleRetry}
              className="mt-4 px-3 py-1.5 text-xs font-mono font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors flex items-center gap-1.5"
            >
              <RefreshCwIcon className="w-3.5 h-3.5" />
              Retry Panel
            </button>
          </div>
        );
      }

      // Global boundary fallback
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-zinc-100 p-8">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_25px_rgba(244,63,94,0.3)]">
            <AlertTriangleIcon className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-zinc-100 font-mono tracking-tight">
            AutoMedic Resilient Recovery Mode
          </h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-md text-center">
            A rendering exception occurred in the dashboard interface. System services and background healing engines continue running normally.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 text-xs font-mono font-bold rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center gap-2"
          >
            <RefreshCwIcon className="w-4 h-4" />
            Reload Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
