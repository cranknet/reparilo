import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Uncaught error:", error, errorInfo);
  }

  reset(): void {
    window.location.reload();
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const title = i18n.t("errors.unexpected_title", "Something went wrong");
    const body = i18n.t(
      "errors.unexpected_body",
      "An unexpected error occurred. Please reload the page."
    );
    const reload = i18n.t("errors.unexpected_reload", "Reload");

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="material-symbols-outlined text-6xl text-error">
            error_outline
          </span>
          <h1 className="font-bold font-headline text-2xl text-on-surface">
            {title}
          </h1>
          <p className="max-w-md font-body text-on-surface-variant">{body}</p>
          <button
            className="rounded-xl bg-primary px-8 py-3 font-bold text-on-primary"
            onClick={() => this.reset()}
            type="button"
          >
            {reload}
          </button>
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 w-full max-w-2xl text-start">
              <summary className="cursor-pointer font-mono text-on-surface-variant text-xs">
                Stack trace (dev only)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-surface-container-highest p-4 font-mono text-error text-xs">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
