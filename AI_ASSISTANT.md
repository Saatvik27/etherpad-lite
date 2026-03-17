# AI Procurement Analyst for Etherpad Lite

## Overview

The AI Procurement Analyst turns this collaborative editor into a guided procurement intake tool. Through natural conversation, the AI interviews the user, gathers requirements progressively, and builds a formal **Requirement Definition Document** directly in the pad — section by section — in real time.

This is the first module of a broader procurement software suite. Its sole purpose is to go from *"I need t-shirts"* to a complete, defensible, supplier-ready requirements document — without any forms or uploads.

## How It Works

1. Open the AI panel (clipboard icon in the bottom-left, or **Alt+A**)
2. Tell the analyst what you need to procure in plain language
3. The analyst conducts a structured interview, asking 1–2 focused questions at a time
4. As information is confirmed, the analyst writes each section of the document live into the pad
5. The collaborative pad becomes the living Requirement Definition Document

The analyst follows a five-phase intake flow:

| Phase | What Happens |
|---|---|
| **Clarify** | Restate the need in precise terms; confirm understanding |
| **Scope** | Explore scale, quantity, frequency, and intended users |
| **Specify** | Functional requirements, quality, customization, branding |
| **Validate** | Surface constraints, deadlines, compliance, open items |
| **Draft** | Write the complete document, section by section |

## Document Template

The analyst produces a **Canadian Public Sector–style Requirement Definition Document** covering:

- Header (title, org, date, procurement type)
- A. Purpose & Measurable Objectives
- B. Scope Boundaries (in-scope, out-of-scope, assumptions)
- C. Background & Current State / Volumes
- D. Deliverables, Acceptance Criteria & Timeline
- E. Services Scope *(if applicable)*
- F. Goods / Supply Scope *(if applicable)*
- G. Functional & Non-Functional Requirements (Must/Should)
- H. Service Levels & Reporting
- I. Compliance, Privacy & Security
- J. Locations & Logistics
- K. Training & Knowledge Transfer

## Features

- **Conversational intake**: Natural language — no forms or uploads required
- **Live document building**: Writes each section to the pad as it's confirmed  
- **Template initialization**: One-click blank document scaffold with TBD placeholders
- **Section-level updates**: Targets named sections precisely without touching others
- **Industry notes**: Helps users with common specifications, labelled clearly
- **Confirmation dialogs**: All write operations require explicit user approval
- **Persistent history**: Each user's chat history is saved per pad
- **Rate limiting**: Configurable request limits to prevent abuse


## Configuration

Add the following configuration to your `settings.json`:

```json
{
  "aiAssistant": {
    "enabled": true,
    "provider": "groq",
    "apiKey": "your-api-key-here",
    "model": "llama-3.3-70b-versatile",
    "maxTokens": 2000,
    "temperature": 0.7,
    "features": {
      "canReadPad": true,
      "canWritePad": true,
      "canSummarize": true,
      "maxRequestsPerMinute": 10
    }
  }
}
```

### Configuration Options

#### Provider Settings

- **enabled**: Enable or disable the AI assistant (default: `false`)
- **provider**: AI provider to use (`groq`, `openai`, or `local`)
- **apiKey**: Your API key for the selected provider
- **model**: The model to use
  - Groq: `llama-3.3-70b-versatile`, `llama-3.1-70b-versatile`, `mixtral-8x7b-32768`
  - OpenAI: `gpt-4-turbo-preview`, `gpt-3.5-turbo`
- **maxTokens**: Maximum tokens in AI response (default: `2000`)
- **temperature**: Creativity level 0.0-1.0 (default: `0.7`)

#### Feature Flags

- **canReadPad**: Allow AI to read pad content (default: `true`)
- **canWritePad**: Allow AI to modify pad content with confirmation (default: `true`)
- **canSummarize**: Allow AI to summarize content (default: `true`)
- **maxRequestsPerMinute**: Rate limit per user (default: `10`)

## Getting API Keys

### Groq API (Recommended)

