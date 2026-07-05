import React from 'react';

const FaqCard = ({ content }) => {
  // Assuming content is a JSON string with question and answer
  let parsedContent = { question: 'N/A', answer: 'N/A' };
  try {
    parsedContent = JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse FaqCard content", content);
  }

  return (
    <div className="faq-card">
      <p><strong>问题：{parsedContent.question}</strong></p>
      <p>答案：{parsedContent.answer}</p>
    </div>
  );
};

export default FaqCard;
