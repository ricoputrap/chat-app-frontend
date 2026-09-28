import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { ApiError, fetchGroups, fetchLocations, fetchMe, listChats } from '../api'
import { chatTitle, formatTime } from '../format'
import { clearToken } from '../session'
import type { ChatSummary, Location } from '../types'

export function ChatListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const locations = useQuery({ queryKey: ['locations'], queryFn: fetchLocations })
  const groups = useQuery({ queryKey: ['groups'], queryFn: fetchGroups })
  const locationKey = locations.data?.map((location) => location.id).join(',') ?? ''
  const chats = useQuery({
    queryKey: ['chats', locationKey],
    enabled: locationKey.length > 0,
    queryFn: async () => {
      const rows = await Promise.all(
        (locations.data ?? []).map((location) => listChats(location.id)),
      )
      return rows.flat()
    },
  })

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      clearToken()
      void navigate({ to: '/login' })
    }
  }, [me.error, navigate])

  function logout() {
    clearToken()
    queryClient.clear()
    void navigate({ to: '/login' })
  }

  return (
    <main className="screen">
      <header className="topbar">
        <div>
          <p className="eyebrow">Chats</p>
          <h1>{me.data?.name ?? '…'}</h1>
        </div>
        <button type="button" className="ghost" onClick={logout}>
          Log out
        </button>
      </header>
      <Link className="button" to="/chats/new">
        New chat
      </Link>
      {locations.isPending ? <p className="muted">Loading rooms…</p> : null}
      {locations.isError ? <p className="error">Could not load rooms.</p> : null}
      {chats.isError ? (
        <p className="error">
          {chats.error instanceof Error ? chats.error.message : 'Could not load chats.'}
        </p>
      ) : null}
      {locations.data?.map((location) => (
        <LocationSection
          key={location.id}
          location={location}
          chats={(chats.data ?? []).filter((chat) => chat.loc_id === location.id)}
          groups={groups.data ?? []}
          ready={chats.isSuccess}
        />
      ))}
    </main>
  )
}

function LocationSection({
  location,
  chats,
  groups,
  ready,
}: {
  location: Location
  chats: ChatSummary[]
  groups: { id: number; name: string }[]
  ready: boolean
}) {
  const ordered = [...chats].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    return b.last_message_at - a.last_message_at || b.created_at - a.created_at
  })

  return (
    <section className="room">
      <h2>{location.name}</h2>
      {ready && ordered.length === 0 ? <p className="muted">No chats yet.</p> : null}
      <ul className="chat-list">
        {ordered.map((chat) => {
          const unread = chat.last_message_at > chat.last_read_at
          return (
            <li key={chat.id}>
              <Link
                to="/chats/$chatId"
                params={{ chatId: chat.id }}
                className={unread ? 'chat-row unread' : 'chat-row'}
              >
                <span className="chat-row-title">
                  {chatTitle(chat.type, chat.group_id, groups)}
                  {chat.is_active ? null : <em>Closed</em>}
                </span>
                <span className="chat-row-meta">
                  {unread ? <span className="pill">New</span> : null}
                  <time>{formatTime(chat.last_message_at || chat.created_at)}</time>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
