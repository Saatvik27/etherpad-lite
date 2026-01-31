@echo off
echo Building AI Chat Widget...
cd src\ai-chat-widget
call pnpm build
cd ..\..
echo.
echo Build complete! Widget is ready at: src\static\js\ai-widget\ai-chat-widget.iife.js
echo.
