/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TEMPLATE_BASE?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
