/**
 * The last line of defence against "it does not load on my device".
 *
 * A React app with no boundary answers any render-time throw with a blank white
 * page. That failure mode is the one that reads as a browser bug to the person
 * hitting it, because there is nothing on screen to say otherwise, and it only
 * shows up wherever the trigger happens to exist — one device, one browser, one
 * locale's number formatting. A boundary cannot prevent the throw, but it turns
 * a dead page into a screen that says what happened and offers a way out, and it
 * keeps the failure to the screen that caused it.
 *
 * Deliberately not translated through the i18n hook: if the thing that threw was
 * the i18n provider, calling into it again would take the boundary down with it.
 * The copy is passed in by whoever mounts it, already resolved.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  title: string;
  body: string;
  retryLabel: string;
  /** Changing this remounts the subtree, so navigating away clears the error. */
  resetKey?: string;
}

interface State {
  error: Error | null;
  /** The resetKey the current error belongs to. */
  at?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  /**
   * Clears the error when the route changes. Derived during render rather than
   * set from componentDidUpdate, which would render the dead screen once more
   * before recovering.
   */
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.at === undefined) return { at: props.resetKey };
    if (state.error && state.at !== props.resetKey) return { error: null, at: props.resetKey };
    if (!state.error && state.at !== props.resetKey) return { at: props.resetKey };
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry service is wired up yet, so the console is the only place
    // this can go. It matters: without it a support report is "the page was
    // blank" and there is nothing to act on.
    console.error('[itqan] screen failed to render', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="boot">
        <div className="empty" role="alert">
          <h1 className="headline">{this.props.title}</h1>
          <p className="subhead">{this.props.body}</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => window.location.reload()}
          >
            {this.props.retryLabel}
          </button>
        </div>
      </div>
    );
  }
}
