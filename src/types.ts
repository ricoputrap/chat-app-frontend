export type User = {
  id: number
  name: string
  username: string
  group_ids: number[]
}

export type Group = {
  id: number
  name: string
}

export type Location = {
  id: number
  name: string
}

export type ChatSummary = {
  id: string
  loc_id: number
  type: 'general' | 'group' | string
  group_id: number
  created_by: number
  created_at: number
  is_active: boolean
  last_message_at: number
  last_read_at: number
}

export type ChatMessage = {
  chat_id: string
  sk: string
  msg: string
  sender_id: number
  created_at: number
}

export type MessagePage = {
  messages: ChatMessage[]
  nextToken: string | null
}
