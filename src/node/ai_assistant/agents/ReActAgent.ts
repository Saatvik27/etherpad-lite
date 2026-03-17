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
import {REQUIREMENTS_TEMPLATE, SECTION_HEADERS} from '../RequirementsTemplate';
import settings from '../../utils/Settings';
import {RunnableSequence} from '@langchain/core/runnables';
import {ChatPromptTemplate} from '@langchain/core/prompts';
import {StructuredTool} from '@langchain/core/tools';
import {AIMessage, HumanMessage, SystemMessage} from '@langchain/core/messages';

const logger = log4js.getLogger('ReActAgent');

export class ReActAgent extends BaseAgent {
  private llm: ChatGroq;

  constructor() {
    super();
    
    const config = settings.aiAssistant;
    this.llm = new ChatGroq({
      apiKey: config.apiKey,
      model: config.model || 'openai/gpt-oss-120b',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000,
    });
  }

  private isToolUseFailedError(error: any): boolean {
    return (
      error?.status === 400 &&
      (error?.error?.error?.code === 'tool_use_failed' ||
        typeof error?.error?.error?.failed_generation === 'string')
    );
  }

  private buildInitializedTemplate(userQuery: string): string {
    const today = new Date().toISOString().split('T')[0];
    const isChairRequest = /chair/i.test(userQuery);
    const title = isChairRequest ? 'Office Chair Supply' : 'Procurement Requirements';

    let doc = REQUIREMENTS_TEMPLATE;
    doc = doc.replace('Scope of Work / Supply', title);
    doc = doc.replace('Procurement Type: TBD', 'Procurement Type: Goods Only');
    doc = doc.replace('Date: TBD', `Date: ${today}`);
    return doc;
  }

  private extractRecoveryFacts(userQuery: string): {quantity?: number; budgetPerUnit?: number; department?: string} {
    const quantityMatch = userQuery.match(/\b(\d{1,4})\s*(chairs?|units?)\b/i);
    const dollarMatch =
      userQuery.match(/\$\s*(\d{1,6})\s*(?:per\s*(?:chair|unit)|each)?/i) ||
      userQuery.match(/(\d{1,6})\s*(?:dollars?|usd)\s*(?:per\s*(?:chair|unit)|each)?/i) ||
      userQuery.match(/(?:budget|max(?:imum)?)\s*(?:of|is|:)?\s*\$?\s*(\d{1,6})/i);
    const deptMatch = userQuery.match(/\b([a-z][a-z\s&-]{1,40})\s+department\b/i);

    return {
      quantity: quantityMatch ? Number(quantityMatch[1]) : undefined,
      budgetPerUnit: dollarMatch ? Number(dollarMatch[1]) : undefined,
      department: deptMatch ? `${deptMatch[1].trim()} department` : undefined,
    };
  }

