import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useAtom } from 'jotai'
import { countAtom } from './store.ts'
import ChatbotPage from './pages/ChatbotPage.jsx'
import LivechatPage from './pages/LivechatPage.jsx'

function App() {
  const [count, setCount] = useAtom(countAtom)
  return (
    <main className="main-content-wrapper">
      <h1>Electron + React + Vite</h1>
      <p>项目已成功迁移到 React 和 Vite。</p>
      <Routes>
        <Route path="/" element={
          <ChatbotPage />
        } />
        <Route path="/chatbot" element={<ChatbotPage />} />
        <Route path="/livechat" element={<LivechatPage />} />
      </Routes>
    </main>
  )
}

export default App
