import React, { useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { ThinkingIndicator } from './ThinkingIndicator';
import { MessageList } from './MessageList';
import { InputBox } from './InputBox';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ChatSessionsPanel } from './ChatSessionsPanel';

export function ChatBox() {
  const { state, toggleChat, clearActiveSession } = useChat();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        toggleChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleChat]);

  if (!state.isOpen) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          width: 'min(760px, calc(100vw - 32px))',
          height: '550px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          transformOrigin: 'bottom left',
          transition: 'all 0.3s ease',
          opacity: state.isOpen ? 1 : 0,
          transform: state.isOpen ? 'scale(1)' : 'scale(0.95)',
        }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
          color: 'white',
          padding: '18px 20px',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <span style={{ fontSize: '32px', lineHeight: 1 }}>📋</span>
            <div>
              <h2 style={{
                fontWeight: '700',
                fontSize: '18px',
                margin: '0',
                letterSpacing: '0.3px',
              }}>Procurement Analyst</h2>
              <p style={{
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.9)',
                margin: '0',
                marginTop: '3px',
                fontWeight: '500',
              }}>
                {state.isConnected ? '✅ Ready to gather requirements' : '⏳ Connecting...'}
              </p>
            </div>
          </div>
          <button
            onClick={clearActiveSession}
            style={{
              padding: '6px 10px',
              borderRadius: '999px',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              background: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              marginRight: '8px',
            }}
            title="Clear current chat"
          >
            Clear Chat
          </button>
          <button
            onClick={toggleChat}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              fontSize: '22px',
              fontWeight: 'bold',
              color: 'white',
            }}
            aria-label="Close chat"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              e.currentTarget.style.transform = 'rotate(90deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.transform = 'rotate(0deg)';
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <ChatSessionsPanel />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            {/* Thinking Indicator */}
            {(state.isThinking || state.isLoadingHistory) && <ThinkingIndicator />}

            {/* Messages */}
            <MessageList />

            {/* Input */}
            <InputBox />
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog />
    </>
  );
}
