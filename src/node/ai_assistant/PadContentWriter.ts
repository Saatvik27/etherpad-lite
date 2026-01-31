'use strict';
/**
 * PadContentWriter - Modify pad content via changesets
 */

import log4js from 'log4js';
import {PadType} from '../types/PadType';
import {Builder} from '../../static/js/Builder';

const padManager = require('../db/PadManager');
const authorManager = require('../db/AuthorManager');
const padMessageHandler = require('../handler/PadMessageHandler');
const logger = log4js.getLogger('PadContentWriter');

// Create a dedicated AI Assistant author
const AI_AUTHOR_ID = 'a.AI_ASSISTANT';
const AI_AUTHOR_NAME = '🤖 AI Assistant';

/**
 * Ensure AI author exists in the database
 */
async function ensureAIAuthor() {
  try {
    const exists = await authorManager.doesAuthorExist(AI_AUTHOR_ID);
    if (!exists) {
      // Manually create the author object since we're using a fixed ID
      const db = require('../db/DB');
      const authorObj = {
        colorId: 0, // Use first color in palette
        name: AI_AUTHOR_NAME,
        timestamp: Date.now(),
      };
      await db.set(`globalAuthor:${AI_AUTHOR_ID}`, authorObj);
      logger.info(`Created AI Assistant author: ${AI_AUTHOR_ID}`);
    }
  } catch (error) {
    logger.error('Error ensuring AI author exists:', error);
  }
}

export class PadContentWriter {
  /**
   * Initialize AI author at server startup
   */
  static async initializeAIAuthor(): Promise<void> {
    await ensureAIAuthor();
  }

