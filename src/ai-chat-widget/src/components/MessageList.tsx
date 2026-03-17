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
          color: '#6B7280',
          textAlign: 'center',
          padding: '0 8px',
        }}>
          <span style={{ fontSize: '56px', marginBottom: '16px', opacity: 0.7 }}>📋</span>
          <p style={{
            fontSize: '16px',
            fontWeight: '700',
            margin: '0',
            marginBottom: '8px',
            color: '#374151',
          }}>Procurement Requirements Analyst</p>
          <p style={{
            fontSize: '13px',
            margin: '0',
            lineHeight: '1.6',
            color: '#9CA3AF',
          }}>
            Tell me what you need to procure and I’ll guide you through building a formal Requirement Definition Document — section by section, through conversation.
          </p>
          <div style={{
            marginTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '100%',
          }}>
            {[
              '📦 I need to procure custom t-shirts for 500 employees',
              '💻 We need a software system for expense management',
              '🛍️ Looking to source office furniture for a new branch',
            ].map((example) => (
              <div key={example} style={{
                padding: '8px 12px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                fontSize: '12px',
                color: '#6B7280',
                textAlign: 'left',
                cursor: 'default',
              }}>
                {example}
              </div>
            ))}
          </div>
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
