export function formatTime(ms: number) {
  if (!ms) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}

export function chatTitle(type: string, groupID: number, groups: { id: number; name: string }[]) {
  if (type === 'general') return 'General'
  return groups.find((group) => group.id === groupID)?.name ?? `Group ${groupID}`
}

export function personName(userID: number, meID: number, users: { id: number; name: string }[]) {
  if (userID === meID) return 'You'
  return users.find((user) => user.id === userID)?.name ?? `User ${userID}`
}
