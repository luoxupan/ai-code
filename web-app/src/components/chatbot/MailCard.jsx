import React, { useState } from 'react';
import { useSetAtom } from 'jotai';
import { v4 as uuidv4 } from 'uuid';
import { messagesAtom } from '../../store/chatbotAtoms.ts';
import { MESSAGE_TYPE, SUB_TYPE } from '../../constants/chat.ts';
import { parseJsonContent } from './contentUtils.js';
import { sendChatMessage } from './sendChatMessage.js';
import './MailCard.css';

export const messageType = SUB_TYPE.MAIL_CARD;

const MailCard = ({ content }) => {
  const initialContent = parseJsonContent(content, {});
  const [form, setForm] = useState({
    recipients: initialContent.recipients || '',
    subject: initialContent.subject || '',
    body: initialContent.body || '',
  });
  const [status, setStatus] = useState('');
  const setMessages = useSetAtom(messagesAtom);

  const updateField = (fieldName) => (event) => {
    setForm(prev => ({ ...prev, [fieldName]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('sending');

    const message = {
      mid: uuidv4(),
      type: MESSAGE_TYPE.ACTION,
      subType: SUB_TYPE.MAIL_CARD,
      sender: 'user',
      status: 'sending',
      payload: { content: form },
    };

    setMessages(prev => [...prev, message]);
    try {
      let result = await sendChatMessage(message, setMessages);
      setStatus(result ? 'success' : 'failed');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <section className="mail-card">
      <header className="mail-card__header">
        <svg className="mail-card__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5Zm-.05 2.16v9.34c0 .28.22.5.5.5h15.1a.5.5 0 0 0 .5-.5V7.66l-7.38 5.06a1 1 0 0 1-1.14 0L3.95 7.66Zm.94-1.66 7.16 4.91c.29.2.66.2.9 0l7.16-4.91H4.89Z" />
        </svg>
        <h2>发送邮件</h2>
      </header>

      <form className="mail-card__form" onSubmit={handleSubmit}>
        <label className="mail-card__field">
          <span>收件人 <i>*</i></span>
          <input
            type="text"
            value={form.recipients}
            onChange={updateField('recipients')}
            placeholder="请输入收件人邮箱地址（多个邮箱用逗号分隔）"
            required
          />
        </label>

        <label className="mail-card__field">
          <span>主题 <i>*</i></span>
          <input
            type="text"
            value={form.subject}
            onChange={updateField('subject')}
            placeholder="请输入邮件主题"
            required
          />
        </label>

        <label className="mail-card__field">
          <span>邮件内容 <i>*</i></span>
          <textarea
            value={form.body}
            onChange={updateField('body')}
            placeholder="请输入邮件内容..."
            required
          />
        </label>

        <div className="mail-card__actions">
          <button type="submit" disabled={status === 'sending'}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3.4 20.4 21 12 3.4 3.6l.02 6.53L15 12l-11.58 1.87-.02 6.53Z" />
            </svg>
            {status === 'sending' ? '发送中...' : '发送'}
          </button>
          {status === 'success' && <span className="mail-card__status is-success">发送成功</span>}
          {status === 'failed' && <span className="mail-card__status is-failed">发送失败</span>}
        </div>
      </form>
    </section>
  );
};

export default MailCard;
