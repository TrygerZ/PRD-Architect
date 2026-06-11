import { Component, ReactNode } from "react";

interface Props { children: ReactNode; language?: "id" | "en"; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  handleReset = () => this.setState({ hasError: false, error: null });
  render() {
    if (this.state.hasError) {
      const isEn = this.props.language === "en";
      return (
        <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[8px] p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#8a3a3a] flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-xl font-bold">!</span>
            </div>
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
              {isEn ? "Something went wrong" : "Terjadi Kesalahan"}
            </h2>
            <p className="text-[var(--color-text-secondary)] text-sm mb-6">
              {isEn ? "Please try again or start a new PRD." : "Coba lagi atau buat PRD baru."}
            </p>
            <button onClick={this.handleReset}
              className="px-4 py-2 rounded-[6px] bg-[var(--color-text-primary)] text-[var(--color-bg)] text-sm font-medium hover:bg-[var(--color-text-primary)] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-interactive)] focus-visible:outline-none"
              aria-label={isEn ? "Try again" : "Coba lagi"}>
              {isEn ? "Try Again" : "Coba Lagi"}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
