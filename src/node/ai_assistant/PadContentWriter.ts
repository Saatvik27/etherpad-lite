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

/* ---------------------------------------------------------------------------
 * LLMHelper — lazily initialised singleton for direct LLM calls from tools.
 * Uses the same Groq config as ReActAgent so there is no config duplication.
 * --------------------------------------------------------------------------- */
class LLMHelper {
  private static instance: LLMHelper | null = null;
  private llm: any = null;

  private constructor() {}

  static getInstance(): LLMHelper {
    if (!LLMHelper.instance) {
      LLMHelper.instance = new LLMHelper();
    }
    return LLMHelper.instance;
  }

  private async getLLM(): Promise<any> {
    if (this.llm) return this.llm;
    try {
      const {ChatGroq} = await import('@langchain/groq');
      const settings = (await import('../utils/Settings')).default;
      const cfg = settings.aiAssistant;
      if (!cfg?.apiKey) throw new Error('AI Assistant not configured');
      this.llm = new ChatGroq({
        apiKey: cfg.apiKey,
        model: cfg.model || 'llama-3.3-70b-versatile',
        temperature: 0.3, // lower temp for editing / correction tasks
        maxTokens: cfg.maxTokens || 2000,
      });
    } catch (err) {
      logger.error('LLMHelper: failed to initialise LLM', err);
      throw err;
    }
    return this.llm;
  }

  /**
   * Summarize text into concise bullet points suitable for a procurement document.
   */
  async summarize(text: string): Promise<string> {
    const llm = await this.getLLM();
    const {HumanMessage, SystemMessage} = await import('@langchain/core/messages');
    const response = await llm.invoke([
      new SystemMessage(
        'You are a procurement document analyst. Summarize the provided text into 3–5 concise bullet points. ' +
        'Each bullet should be a complete, standalone sentence. Keep the tone professional and supplier-ready. ' +
        'Return ONLY the bullet points, no preamble or trailing commentary.'
      ),
      new HumanMessage(`Summarize the following procurement document text:\n\n${text}`),
    ]);
    return (response.content as string).trim();
  }

  /**
   * Expand text to approximately targetLength characters, maintaining procurement tone.
   */
  async expand(text: string, targetLength: number): Promise<string> {
    const llm = await this.getLLM();
    const {HumanMessage, SystemMessage} = await import('@langchain/core/messages');
    const response = await llm.invoke([
      new SystemMessage(
        'You are a procurement document writer. Expand the provided text to approximately the requested character count. ' +
        'Maintain a professional, supplier-ready tone. Add relevant detail, context, and clarity. ' +
        'Return ONLY the expanded text, preserving line breaks. No preamble or commentary.'
      ),
      new HumanMessage(
        `Expand the following text to approximately ${targetLength} characters:\n\n${text}`
      ),
    ]);
    return (response.content as string).trim();
  }

  /**
   * Fix grammar and spelling — returns the corrected text only, no explanation.
   */
  async fixGrammar(text: string): Promise<string> {
    const llm = await this.getLLM();
    const {HumanMessage, SystemMessage} = await import('@langchain/core/messages');
    const response = await llm.invoke([
      new SystemMessage(
        'You are a professional editor. Fix all spelling and grammar errors in the provided text. ' +
        'Preserve ALL line breaks exactly. Do not change the content, structure, or formatting beyond grammar/spelling. ' +
        'Return ONLY the corrected text with no explanations or preamble.'
      ),
      new HumanMessage(`Fix grammar and spelling in this text:\n\n${text}`),
    ]);
    return (response.content as string).trim();
  }
}

