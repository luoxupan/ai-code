import React from 'react';

const GuessYouAsk = ({ content }) => {
  return (
    <div className="guess-you-ask">
      <p><strong>猜你想问：</strong></p>
      <div>{content}</div>
    </div>
  );
};

export default GuessYouAsk;
