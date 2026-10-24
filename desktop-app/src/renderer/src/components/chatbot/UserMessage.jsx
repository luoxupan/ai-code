import React from 'react';

const UserMessage = ({ children, status, onRetry }) => {
  const statusText = {
    sending: '发送中',
    failed: '发送失败',
  }[status]

  return (
    <div className="message-row user-message-row">
      <div className="message-content user-message-content">
        {children}
        {statusText && (
          <div className={`message-status${status === 'failed' ? ' message-status--failed' : ''}`}>
            {statusText}
            {status === 'failed' && (
              <button
                type="button"
                className="message-retry-button"
                onClick={onRetry}
              >
                重新发送
              </button>
            )}
          </div>
        )}
      </div>
      {/* <div className="message-avatar message-avatar--user" aria-hidden="true">我</div> */}
    </div>
  );
};

export default UserMessage;
