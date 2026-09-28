import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'

import { ApiError, login } from '../api'
import { setToken } from '../session'

const DEMO = [
  ['alice', 'Engineering, Facilities'],
  ['bob', 'Engineering'],
  ['carol', 'Front Desk'],
  ['dave', 'Facilities, Front Desk'],
] as const

export function LoginPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setPending(true)
    try {
      const result = await login(username.trim(), password)
      queryClient.clear()
      setToken(result.token)
      await navigate({ to: '/chats' })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server')
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="screen">
      <header className="mast">
        <p className="eyebrow">Building chat</p>
        <h1>Sign in</h1>
        <p className="lede">Messages stay in the room they were started in.</p>
      </header>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Username
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <section className="demo">
        <h2>Seeded accounts</h2>
        <p>The password is the username.</p>
        <ul>
          {DEMO.map(([name, groups]) => (
            <li key={name}>
              <strong>{name}</strong>
              <span>{groups}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
