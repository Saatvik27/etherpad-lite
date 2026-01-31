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
      await authorManager.createAuthor(AI_AUTHOR_NAME, AI_AUTHOR_ID);
      logger.info(`Created AI Assistant author: ${AI_AUTHOR_ID}`);
    }
  } catch (error) {
    logger.error('Error ensuring AI author exists:', error);
  }
}

export class PadContentWriter {
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
}
