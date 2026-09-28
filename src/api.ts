import { config } from './config'
import { getToken } from './session'
import type { ChatMessage, ChatSummary, Group, Location, MessagePage, User } from './types'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function errorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'error' in body) {
    const message = (body as { error?: unknown }).error
    if (typeof message === 'string' && message) return message
  }
  return fallback
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${config.apiBaseUrl}${path}`, { ...init, headers })
  const text = await res.text()
  let body: unknown = null
  if (text) {
    try {
      body = JSON.parse(text) as unknown
    } catch {
      body = null
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, errorMessage(body, res.statusText))
  }
  return body as T
}

async function graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = getToken()
  if (!token) throw new ApiError(401, 'missing or invalid token')

  const res = await fetch(config.appsyncGraphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  })
  const body = (await res.json()) as {
    data?: T
    errors?: { message?: string }[]
  }
  if (!res.ok || body.errors?.length) {
    throw new ApiError(res.status || 400, body.errors?.[0]?.message || 'AppSync request failed')
  }
  if (!body.data) throw new ApiError(res.status || 502, 'AppSync request failed')
  return body.data
}

const LIST_CHATS = `query ListChats($loc_id: Int!) {
  listChats(loc_id: $loc_id) {
    id
    loc_id
    type
    group_id
    created_by
    created_at
    is_active
    last_message_at
    last_read_at
  }
}`

const LIST_MESSAGES = `query ListMessages($chat_id: ID!, $limit: Int, $nextToken: String) {
  listMessages(chat_id: $chat_id, limit: $limit, nextToken: $nextToken) {
    messages {
      chat_id
      sk
      msg
      sender_id
      created_at
    }
    nextToken
  }
}`

export function login(username: string, password: string) {
  return request<{ token: string; user: User }>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function fetchMe() {
  return request<User>('/me')
}

export function fetchLocations() {
  return request<Location[]>('/locations')
}

export function fetchGroups() {
  return request<Group[]>('/groups')
}

export function fetchUsers() {
  return request<User[]>('/users')
}

export function createChat(input: { loc_id: number; type: 'general' | 'group'; group_id?: number }) {
  return request<ChatSummary>('/chats', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function sendMessage(chatID: string, msg: string) {
  return request<ChatMessage>(`/chats/${encodeURIComponent(chatID)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ msg }),
  })
}

export function markChatRead(chatID: string) {
  return request<{ user_id: number; chat_id: string; last_read_at: number }>(
    `/chats/${encodeURIComponent(chatID)}/read`,
    { method: 'POST' },
  )
}

export async function listChats(locID: number) {
  const data = await graphql<{ listChats: ChatSummary[] | null }>(LIST_CHATS, { loc_id: locID })
  return data.listChats ?? []
}

export async function listMessages(chatID: string, nextToken?: string): Promise<MessagePage> {
  const variables: Record<string, unknown> = { chat_id: chatID, limit: 50 }
  if (nextToken) variables.nextToken = nextToken
  const data = await graphql<{ listMessages: MessagePage | null }>(LIST_MESSAGES, variables)
  return {
    messages: data.listMessages?.messages ?? [],
    nextToken: data.listMessages?.nextToken ?? null,
  }
}