  /**
   * Append text to the end of the pad
   */
  static async appendText(
    padId: string,
    text: string,
    authorId: string
  ): Promise<void> {
    try {
      await ensureAIAuthor();
      const pad: PadType = await padManager.getPad(padId, null, AI_AUTHOR_ID);
      const currentText = pad.text();
      const newText = currentText + (currentText.endsWith('\n') ? '' : '\n') + text;
      await pad.setText(newText, AI_AUTHOR_ID);
      
      // Broadcast changes to all connected clients
      await padMessageHandler.updatePadClients(pad);
      
      logger.info(`Appended text to pad ${padId} by author ${authorId}`);
    } catch (error: any) {
      logger.error(`Error appending text to pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Replace specific text in the pad
   */
  static async replaceText(
    padId: string,
    searchText: string,
    replacementText: string,
    authorId: string
  ): Promise<{success: boolean; replacements: number}> {
    try {
      await ensureAIAuthor();
      const pad: PadType = await padManager.getPad(padId, null, AI_AUTHOR_ID);
      const currentText = pad.text();
      
      let replacements = 0;
      let newText = currentText;
      let index = 0;
      
      while ((index = newText.indexOf(searchText, index)) !== -1) {
        newText = newText.substring(0, index) + 
                  replacementText + 
                  newText.substring(index + searchText.length);
        index += replacementText.length;
        replacements++;
      }

      if (replacements > 0) {
        await pad.setText(newText, AI_AUTHOR_ID);
        
        // Broadcast changes to all connected clients
        await padMessageHandler.updatePadClients(pad);
        
        logger.info(`Replaced ${replacements} occurrences in pad ${padId}`);
      }

      return { success: replacements > 0, replacements };
    } catch (error: any) {
      logger.error(`Error replacing text in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Insert text at a specific line number
   */
  static async insertTextAtLine(
    padId: string,
    lineNumber: number,
    text: string,
    authorId: string
  ): Promise<void> {
    try {
      await ensureAIAuthor();
      const pad: PadType = await padManager.getPad(padId, null, AI_AUTHOR_ID);
      const currentText = pad.text();
      const lines = currentText.split('\n');
      
      // Insert at the specified line
      lines.splice(lineNumber, 0, text);
      const newText = lines.join('\n');
      
      await pad.setText(newText, AI_AUTHOR_ID);
      
      // Broadcast changes to all connected clients
      await padMessageHandler.updatePadClients(pad);
      
      logger.info(`Inserted text at line ${lineNumber} in pad ${padId} by author ${authorId}`);
    } catch (error: any) {
      logger.error(`Error inserting text in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all occurrences of specific text
   */
  static async deleteText(
    padId: string,
    textToDelete: string,
    authorId: string
  ): Promise<{success: boolean; deletions: number}> {
    try {
      await ensureAIAuthor();
      const pad: PadType = await padManager.getPad(padId, null, AI_AUTHOR_ID);
      const currentText = pad.text();
      
      let deletions = 0;
      let newText = currentText;
      let index = 0;
      
      while ((index = newText.indexOf(textToDelete, index)) !== -1) {
        newText = newText.substring(0, index) + 
                  newText.substring(index + textToDelete.length);
        deletions++;
      }

      if (deletions > 0) {
        await pad.setText(newText, AI_AUTHOR_ID);
        
        // Broadcast changes to all connected clients
        await padMessageHandler.updatePadClients(pad);
        
        logger.info(`Deleted ${deletions} occurrences in pad ${padId}`);
      }

      return { success: deletions > 0, deletions };
    } catch (error: any) {
      logger.error(`Error deleting text in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Set entire pad text (careful - this replaces everything!)
   */
  static async setPadText(
    padId: string,
    text: string,
    authorId: string
  ): Promise<void> {
    try {
      await ensureAIAuthor();
      const pad: PadType = await padManager.getPad(padId, null, AI_AUTHOR_ID);
      await pad.setText(text, AI_AUTHOR_ID);
      
      // Broadcast changes to all connected clients
      await padMessageHandler.updatePadClients(pad);
      
      logger.info(`Set entire text for pad ${padId}`);
    } catch (error: any) {
      logger.error(`Error setting text for pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Insert text at a specific position in the pad
   */
  static async insertTextAtPosition(
    padId: string,
    text: string,
    position: number,
    authorId: string
  ): Promise<void> {
    try {
      const pad: PadType = await padManager.getPad(padId, null, authorId);
      const currentText = pad.text();
      
      const newText = 
        currentText.substring(0, position) + 
        text + 
        currentText.substring(position);
      
      await pad.setText(newText, authorId);
      logger.info(`Inserted text at position ${position} in pad ${padId}`);
    } catch (error: any) {
      logger.error(`Error inserting text in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Delete lines from the pad
   */
  static async deleteLines(
    padId: string,
    startLine: number,
    endLine: number,
    authorId: string
  ): Promise<void> {
    try {
      const pad: PadType = await padManager.getPad(padId, null, authorId);
      const currentText = pad.text();
      const lines = currentText.split('\n');
      
      lines.splice(startLine - 1, endLine - startLine + 1);
      const newText = lines.join('\n');
      
      await pad.setText(newText, authorId);
      logger.info(`Deleted lines ${startLine}-${endLine} from pad ${padId}`);
    } catch (error: any) {
      logger.error(`Error deleting lines from pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Format text with bold, italic, underline, or strikethrough
   * Note: This is a simplified implementation. Full Etherpad formatting requires
   * changeset operations with proper attribute application.
   */
  static async formatText(
    padId: string,
    textToFormat: string,
    formatType: 'bold' | 'italic' | 'underline' | 'strikethrough',
    authorId: string
  ): Promise<{success: boolean; formatted: number}> {
    try {
      await ensureAIAuthor();
      const pad: PadType = await padManager.getPad(padId, null, AI_AUTHOR_ID);
      const currentText = pad.text();
      
      // For now, we'll use markdown-style formatting as a visual indicator
      // Full implementation would require changeset operations with attributes
      let formattedText = textToFormat;
      let marker = '';
      
      switch (formatType) {
        case 'bold':
          marker = '**';
          break;
        case 'italic':
          marker = '*';
          break;
        case 'underline':
          marker = '_';
          break;
        case 'strikethrough':
          marker = '~~';
          break;
      }
      
      if (!currentText.includes(marker + textToFormat + marker)) {
        formattedText = marker + textToFormat + marker;
      }
      
      let formatted = 0;
      let newText = currentText;
      let index = 0;
      
      while ((index = newText.indexOf(textToFormat, index)) !== -1) {
        // Only format if not already formatted
        if (index === 0 || newText[index - marker.length] !== marker[0]) {
          newText = newText.substring(0, index) + 
                    formattedText + 
                    newText.substring(index + textToFormat.length);
          index += formattedText.length;
          formatted++;
        } else {
          index += textToFormat.length;
        }
      }
      
      if (formatted > 0) {
        await pad.setText(newText, AI_AUTHOR_ID);
        await padMessageHandler.updatePadClients(pad);
        logger.info(`Formatted ${formatted} occurrences with ${formatType} in pad ${padId}`);
      }
      
      return {success: formatted > 0, formatted};
    } catch (error: any) {
      logger.error(`Error formatting text in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Create a list (ordered or unordered)
   */
  static async createList(
    padId: string,
    items: string[],
    listType: 'ordered' | 'unordered',
    indentLevel: number = 1,
    authorId: string
  ): Promise<void> {
    try {
      await ensureAIAuthor();
      const indent = '  '.repeat(Math.max(0, indentLevel - 1));
      let listText = '';
      
      if (listType === 'ordered') {
        items.forEach((item, index) => {
          listText += `${indent}${index + 1}. ${item}\n`;
        });
      } else {
        items.forEach(item => {
          listText += `${indent}• ${item}\n`;
        });
      }
      
      await this.appendText(padId, listText.trim(), authorId);
      logger.info(`Created ${listType} list with ${items.length} items in pad ${padId}`);
    } catch (error: any) {
      logger.error(`Error creating list in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Rewrite a section (replace specific line range with new text)
   */
  static async rewriteSection(
    padId: string,
    startLine: number,
    endLine: number,
    newText: string,
    authorId: string
  ): Promise<void> {
    try {
      await ensureAIAuthor();
      const pad: PadType = await padManager.getPad(padId, null, AI_AUTHOR_ID);
      const currentText = pad.text();
      const lines = currentText.split('\n');
      
      // Remove old lines and insert new text
      const beforeLines = lines.slice(0, startLine - 1);
      const afterLines = lines.slice(endLine);
      const newLines = newText.split('\n');
      
      const finalLines = [...beforeLines, ...newLines, ...afterLines];
      const finalText = finalLines.join('\n');
      
      await pad.setText(finalText, AI_AUTHOR_ID);
      await padMessageHandler.updatePadClients(pad);
      
      logger.info(`Rewrote lines ${startLine}-${endLine} in pad ${padId}`);
    } catch (error: any) {
      logger.error(`Error rewriting section in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Indent or outdent lines (useful for lists)
   */
  static async indentLines(
    padId: string,
    startLine: number,
    endLine: number,
    direction: 'indent' | 'outdent',
    authorId: string
  ): Promise<void> {
    try {
      await ensureAIAuthor();
      const pad: PadType = await padManager.getPad(padId, null, AI_AUTHOR_ID);
      const currentText = pad.text();
      const lines = currentText.split('\n');
      
      for (let i = startLine - 1; i < Math.min(endLine, lines.length); i++) {
        if (direction === 'indent') {
          lines[i] = '  ' + lines[i];
        } else {
          // Remove up to 2 spaces from the beginning
          lines[i] = lines[i].replace(/^ {1,2}/, '');
        }
      }
      
      const newText = lines.join('\n');
      await pad.setText(newText, AI_AUTHOR_ID);
      await padMessageHandler.updatePadClients(pad);
      
      logger.info(`${direction === 'indent' ? 'Indented' : 'Outdented'} lines ${startLine}-${endLine} in pad ${padId}`);
    } catch (error: any) {
      logger.error(`Error indenting lines in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Remove formatting from text
   */
  static async removeFormatting(
    padId: string,
    startLine: number,
    endLine: number,
    authorId: string
  ): Promise<void> {
    try {
      await ensureAIAuthor();
      const pad: PadType = await padManager.getPad(padId, null, AI_AUTHOR_ID);
      const currentText = pad.text();
      const lines = currentText.split('\n');
      
      // Remove markdown-style formatting markers
      for (let i = startLine - 1; i < Math.min(endLine, lines.length); i++) {
        lines[i] = lines[i]
          .replace(/\*\*(.+?)\*\*/g, '$1')  // Bold
          .replace(/\*(.+?)\*/g, '$1')      // Italic
          .replace(/_(.+?)_/g, '$1')        // Underline
          .replace(/~~(.+?)~~/g, '$1');     // Strikethrough
      }
      
      const newText = lines.join('\n');
      await pad.setText(newText, AI_AUTHOR_ID);
      await padMessageHandler.updatePadClients(pad);
      
      logger.info(`Removed formatting from lines ${startLine}-${endLine} in pad ${padId}`);
    } catch (error: any) {
      logger.error(`Error removing formatting in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Summarize a section (placeholder for AI-driven summarization)
   */
  static async summarizeSection(
    padId: string,
    startLine: number,
    endLine: number,
    authorId: string
  ): Promise<string> {
    try {
      const pad: PadType = await padManager.getPad(padId);
      const currentText = pad.text();
      const lines = currentText.split('\n');
      const sectionText = lines.slice(startLine - 1, endLine).join('\n');
      
      // This would integrate with the AI agent for actual summarization
      // For now, return a placeholder
      const summary = `Summary of lines ${startLine}-${endLine} (${sectionText.length} chars)`;
      
      logger.info(`Generated summary for lines ${startLine}-${endLine} in pad ${padId}`);
      return summary;
    } catch (error: any) {
      logger.error(`Error summarizing section in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Expand a section (placeholder for AI-driven expansion)
   */
  static async expandSection(
    padId: string,
    startLine: number,
    endLine: number,
    targetLength: number,
    authorId: string
  ): Promise<string> {
    try {
      const pad: PadType = await padManager.getPad(padId);
      const currentText = pad.text();
      const lines = currentText.split('\n');
      const sectionText = lines.slice(startLine - 1, endLine).join('\n');
      
      // This would integrate with the AI agent for actual expansion
      // For now, return a placeholder
      const expanded = `Expanded version of lines ${startLine}-${endLine} to ${targetLength} chars`;
      
      logger.info(`Expanded lines ${startLine}-${endLine} in pad ${padId}`);
      return expanded;
    } catch (error: any) {
      logger.error(`Error expanding section in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Fix grammar in text (placeholder for AI-driven grammar correction)
   */
  static async fixGrammar(
    padId: string,
    startLine?: number,
    endLine?: number,
    authorId?: string
  ): Promise<{success: boolean; corrections: number}> {
    try {
      const pad: PadType = await padManager.getPad(padId);
      const currentText = pad.text();
      const lines = currentText.split('\n');
      
      let textToFix = currentText;
      if (startLine !== undefined && endLine !== undefined) {
        textToFix = lines.slice(startLine - 1, endLine).join('\n');
      }
      
      // This would integrate with the AI agent for actual grammar correction
      // For now, return a placeholder result
      const corrections = 0;
      
      logger.info(`Fixed grammar in pad ${padId}`);
      return {success: corrections > 0, corrections};
    } catch (error: any) {
      logger.error(`Error fixing grammar in pad ${padId}:`, error);
      throw error;
    }
  }
}
