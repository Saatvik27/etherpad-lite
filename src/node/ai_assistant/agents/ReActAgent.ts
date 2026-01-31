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
      const systemPrompt = `You are a helpful AI assistant integrated into Etherpad, a collaborative text editor.
Your role is to help users with their documents by:
- Reading and understanding the pad content
- Answering questions about the document
- Suggesting improvements
- Making edits when requested (with user confirmation)

Important guidelines:
1. ALWAYS read the pad content first before answering questions about it
2. When asked to modify the pad, use the appropriate tools
3. Be concise and helpful
4. If uncertain, ask clarifying questions

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n` : ''}

Available tools:
- read_pad_content: Read the pad content (use startLine and endLine for specific ranges)
- search_in_pad: Search for text in the pad
- get_pad_metadata: Get information like line count, word count, etc.
- append_text_to_pad: Add text to the end of the pad
- replace_text_in_pad: Replace existing text with new text

When you need to modify the pad, use the tools and I will ask the user for confirmation.`;

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
          // Execute the tool
          const toolResult = await tool.invoke(toolCall.args);
          
          // Check if it's a write operation that needs confirmation
          if (toolCall.name === 'append_text_to_pad' || toolCall.name === 'replace_text_in_pad') {
            return {
              response: aiMessage.content as string || `I want to ${toolCall.name.replace(/_/g, ' ')}`,
              requiresConfirmation: true,
              action: {
                type: toolCall.name === 'append_text_to_pad' ? 'append' : 'replace',
                oldText: toolCall.args.oldText,
                newText: toolCall.args.newText || toolCall.args.text,
              },
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

        case 'replace':
          const result = await PadContentWriter.replaceText(
            padId,
            action.oldText,
            action.newText,
            authorId
          );
          return {
            success: result.success,
            message: `Replaced ${result.replacements} occurrence(s) in the pad.`,
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
