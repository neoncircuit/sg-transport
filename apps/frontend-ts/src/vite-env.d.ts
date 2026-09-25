/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __APP_VERSION_BADGE__: string;
declare const __GIT_SHA__: string;

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
