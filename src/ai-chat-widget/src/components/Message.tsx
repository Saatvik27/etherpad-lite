import React from 'react';
import { Message as MessageType } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const normalizedContent = message.content
    // Unescape common markdown chars when models return escaped markdown.
    .replace(/\\([*_`#\-[\]()])/g, '$1')
    // Normalize excessive blank lines.
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const getMessageStyles = () => {
    const baseStyles: React.CSSProperties = {
      padding: '12px 16px',
      borderRadius: '14px',
      maxWidth: '80%',
      wordWrap: 'break-word',
      wordBreak: 'break-word',
      animation: 'slideIn 0.3s ease-out',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    };

    switch (message.role) {
      case 'user':
        return {
          ...baseStyles,
          background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
          color: 'white',
          alignSelf: 'flex-end',
          marginLeft: 'auto',
          borderBottomRightRadius: '4px',
        };
      case 'assistant':
        return {
          ...baseStyles,
          background: 'white',
          border: '2px solid #E5E7EB',
          color: '#1F2937',
          alignSelf: 'flex-start',
          marginRight: 'auto',
          borderBottomLeftRadius: '4px',
        };
      case 'system':
        return {
          ...baseStyles,
          background: '#FEF3C7',
          border: '2px solid #FCD34D',
          color: '#92400E',
          alignSelf: 'center',
          marginLeft: 'auto',
          marginRight: 'auto',
          textAlign: 'center' as const,
          fontSize: '14px',
        };
      case 'error':
        return {
          ...baseStyles,
          background: '#FEE2E2',
          border: '2px solid #FECACA',
          color: '#991B1B',
          alignSelf: 'center',
          marginLeft: 'auto',
          marginRight: 'auto',
          textAlign: 'center' as const,
        };
      default:
        return {
          ...baseStyles,
          background: '#F3F4F6',
          color: '#1F2937',
          alignSelf: 'flex-start',
        };
    }
  };

  const getEmoji = () => {
    switch (message.role) {
      case 'user':
        return '👤';
      case 'assistant':
        return '🤖';
      case 'system':
        return 'ℹ️';
      case 'error':
        return '⚠️';
      default:
        return '';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
      <div style={getMessageStyles()}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
          <span style={{ fontSize: '16px', flexShrink: 0 }}>{getEmoji()}</span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '14px',
              lineHeight: '1.5',
              margin: '0',
            }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({children}) => <p style={{margin: '0 0 6px 0'}}>{children}</p>,
                  ul: ({children}) => <ul style={{margin: '0 0 8px 18px', padding: 0}}>{children}</ul>,
                  ol: ({children}) => <ol style={{margin: '0 0 8px 18px', padding: 0}}>{children}</ol>,
                  li: ({children}) => <li style={{margin: '0 0 4px 0'}}>{children}</li>,
                  strong: ({children}) => <strong style={{fontWeight: 700}}>{children}</strong>,
                  em: ({children}) => <em>{children}</em>,
                  code: ({children}) => (
                    <code style={{
                      background: 'rgba(15, 23, 42, 0.08)',
                      borderRadius: '4px',
                      padding: '1px 4px',
                      fontSize: '12px',
                    }}>
                      {children}
                    </code>
                  ),
                }}
              >
                {normalizedContent}
              </ReactMarkdown>
            </div>
            <span style={{
              fontSize: '11px',
              opacity: 0.6,
              marginTop: '6px',
              display: 'block',
            }}>
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
