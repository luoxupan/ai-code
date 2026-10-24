import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import ChatbotPage from './pages/ChatbotPage.jsx'
import LivechatPage from './pages/LivechatPage.jsx'

const SIDEBAR_MIN_WIDTH = 180
const SIDEBAR_MAX_WIDTH = 420
const SIDEBAR_DEFAULT_WIDTH = 220

function App() {
  const { pathname } = useLocation()
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const [isResizing, setIsResizing] = useState(false)

  const isChatbotActive = pathname === '/chatbot'
  const isLivechatActive = pathname === '/livechat'

  const clampSidebarWidth = (width: number) => (
    Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width))
  )

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setSidebarWidth(clampSidebarWidth(sidebarWidth - 16))
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setSidebarWidth(clampSidebarWidth(sidebarWidth + 16))
    }
  }

  return (
    <div
      className={`app-layout ${isResizing ? 'resizing' : ''}`}
      style={{ gridTemplateColumns: `${sidebarWidth}px 6px minmax(0, 1fr)` }}
    >
      <aside className="sidebar">
        <div className="sidebar-brand">Desktop App</div>
        <nav aria-label="Main navigation" className="sidebar-nav">
          <NavLink to="/chatbot?userId=122689" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            Chatbot
          </NavLink>
          <NavLink to="/livechat" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            LiveChat
          </NavLink>
        </nav>
      </aside>

      <div
        role="separator"
        tabIndex={0}
        aria-label="调整左侧导航宽度"
        aria-orientation="vertical"
        aria-valuemin={SIDEBAR_MIN_WIDTH}
        aria-valuemax={SIDEBAR_MAX_WIDTH}
        aria-valuenow={sidebarWidth}
        className={`sidebar-resizer ${isResizing ? 'active' : ''}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setIsResizing(true)
        }}
        onPointerMove={(event) => {
          if (!isResizing) return
          const layout = event.currentTarget.parentElement
          if (!layout) return
          setSidebarWidth(clampSidebarWidth(event.clientX - layout.getBoundingClientRect().left))
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId)
          setIsResizing(false)
        }}
        onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
        onKeyDown={handleResizeKeyDown}
      />

      <div className="page-host">
        <div className="page-viewport" hidden={!isChatbotActive}>
          <ChatbotPage />
        </div>

        <div className="page-viewport" hidden={!isLivechatActive}>
          <LivechatPage />
        </div>

        <main className="content" hidden={isChatbotActive || isLivechatActive}>
          <h1>首页</h1>
          <p>请从左侧选择 Chatbot 或 LiveChat。</p>
        </main>
      </div>
    </div>
  )
}

export default App
