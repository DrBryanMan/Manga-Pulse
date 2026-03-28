/**
 * Lightweight hash-based SPA router.
 * Routes: '#/' → '/',  '#/series' → '/series', etc.
 */
export class Router {
  #routes         = new Map();
  #fallback       = null;
  #currentPath    = null;
  #changeListeners = [];

  /** Register a route handler. Chainable. */
  on(path, handler) {
    this.#routes.set(path, handler);
    return this;
  }

  /** Fallback when no route matches. */
  notFound(handler) {
    this.#fallback = handler;
    return this;
  }

  get currentPath() { return this.#currentPath; }

  /** Resolve current hash and call the matching handler. */
  resolve() {
    const hash = location.hash.replace(/^#\/?/, '');
    const path = '/' + hash;
    this.#currentPath = path;

    const handler = this.#routes.get(path) ?? this.#fallback;
    handler?.(path);
    this.#changeListeners.forEach(fn => fn(path));
  }

  /** Programmatic navigation. */
  navigate(path) {
    location.hash = path;
  }

  /** Subscribe to route changes (for shell active-link sync, etc.). */
  onChange(fn) {
    this.#changeListeners.push(fn);
    return this;
  }

  /** Start listening to hashchange + resolve immediately. Chainable. */
  listen() {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
    return this;
  }
}

export const router = new Router();