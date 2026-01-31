import React from 'react';
import { useChat } from '../context/ChatContext';

export function ConfirmationDialog() {
  const { state, confirmAction, cancelAction } = useChat();

  if (!state.pendingAction) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
      animation: 'fadeIn 0.2s ease-out',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
        padding: '24px',
        maxWidth: '450px',
        width: '90%',
        margin: '0 20px',
        animation: 'slideUp 0.3s ease-out',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'start',
          gap: '16px',
          marginBottom: '20px',
        }}>
          <span style={{ fontSize: '40px', lineHeight: 1 }}>⚠️</span>
          <div style={{ flex: '1' }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#111827',
              marginBottom: '10px',
              margin: '0 0 10px 0',
            }}>
              Confirm AI Action
            </h3>
            <p style={{
              fontSize: '15px',
              color: '#4B5563',
              lineHeight: '1.5',
              margin: '0',
            }}>
              {state.pendingAction.description}
            </p>
            {state.pendingAction.action && (
              <div style={{
                marginTop: '14px',
                padding: '14px',
                background: '#F9FAFB',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                maxHeight: '300px',
                overflow: 'auto',
              }}>
                {state.pendingAction.action.type === 'append' && (
                  <>
                    <p style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280',
                      margin: '0 0 8px 0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      📝 Text to append:
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#374151',
                      margin: '0',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6',
                    }}>
                      {state.pendingAction.action.newText}
                    </p>
                  </>
                )}
                {state.pendingAction.action.type === 'insert' && (
                  <>
                    <p style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280',
                      margin: '0 0 8px 0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      ➕ Insert at line {state.pendingAction.action.lineNumber}:
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#059669',
                      margin: '0',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6',
                    }}>
                      {state.pendingAction.action.newText}
                    </p>
                  </>
                )}
                {state.pendingAction.action.type === 'replace' && (
                  <>
                    <p style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280',
                      margin: '0 0 8px 0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      🔄 Replace:
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#DC2626',
                      margin: '0 0 12px 0',
                      textDecoration: 'line-through',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {state.pendingAction.action.oldText}
                    </p>
                    <p style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280',
                      margin: '0 0 8px 0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      With:
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#059669',
                      margin: '0',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {state.pendingAction.action.newText}
                    </p>
                  </>
                )}
                {state.pendingAction.action.type === 'delete' && (
                  <>
                    <p style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#6B7280',
                      margin: '0 0 8px 0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      🗑️ Text to delete:
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#DC2626',
                      margin: '0',
                      textDecoration: 'line-through',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6',
                    }}>
                      {state.pendingAction.action.textToDelete}
                    </p>
                  </>
                )}
                {state.pendingAction.action.type === 'clear' && (
                  <>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#DC2626',
                      margin: '0',
                      textAlign: 'center',
                    }}>
                      ⚠️ This will permanently delete ALL content from the pad!
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={cancelAction}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              background: '#E5E7EB',
              color: '#374151',
              fontWeight: '600',
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#D1D5DB';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#E5E7EB';
            }}
          >
            ❌ Cancel
          </button>
          <button
            onClick={() => confirmAction(state.pendingAction!.actionId)}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
              color: 'white',
              fontWeight: '600',
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
            }}
          >
            ✅ Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
