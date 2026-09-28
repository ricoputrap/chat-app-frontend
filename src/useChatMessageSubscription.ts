import { useEffect, useRef, useState } from 'react'

import { config } from './config'
import { getToken } from './session'
import type { ChatMessage } from './types'

export type SubscriptionStatus = 'idle' | 'connecting' | 'subscribed' | 'reconnecting' | 'error'

type Options = {
  chatId: string
  enabled?: boolean
  onMessage: (message: ChatMessage) => void
  onReconnect?: () => void
}

const WS_SUBPROTOCOL = 'graphql-ws'
const RECONNECT_BASE_DELAY_MS = 500
const RECONNECT_MAX_DELAY_MS = 30_000
const DEFAULT_CONNECTION_TIMEOUT_MS = 300_000
const HANDSHAKE_TIMEOUT_MS = 10_000
const AUTH_ERROR_PATTERN = /unauthorized|unauthenticated|forbidden|accessdenied/i

const SUBSCRIPTION = `subscription OnNewChatMessage($chat_id: ID!) {
  onNewChatMessage(chat_id: $chat_id) {
    chat_id
    sk
    msg
    sender_id
    created_at
  }
}`

type ErrorEntry = { errorType?: string; message?: string }

type Frame = {
  type?: string
  id?: string
  payload?: {
    connectionTimeoutMs?: number
    data?: { onNewChatMessage?: ChatMessage | null }
    errors?: ErrorEntry[]
  }
  connectionTimeoutMs?: number
  errors?: ErrorEntry[]
}

function reconnectDelay(attempt: number) {
  const ceiling = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_BASE_DELAY_MS * 2 ** attempt)
  return ceiling / 2 + Math.random() * (ceiling / 2)
}

function base64url(value: string) {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function createID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function isAuthError(errors: unknown) {
  return (
    Array.isArray(errors) &&
    errors.some((entry) => {
      const item = entry as ErrorEntry
      return AUTH_ERROR_PATTERN.test(String(item?.errorType ?? item?.message ?? ''))
    })
  )
}

export function useChatMessageSubscription({
  chatId,
  enabled = true,
  onMessage,
  onReconnect,
}: Options) {
  const onMessageRef = useRef(onMessage)
  const onReconnectRef = useRef(onReconnect)
  const [connection, setConnection] = useState<SubscriptionStatus>('idle')
  const status: SubscriptionStatus = enabled ? connection : 'idle'

  useEffect(() => {
    onMessageRef.current = onMessage
    onReconnectRef.current = onReconnect
  }, [onMessage, onReconnect])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let gaveUp = false
    let attempt = 0
    let everSubscribed = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let closeCurrent: (() => void) | null = null

    const scheduleReconnect = () => {
      if (cancelled || gaveUp || retryTimer) return
      setConnection('reconnecting')
      retryTimer = setTimeout(() => {
        retryTimer = null
        connect()
      }, reconnectDelay(attempt))
      attempt += 1
    }

    function connect() {
      if (cancelled || gaveUp) return
      setConnection((current) => (current === 'idle' ? 'connecting' : current))

      const token = getToken()
      if (!token) {
        scheduleReconnect()
        return
      }

      const subscriptionID = createID()
      let livenessTimer: ReturnType<typeof setTimeout> | null = null
      let retired = false
      let started = false
      let connectionTimeout = DEFAULT_CONNECTION_TIMEOUT_MS

      let socket: WebSocket
      try {
        const header = base64url(
          JSON.stringify({ host: config.appsyncHost, Authorization: token }),
        )
        const payload = base64url(JSON.stringify({}))
        socket = new WebSocket(config.appsyncRealtimeUrl, [
          WS_SUBPROTOCOL,
          `header-${header}`,
          `payload-${payload}`,
        ])
      } catch {
        scheduleReconnect()
        return
      }

      const clearLiveness = () => {
        if (!livenessTimer) return
        clearTimeout(livenessTimer)
        livenessTimer = null
      }

      const retire = () => {
        retired = true
        clearLiveness()
        if (started && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'stop', id: subscriptionID }))
        }
        socket.close()
      }

      closeCurrent = retire

      const reject = (errors: unknown) => {
        gaveUp = isAuthError(errors)
        retire()
        if (gaveUp) setConnection('error')
        else scheduleReconnect()
      }

      const watchLiveness = (timeoutMS: number) => {
        clearLiveness()
        livenessTimer = setTimeout(() => {
          retire()
          scheduleReconnect()
        }, timeoutMS)
      }

      socket.onopen = () => {
        watchLiveness(HANDSHAKE_TIMEOUT_MS)
        socket.send(JSON.stringify({ type: 'connection_init' }))
      }

      socket.onmessage = (frame: MessageEvent) => {
        let message: Frame
        try {
          message = JSON.parse(String(frame.data)) as Frame
        } catch {
          return
        }

        if (message.type === 'connection_ack') {
          connectionTimeout =
            message.payload?.connectionTimeoutMs ??
            message.connectionTimeoutMs ??
            DEFAULT_CONNECTION_TIMEOUT_MS
          watchLiveness(connectionTimeout)
          started = true
          socket.send(
            JSON.stringify({
              id: subscriptionID,
              type: 'start',
              payload: {
                data: JSON.stringify({
                  query: SUBSCRIPTION,
                  variables: { chat_id: chatId },
                }),
                extensions: {
                  authorization: {
                    host: config.appsyncHost,
                    Authorization: token,
                  },
                },
              },
            }),
          )
          attempt = 0
          setConnection('subscribed')
          if (everSubscribed) onReconnectRef.current?.()
          everSubscribed = true
          return
        }

        watchLiveness(connectionTimeout)

        if (message.type === 'connection_error') {
          reject(message.payload?.errors ?? message.errors)
          return
        }
        if (message.type === 'ka') return
        if (message.id !== subscriptionID) return
        if (message.type === 'error') {
          reject(message.payload?.errors ?? message.errors)
          return
        }
        if (message.type === 'data') {
          const incoming = message.payload?.data?.onNewChatMessage
          if (incoming) onMessageRef.current(incoming)
        }
      }

      socket.onerror = () => {}

      socket.onclose = () => {
        clearLiveness()
        if (cancelled || retired) return
        started = false
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      cancelled = true
      setConnection('idle')
      if (retryTimer) {
        clearTimeout(retryTimer)
        retryTimer = null
      }
      closeCurrent?.()
      closeCurrent = null
    }
  }, [chatId, enabled])

  return { status }
}
