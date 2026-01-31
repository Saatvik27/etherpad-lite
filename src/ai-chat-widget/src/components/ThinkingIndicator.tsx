import React from 'react';

export function ThinkingIndicator() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '14px 20px',
      background: '#F3E8FF',
      borderBottom: '1px solid #E9D5FF',
    }}>
      <div style={{
        display: 'flex',
        gap: '6px',
        alignItems: 'center',
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          background: '#8B5CF6',
          borderRadius: '50%',
          animation: 'bounce 1.4s infinite ease-in-out both',
          animationDelay: '0s',
        }} />
        <span style={{
          width: '8px',
          height: '8px',
          background: '#8B5CF6',
          borderRadius: '50%',
          animation: 'bounce 1.4s infinite ease-in-out both',
          animationDelay: '0.16s',
        }} />
        <span style={{
          width: '8px',
          height: '8px',
          background: '#8B5CF6',
          borderRadius: '50%',
          animation: 'bounce 1.4s infinite ease-in-out both',
          animationDelay: '0.32s',
        }} />
      </div>
      <span style={{
        fontSize: '14px',
        color: '#7C3AED',
        fontWeight: '500',
      }}>
        🤔 AI is thinking...
      </span>
    </div>
  );
}
