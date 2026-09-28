import { Outlet, createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'

import { Root } from './Root'
import { ChatListPage } from './pages/ChatListPage'
import { ChatPage } from './pages/ChatPage'
import { LoginPage } from './pages/LoginPage'
import { NewChatPage } from './pages/NewChatPage'
import { getToken } from './session'

const rootRoute = createRootRoute({ component: Root })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: getToken() ? '/chats' : '/login' })
  },
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: () => {
    if (getToken()) throw redirect({ to: '/chats' })
  },
  component: LoginPage,
})

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  beforeLoad: () => {
    if (!getToken()) throw redirect({ to: '/login' })
  },
  component: () => <Outlet />,
})

const chatsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/chats',
  component: ChatListPage,
})

const newChatRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/chats/new',
  component: NewChatPage,
})

const chatRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/chats/$chatId',
  component: ChatPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  authedRoute.addChildren([chatsRoute, newChatRoute, chatRoute]),
])

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <main className="screen">
      <h1>Page not found</h1>
    </main>
  ),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
