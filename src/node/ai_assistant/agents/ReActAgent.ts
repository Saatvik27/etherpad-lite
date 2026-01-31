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

Available tools:
- read_pad_content: Read the entire pad content (ALWAYS use this first before making changes)
- get_pad_metadata: Get line count, word count, etc.
- search_in_pad: Search for specific text and find its position

Writing/Editing tools (all require user confirmation):
- insert_text_at_position: Insert text at a specific line number (USE THIS for smart insertion)
- append_text_to_pad: Add text to the END of the pad only (use sparingly)
- replace_text_in_pad: Find and replace specific text
- delete_text: Remove specific text from the pad
- clear_pad: Clear ALL content (use ONLY when user explicitly asks to clear everything)

Smart insertion strategy:
1. Read pad content first to understand structure
2. Determine appropriate line number for new content
3. Use insert_text_at_position with the calculated line number
4. This ensures content goes in the right place, not just at the end

Example: If user says "write an essay on cats" and pad has existing intro text ending at line 5, insert the essay at line 6.

When you use any write tool, I will show the user exactly what will change before applying it.

Be direct and action-oriented - users want results, not endless clarification questions.`;

      // Invoke the model with the query
      const response = await modelWithTools.invoke([
        {role: 'system', content: systemPrompt},
        {role: 'user', content: userQuery},
      ]);

      // Check if the model wants to use tools
      const aiMessage = response as AIMessage;
      if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
        // Execute the first tool call
        const toolCall = aiMessage.tool_calls[0];
        const tool = tools.find((t: StructuredTool) => t.name === toolCall.name);
        
        if (tool) {
          // Validate tool args (allow null for parameter-less tools with empty schema)
          let args = toolCall.args;
          if (args === null || args === undefined) {
            args = {}; // Convert null/undefined to empty object for parameter-less tools
          }
          if (typeof args !== 'object') {
            logger.error('Invalid tool args type:', typeof args, args);
            return {
              response: `I encountered an error: Invalid tool arguments. Please try rephrasing your request.`,
              requiresConfirmation: false,
              error: true,
            };
          }
          
          // Execute the tool
          const toolResult = await tool.invoke(args);
        
          // Check if it's a write operation that needs confirmation
          if (toolCall.name === 'append_text_to_pad' || 
              toolCall.name === 'replace_text_in_pad' ||
              toolCall.name === 'insert_text_at_position' ||
              toolCall.name === 'delete_text' ||
              toolCall.name === 'clear_pad') {
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
            }
            
            return {
              response: aiMessage.content as string || `I want to ${toolCall.name.replace(/_/g, ' ')}`,
              requiresConfirmation: true,
              action,
            };
          }
          
          // For read operations, get a response with the tool result
          const finalResponse = await this.llm.invoke([
            {role: 'system', content: systemPrompt},
            {role: 'user', content: userQuery},
            {role: 'assistant', content: `I used ${toolCall.name} and got: ${toolResult}`},
            {role: 'user', content: 'Based on the tool result, provide a helpful answer to my question.'},
          ]);
          
          return {
            response: finalResponse.content as string,
            requiresConfirmation: false,
          };
        }
      }

      // No tools needed, return the response
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
