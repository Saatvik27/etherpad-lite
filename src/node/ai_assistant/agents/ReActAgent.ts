'use strict';
/**
 * ReActAgent - Reasoning + Acting agent using LangChain and Groq
 */

import log4js from 'log4js';
import {ChatGroq} from '@langchain/groq';
import {BaseAgent, AgentResponse} from './BaseAgent';
import {ToolRegistry} from './ToolRegistry';
import {PadContentReader} from '../PadContentReader';
import {PadContentWriter} from '../PadContentWriter';
import settings from '../../utils/Settings';
import {RunnableSequence} from '@langchain/core/runnables';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {StructuredTool} from '@langchain/core/tools';
import {AIMessage} from '@langchain/core/messages';

const logger = log4js.getLogger('ReActAgent');

export class ReActAgent extends BaseAgent {
  private llm: ChatGroq;

  constructor() {
    super();
    
    const config = settings.aiAssistant;
    this.llm = new ChatGroq({
      apiKey: config.apiKey,
      model: config.model || 'llama-3.3-70b-versatile',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000,
    });
  }

  /**
   * Process user query using tool calling
   */
  async process(
    userQuery: string,
    padId: string,
    userId: string,
    conversationHistory?: string
  ): Promise<AgentResponse> {
    try {
      // Create tools for this session
      const tools = ToolRegistry.createTools(padId, userId);

      // Bind tools to the model
      const modelWithTools = this.llm.bindTools(tools);

      // Create the system prompt
      const systemPrompt = `You are a helpful AI writing assistant integrated into Etherpad, a collaborative text editor.

Your role is to help users create and edit documents efficiently.

Key behaviors:
1. When asked to write content (essays, articles, etc.), ALWAYS read the pad first to understand context
2. INSERT content at appropriate positions - don't just append everything to the end
3. Be proactive - write immediately without asking unnecessary questions
4. Write complete, well-structured content with proper paragraphs and formatting
5. Keep responses conversational and friendly

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n` : ''}

Available tools (22 total):

READ-ONLY TOOLS (8):
- read_pad_content: Read entire pad (use this FIRST before writing)
- get_text_range: Read specific line range (efficient for large pads)
- search_in_pad: Find text and get positions
- find_and_list: Search with surrounding context lines
- analyze_structure: Identify lists, formatting, document layout
- get_pad_metadata: Get stats (line count, word count, etc.)
- get_author_text: Get text by specific author
- get_changes_since: See recent changes from a revision

WRITING/EDITING TOOLS (14 - all require user confirmation):
- insert_text_at_position: Insert at specific line (USE THIS for smart insertion)
- append_text_to_pad: Add to END only (use sparingly)
- replace_text_in_pad: Find and replace text
- delete_text: Remove specific text
- clear_pad: Empty entire pad (AVOID - use insert_text_at_position at line 0 instead)
- format_text: Apply bold/italic/underline/strikethrough
- create_list: Make bullet or numbered lists
- rewrite_section: Replace line range with improved text (BEST for replacing entire content)
- indent_lines: Adjust indentation (indent/outdent)
- remove_formatting: Strip formatting from lines
- summarize_section: Generate summary of line range
- expand_section: Add detail to line range
- fix_grammar: Correct grammar/spelling errors

IMPORTANT - Replacing entire pad content:
When user asks to "replace entire content" or "write new essay replacing everything":
1. Read pad to get current line count
2. Use rewrite_section with startLine: 0, endLine: <lastLine>, newText: <your new content>
3. DO NOT use clear_pad followed by insert - this requires TWO confirmations
4. ONE action is better than TWO actions

Smart insertion strategy:
1. Read pad content first to understand structure
2. Determine appropriate line number for new content
3. Use insert_text_at_position with the calculated line number
4. This ensures content goes in the right place, not just at the end

Example workflow:
User: "write an essay on cats"
1. Use read_pad_content to see existing content
2. If pad has intro ending at line 5, calculate insertion point (line 6)
3. Use insert_text_at_position with lineNumber: 6 and your essay text
4. User confirms → essay inserted at proper position

Formatting:
- Use format_text for bold/italic/underline/strikethrough on existing text
- Use create_list for structured bullet or numbered lists
- Use rewrite_section to improve existing content with better writing

When you use any write tool, I will show the user exactly what will change before applying it.

Be direct and action-oriented - users want results, not endless clarification questions.`;

      // Create conversation with agent loop for multi-tool execution
      const messages: any[] = [
        {role: 'system', content: systemPrompt},
        {role: 'user', content: userQuery},
      ];
      
      let maxIterations = 5; // Prevent infinite loops
      let iteration = 0;
      let pendingWriteAction: any = null;
      
      // Agent loop: keep calling model until it stops using tools or hits a write operation
      while (iteration < maxIterations) {
        iteration++;
        
        const response = await modelWithTools.invoke(messages);
        const aiMessage = response as AIMessage;
        
        // Add AI response to conversation
        messages.push(aiMessage);
        
        // Check if the model wants to use tools
        if (!aiMessage.tool_calls || aiMessage.tool_calls.length === 0) {
          // No more tool calls, AI has finished or provided a text response
          if (!pendingWriteAction && aiMessage.content) {
            // Return the text response
            return {
              response: aiMessage.content as string,
              requiresConfirmation: false,
            };
          }
          break;
        }
        
        // Execute all tool calls in this iteration
        for (const toolCall of aiMessage.tool_calls) {
          const tool = tools.find((t: StructuredTool) => t.name === toolCall.name);
        
          if (!tool) {
            logger.warn(`Tool not found: ${toolCall.name}`);
            messages.push({
              role: 'tool',
              content: `Error: Tool ${toolCall.name} not found`,
              tool_call_id: toolCall.id,
            });
            continue;
          }
        
          // Validate tool args
          let args = toolCall.args;
          if (args === null || args === undefined) {
            args = {};
          }
          if (typeof args !== 'object') {
            logger.error('Invalid tool args type:', typeof args, args);
            messages.push({
              role: 'tool',
              content: 'Error: Invalid tool arguments',
              tool_call_id: toolCall.id,
            });
            continue;
          }
          
          // Execute the tool
          const toolResult = await tool.invoke(args);
        
          // Check if it's a write operation that needs confirmation
          const isWriteOperation = [
            'append_text_to_pad',
            'replace_text_in_pad',
            'insert_text_at_position',
            'delete_text',
            'clear_pad',
            'format_text',
            'create_list',
            'rewrite_section',
            'indent_lines',
            'remove_formatting',
            'fix_grammar'
          ].includes(toolCall.name);
          
          if (isWriteOperation) {
            // Stop agent loop and return confirmation request
            // Build action object based on tool type
            const action: any = {
              description: '',
            };
            
            if (toolCall.name === 'append_text_to_pad') {
              action.type = 'append';
              action.newText = args.text || '';
              action.description = 'Append text to the end of the pad';
            } else if (toolCall.name === 'insert_text_at_position') {
              action.type = 'insert';
              action.lineNumber = args.lineNumber || 0;
              action.newText = args.text || '';
              action.description = `Insert text at line ${args.lineNumber}`;
            } else if (toolCall.name === 'replace_text_in_pad') {
              action.type = 'replace';
              action.oldText = args.searchText || '';
              action.newText = args.replacementText || '';
              action.description = 'Replace text in the pad';
            } else if (toolCall.name === 'delete_text') {
              action.type = 'delete';
              action.textToDelete = args.textToDelete || '';
              action.description = 'Delete text from the pad';
            } else if (toolCall.name === 'clear_pad') {
              action.type = 'clear';
              action.description = 'Clear all content from the pad';
            } else if (toolCall.name === 'format_text') {
              action.type = 'format';
              action.textToFormat = args.textToFormat || '';
              action.formatType = args.formatType || 'bold';
              action.description = `Apply ${args.formatType} formatting to text`;
            } else if (toolCall.name === 'create_list') {
              action.type = 'create_list';
              action.items = args.items || [];
              action.listType = args.listType || 'unordered';
              action.indentLevel = args.indentLevel || 1;
              action.description = `Create ${args.listType} list with ${args.items?.length || 0} items`;
            } else if (toolCall.name === 'rewrite_section') {
              action.type = 'rewrite_section';
              action.startLine = args.startLine || 1;
              action.endLine = args.endLine || 1;
              action.newText = args.newText || '';
              action.description = `Rewrite lines ${args.startLine}-${args.endLine}`;
            } else if (toolCall.name === 'indent_lines') {
              action.type = 'indent_lines';
              action.startLine = args.startLine || 1;
              action.endLine = args.endLine || 1;
              action.direction = args.direction || 'indent';
              action.description = `${args.direction === 'indent' ? 'Indent' : 'Outdent'} lines ${args.startLine}-${args.endLine}`;
            } else if (toolCall.name === 'remove_formatting') {
              action.type = 'remove_formatting';
              action.startLine = args.startLine || 1;
              action.endLine = args.endLine || 1;
              action.description = `Remove formatting from lines ${args.startLine}-${args.endLine}`;
            } else if (toolCall.name === 'fix_grammar') {
              action.type = 'fix_grammar';
              action.startLine = args.startLine;
              action.endLine = args.endLine;
              action.description = args.startLine ? `Fix grammar in lines ${args.startLine}-${args.endLine}` : 'Fix grammar in entire pad';
            }
            
            // Store pending write action and stop agent loop
            pendingWriteAction = action;
            break; // Exit tool execution loop
          } else {
            // Read operation - add result to conversation and continue
            messages.push({
              role: 'tool',
              content: JSON.stringify(toolResult),
              tool_call_id: toolCall.id,
            });
          }
        }
        
        // If we hit a write operation, break the agent loop
        if (pendingWriteAction) {
          break;
        }
      }
      
      // Return the pending write action for confirmation
      if (pendingWriteAction) {
        return {
          response: '', // Don't send a chat message - modal will handle confirmation
          requiresConfirmation: true,
          action: pendingWriteAction,
        };
      }

      // No pending action and agent loop completed
      // Get final response from the last AI message
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.content) {
        return {
          response: lastMessage.content as string,
          requiresConfirmation: false,
        };
      }

      // Fallback
      return {
        response: aiMessage.content as string,
        requiresConfirmation: false,
      };
    } catch (error) {
      logger.error('Error in ReAct agent:', error);
      throw error;
    }
  }

  /**
   * Execute a confirmed action
   */
  async executeAction(
    action: any,
    padId: string,
    authorId: string
  ): Promise<{success: boolean; message: string}> {
    try {
      switch (action.type) {
        case 'append':
          await PadContentWriter.appendText(padId, action.newText, authorId);
          return {
            success: true,
            message: `Successfully appended text to the pad.`,
          };

        case 'insert':
          await PadContentWriter.insertTextAtLine(padId, action.lineNumber, action.newText, authorId);
          return {
            success: true,
            message: `Successfully inserted text at line ${action.lineNumber}.`,
          };

        case 'replace':
          const replaceResult = await PadContentWriter.replaceText(
            padId,
            action.oldText,
            action.newText,
            authorId
          );
          return {
            success: replaceResult.success,
            message: `Replaced ${replaceResult.replacements} occurrence(s) in the pad.`,
          };

        case 'delete':
          const deleteResult = await PadContentWriter.deleteText(
            padId,
            action.textToDelete,
            authorId
          );
          return {
            success: deleteResult.success,
            message: `Deleted ${deleteResult.deletions} occurrence(s) from the pad.`,
          };

        case 'clear':
          await PadContentWriter.setPadText(padId, '', authorId);
          return {
            success: true,
            message: 'Successfully cleared all content from the pad.',
          };

        case 'format':
          const formatResult = await PadContentWriter.formatText(
            padId,
            action.textToFormat,
            action.formatType,
            authorId
          );
          return {
            success: formatResult.success,
            message: `Applied ${action.formatType} formatting to ${formatResult.formatted} occurrence(s).`,
          };

        case 'create_list':
          await PadContentWriter.createList(
            padId,
            action.items,
            action.listType,
            action.indentLevel,
            authorId
          );
          return {
            success: true,
            message: `Created ${action.listType} list with ${action.items.length} items.`,
          };

        case 'rewrite_section':
          await PadContentWriter.rewriteSection(
            padId,
            action.startLine,
            action.endLine,
            action.newText,
            authorId
          );
          return {
            success: true,
            message: `Rewrote lines ${action.startLine}-${action.endLine}.`,
          };

        case 'indent_lines':
          await PadContentWriter.indentLines(
            padId,
            action.startLine,
            action.endLine,
            action.direction,
            authorId
          );
          return {
            success: true,
            message: `${action.direction === 'indent' ? 'Indented' : 'Outdented'} lines ${action.startLine}-${action.endLine}.`,
          };

        case 'remove_formatting':
          await PadContentWriter.removeFormatting(
            padId,
            action.startLine,
            action.endLine,
            authorId
          );
          return {
            success: true,
            message: `Removed formatting from lines ${action.startLine}-${action.endLine}.`,
          };

        case 'fix_grammar':
          const grammarResult = await PadContentWriter.fixGrammar(
            padId,
            action.startLine,
            action.endLine,
            authorId
          );
          return {
            success: grammarResult.success,
            message: action.startLine 
              ? `Fixed grammar in lines ${action.startLine}-${action.endLine} (${grammarResult.corrections} corrections).`
              : `Fixed grammar in entire pad (${grammarResult.corrections} corrections).`,
          };

        default:
          return {
            success: false,
            message: 'Unknown action type',
          };
      }
    } catch (error: any) {
      logger.error('Error executing action:', error);
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }
}
