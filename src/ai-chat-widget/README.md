# AI Chat Widget - Modern React Implementation

A modern React-based AI chat widget for Etherpad, built with React 18, TypeScript, and Tailwind CSS.

## 🚀 Features

- **Modern Stack**: React 18 + TypeScript + Tailwind CSS + Vite
- **Real-time Communication**: Socket.io integration with Etherpad backend
- **Beautiful UI**: Gradient purple theme, smooth animations, responsive design
- **Full Functionality**: 
  - Chat with AI assistant
  - Confirmation dialogs for pad modifications
  - Chat history persistence
  - Thinking indicator
  - Keyboard shortcuts (Alt+A)

## 📁 Structure

```
src/ai-chat-widget/
├── src/
│   ├── components/
│   │   ├── ChatBox.tsx        # Main chat container
│   │   ├── ChatIcon.tsx       # Floating chat button
│   │   ├── Message.tsx        # Individual message component
│   │   ├── MessageList.tsx    # Messages container
│   │   ├── InputBox.tsx       # Input area with send button
│   │   ├── ThinkingIndicator.tsx  # Loading indicator
│   │   └── ConfirmationDialog.tsx # Action confirmation modal
│   ├── context/
│   │   └── ChatContext.tsx    # React Context for state management
│   ├── services/
│   │   └── socket.ts         # Socket.io client service
│   ├── types.ts              # TypeScript interfaces
│   ├── App.tsx               # Root component
│   ├── main.tsx              # Entry point
│   └── index.css             # Tailwind styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 🛠️ Development

### Prerequisites
- pnpm (package manager)
- Node.js 20+

### Build the Widget

From the Etherpad root directory:

```bash
cd src/ai-chat-widget
pnpm install
pnpm build
```

This creates `../static/js/ai-widget/ai-chat-widget.iife.js` which is automatically loaded by Etherpad.

### Development Mode

```bash
pnpm dev
```

Note: In dev mode, you'll need to manually copy the built file after changes.

## 🔌 Integration

The widget is integrated into Etherpad via:

1. **Script Tag** in `src/templates/pad.html`:
   ```html
   <script src="../static/js/ai-widget/ai-chat-widget.iife.js"></script>
   ```

2. **Auto-initialization**: The widget initializes itself when the script loads

3. **Socket Communication**: Connects to Etherpad's existing Socket.io connection

## 🎨 Design

- **Position**: Fixed bottom-left corner
- **Colors**: Purple gradient (#667eea → #764ba2)
- **Size**: 420px × 550px
- **Animations**: Smooth scale, fade, slide transitions

## 📡 Backend Communication

The widget communicates with the backend using these Socket.io messages:

- **AI_CHAT_MESSAGE**: Send user message
- **AI_GET_HISTORY**: Request chat history
- **AI_CONFIRM_ACTION**: Confirm/cancel AI actions
- **AI_RESPONSE**: Receive AI responses
- **AI_HISTORY**: Receive chat history
- **AI_PAD_MODIFIED**: Pad modification notification

## 🔑 Keyboard Shortcuts

- **Alt+A**: Toggle AI chat open/close
- **Enter**: Send message
- **Shift+Enter**: New line in input

## 🚀 Why React?

The previous implementation used vanilla JavaScript with jQuery. This React version offers:

1. **Better Maintainability**: Component-based architecture
2. **Type Safety**: Full TypeScript support
3. **Modern Tooling**: Vite for fast builds, HMR
4. **State Management**: React Context API
5. **Developer Experience**: Hot reload, modern debugging
6. **Future-Proof**: Easy to extend and test

## 📦 Build Output

- **Production Build**: Single IIFE bundle (~156 KB, ~50 KB gzipped)
- **No Dependencies**: React and all libraries bundled
- **Zero Conflicts**: Isolated from Etherpad's legacy code

## 🧹 Cleanup

The following legacy files were removed:
- `src/static/js/ai_chat.js` (old vanilla JS implementation)
- `src/static/css/ai_chat.css` (old CSS)
- Old HTML templates from `src/templates/pad.html`
- Old initialization code from `padBootstrap.js` and `pad.ts`

## 🎯 Next Steps

To further modernize:
1. Add unit tests with Vitest
2. Add E2E tests with Playwright
3. Implement more UI features (markdown rendering, code highlighting)
4. Add accessibility improvements (ARIA labels, keyboard navigation)
5. Implement theme switching (dark/light mode)
