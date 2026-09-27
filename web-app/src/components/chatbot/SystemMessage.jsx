import React from 'react';

const SystemMessage = ({ children }) => {
  return (
    <div className="message-row system-message-row">
      <div className="message-avatar message-avatar--system" aria-hidden="true">AI</div>
      <div className="message-content system-message-content">{children}</div>
    </div>
  );
};

export default SystemMessage;