/* ---------------------------------------------------------------------------
 * PadContentWriter — all Etherpad write operations
 * --------------------------------------------------------------------------- */
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
      const insertPosition = currentText.length;

      // Ensure text ends with newline (spliceText requires this)
      let textToAppend = text;
      if (!textToAppend.endsWith('\n')) {
        textToAppend += '\n';
      }
      // Add newline before if current text doesn't end with one
      if (currentText && !currentText.endsWith('\n')) {
        textToAppend = '\n' + textToAppend;
      }

      // Use spliceText to properly insert at the end
      await pad.spliceText(insertPosition, 0, textToAppend, AI_AUTHOR_ID);

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
      let currentText = pad.text();

      let replacements = 0;
      let offset = 0; // Track offset due to length changes
      let index = 0;

      // Find all occurrences first
      const occurrences: number[] = [];
      while ((index = currentText.indexOf(searchText, index)) !== -1) {
        occurrences.push(index);
        index += searchText.length;
      }

      // Replace each occurrence using spliceText
      for (const position of occurrences) {
        const adjustedPos = position + offset;
        await pad.spliceText(adjustedPos, searchText.length, replacementText, AI_AUTHOR_ID);
        currentText = pad.text(); // Update current text
        offset += replacementText.length - searchText.length;
        replacements++;
      }

      if (replacements > 0) {
        // Broadcast changes to all connected clients
        await padMessageHandler.updatePadClients(pad);
        logger.info(`Replaced ${replacements} occurrences in pad ${padId}`);
      }

      return {success: replacements > 0, replacements};
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

      let insertPosition = 0;

      // Calculate character position for the line number
      if (lineNumber >= lines.length) {
        // Insert at end if line number exceeds current lines
        insertPosition = currentText.length;
        // Add newline before if current text doesn't end with one
        if (currentText && !currentText.endsWith('\n')) {
          text = '\n' + text;
        }
      } else if (lineNumber <= 0) {
        // Insert at beginning
        insertPosition = 0;
        // Add newline after if not already there
        if (!text.endsWith('\n')) {
          text = text + '\n';
        }
      } else {
        // Insert after the specified line
        for (let i = 0; i < lineNumber && i < lines.length; i++) {
          insertPosition += lines[i].length + 1; // +1 for newline
        }
      }

      // Ensure text ends with newline (spliceText requires this)
      if (!text.endsWith('\n')) {
        text += '\n';
      }

      // Use spliceText to properly insert at the position
      await pad.spliceText(insertPosition, 0, text, AI_AUTHOR_ID);

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
      let currentText = pad.text();

      let deletions = 0;
      let index = 0;

      // Find all occurrences first
      const occurrences: number[] = [];
      while ((index = currentText.indexOf(textToDelete, index)) !== -1) {
        occurrences.push(index);
        index += textToDelete.length;
      }

      // Delete each occurrence using spliceText (in reverse to maintain positions)
      for (let i = occurrences.length - 1; i >= 0; i--) {
        await pad.spliceText(occurrences[i], textToDelete.length, '', AI_AUTHOR_ID);
        currentText = pad.text(); // Update current text
        deletions++;
      }

      if (deletions > 0) {
        // Broadcast changes to all connected clients
        await padMessageHandler.updatePadClients(pad);
        logger.info(`Deleted ${deletions} occurrences in pad ${padId}`);
      }

      return {success: deletions > 0, deletions};
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
   * Format text with bold, italic, underline, or strikethrough using proper
   * Etherpad attribute changesets. Finds all occurrences of `textToFormat` in
   * the pad and applies the chosen attribute via `keepText + appendRevision`.
   * This produces real rich-text formatting in the editor (not markdown markers).
   *
   * How it works:
   *  1. Walk the full pad text with a Builder.
   *  2. For chunks BEFORE an occurrence → keepText (no attrib change).
   *  3. For each matched occurrence    → keepText with [[formatType, 'true']].
   *  4. After all occurrences          → keepText the remainder.
   *  5. Serialise via builder.toString() and appendRevision to the pad.
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
      const pool = pad.apool();

      if (!currentText.includes(textToFormat)) {
        logger.info(`Text "${textToFormat}" not found in pad ${padId}`);
        return {success: false, formatted: 0};
      }

      const builder = new Builder(currentText.length);
      const searchLen = textToFormat.length;
      let pos = 0;
      let formatted = 0;

      while (pos < currentText.length) {
        const idx = currentText.indexOf(textToFormat, pos);
        if (idx === -1) {
          // Keep all remaining text unchanged
          const remaining = currentText.slice(pos);
          if (remaining.length > 0) builder.keepText(remaining);
          break;
        }

        // Keep gap before this occurrence (no format change)
        if (idx > pos) {
          builder.keepText(currentText.slice(pos, idx));
        }

        // Keep the matched text with the formatting attribute set to 'true'
        builder.keepText(textToFormat, [[formatType, 'true']], pool);
        formatted++;
        pos = idx + searchLen;
      }

      if (formatted > 0) {
        const changeset = builder.toString();
        await pad.appendRevision(changeset, AI_AUTHOR_ID);
        await padMessageHandler.updatePadClients(pad);
        logger.info(`Applied ${formatType} to ${formatted} occurrence(s) in pad ${padId}`);
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
        items.forEach((item) => {
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

      logger.info(
        `${direction === 'indent' ? 'Indented' : 'Outdented'} lines ${startLine}-${endLine} in pad ${padId}`
      );
    } catch (error: any) {
      logger.error(`Error indenting lines in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Remove formatting from a line range.
   * Builds a changeset that re-keeps the target lines with each of
   * bold/italic/underline/strikethrough set to '' (Etherpad treats '' as removal).
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
      const pool = pad.apool();
      const lines = currentText.split('\n');

      // Compute character offsets for the target line range
      let startChar = 0;
      for (let i = 0; i < startLine - 1 && i < lines.length; i++) {
        startChar += lines[i].length + 1; // +1 for \n
      }
      let endChar = startChar;
      for (let i = startLine - 1; i < Math.min(endLine, lines.length); i++) {
        endChar += lines[i].length + 1;
      }

      const clearAttribs: [string, string][] = [
        ['bold', ''],
        ['italic', ''],
        ['underline', ''],
        ['strikethrough', ''],
      ];

      const builder = new Builder(currentText.length);

      // Keep text before range unchanged
      if (startChar > 0) builder.keepText(currentText.slice(0, startChar));

      // Keep text in range with formatting cleared
      const rangeText = currentText.slice(startChar, endChar);
      if (rangeText.length > 0) {
        builder.keepText(rangeText, clearAttribs, pool);
      }

      // Keep text after range unchanged
      if (endChar < currentText.length) builder.keepText(currentText.slice(endChar));

      const changeset = builder.toString();
      await pad.appendRevision(changeset, AI_AUTHOR_ID);
      await padMessageHandler.updatePadClients(pad);

      logger.info(`Removed formatting from lines ${startLine}-${endLine} in pad ${padId}`);
    } catch (error: any) {
      logger.error(`Error removing formatting in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Summarize a section using a real LLM call (replaces stub).
   * Returns the summary string; the agent can display it in chat or insert it.
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

      if (!sectionText.trim()) {
        return 'The selected section is empty.';
      }

      const summary = await LLMHelper.getInstance().summarize(sectionText);
      logger.info(`Generated AI summary for lines ${startLine}-${endLine} in pad ${padId}`);
      return summary;
    } catch (error: any) {
      logger.error(`Error summarizing section in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Expand a section using a real LLM call (replaces stub).
   * Returns the expanded text string; the agent then uses rewrite_section to apply it.
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

      if (!sectionText.trim()) {
        return 'The selected section is empty — nothing to expand.';
      }

      const expanded = await LLMHelper.getInstance().expand(sectionText, targetLength);
      logger.info(
        `Expanded lines ${startLine}-${endLine} in pad ${padId} to ~${targetLength} chars`
      );
      return expanded;
    } catch (error: any) {
      logger.error(`Error expanding section in pad ${padId}:`, error);
      throw error;
    }
  }

  /**
   * Fix grammar and spelling using a real LLM call (replaces stub).
   *
   * Flow:
   *  1. Read target lines (or the entire pad if no range given).
   *  2. Send to LLM — returns corrected text only.
   *  3. Apply corrected text via rewriteSection or setPadText.
   *  4. Return {success, corrections} where corrections is estimated from word diff.
   *
   * The confirmation dialog is applied upstream by ReActAgent / the tool's
   * requiresConfirmation flag — this method is only called after the user agrees.
   */
  static async fixGrammar(
    padId: string,
    startLine?: number,
    endLine?: number,
    authorId?: string
  ): Promise<{success: boolean; corrections: number}> {
    try {
      await ensureAIAuthor();
      const pad: PadType = await padManager.getPad(padId, null, AI_AUTHOR_ID);
      const currentText = pad.text();
      const lines = currentText.split('\n');

      let textToFix: string;
      let isFullPad = startLine === undefined || endLine === undefined;

      if (!isFullPad) {
        textToFix = lines.slice(startLine! - 1, endLine).join('\n');
      } else {
        textToFix = currentText;
      }

      if (!textToFix.trim()) {
        return {success: false, corrections: 0};
      }

      // Call the LLM for grammar correction
      const corrected = await LLMHelper.getInstance().fixGrammar(textToFix);

      // Estimate correction count from word-level diff
      let corrections = 0;
      const origWords = textToFix.split(/\s+/);
      const corrWords = corrected.split(/\s+/);
      for (let i = 0; i < Math.min(origWords.length, corrWords.length); i++) {
        if (origWords[i] !== corrWords[i]) corrections++;
      }
      corrections += Math.abs(origWords.length - corrWords.length);

      if (corrections === 0 && corrected === textToFix) {
        logger.info(`No grammar corrections needed in pad ${padId}`);
        return {success: false, corrections: 0};
      }

      // Apply the corrected text to the pad
      if (isFullPad) {
        await pad.setText(corrected, AI_AUTHOR_ID);
        await padMessageHandler.updatePadClients(pad);
      } else {
        await this.rewriteSection(
          padId,
          startLine!,
          endLine!,
          corrected,
          authorId || AI_AUTHOR_ID
        );
      }

      logger.info(`Fixed grammar in pad ${padId} (~${corrections} corrections)`);
      return {success: true, corrections};
    } catch (error: any) {
      logger.error(`Error fixing grammar in pad ${padId}:`, error);
      throw error;
    }
  }
}