  private async buildRecoveryAction(userQuery: string, padId: string): Promise<AgentResponse | null> {
    const currentPad = await PadContentReader.getPadText(padId);
    const hasTemplate = this.hasRequirementsTemplate(currentPad);
    const facts = this.extractRecoveryFacts(userQuery);

    if (!hasTemplate) {
      return {
        response: '',
        requiresConfirmation: true,
        action: {
          type: 'initialize_requirements_document',
          newText: this.buildInitializedTemplate(userQuery),
          description: 'Initialize Requirement Definition Document',
        },
      };
    }

    if (facts.quantity || facts.budgetPerUnit) {
      const lines: string[] = [];
      lines.push(`Users / stakeholders: ${facts.department || 'TBD — department to be confirmed'}`);
      lines.push(`Transactions / volume: ${facts.quantity ? `${facts.quantity} office chairs (one-time procurement)` : 'TBD — quantity to be confirmed'}`);
      lines.push('Sites / locations: TBD — exact building/city to be confirmed');
      lines.push('Growth expectations: Optional repeat procurement based on workspace expansion');
      if (facts.budgetPerUnit) {
        lines.push(`Budget guidance: Maximum ${facts.budgetPerUnit} per chair`);
      }

      return {
        response: '',
        requiresConfirmation: true,
        action: {
          type: 'update_document_section',
          sectionHeader: SECTION_HEADERS.volumes,
          newContent: lines.join('\n'),
          description: `Update section: ${SECTION_HEADERS.volumes}`,
        },
      };
    }

    if (facts.department) {
      return {
        response: '',
        requiresConfirmation: true,
        action: {
          type: 'update_document_section',
          sectionHeader: SECTION_HEADERS.background,
          newContent: `The requesting unit is ${facts.department}. The team requires office seating that supports daily desk-based work and long-duration comfort. Final location details remain TBD and will be confirmed before supplier issuance.`,
          description: `Update section: ${SECTION_HEADERS.background}`,
        },
      };
    }

    return null;
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
      const systemPrompt = `You are a Procurement Requirements Analyst embedded in a collaborative document editor. Your mission is to guide users from a vague idea to a complete, formal Requirement Definition Document — written live into the pad as the conversation progresses.

## Your Approach

**Interview style:** Ask exactly ONE focused question per turn. Never ask multiple questions in one message. Build on prior answers — do not repeat covered ground.
**Question quality:** Use procurement-professional questions with concrete options (quantity bands, budget range, delivery window, branding specs, quality level). Avoid generic filler.
**Industry knowledge:** When referencing common standards or typical specifications, prefix clearly with "**Industry note:**" and let the user decide whether it applies.
**Document ownership:** Final decisions always belong to the user. You suggest; they confirm.
**Writing depth:** Never write one-liners for document sections. Provide professional, supplier-ready detail with complete sentences, bullets where useful, and practical specificity.

## Information to Gather (progressively)

1. **Intent** — What is being procured? Why? Who is the requesting organization?
2. **Scope & Usage** — Who uses/receives it? One-time or recurring? Estimated quantity/scale?
3. **Specifications** — Functional needs, quality standards, customization or branding?
4. **Constraints** — Budget sensitivity, deadline, compliance requirements, delivery geography?
5. **Success Criteria** — Acceptance criteria, quality benchmarks, defect tolerance?
6. **Open Items** — Unresolved decisions and assumptions to flag?

## Document Building Workflow

1. **Empty pad** → After confirming the procurement type and basic intent, call \`initialize_requirements_document\` to write the blank template skeleton. Explain what you're doing.
2. **Fill sections progressively** → As each topic is confirmed, immediately call \`update_document_section\` (preferred) or \`replace_text_in_pad\` to replace the TBD placeholder with the real content. Do not wait until the end to write everything.
2.2 **Write cadence rule** → After every meaningful user answer (quantity, budget, organization, location, requirements), update at least one relevant section before asking the next question.
2.1 **Use exact template headers** → When calling \`update_document_section\`, prefer exact headers from the template (for example: \`C1. Current Environment\`, \`C2. Volumes and Scale\`, \`D1. Deliverables\`, \`D3. Milestones and Timeline\`).
3. **Read before editing** → Always call \`read_pad_content\` before making any edits to an existing document. Use \`search_in_pad\` to locate specific section headers.
4. **Language** → Write in concise, professional, supplier-ready plain text. Mark genuinely unknown items as "TBD — [brief note]". Use "Supplier will…" phrasing for in-scope items.
5. **Never duplicate template** → Never call \`initialize_requirements_document\` if the pad already contains the template or a partially completed requirements document.
6. **Minimum substance per section** → For major sections (Purpose, Objectives, Scope, Deliverables, Requirements, Compliance, Logistics), write roughly 90-180 words or equivalent structured bullet detail. Avoid short placeholder sentences.

## Section Guide (use only what's relevant to the procurement type)

| Section | Fill when… |
|---|---|
| Header | Always — from first confirmed details |
| A. Purpose & Objectives | Intent + 3–5 measurable outcomes confirmed |
| B. Scope Boundaries | In-scope responsibilities and exclusions defined |
| C. Background and Current State | Current state and scale estimates available |
| D. Supplier Deliverables | Tangible outputs and deadlines clear |
| E. Services Scope | Procurement involves services |
| F. Goods / Supply | Procurement involves physical goods or subscriptions |
| G. Requirements (Must/Should) | Functional and non-functional needs identified |
| H. Service Levels | SLA expectations discussed |
| I. Compliance & Security | Privacy, data residency, or security needs flagged |
| J. Locations & Logistics | Delivery locations or on-site requirements known |
| K. Training | Training needs identified |
| Open Questions | Any time an assumption or unresolved item surfaces |

## Tool Priority (procurement context)

- **Read:** \`read_pad_content\` → check current state; \`search_in_pad\` → find section headers
- **Structure:** \`initialize_requirements_document\` → write blank template (once, at start)
- **Update:** \`update_document_section\` → fill/update a named section by header
- **Fallback edits:** \`replace_text_in_pad\` or \`rewrite_section\` for targeted changes

${conversationHistory ? `## Conversation History\n${conversationHistory}\n` : ''}
## Session Start Rules
- **Pad is empty** → Greet the user as a procurement analyst, briefly explain how the process works (one sentence), then ask: *"What are you looking to procure?"*
- **Pad has content** → Read it first with \`read_pad_content\`, identify the current document state, then continue the conversation from the most recently incomplete section.`;

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
        logger.debug(`[ReActAgent] Iteration ${iteration}/${maxIterations} for pad ${padId}`);
        
        let response: any;
        try {
          response = await modelWithTools.invoke(messages);
        } catch (invokeError: any) {
          if (this.isToolUseFailedError(invokeError)) {
            logger.warn('[ReActAgent] Tool call format rejected by provider; using fallback response path', {
              padId,
              failedGeneration: invokeError?.error?.error?.failed_generation,
            });

            const recoveryAction = await this.buildRecoveryAction(userQuery, padId);
            if (recoveryAction) return recoveryAction;

            const recovery = await this.llm.invoke([
              new SystemMessage('You are a procurement analyst assistant. Ask exactly ONE short follow-up question (max 25 words). Do not mention tools, errors, or internals.'),
              new HumanMessage(`User said: ${userQuery}\n\nCurrent context:\n${conversationHistory || '(none)'}`),
            ]);

            const recoveryText = (recovery.content as string || '').trim() ||
              'Please confirm the requesting department.';

            return {
              response: recoveryText,
              requiresConfirmation: false,
            };
          }
          throw invokeError;
        }
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
        let foundWriteOperation = false;
        for (const toolCall of aiMessage.tool_calls) {
          // Skip remaining tool calls if we already found a write operation
          if (foundWriteOperation) {
            break;
          }
          
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

          if (toolCall.name === 'initialize_requirements_document') {
            let initResult: any = null;
            try {
              initResult = typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult;
            } catch (_error) {
              initResult = null;
            }
            if (initResult?.action === 'noop' || initResult?.skipWrite === true) {
              logger.info(`[ReActAgent] Skipping template initialization because template already exists in pad ${padId}`);
              messages.push({
                role: 'tool',
                content: JSON.stringify(initResult),
                tool_call_id: toolCall.id,
              });
              continue;
            }
          }
        
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
            'fix_grammar',
            'initialize_requirements_document',
            'update_document_section',
          ].includes(toolCall.name);
          
          if (isWriteOperation) {
            // Mark that we found a write operation to skip any remaining tool calls
            foundWriteOperation = true;
            
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
            } else if (toolCall.name === 'initialize_requirements_document') {
              // The tool func already built the full text — parse it back out
              let toolData: any = {};
              try { toolData = typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult; } catch {}
              action.type = 'initialize_requirements_document';
              action.newText = toolData.text || args.procurementType || '';
              action.description = toolData.description || 'Initialize Requirement Definition Document';
            } else if (toolCall.name === 'update_document_section') {
              action.type = 'update_document_section';
              action.sectionHeader = args.sectionHeader || '';
              action.newContent = args.newContent || '';
              action.description = args.description || `Update section: ${args.sectionHeader}`;
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
        logger.info('[ReActAgent] Returning pending write action for user confirmation', {
          padId,
          actionType: pendingWriteAction.type,
        });
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

        case 'initialize_requirements_document':
          {
            const currentText = await PadContentReader.getPadText(padId);
            if (this.hasRequirementsTemplate(currentText)) {
              logger.info(`[ReActAgent] Requirements template already present in pad ${padId}. Skipping write.`);
              return {
                success: true,
                message: 'Requirement Definition Document template already exists in the pad. I will continue by filling missing sections instead of rewriting it.',
              };
            }
          }
          // Write the blank template as the entire pad content
          await PadContentWriter.setPadText(padId, action.newText, authorId);
          return {
            success: true,
            message: 'Requirement Definition Document template created. I\'ll fill in each section as we work through the details.',
          };

        case 'update_document_section': {
          // Find the section header in the pad and replace its body
          const currentText = await PadContentReader.getPadText(padId);
          const lines = currentText.split('\n');
          const requestedHeader = (action.sectionHeader || '').trim();
          const normalizeHeader = (value: string): string =>
            value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

          const canonicalHeaderAliases: Record<string, string> = {
            [normalizeHeader('A. Purpose & Objectives')]: SECTION_HEADERS.purpose,
            [normalizeHeader('B. Scope Boundaries')]: SECTION_HEADERS.inScope,
            [normalizeHeader('C. Background / Volumes')]: SECTION_HEADERS.background,
            [normalizeHeader('C. Background and Current State')]: SECTION_HEADERS.background,
            [normalizeHeader('D. Deliverables & Timeline')]: SECTION_HEADERS.deliverables,
            [normalizeHeader('D. Supplier Deliverables')]: SECTION_HEADERS.deliverables,
            [normalizeHeader('G. Requirements')]: SECTION_HEADERS.functional,
            [normalizeHeader('I. Compliance and Security')]: SECTION_HEADERS.compliance,
            [normalizeHeader('J. Logistics')]: SECTION_HEADERS.logistics,
          };

          let headerLine = lines.findIndex((l: string) => l.trim() === requestedHeader);
          let resolvedHeader = requestedHeader;

          if (headerLine === -1) {
            const aliasResolved = canonicalHeaderAliases[normalizeHeader(requestedHeader)];
            if (aliasResolved) {
              headerLine = lines.findIndex((l: string) => l.trim() === aliasResolved);
              if (headerLine !== -1) resolvedHeader = aliasResolved;
            }
          }

          if (headerLine === -1) {
            const normalizedRequested = normalizeHeader(requestedHeader);
            headerLine = lines.findIndex((l: string) => normalizeHeader(l.trim()) === normalizedRequested);
            if (headerLine !== -1) resolvedHeader = lines[headerLine].trim();
          }

          if (headerLine === -1) {
            const majorSectionMatch = requestedHeader.match(/^([A-Z])(?:\d+)?\./);
            if (majorSectionMatch) {
              const majorSection = majorSectionMatch[1];
              headerLine = lines.findIndex((l: string) => {
                const trimmed = l.trim();
                return trimmed.startsWith(`${majorSection}1. `) || trimmed.startsWith(`${majorSection}. `);
              });
              if (headerLine !== -1) resolvedHeader = lines[headerLine].trim();
            }
          }

          if (headerLine === -1) {
            // Section not found — append it
            const fallback = `\n${requestedHeader}\n\n${action.newContent}\n`;
            await PadContentWriter.appendText(padId, fallback, authorId);
            return {
              success: true,
              message: `Section "${requestedHeader}" not found — appended to end of document.`,
            };
          }

          const isSectionBoundary = (line: string): boolean => {
            const trimmed = line.trim();
            if (!trimmed) return false;
            if (/^={5,}$/.test(trimmed)) return true;
            if (/^#{1,3}\s+/.test(trimmed)) return true;
            if (/^[A-Z]\.\s+/.test(trimmed)) return true; // Example: "B. Scope Boundaries"
            if (/^[A-Z]\d+\.\s+/.test(trimmed)) return true; // Example: "A1. Purpose"
            if (trimmed === 'Open Questions and Assumptions') return true;
            return false;
          };

          // Find the next section boundary after this header to determine section extent
          let sectionEnd = lines.length - 1;
          for (let i = headerLine + 1; i < lines.length; i++) {
            if (isSectionBoundary(lines[i])) {
              sectionEnd = i - 1;
              break;
            }
          }

          // Skip blank lines immediately after the header
          let contentStart = headerLine + 1;
          while (contentStart <= sectionEnd && lines[contentStart].trim() === '') {
            contentStart++;
          }

          logger.info('[ReActAgent] update_document_section boundaries resolved', {
            padId,
            requestedHeader,
            resolvedHeader,
            headerLine,
            contentStart,
            sectionEnd,
          });

          // Section has no existing body yet; insert directly after header line.
          if (contentStart > sectionEnd) {
            await PadContentWriter.insertTextAtLine(
              padId,
              headerLine + 1,
              `\n${action.newContent}\n`,
              authorId
            );
            return {
              success: true,
              message: `Updated section: ${resolvedHeader}`,
            };
          }

          // Rewrite the section body (lines contentStart..sectionEnd)
          await PadContentWriter.rewriteSection(
            padId,
            contentStart + 1, // 1-based
            sectionEnd + 1,   // 1-based
            action.newContent,
            authorId
          );
          return {
            success: true,
            message: `Updated section: ${resolvedHeader}`,
          };
        }

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

  private hasRequirementsTemplate(text: string): boolean {
    if (!text || !text.trim()) return false;
    return (
      text.includes('Requirement Definition Document') &&
      text.includes('A1. Purpose') &&
      text.includes('Open Questions and Assumptions')
    );
  }

  /**
   * Generate the next procurement follow-up question after a successful write action.
   * This uses direct LLM text generation (no tools) to avoid another write/confirm loop.
   */
  async generateNextQuestion(
    padId: string,
    userIntent: string,
    conversationHistory?: string
  ): Promise<string> {
    try {
      const currentPad = await PadContentReader.getPadText(padId);
      const response = await this.llm.invoke([
        new SystemMessage(`You are a senior procurement requirements analyst.
Ask the NEXT best ONE focused question needed to complete the Requirement Definition Document.

Rules:
- Ask concise, practical procurement questions only.
- Ask exactly one question in one sentence (max 25 words).
- Do not repeat questions that were already answered.
- Do not say "template created" or "let's start filling details".
- If the document appears complete (no remaining TBD placeholders), reply exactly: REQUIREMENTS_DOCUMENT_COMPLETE.
- Return plain text only.`),
        new HumanMessage(`Latest confirmed user intent:
${userIntent}

Current document content:
${currentPad}

Conversation history:
${conversationHistory || '(none)'}`),
      ]);

      const content = (response.content as string || '').trim();
      if (!content) {
        return 'What delivery date do you need for these chairs?';
      }
      return content;
    } catch (error: any) {
      logger.error('Error generating follow-up question:', error);
      return 'To continue, what quantity of items do you need and what is your target delivery date?';
    }
  }
}
