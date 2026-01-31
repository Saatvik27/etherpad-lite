'use strict';
/**
 * PadContentReader - Read and analyze pad content
 */

import log4js from 'log4js';
import {PadType} from '../types/PadType';

const padManager = require('../db/PadManager');
const logger = log4js.getLogger('PadContentReader');

export class PadContentReader {
  /**
   * Get current pad text (plain text without formatting)
   */
  static async getPadText(padId: string): Promise<string> {
    try {
      const pad: PadType = await padManager.getPad(padId);
      return pad.text();
    } catch (error: any) {
      logger.error(`Error reading pad text for ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Get current pad text with line numbers
   */
  static async getPadTextWithLines(padId: string): Promise<{text: string; lines: string[]}> {
    const text = await this.getPadText(padId);
    const lines = text.split('\n');
    return { text, lines };
  }

  /**
   * Get pad metadata (length, line count, word count, etc.)
   */
  static async getPadMetadata(padId: string): Promise<{
    lineCount: number;
    wordCount: number;
    charCount: number;
    authorCount: number;
    revisionCount: number;
  }> {
    try {
      const pad: PadType = await padManager.getPad(padId);
      const text = pad.text();
      const lines = text.split('\n');
      const words = text.split(/\s+/).filter(w => w.length > 0);
      const authors = pad.getAllAuthors();

      return {
        lineCount: lines.length,
        wordCount: words.length,
        charCount: text.length,
        authorCount: authors.length,
        revisionCount: pad.getHeadRevisionNumber(),
      };
    } catch (error: any) {
      logger.error(`Error getting pad metadata for ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Search for text in pad
   */
  static async searchInPad(padId: string, searchTerm: string): Promise<{
    found: boolean;
    matches: number;
    positions: Array<{line: number; column: number}>;
  }> {
    const {text, lines} = await this.getPadTextWithLines(padId);
    const matches: Array<{line: number; column: number}> = [];
    
    lines.forEach((line, lineIndex) => {
      let index = 0;
      while ((index = line.indexOf(searchTerm, index)) !== -1) {
        matches.push({ line: lineIndex + 1, column: index + 1 });
        index += searchTerm.length;
      }
    });

    return {
      found: matches.length > 0,
      matches: matches.length,
      positions: matches,
    };
  }

  /**
   * Get a specific range of lines from the pad
   */
  static async getPadLines(
    padId: string, 
    startLine: number, 
    endLine?: number
  ): Promise<string> {
    const {lines} = await this.getPadTextWithLines(padId);
    const end = endLine || lines.length;
    return lines.slice(startLine - 1, end).join('\n');
  }
}
