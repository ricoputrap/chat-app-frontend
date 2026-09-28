/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APPSYNC_GRAPHQL_URL: string
  readonly VITE_APPSYNC_REALTIME_URL: string
  readonly VITE_APPSYNC_HOST: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
