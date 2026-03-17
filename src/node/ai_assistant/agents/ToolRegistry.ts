'use strict';
/**
 * ToolRegistry - Defines available tools for the AI agent
 */

import {DynamicStructuredTool} from '@langchain/core/tools';
import {z} from 'zod';
import {PadContentReader} from '../PadContentReader';
import {PadContentWriter} from '../PadContentWriter';
import {REQUIREMENTS_TEMPLATE} from '../RequirementsTemplate';

export class ToolRegistry {
  /**
   * Create all available tools for the AI agent
   */
  static createTools(padId: string, authorId: string) {
    return [
      // Read-only tools
      this.createReadPadTool(padId),
      this.createSearchPadTool(padId),
      this.createGetMetadataTool(padId),
      this.createGetTextRangeTool(padId),
      this.createFindAndListTool(padId),
      this.createAnalyzeStructureTool(padId),
      this.createGetAuthorTextTool(padId),
      this.createGetChangesSinceTool(padId),

      // Procurement requirements tools
      this.createInitializeRequirementsDocumentTool(padId, authorId),
      this.createUpdateDocumentSectionTool(padId, authorId),
      
      // Write tools
      this.createInsertTextTool(padId, authorId),
      this.createAppendTextTool(padId, authorId),
      this.createReplaceTextTool(padId, authorId),
      this.createDeleteTextTool(padId, authorId),
      this.createClearPadTool(padId, authorId),
      this.createFormatTextTool(padId, authorId),
      this.createCreateListTool(padId, authorId),
      this.createRewriteSectionTool(padId, authorId),
      this.createIndentLinesTool(padId, authorId),
      this.createRemoveFormattingTool(padId, authorId),
      this.createSummarizeSectionTool(padId, authorId),
      this.createExpandSectionTool(padId, authorId),
      this.createFixGrammarTool(padId, authorId),
    ];
  }

