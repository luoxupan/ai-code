import React from 'react';
import MessageCard from './MessageCard.jsx';
import { parseJsonContent } from './contentUtils.js';

const FaqCard = ({ content }) => {
  const parsedContent = parseJsonContent(content, {
    question: typeof content === 'string' ? content : '暂无问题',
    answer: '',
  })

  return (
    <MessageCard icon="?" label="FAQ">
      <h3 className="faq-question">{parsedContent.question}</h3>
      <p className="faq-answer">{parsedContent.answer || '暂无答案'}</p>
    </MessageCard>
  );
};

export default FaqCard;
