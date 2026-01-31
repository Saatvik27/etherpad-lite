import React, { useState, KeyboardEvent } from 'react';
import { useChat } from '../context/ChatContext';

export function InputBox() {
  const { sendMessage, state } = useChat();
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim() && !state.isThinking) {
      sendMessage(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      borderTop: '1px solid #E5E7EB',
      background: 'white',
      padding: '16px',
      borderBottomLeftRadius: '16px',
      borderBottomRightRadius: '16px',
    }}>
      <div style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'end',
      }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI anything about this pad..."
          disabled={state.isThinking}
          style={{
            flex: '1',
            resize: 'none',
            borderRadius: '12px',
            border: '2px solid #E5E7EB',
            padding: '12px 14px',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
            minHeight: '48px',
            maxHeight: '120px',
            background: state.isThinking ? '#F9FAFB' : 'white',
            cursor: state.isThinking ? 'not-allowed' : 'text',
            transition: 'all 0.2s',
          }}
          onFocus={(e) => {
            if (!state.isThinking) {
              e.target.style.borderColor = '#8B5CF6';
              e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)';
            }
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#E5E7EB';
            e.target.style.boxShadow = 'none';
          }}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || state.isThinking}
          style={{
            padding: '12px 18px',
            background: (!input.trim() || state.isThinking) ? '#D1D5DB' : 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
            color: 'white',
            borderRadius: '12px',
            fontWeight: '600',
            border: 'none',
            cursor: (!input.trim() || state.isThinking) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            fontSize: '20px',
            minWidth: '48px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: (!input.trim() || state.isThinking) ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.3)',
          }}
          onMouseEnter={(e) => {
            if (!(!input.trim() || state.isThinking)) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = (!input.trim() || state.isThinking) ? 'none' : '0 4px 12px rgba(139, 92, 246, 0.3)';
          }}
        >
          {state.isThinking ? '⏳' : '➤'}
        </button>
      </div>
      <p style={{
        fontSize: '12px',
        color: '#9CA3AF',
        marginTop: '8px',
        margin: '8px 0 0 0',
      }}>
        ↵ to send • Shift+↵ for new line
      </p>
    </div>
  );
}
