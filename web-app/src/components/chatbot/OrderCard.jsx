import React from 'react';
import MessageCard from './MessageCard.jsx';
import { parseJsonContent } from './contentUtils.js';

const OrderCard = ({ content }) => {
  const order = parseJsonContent(content, {})
  const amount = Number(order.amount)
  const isValidAmount = Number.isFinite(amount)

  return (
    <MessageCard icon="📦" label="订单详情">
      <div className="order-amount">
        <span>订单金额</span>
        <strong>{isValidAmount ? `¥${amount.toFixed(2)}` : '待确认'}</strong>
      </div>
      <dl className="order-fields">
        <div>
          <dt>订单号</dt>
          <dd>{order.orderId || '暂无'}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd><span className="order-status">{order.status || '未知'}</span></dd>
        </div>
      </dl>
    </MessageCard>
  );
};

export default OrderCard;
