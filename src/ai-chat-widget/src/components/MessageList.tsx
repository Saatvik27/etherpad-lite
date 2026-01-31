import React, { useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { Message } from './Message';

export function MessageList() {
  const { state } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages]);

  return (
    <div style={{
      flex: '1',
      overflowY: 'auto',
      background: '#F9FAFB',
      padding: '20px',
    }}>
      {state.messages.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#9CA3AF',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.6 }}>💬</span>
          <p style={{
            fontSize: '16px',
            fontWeight: '600',
            margin: '0',
            marginBottom: '4px',
          }}>No messages yet</p>
          <p style={{
            fontSize: '14px',
            margin: '0',
            opacity: 0.7,
          }}>Start a conversation with the AI</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {state.messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}
