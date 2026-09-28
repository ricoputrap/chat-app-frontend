import { Outlet } from '@tanstack/react-router'

import { missingEnv } from './config'

export function Root() {
  if (missingEnv.length > 0) {
    return (
      <main className="screen">
        <header className="mast">
          <p className="eyebrow">Setup</p>
          <h1>Add a .env file</h1>
          <p className="lede">Copy frontend/.env.default to frontend/.env and fill in:</p>
        </header>
        <ul className="env-list">
          {missingEnv.map((key) => (
            <li key={key}>
              <code>{key}</code>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  return (
    <div className="app">
      <Outlet />
    </div>
  )
}
