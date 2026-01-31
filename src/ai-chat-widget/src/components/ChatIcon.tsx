import React from 'react';
import { useChat } from '../context/ChatContext';

export function ChatIcon() {
  const { toggleChat, state } = useChat();

  return (
    <button
      onClick={toggleChat}
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 50,
        width: '60px',
        height: '60px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
        color: 'white',
        boxShadow: '0 10px 25px rgba(139, 92, 246, 0.3)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.3s ease',
        fontSize: '28px',
      }}
      title="AI Assistant (Alt+A)"
      aria-label="Toggle AI Chat"
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.boxShadow = '0 15px 35px rgba(139, 92, 246, 0.4)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = '0 10px 25px rgba(139, 92, 246, 0.3)';
      }}
    >
      💬
      {state.messages.length > 0 && !state.isOpen && (
        <span
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '18px',
            height: '18px',
            background: '#EF4444',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 'bold',
            border: '2px solid white',
          }}
        >
          {state.messages.length}
        </span>
      )}
    </button>
  );
}
