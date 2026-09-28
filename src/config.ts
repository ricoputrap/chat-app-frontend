const keys = [
  'VITE_API_BASE_URL',
  'VITE_APPSYNC_GRAPHQL_URL',
  'VITE_APPSYNC_REALTIME_URL',
  'VITE_APPSYNC_HOST',
] as const

function read(name: (typeof keys)[number]) {
  return import.meta.env[name]?.trim() ?? ''
}

export const config = {
  apiBaseUrl: read('VITE_API_BASE_URL').replace(/\/$/, ''),
  appsyncGraphqlUrl: read('VITE_APPSYNC_GRAPHQL_URL'),
  appsyncRealtimeUrl: read('VITE_APPSYNC_REALTIME_URL'),
  appsyncHost: read('VITE_APPSYNC_HOST'),
}

export const missingEnv = keys.filter((key) => read(key) === '')
