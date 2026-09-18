import React from 'react';

const OrderCard = ({ content }) => {
  // Assuming content is a JSON string with order details
  let parsedContent = { orderId: 'N/A', amount: 'N/A', status: 'N/A' };
  try {
    parsedContent = JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse OrderCard content", content);
  }

  return (
    <div className="order-card">
      <p><strong>订单详情：</strong></p>
      <p>订单号：{parsedContent.orderId}</p>
      <p>金额：¥{parsedContent.amount}</p>
      <p>状态：{parsedContent.status}</p>
    </div>
  );
};

export default OrderCard;
