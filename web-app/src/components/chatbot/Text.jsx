import React from 'react';

const OrderCard = ({ content }) => {

  return (
    <div className="text-card">
      <div dangerouslySetInnerHTML={{ __html: content }}></div>
    </div>
  );
};

export default OrderCard;