  /**
   * Tool: Initialize a blank Requirement Definition Document in the pad
   */
  private static createInitializeRequirementsDocumentTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'initialize_requirements_document',
      description:
        'Write the blank Requirement Definition Document template into the pad. ' +
        'Call this ONCE at the start of a procurement intake when the pad is empty or when the user asks to start a new requirements document. ' +
        'After calling this, fill in sections using update_document_section or replace_text_in_pad.',
      schema: z.object({
        procurementType: z
          .enum(['Services Only', 'Goods Only', 'Mixed (Services + Goods)'])
          .describe('Type of procurement'),
        organizationName: z.string().optional().describe('Organization or branch name if known'),
        title: z.string().optional().describe('Brief descriptive title for the procurement (e.g. "Supply of Custom T-Shirts")'),
      }),
      func: async ({procurementType, organizationName, title}) => {
        const currentPadText = await PadContentReader.getPadText(padId);
        const hasTemplateAlready =
          currentPadText.includes('Requirement Definition Document') &&
          currentPadText.includes('A1. Purpose') &&
          currentPadText.includes('Open Questions and Assumptions');

        if (hasTemplateAlready) {
          return JSON.stringify({
            action: 'noop',
            skipWrite: true,
            message:
              'Requirement Definition Document template already exists. Do not re-initialize; continue by updating sections and asking the next procurement question.',
            requiresConfirmation: false,
          });
        }

        const today = new Date().toISOString().split('T')[0];
        let doc = REQUIREMENTS_TEMPLATE;
        // Patch known header fields before writing
        if (title) doc = doc.replace('Scope of Work / Supply', title);
        doc = doc.replace('| Procurement Type | TBD |', `| Procurement Type | ${procurementType} |`);
        if (organizationName)
          doc = doc.replace('| Organization / Branch | TBD |', `| Organization / Branch | ${organizationName} |`);
        doc = doc.replace('| Date | TBD |', `| Date | ${today} |`);
        return JSON.stringify({
          action: 'initialize_requirements_document',
          text: doc,
          description: `Initialize Requirement Definition Document: ${title || 'Procurement Requirements'}`,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Update a specific named section in the requirements document
   */
  private static createUpdateDocumentSectionTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'update_document_section',
      description:
        'Update the content of a specific section in the Requirement Definition Document. ' +
        'Use this instead of rewrite_section when you know the section name but not the line numbers. ' +
        'The tool searches for the section header, finds its extent, and replaces the body with your new content. ' +
        'Provide substantial professional content (not one-liners): detailed paragraph(s) and/or 3-6 specific bullets as appropriate.',
      schema: z.object({
        sectionHeader: z
          .string()
          .describe(
            'The exact section header text as it appears in the document (e.g. "A1. Purpose" or "B1. In Scope")'
          ),
        newContent: z
          .string()
          .describe(
            'The new content to place under this section header (do NOT include the header itself). Must be detailed and procurement-grade, not a short sentence.'
          ),
        description: z.string().optional().describe('Brief description of what is being updated'),
      }),
      func: async ({sectionHeader, newContent, description}) => {
        return JSON.stringify({
          action: 'update_document_section',
          sectionHeader,
          newContent,
          description: description || `Update section: ${sectionHeader}`,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Read entire pad content
   */
  private static createReadPadTool(padId: string) {
    return new DynamicStructuredTool({
      name: 'read_pad_content',
      description: 'Read the entire content of the current pad. Use this to understand what\'s in the document before making changes or answering questions about it.',
      schema: z.object({}),
      func: async () => {
        const text = await PadContentReader.getPadText(padId);
        return `Current pad content:\n\n${text}`;
      },
    });
  }

  /**
   * Tool: Search for text in pad
   */
  private static createSearchPadTool(padId: string) {
    return new DynamicStructuredTool({
      name: 'search_in_pad',
      description: 'Search for specific text within the pad. Returns the number of matches and their line positions.',
      schema: z.object({
        searchTerm: z.string().describe('The text to search for in the pad'),
      }),
      func: async ({searchTerm}) => {
        const result = await PadContentReader.searchInPad(padId, searchTerm);
        if (result.found) {
          const positions = result.positions
            .slice(0, 10)
            .map(p => `Line ${p.line}, Column ${p.column}`)
            .join('; ');
          return `Found ${result.matches} match(es). First 10 positions: ${positions}`;
        }
        return `Text "${searchTerm}" not found in the pad.`;
      },
    });
  }

  /**
   * Tool: Get pad metadata
   */
  private static createGetMetadataTool(padId: string) {
    return new DynamicStructuredTool({
      name: 'get_pad_metadata',
      description: 'Get information about the pad such as line count, word count, character count, number of authors, and revision count.',
      schema: z.object({}),
      func: async () => {
        const metadata = await PadContentReader.getPadMetadata(padId);
        return `Pad Statistics:
- Lines: ${metadata.lineCount}
- Words: ${metadata.wordCount}
- Characters: ${metadata.charCount}
- Authors: ${metadata.authorCount}
- Revisions: ${metadata.revisionCount}`;
      },
    });
  }

  /**
   * Tool: Insert text at specific position
   */
  private static createInsertTextTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'insert_text_at_position',
      description: 'Insert text at a specific line number in the pad. Use this when you need to add content in the middle of the document, not just at the end. Line numbers start at 0.',
      schema: z.object({
        lineNumber: z.number().describe('The line number where to insert the text (0-based)'),
        text: z.string().describe('The text to insert'),
      }),
      func: async ({lineNumber, text}) => {
        return JSON.stringify({
          action: 'insert',
          lineNumber,
          text,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Append text to pad
   */
  private static createAppendTextTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'append_text_to_pad',
      description: 'Append text to the END of the pad. Use this only when adding content at the very end. For inserting in the middle, use insert_text_at_position instead.',
      schema: z.object({
        text: z.string().describe('The text to append to the pad'),
      }),
      func: async ({text}) => {
        return JSON.stringify({
          action: 'append',
          text,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Replace text in pad
   */
  private static createReplaceTextTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'replace_text_in_pad',
      description: 'Find and replace ALL occurrences of specific text in the pad. Use this to update existing content.',
      schema: z.object({
        searchText: z.string().describe('The exact text to find'),
        replacementText: z.string().describe('The text to replace it with'),
      }),
      func: async ({searchText, replacementText}) => {
        return JSON.stringify({
          action: 'replace',
          searchText,
          replacementText,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Delete specific text
   */
  private static createDeleteTextTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'delete_text',
      description: 'Delete ALL occurrences of specific text from the pad. Use this to remove unwanted content.',
      schema: z.object({
        textToDelete: z.string().describe('The exact text to delete from the pad'),
      }),
      func: async ({textToDelete}) => {
        return JSON.stringify({
          action: 'delete',
          textToDelete,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Clear entire pad
   */
  private static createClearPadTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'clear_pad',
      description: 'Clear ALL content from the pad (makes it completely empty). Use ONLY when user explicitly asks to clear, empty, or delete everything.',
      schema: z.object({}),
      func: async () => {
        return JSON.stringify({
          action: 'clear',
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Get text range (specific lines)
   */
  private static createGetTextRangeTool(padId: string) {
    return new DynamicStructuredTool({
      name: 'get_text_range',
      description: 'Read a specific range of lines from the pad instead of the entire document. Much more efficient for large pads. Use this when you only need to see specific sections.',
      schema: z.object({
        startLine: z.number().describe('Starting line number (1-based)'),
        endLine: z.number().describe('Ending line number (1-based, inclusive)'),
      }),
      func: async ({startLine, endLine}) => {
        const result = await PadContentReader.getTextRange(padId, startLine, endLine);
        return `Lines ${result.startLine}-${result.endLine} of ${result.totalLines}:\n\n${result.text}`;
      },
    });
  }

  /**
   * Tool: Find and list with context
   */
  private static createFindAndListTool(padId: string) {
    return new DynamicStructuredTool({
      name: 'find_and_list',
      description: 'Search for text and show surrounding context lines. Better than basic search when you need to understand how the text is used.',
      schema: z.object({
        searchTerm: z.string().describe('The text to search for'),
        contextLines: z.number().optional().describe('Number of lines to show before and after each match (default: 2)'),
      }),
      func: async ({searchTerm, contextLines}) => {
        const result = await PadContentReader.findAndList(padId, searchTerm, contextLines || 2);
        if (!result.found) {
          return `Text "${searchTerm}" not found in the pad.`;
        }
        
        let output = `Found ${result.matches.length} match(es):\n\n`;
        result.matches.forEach((match, index) => {
          output += `--- Match ${index + 1} at Line ${match.line}, Column ${match.column} ---\n`;
          if (match.contextBefore.length > 0) {
            output += match.contextBefore.join('\n') + '\n';
          }
          output += `>>> ${match.lineText}\n`;
          if (match.contextAfter.length > 0) {
            output += match.contextAfter.join('\n') + '\n';
          }
          output += '\n';
        });
        return output;
      },
    });
  }

  /**
   * Tool: Analyze document structure
   */
  private static createAnalyzeStructureTool(padId: string) {
    return new DynamicStructuredTool({
      name: 'analyze_structure',
      description: 'Analyze the document structure to identify lists, formatted sections, and layout. Helps understand document organization.',
      schema: z.object({}),
      func: async () => {
        const structure = await PadContentReader.analyzeStructure(padId);
        let output = `Document Structure Analysis:\n\n`;
        output += `Total Lines: ${structure.totalLines}\n`;
        output += `Empty Lines: ${structure.emptyLines.length}\n\n`;
        
        if (structure.lists.length > 0) {
          output += `Lists Found (${structure.lists.length}):\n`;
          structure.lists.forEach(list => {
            output += `  Line ${list.line}: ${list.type} list, level ${list.level}\n`;
          });
        } else {
          output += `No lists found\n`;
        }
        
        return output;
      },
    });
  }

  /**
   * Tool: Get text by author
   */
  private static createGetAuthorTextTool(padId: string) {
    return new DynamicStructuredTool({
      name: 'get_author_text',
      description: 'Get all text written by a specific author. Useful for understanding individual contributions.',
      schema: z.object({
        authorId: z.string().describe('The author ID to filter by'),
      }),
      func: async ({authorId}) => {
        const result = await PadContentReader.getAuthorText(padId, authorId);
        return `Author ${authorId} contribution:\n` +
               `Characters: ${result.charCount}\n` +
               `Percentage: ${result.contribution.toFixed(2)}%\n\n` +
               `${result.text}`;
      },
    });
  }

  /**
   * Tool: Get changes since revision
   */
  private static createGetChangesSinceTool(padId: string) {
    return new DynamicStructuredTool({
      name: 'get_changes_since',
      description: 'Get all changes made since a specific revision number. Useful for understanding recent edits.',
      schema: z.object({
        sinceRevision: z.number().describe('The revision number to start from'),
      }),
      func: async ({sinceRevision}) => {
        const result = await PadContentReader.getChangesSince(padId, sinceRevision);
        let output = `Changes from revision ${sinceRevision} to ${result.currentRevision}:\n\n`;
        result.changes.forEach(change => {
          const date = new Date(change.timestamp).toISOString();
          output += `Rev ${change.revision} by ${change.author} at ${date}\n`;
          output += `  ${change.changeDescription}\n\n`;
        });
        return output;
      },
    });
  }

  /**
   * Tool: Format text (bold, italic, underline, strikethrough)
   */
  private static createFormatTextTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'format_text',
      description: 'Apply formatting (bold, italic, underline, strikethrough) to specific text. Uses markdown-style markers.',
      schema: z.object({
        textToFormat: z.string().describe('The exact text to format'),
        formatType: z.enum(['bold', 'italic', 'underline', 'strikethrough']).describe('The type of formatting to apply'),
      }),
      func: async ({textToFormat, formatType}) => {
        return JSON.stringify({
          action: 'format',
          textToFormat,
          formatType,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Create list
   */
  private static createCreateListTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'create_list',
      description: 'Create a bullet or numbered list from an array of items. Can specify indent level (1-16).',
      schema: z.object({
        items: z.array(z.string()).describe('Array of list items'),
        listType: z.enum(['ordered', 'unordered']).describe('Type of list: ordered (numbered) or unordered (bullets)'),
        indentLevel: z.number().optional().describe('Indent level (1-16, default: 1)'),
      }),
      func: async ({items, listType, indentLevel}) => {
        return JSON.stringify({
          action: 'create_list',
          items,
          listType,
          indentLevel: indentLevel || 1,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Rewrite section
   */
  private static createRewriteSectionTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'rewrite_section',
      description: 'Replace a specific line range with improved or rewritten text. Better than find/replace for content improvement.',
      schema: z.object({
        startLine: z.number().describe('Starting line number (1-based)'),
        endLine: z.number().describe('Ending line number (1-based, inclusive)'),
        newText: z.string().describe('The new text to replace the section with'),
      }),
      func: async ({startLine, endLine, newText}) => {
        return JSON.stringify({
          action: 'rewrite_section',
          startLine,
          endLine,
          newText,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Indent lines
   */
  private static createIndentLinesTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'indent_lines',
      description: 'Indent or outdent (unindent) specific lines. Useful for adjusting list levels or code blocks.',
      schema: z.object({
        startLine: z.number().describe('Starting line number (1-based)'),
        endLine: z.number().describe('Ending line number (1-based, inclusive)'),
        direction: z.enum(['indent', 'outdent']).describe('Direction: indent (add spaces) or outdent (remove spaces)'),
      }),
      func: async ({startLine, endLine, direction}) => {
        return JSON.stringify({
          action: 'indent_lines',
          startLine,
          endLine,
          direction,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Remove formatting
   */
  private static createRemoveFormattingTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'remove_formatting',
      description: 'Remove all formatting (bold, italic, underline, strikethrough) from a line range.',
      schema: z.object({
        startLine: z.number().describe('Starting line number (1-based)'),
        endLine: z.number().describe('Ending line number (1-based, inclusive)'),
      }),
      func: async ({startLine, endLine}) => {
        return JSON.stringify({
          action: 'remove_formatting',
          startLine,
          endLine,
          requiresConfirmation: true,
        });
      },
    });
  }

  /**
   * Tool: Summarize section
   */
  private static createSummarizeSectionTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'summarize_section',
      description: 'Generate a concise summary of a specific line range. Returns the summary as text that you can then insert elsewhere.',
      schema: z.object({
        startLine: z.number().describe('Starting line number (1-based)'),
        endLine: z.number().describe('Ending line number (1-based, inclusive)'),
      }),
      func: async ({startLine, endLine}) => {
        const summary = await PadContentWriter.summarizeSection(padId, startLine, endLine, authorId);
        return `Summary: ${summary}`;
      },
    });
  }

  /**
   * Tool: Expand section
   */
  private static createExpandSectionTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'expand_section',
      description: 'Expand a specific line range with more detail to reach a target length. Returns expanded text that you can then use to replace the section.',
      schema: z.object({
        startLine: z.number().describe('Starting line number (1-based)'),
        endLine: z.number().describe('Ending line number (1-based, inclusive)'),
        targetLength: z.number().describe('Target character count for expanded text'),
      }),
      func: async ({startLine, endLine, targetLength}) => {
        const expanded = await PadContentWriter.expandSection(padId, startLine, endLine, targetLength, authorId);
        return `Expanded: ${expanded}`;
      },
    });
  }

  /**
   * Tool: Fix grammar
   */
  private static createFixGrammarTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'fix_grammar',
      description: 'Correct grammar and spelling errors. Can fix entire pad or specific line range.',
      schema: z.object({
        startLine: z.number().optional().describe('Starting line number (1-based, optional - omit to fix entire pad)'),
        endLine: z.number().optional().describe('Ending line number (1-based, inclusive, optional)'),
      }),
      func: async ({startLine, endLine}) => {
        return JSON.stringify({
          action: 'fix_grammar',
          startLine,
          endLine,
          requiresConfirmation: true,
        });
      },
    });
  }
}
