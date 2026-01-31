import React from 'react';
import { useChat } from '../context/ChatContext';

export function ConfirmationDialog() {
  const { state, confirmAction, cancelAction } = useChat();

  if (!state.pendingAction) return null;

  // Helper to get action summary
  const getActionSummary = () => {
    const action = state.pendingAction!.action;
    const type = action.type;

    switch (type) {
      case 'append':
        const appendLength = action.newText?.length || 0;
        const appendLines = (action.newText?.match(/\n/g) || []).length + 1;
        return {
          icon: '📝',
          title: 'Add Content',
          description: `Add ${appendLength} characters (${appendLines} line${appendLines !== 1 ? 's' : ''}) to the end of the pad`,
          color: '#8B5CF6',
        };
      
      case 'insert':
        const insertLength = action.newText?.length || 0;
        const insertLines = (action.newText?.match(/\n/g) || []).length + 1;
        return {
          icon: '➕',
          title: 'Insert Content',
          description: `Insert ${insertLength} characters (${insertLines} line${insertLines !== 1 ? 's' : ''}) at line ${action.lineNumber}`,
          color: '#10B981',
        };
      
      case 'replace':
        return {
          icon: '🔄',
          title: 'Replace Text',
          description: `Replace all occurrences of "${action.oldText?.substring(0, 50)}${(action.oldText?.length ?? 0) > 50 ? '...' : ''}"`,
          color: '#F59E0B',
        };
      
      case 'delete':
        return {
          icon: '🗑️',
          title: 'Delete Text',
          description: `Delete all occurrences of "${action.textToDelete?.substring(0, 50)}${(action.textToDelete?.length ?? 0) > 50 ? '...' : ''}"`,
          color: '#EF4444',
        };
      
      case 'clear':
        return {
          icon: '⚠️',
          title: 'Clear Pad',
          description: 'Permanently delete ALL content from the pad',
          color: '#DC2626',
        };
      
      case 'format':
        return {
          icon: '✨',
          title: 'Format Text',
          description: `Apply ${action.formatType} formatting to "${action.textToFormat?.substring(0, 40)}${(action.textToFormat?.length ?? 0) > 40 ? '...' : ''}"`,
          color: '#8B5CF6',
        };
      
      case 'create_list':
        return {
          icon: '📋',
          title: 'Create List',
          description: `Create ${action.listType} list with ${action.items?.length || 0} items`,
          color: '#3B82F6',
        };
      
      case 'rewrite_section':
        const rewriteLines = (action.endLine ?? 0) - (action.startLine ?? 0) + 1;
        return {
          icon: '✏️',
          title: 'Rewrite Section',
          description: `Rewrite ${rewriteLines} line${rewriteLines !== 1 ? 's' : ''} (lines ${action.startLine}-${action.endLine})`,
          color: '#8B5CF6',
        };
      
      case 'indent_lines':
        const indentLines = (action.endLine ?? 0) - (action.startLine ?? 0) + 1;
        return {
          icon: action.direction === 'indent' ? '➡️' : '⬅️',
          title: action.direction === 'indent' ? 'Indent Lines' : 'Outdent Lines',
          description: `${action.direction === 'indent' ? 'Indent' : 'Outdent'} ${indentLines} line${indentLines !== 1 ? 's' : ''} (lines ${action.startLine}-${action.endLine})`,
          color: '#6366F1',
        };
      
      case 'remove_formatting':
        const removeLines = (action.endLine ?? 0) - (action.startLine ?? 0) + 1;
        return {
          icon: '🧹',
          title: 'Remove Formatting',
          description: `Remove all formatting from ${removeLines} line${removeLines !== 1 ? 's' : ''} (lines ${action.startLine}-${action.endLine})`,
          color: '#9CA3AF',
        };
      
      case 'fix_grammar':
        if (action.startLine) {
          const grammarLines = (action.endLine ?? 0) - (action.startLine ?? 0) + 1;
          return {
            icon: '📝',
            title: 'Fix Grammar',
            description: `Fix grammar in ${grammarLines} line${grammarLines !== 1 ? 's' : ''} (lines ${action.startLine}-${action.endLine})`,
            color: '#10B981',
          };
        }
        return {
          icon: '📝',
          title: 'Fix Grammar',
          description: 'Fix grammar and spelling in entire pad',
          color: '#10B981',
        };
      
      default:
        return {
          icon: '⚡',
          title: 'AI Action',
          description: state.pendingAction!.description || 'Perform AI action',
          color: '#8B5CF6',
        };
    }
  };

  const summary = getActionSummary();

  return (
    <div style={{
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      background: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
      animation: 'fadeIn 0.2s ease-out',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        padding: '0',
        maxWidth: '440px',
        width: '90%',
        overflow: 'hidden',
        animation: 'slideUp 0.3s ease-out',
      }}>
        {/* Header with colored background */}
        <div style={{
          background: `linear-gradient(135deg, ${summary.color} 0%, ${summary.color}dd 100%)`,
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <span style={{
            fontSize: '48px',
            lineHeight: 1,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
          }}>
            {summary.icon}
          </span>
          <h3 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: 'white',
            margin: '0',
            textShadow: '0 1px 2px rgba(0,0,0,0.1)',
          }}>
            {summary.title}
          </h3>
        </div>

        {/* Content */}
        <div style={{
          padding: '28px',
        }}>
          <p style={{
            fontSize: '16px',
            color: '#374151',
            lineHeight: '1.6',
            margin: '0 0 24px 0',
            fontWeight: '500',
          }}>
            {summary.description}
          </p>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={cancelAction}
              style={{
                padding: '12px 28px',
                borderRadius: '12px',
                background: '#F3F4F6',
                color: '#4B5563',
                fontWeight: '600',
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#E5E7EB';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#F3F4F6';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => confirmAction(state.pendingAction!.actionId)}
              style={{
                padding: '12px 28px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${summary.color} 0%, ${summary.color}dd 100%)`,
                color: 'white',
                fontWeight: '600',
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: `0 4px 12px ${summary.color}40`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = `0 6px 20px ${summary.color}50`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = `0 4px 12px ${summary.color}40`;
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
