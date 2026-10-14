import React, { useState, useEffect } from 'react'
import { getAllSessionInfo } from '../services/sessionService.ts'
import './LivechatPage.css'

function LivechatPage() {
  const [message, setMessage] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    getAllSessionInfo()
      .then((data) => {
        if (Array.isArray(data?.data)) {
          setSessions(data?.data)
        }
      })
      .catch((err) => {
        console.error('获取会话列表失败:', err)
      })
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const content = message
    if (!content) return

    setMessage('')
    await fetch('http://localhost:3002/api/v1/websocket/postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: content, sessionId }),
    })
  }

  return (
    <div className="livechat-page">
      <form className="livechat-form" onSubmit={handleSubmit}>
        <select
          className="livechat-session-input"
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
        >
          {sessions.map((item) => (
            <option key={item.session_id} value={item.session_id}>
              {item.session_id}
            </option>
          ))}
        </select>
        <textarea
          className="livechat-input"
          rows={4}
          value={message}
          placeholder="请输入消息"
          onChange={(event) => setMessage(event.target.value)}
        />
        <button className="livechat-send" type="submit">发送</button>
      </form>
    </div>
  )
}

export default LivechatPage
