import React from 'react';

const OrderCard = ({ content }) => {

  return (
    <div className="text-card">
      <p dangerouslySetInnerHTML={{ __html: content }}></p>
    </div>
  );
};

export default OrderCard;
