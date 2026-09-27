import React from 'react';
import MessageCard from './MessageCard.jsx';
import { asArray } from './contentUtils.js';

const GuessYouAsk = ({ content }) => {
  const questions = asArray(
    typeof content === 'string' && content.trim().startsWith('[')
      ? (() => {
        try {
          return JSON.parse(content)
        } catch {
          return content
        }
      })()
      : content
  )

  return (
    <MessageCard icon="✦" label="猜你想问">
      <ul className="guess-list">
        {questions.map((question, index) => (
          <li key={`${question}-${index}`} className="guess-item">{question}</li>
        ))}
      </ul>
    </MessageCard>
  );
};

export default GuessYouAsk;
