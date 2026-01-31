'use strict';
/**
 * ToolRegistry - Defines available tools for the AI agent
 */

import {DynamicStructuredTool} from '@langchain/core/tools';
import {z} from 'zod';
import {PadContentReader} from '../PadContentReader';
import {PadContentWriter} from '../PadContentWriter';

export class ToolRegistry {
  /**
   * Create all available tools for the AI agent
   */
  static createTools(padId: string, authorId: string) {
    return [
      this.createReadPadTool(padId),
      this.createSearchPadTool(padId),
      this.createGetMetadataTool(padId),
      this.createInsertTextTool(padId, authorId),
      this.createAppendTextTool(padId, authorId),
      this.createReplaceTextTool(padId, authorId),
      this.createDeleteTextTool(padId, authorId),
      this.createClearPadTool(padId, authorId),
    ];
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
}
