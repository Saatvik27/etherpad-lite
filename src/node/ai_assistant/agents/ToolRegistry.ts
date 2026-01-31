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
      this.createAppendTextTool(padId, authorId),
      this.createReplaceTextTool(padId, authorId),
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
   * Tool: Append text to pad
   */
  private static createAppendTextTool(padId: string, authorId: string) {
    return new DynamicStructuredTool({
      name: 'append_text_to_pad',
      description: 'Append text to the end of the pad. IMPORTANT: This modifies the pad and requires user confirmation.',
      schema: z.object({
        text: z.string().describe('The text to append to the pad'),
      }),
      func: async ({text}) => {
        // This will be intercepted by the agent handler for confirmation
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
      description: 'Find and replace text in the pad. IMPORTANT: This modifies the pad and requires user confirmation.',
      schema: z.object({
        searchText: z.string().describe('The text to find'),
        replacementText: z.string().describe('The text to replace it with'),
      }),
      func: async ({searchText, replacementText}) => {
        // This will be intercepted by the agent handler for confirmation
        return JSON.stringify({
          action: 'replace',
          searchText,
          replacementText,
          requiresConfirmation: true,
        });
      },
    });
  }
}
