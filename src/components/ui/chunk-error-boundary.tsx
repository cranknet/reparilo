import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// biome-ignore lint/style/useReactFunctionComponents: React error boundaries require class components
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-4 rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="font-medium text-destructive">Failed to load page</p>
          <button
            className="mt-2 text-muted-foreground text-sm underline"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
