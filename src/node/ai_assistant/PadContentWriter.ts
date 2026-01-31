'use strict';
/**
 * PadContentWriter - Modify pad content via changesets
 */

import log4js from 'log4js';
import {PadType} from '../types/PadType';
import {Builder} from '../../static/js/Builder';

const padManager = require('../db/PadManager');
const logger = log4js.getLogger('PadContentWriter');

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
      const pad: PadType = await padManager.getPad(padId, null, authorId);
      const currentText = pad.text();
      const newText = currentText + (currentText.endsWith('\n') ? '' : '\n') + text;
      await pad.setText(newText, authorId);
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
      const pad: PadType = await padManager.getPad(padId, null, authorId);
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
        await pad.setText(newText, authorId);
        logger.info(`Replaced ${replacements} occurrences in pad ${padId}`);
      }

      return { success: replacements > 0, replacements };
    } catch (error: any) {
      logger.error(`Error replacing text in pad ${padId}:`, error);
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
      const pad: PadType = await padManager.getPad(padId, null, authorId);
      await pad.setText(text, authorId);
      logger.info(`Set entire pad text for ${padId} by author ${authorId}`);
    } catch (error: any) {
      logger.error(`Error setting pad text for ${padId}:`, error);
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
