import React from 'react';
import { ChatProvider } from './context/ChatContext';
import { ChatIcon } from './components/ChatIcon';
import { ChatBox } from './components/ChatBox';

export default function App() {
  return (
    <ChatProvider>
      <ChatIcon />
      <ChatBox />
    </ChatProvider>
  );
}
