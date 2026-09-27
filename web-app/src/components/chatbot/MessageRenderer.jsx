import React from 'react';
import { messageComponentMap } from './index.ts';
import Text from './Text.jsx';
import { MESSAGE_TYPE } from '../../constants/chat.ts';

const MessageRenderer = ({ message }) => {
  // Explicitly do not render ACK messages
  if (message.type === MESSAGE_TYPE.ACK) {
    return null;
  }

  // Destructure with a default value for payload to be safe
  const { type, subType, payload = {} } = message;

  if (typeof payload.content === 'undefined') {
    // If there's no content, don't render anything for this message.
    // This handles system messages (e.g., type 1, 2) that might not have a displayable payload.
    return null;
  }

  // For chat messages (type 5), use the component map
  if (type === MESSAGE_TYPE.CHAT) {
    const Component = messageComponentMap[subType] ?? Text;
    return <Component content={payload.content} />;
  }

  return <Text content={payload.content} />;
};

export default MessageRenderer;