1. Visit [https://console.groq.com/](https://console.groq.com/)
2. Sign up for a free account
3. Navigate to API Keys section
4. Create a new API key
5. Add the key to your `settings.json`

### OpenAI API

1. Visit [https://platform.openai.com/](https://platform.openai.com/)
2. Sign up and add billing information
3. Navigate to API Keys section
4. Create a new API key
5. Add the key to your `settings.json`

## Usage

### Opening the AI Chat

1. Click the AI Assistant icon (🤖) on the left side of the pad
2. Or press `Alt + A` to toggle the AI chat

### Example Prompts

#### Reading Content

- "What is this pad about?"
- "Summarize the main points"
- "Search for mentions of [keyword]"
- "How many lines does this pad have?"
- "What are the key topics discussed?"

#### Modifying Content

- "Add a table of contents at the beginning"
- "Fix all grammar mistakes"
- "Add bullet points to organize the text"
- "Replace all instances of X with Y"
- "Append a conclusion section"

**Note**: All modification requests will show a confirmation dialog before applying changes.

### Keyboard Shortcuts

- `Alt + A`: Toggle AI chat
- `Enter`: Send message (in AI chat input)

## Architecture

### Backend Components

```
src/node/ai_assistant/
├── index.ts                   # Main module entry point
├── AIContext.ts              # Chat history management
├── PadContentReader.ts       # Read operations
├── PadContentWriter.ts       # Write operations
├── AIMessageHandler.ts       # Socket.io message handlers
└── agents/
    ├── BaseAgent.ts          # Agent interface
    ├── ToolRegistry.ts       # LangChain tools
    └── ReActAgent.ts         # Main AI agent
```

### Frontend Components

```
src/static/js/ai_chat.ts      # Client-side chat logic
src/static/css/ai_chat.css    # Chat styling
ui/pad.html                    # AI chat UI elements
```

### Message Flow

1. User types message in AI chat
2. Frontend sends `AI_CHAT_MESSAGE` via Socket.io
3. Backend processes with LangChain ReAct agent
4. Agent uses tools to read/analyze pad
5. Agent returns response
6. If modification needed, requests confirmation
7. User confirms/denies action
8. Backend applies changes if confirmed
9. Result broadcast to user

## Tools Available to AI

The AI agent has access to these tools:

1. **read_pad_content**: Read entire pad content or specific line ranges
2. **search_in_pad**: Search for text patterns with position tracking
3. **get_pad_metadata**: Get line count, word count, character count, etc.
4. **append_text_to_pad**: Add text to the end of the pad
5. **replace_text_in_pad**: Replace existing text with new text

## Security Considerations

### User Confirmation

All write operations require explicit user confirmation. The system will show:
- The type of operation (append/replace)
- Preview of changes (first 100-200 characters)
- Confirmation dialog with Yes/No options

### Rate Limiting

- Configurable per-user rate limits
- Default: 10 requests per minute
- Prevents API abuse and excessive costs

### Data Privacy

- Each user's chat history is isolated
- History stored per pad and user ID
- Only the user can access their own history
- History limited to last 100 messages per user

### API Key Security

- Store API keys securely in `settings.json`
- Use environment variables for production:
  ```bash
  AI_API_KEY=your-key-here npm start
  ```
- Never commit API keys to version control

## Troubleshooting

### AI Chat Not Appearing

1. Check that `aiAssistant.enabled` is `true` in settings
2. Verify API key is correctly set
3. Check browser console for JavaScript errors
4. Restart Etherpad server

### "AI is not enabled" Error

- Ensure configuration is in `settings.json`
- Verify settings are valid JSON
- Check server logs for initialization errors

### API Rate Limits

- Groq free tier: Check current limits at [https://console.groq.com/](https://console.groq.com/)
- OpenAI: Monitor usage at [https://platform.openai.com/usage](https://platform.openai.com/usage)
- Adjust `maxRequestsPerMinute` if hitting limits

### Slow Responses

- Try a smaller model (e.g., `mixtral-8x7b-32768` on Groq)
- Reduce `maxTokens` setting
- Check network connection to API provider

## Future Enhancements

### Planned Features

- ✅ Groq API support
- ✅ User-specific chat history
- ✅ Confirmation flow for modifications
- 🚧 Local model support (Ollama)
- 🚧 Custom system prompts
- 🚧 Plugin architecture for custom tools
- 🚧 Voice input support
- 🚧 Multi-language support

### Local Model Support

The architecture is designed to support local models. To add local model support:

1. Implement a new agent in `src/node/ai_assistant/agents/`
2. Add model initialization logic
3. Update `settings.json.template` with local model options
4. Configure model path and parameters

Example configuration (future):

```json
{
  "aiAssistant": {
    "provider": "local",
    "localModel": {
      "type": "ollama",
      "model": "llama3.3",
      "endpoint": "http://localhost:11434"
    }
  }
}
```

## Development

### Running Tests

```bash
npm test
```

### Adding New Tools

1. Create tool in `src/node/ai_assistant/agents/ToolRegistry.ts`
2. Define zod schema for input validation
3. Implement tool function
4. Add to `createTools()` array

Example:

```typescript
const createMyTool = (padId: string) => {
  return new DynamicStructuredTool({
    name: 'my_tool',
    description: 'Description of what the tool does',
    schema: z.object({
      param: z.string().describe('Parameter description'),
    }),
    func: async ({param}) => {
      // Implementation
      return 'Result';
    },
  });
};
```

### Extending the Agent

To add a new AI provider:

1. Create new agent class extending `BaseAgent`
2. Implement `process()` and `executeAction()` methods
3. Update `AIMessageHandler.ts` to support new provider
4. Add configuration options to `settings.json.template`

## License

Apache 2.0 (same as Etherpad Lite)

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review server logs for error details
