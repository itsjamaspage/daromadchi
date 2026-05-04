import NotificationsButton from './NotificationsButton'

export default function TopBar() {
  return (
    <div className="hidden lg:flex items-center justify-end h-12 px-8 border-b border-white/[0.04]">
      <NotificationsButton />
    </div>
  )
}
