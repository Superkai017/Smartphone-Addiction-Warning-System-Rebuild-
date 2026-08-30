/// <reference types="vite/client" />
declare module '*.css';

interface ImportMetaEnv {
  /**
   * Origin of the FastAPI backend, for a split deployment where the UI and the
   * API do not share one (a static host such as Netlify, which cannot run
   * Python). Unset means relative `/api` calls, which is correct for local dev
   * behind the Vite proxy and for FastAPI serving the built bundle itself.
   *
   * Inlined at build time, so it is set on the build, not the running site.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
