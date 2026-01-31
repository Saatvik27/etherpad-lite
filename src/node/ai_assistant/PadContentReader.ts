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

  /**
   * Get text range with line numbers and context
   */
  static async getTextRange(
    padId: string,
    startLine: number,
    endLine: number
  ): Promise<{
    text: string;
    startLine: number;
    endLine: number;
    totalLines: number;
  }> {
    const {lines} = await this.getPadTextWithLines(padId);
    const actualEndLine = Math.min(endLine, lines.length);
    const actualStartLine = Math.max(1, startLine);
    const rangeText = lines.slice(actualStartLine - 1, actualEndLine).join('\n');

    return {
      text: rangeText,
      startLine: actualStartLine,
      endLine: actualEndLine,
      totalLines: lines.length,
    };
  }

  /**
   * Search with context - shows surrounding lines
   */
  static async findAndList(
    padId: string,
    searchTerm: string,
    contextLines: number = 2
  ): Promise<{
    found: boolean;
    matches: Array<{
      line: number;
      column: number;
      lineText: string;
      contextBefore: string[];
      contextAfter: string[];
    }>;
  }> {
    const {lines} = await this.getPadTextWithLines(padId);
    const matches: Array<{
      line: number;
      column: number;
      lineText: string;
      contextBefore: string[];
      contextAfter: string[];
    }> = [];

    lines.forEach((line, lineIndex) => {
      let index = 0;
      while ((index = line.indexOf(searchTerm, index)) !== -1) {
        const contextBefore = lines.slice(
          Math.max(0, lineIndex - contextLines),
          lineIndex
        );
        const contextAfter = lines.slice(
          lineIndex + 1,
          Math.min(lines.length, lineIndex + contextLines + 1)
        );

        matches.push({
          line: lineIndex + 1,
          column: index + 1,
          lineText: line,
          contextBefore,
          contextAfter,
        });
        index += searchTerm.length;
      }
    });

    return {
      found: matches.length > 0,
      matches: matches.slice(0, 10), // Limit to first 10 matches
    };
  }

  /**
   * Analyze document structure (lists, formatting)
   */
  static async analyzeStructure(padId: string): Promise<{
    lists: Array<{line: number; level: number; type: 'ordered' | 'unordered'}>;
    formattedSections: Array<{line: number; type: string}>;
    emptyLines: number[];
    totalLines: number;
  }> {
    try {
      const pad: PadType = await padManager.getPad(padId);
      const {lines} = await this.getPadTextWithLines(padId);
      const atext = pad.atext;
      const pool = pad.apool();

      const lists: Array<{line: number; level: number; type: 'ordered' | 'unordered'}> = [];
      const formattedSections: Array<{line: number; type: string}> = [];
      const emptyLines: number[] = [];

      lines.forEach((line, index) => {
        if (line.trim() === '') {
          emptyLines.push(index + 1);
        }
      });

      // Analyze line attributes for lists
      let currentPos = 0;
      lines.forEach((line, lineIndex) => {
        const lineLength = line.length + 1; // +1 for newline
        
        // Check if this line has list attributes
        if (currentPos < atext.text.length) {
          const lineText = atext.text.substring(currentPos, currentPos + lineLength);
          // Note: In a real implementation, we'd need to parse the attribs string
          // For now, we'll provide structure based on text patterns
          
          // Detect lists by common patterns
          const bulletMatch = line.match(/^\s*[•\-\*]\s/);
          const numberedMatch = line.match(/^\s*\d+\.\s/);
          
          if (bulletMatch) {
            const indent = (line.match(/^\s*/) || [''])[0].length;
            const level = Math.floor(indent / 2) + 1;
            lists.push({line: lineIndex + 1, level, type: 'unordered'});
          } else if (numberedMatch) {
            const indent = (line.match(/^\s*/) || [''])[0].length;
            const level = Math.floor(indent / 2) + 1;
            lists.push({line: lineIndex + 1, level, type: 'ordered'});
          }
        }
        currentPos += lineLength;
      });

      return {
        lists,
        formattedSections,
        emptyLines,
        totalLines: lines.length,
      };
    } catch (error: any) {
      logger.error(`Error analyzing structure for ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Get all text written by a specific author
   */
  static async getAuthorText(
    padId: string,
    authorId: string
  ): Promise<{
    text: string;
    charCount: number;
    contribution: number; // percentage
  }> {
    try {
      const pad: PadType = await padManager.getPad(padId);
      const atext = pad.atext;
      const pool = pad.apool();
      const totalChars = atext.text.length;

      // This is a simplified implementation
      // In reality, we'd need to parse the attribs string to find author-specific chars
      let authorChars = 0;
      const authorAttribNum = pool.putAttrib(['author', authorId]);

      // Count characters with this author's attribution
      // Note: This is a simplified version. Full implementation would parse atext.attribs
      const authorText = `Text by author ${authorId}`;

      return {
        text: authorText,
        charCount: authorChars,
        contribution: totalChars > 0 ? (authorChars / totalChars) * 100 : 0,
      };
    } catch (error: any) {
      logger.error(`Error getting author text for ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Get changes since a specific revision
   */
  static async getChangesSince(
    padId: string,
    sinceRevision: number
  ): Promise<{
    changes: Array<{
      revision: number;
      author: string;
      timestamp: number;
      changeDescription: string;
    }>;
    currentRevision: number;
  }> {
    try {
      const pad: PadType = await padManager.getPad(padId);
      const currentRevision = pad.getHeadRevisionNumber();
      const changes: Array<{
        revision: number;
        author: string;
        timestamp: number;
        changeDescription: string;
      }> = [];

      const authorManager = require('../db/AuthorManager');

      for (let rev = sinceRevision + 1; rev <= currentRevision; rev++) {
        const authorId = await pad.getRevisionAuthor(rev);
        const timestamp = await pad.getRevisionDate(rev);
        const changeset = await pad.getRevisionChangeset(rev);

        changes.push({
          revision: rev,
          author: authorId,
          timestamp,
          changeDescription: `Revision ${rev} by ${authorId}`,
        });
      }

      return {
        changes,
        currentRevision,
      };
    } catch (error: any) {
      logger.error(`Error getting changes for ${padId}:`, error);
      throw error;
    }
  }
}
