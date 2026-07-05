import React from 'react';

const UserMessage = ({ children, status }) => {
  return (
    <div className="message-row user-message-row">
      <div className="message-content user-message-content">
        {children}
        <div className="message-status">
          {status === 'sending' && '发送中...'}
          {status === 'failed' && <span style={{ color: 'red' }}>发送失败</span>}
        </div>
      </div>
    </div>
  );
};

export default UserMessage;
