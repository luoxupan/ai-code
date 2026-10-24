import React from 'react'
import './MessageCard.css'

const MessageCard = ({ icon, label, children, footer }) => (
  <section className="message-card">
    <header className="message-card__header">
      <span className="message-card__icon" aria-hidden="true">{icon}</span>
      <span className="message-card__label">{label}</span>
      <span className="message-card__line" aria-hidden="true" />
    </header>
    <div className="message-card__body">{children}</div>
    {footer && <footer className="message-card__footer">{footer}</footer>}
  </section>
)

export default MessageCard
