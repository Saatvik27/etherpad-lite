import React from 'react';
import { useChat } from '../context/ChatContext';

const formatRelative = (timestamp: number): string => {
  const deltaMs = Date.now() - timestamp;
  const deltaMin = Math.floor(deltaMs / 60000);

  if (deltaMin < 1) return 'just now';
  if (deltaMin < 60) return `${deltaMin}m ago`;

  const deltaHours = Math.floor(deltaMin / 60);
  if (deltaHours < 24) return `${deltaHours}h ago`;

  const deltaDays = Math.floor(deltaHours / 24);
  if (deltaDays < 7) return `${deltaDays}d ago`;

  return new Date(timestamp).toLocaleDateString();
};

export function ChatSessionsPanel() {
  const { state, createNewSession, switchSession } = useChat();

  return (
    <aside style={{
      width: '230px',
      borderRight: '1px solid #E5E7EB',
      background: '#F8FAFC',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #E5E7EB' }}>
        <button
          onClick={createNewSession}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 12px',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
            color: 'white',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
          }}
        >
          + New Chat
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {state.sessions.map((session) => {
          const active = session.sessionId === state.activeSessionId;
          return (
            <button
              key={session.sessionId}
              onClick={() => switchSession(session.sessionId)}
              style={{
                width: '100%',
                textAlign: 'left',
                border: active ? '1px solid #8B5CF6' : '1px solid transparent',
                borderRadius: '10px',
                padding: '10px',
                marginBottom: '6px',
                background: active ? '#F3E8FF' : 'transparent',
                cursor: 'pointer',
              }}
              title={session.title}
            >
              <div style={{
                fontSize: '12px',
                color: '#111827',
                fontWeight: 700,
                lineHeight: 1.35,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {session.title || 'New chat'}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#6B7280',
                marginTop: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {session.lastMessagePreview || 'No messages yet'}
              </div>
              <div style={{
                marginTop: '6px',
                fontSize: '10px',
                color: '#9CA3AF',
              }}>
                {session.messageCount} msgs • {formatRelative(session.updatedAt)}
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
