import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'

import { ApiError, createChat, fetchGroups, fetchLocations, fetchMe } from '../api'

export function NewChatPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe })
  const locations = useQuery({ queryKey: ['locations'], queryFn: fetchLocations })
  const groups = useQuery({ queryKey: ['groups'], queryFn: fetchGroups })
  const [locID, setLocID] = useState(0)
  const [type, setType] = useState<'general' | 'group'>('general')
  const [groupID, setGroupID] = useState(0)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const myGroups = (groups.data ?? []).filter((group) => me.data?.group_ids.includes(group.id))
  const selectedLocation = locID || locations.data?.[0]?.id || 0
  const selectedGroup = groupID || myGroups[0]?.id || 0

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const chat = await createChat(
        type === 'group'
          ? { loc_id: selectedLocation, type, group_id: selectedGroup }
          : { loc_id: selectedLocation, type },
      )
      await queryClient.invalidateQueries({ queryKey: ['chats'] })
      await navigate({ to: '/chats/$chatId', params: { chatId: chat.id } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the chat')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="screen">
      <Link className="back" to="/chats">
        Back
      </Link>
      <header className="mast">
        <p className="eyebrow">New chat</p>
        <h1>Start a conversation</h1>
      </header>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Room
          <select
            value={selectedLocation}
            onChange={(event) => setLocID(Number(event.target.value))}
          >
            {(locations.data ?? []).map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Who can join</legend>
          <label className="choice">
            <input
              type="radio"
              name="type"
              checked={type === 'general'}
              onChange={() => setType('general')}
            />
            Anyone in the building
          </label>
          <label className="choice">
            <input
              type="radio"
              name="type"
              checked={type === 'group'}
              onChange={() => setType('group')}
            />
            One of my groups
          </label>
        </fieldset>
        {type === 'group' ? (
          <label>
            Group
            <select
              value={selectedGroup}
              onChange={(event) => setGroupID(Number(event.target.value))}
            >
              {myGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={pending || !selectedLocation || (type === 'group' && !selectedGroup)}>
          {pending ? 'Creating…' : 'Create chat'}
        </button>
      </form>
    </main>
  )
}
