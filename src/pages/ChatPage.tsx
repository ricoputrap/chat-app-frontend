import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import {
  ApiError,
  fetchGroups,
  fetchLocations,
  fetchMe,
  fetchUsers,
  listChats,
  listMessages,
  markChatRead,
  sendMessage,
} from '../api'
import { chatTitle, formatTime, personName } from '../format'
import { useChatMessageSubscription } from '../useChatMessageSubscription'
import type { ChatMessage, MessagePage } from '../types'

export function ChatPage() {
  const { chatId } = useParams({ from: '/authed/chats/$chatId' })
  const queryClient = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [olderPending, setOlderPending] = useState(false)
  const [olderError, setOlderError] = useState('')

  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const locations = useQuery({ queryKey: ['locations'], queryFn: fetchLocations })
  const groups = useQuery({ queryKey: ['groups'], queryFn: fetchGroups })
  const users = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const locationKey = locations.data?.map((location) => location.id).join(',') ?? ''
  const chats = useQuery({
    queryKey: ['chats', locationKey],
    enabled: locationKey.length > 0,
    queryFn: async () => {
      const rows = await Promise.all((locations.data ?? []).map((location) => listChats(location.id)))
      return rows.flat()
    },
  })
  const messages = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => listMessages(chatId),
  })

  const chat = chats.data?.find((item) => item.id === chatId)
  const location = locations.data?.find((item) => item.id === chat?.loc_id)

  function prependMessage(message: ChatMessage) {
    queryClient.setQueryData<MessagePage>(['messages', chatId], (current) => {
      if (!current) return { messages: [message], nextToken: null }
      if (current.messages.some((item) => item.sk === message.sk)) return current
      return { ...current, messages: [message, ...current.messages] }
    })
  }

  async function noteRead() {
    try {
      await markChatRead(chatId)
      await queryClient.invalidateQueries({ queryKey: ['chats'] })
    } catch {
      // The history is still readable if the read marker fails.
    }
  }

  useEffect(() => {
    let cancelled = false
    markChatRead(chatId)
      .then(() => {
        if (!cancelled) return queryClient.invalidateQueries({ queryKey: ['chats'] })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [chatId, queryClient])

  const live = useChatMessageSubscription({
    chatId,
    enabled: Boolean(chat),
    onMessage: (message) => {
      prependMessage(message)
      void noteRead()
    },
    onReconnect: () => {
      void queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
    },
  })

  const newest = messages.data?.messages[0]?.sk
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [newest])

  const send = useMutation({
    mutationFn: (msg: string) => sendMessage(chatId, msg),
    onSuccess: async (message) => {
      prependMessage(message)
      setDraft('')
      await noteRead()
    },
  })

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const msg = draft.trim()
    if (!msg || send.isPending) return
    await send.mutateAsync(msg).catch(() => undefined)
  }

  async function loadOlder() {
    const token = messages.data?.nextToken
    if (!token) return
    setOlderPending(true)
    setOlderError('')
    try {
      const page = await listMessages(chatId, token)
      queryClient.setQueryData<MessagePage>(['messages', chatId], (current) => {
        if (!current) return page
        const seen = new Set(current.messages.map((item) => item.sk))
        const older = page.messages.filter((item) => !seen.has(item.sk))
        return { messages: [...current.messages, ...older], nextToken: page.nextToken }
      })
    } catch (err) {
      setOlderError(err instanceof ApiError ? err.message : 'Could not load older messages')
    } finally {
      setOlderPending(false)
    }
  }

  const chronological = [...(messages.data?.messages ?? [])].reverse()
  const title = chat ? chatTitle(chat.type, chat.group_id, groups.data ?? []) : 'Chat'

  return (
    <main className="chat-screen">
      <header className="chat-head">
        <Link className="back" to="/chats">
          Back
        </Link>
        <div>
          <h1>{title}</h1>
          <p className="muted">
            {location?.name ?? 'Room'}
            {chat && !chat.is_active ? ' · Closed' : ''}
            {live.status === 'reconnecting' ? ' · Reconnecting' : ''}
            {live.status === 'error' ? ' · Live updates stopped' : ''}
          </p>
        </div>
      </header>
      <div className="messages">
        {messages.data?.nextToken ? (
          <button type="button" className="ghost" onClick={() => void loadOlder()} disabled={olderPending}>
            {olderPending ? 'Loading…' : 'Load older'}
          </button>
        ) : null}
        {olderError ? <p className="error">{olderError}</p> : null}
        {messages.isPending ? <p className="muted">Loading messages…</p> : null}
        {messages.isError ? (
          <p className="error">
            {messages.error instanceof Error ? messages.error.message : 'Could not load messages.'}
          </p>
        ) : null}
        {chats.isSuccess && !chat ? <p className="error">This chat is unavailable.</p> : null}
        {messages.isSuccess && chronological.length === 0 ? (
          <p className="muted">No messages yet.</p>
        ) : null}
        {chronological.map((message) => {
          const mine = message.sender_id === me.data?.id
          return (
            <article key={message.sk} className={mine ? 'bubble mine' : 'bubble'}>
              <p className="bubble-name">
                {personName(message.sender_id, me.data?.id ?? 0, users.data ?? [])}
              </p>
              <p className="bubble-text">{message.msg}</p>
              <time>{formatTime(message.created_at)}</time>
            </article>
          )
        })}
        <div ref={bottomRef} />
      </div>
      {chat && !chat.is_active ? (
        <p className="closed-note">This chat is closed. You can still read it.</p>
      ) : (
        <form className="composer" onSubmit={(event) => void onSubmit(event)}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message"
            aria-label="Message"
            disabled={!chat}
          />
          <button type="submit" disabled={!chat || send.isPending || draft.trim() === ''}>
            Send
          </button>
        </form>
      )}
      {send.isError ? (
        <p className="error composer-error">
          {send.error instanceof Error ? send.error.message : 'Could not send'}
        </p>
      ) : null}
    </main>
  )
}
