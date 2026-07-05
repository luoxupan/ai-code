import React from 'react';
import { messageComponentMap } from './index.ts';

const MessageRenderer = ({ message }) => {
  // Destructure with a default value for payload to be safe
  const { type, subType, payload = {} } = message;

  if (typeof payload.content === 'undefined') {
    // If there's no content, don't render anything for this message.
    // This handles system messages (e.g., type 1, 2) that might not have a displayable payload.
    return null;
  }

  // For chat messages (type 5), use the component map
  if (type === 5) {
    const Component = messageComponentMap[subType];
    if (Component) {
      return <Component content={payload.content} />;
    }
  }

  // Fallback for any other message type that has content: display the raw content.
  // This primarily handles the user's plain text messages (subType 0).
  return <div>{payload.content}</div>;
};

export default MessageRenderer;
