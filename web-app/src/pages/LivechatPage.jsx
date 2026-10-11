import React, { useState } from 'react'
import './LivechatPage.css'

function LivechatPage() {
  const [message, setMessage] = useState('')
  const [sessionId, setSessionId] = useState('')

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
        <input
          className="livechat-session-input"
          value={sessionId}
          placeholder="请输入 sessionId"
          onChange={(event) => setSessionId(event.target.value)}
        />
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
