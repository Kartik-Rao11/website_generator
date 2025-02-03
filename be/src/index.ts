require("dotenv").config();
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import { ContentBlock, TextBlock } from "@anthropic-ai/sdk/resources";
import { basePrompt as nodeBasePrompt } from "./defaults/node";
import { basePrompt as reactBasePrompt } from "./defaults/react";
import cors from "cors";

const anthropic = new Anthropic();
const app = express();
app.use(cors())
app.use(express.json())

app.post("/template", async (req, res) => {
    const prompt = req.body.prompt;

    const response = await anthropic.messages.create({
        messages: [{
            role: 'user', content: prompt
        }],
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        system: "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra"
    })

    const answer = (response.content[0] as TextBlock).text; // react or node
    if (answer == "react") {
        res.json({
            prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
            uiPrompts: [reactBasePrompt]
        })
        return;
    }

    if (answer === "node") {
        res.json({
            prompts: [`Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
            uiPrompts: [nodeBasePrompt]
        })
        return;
    }

    res.status(403).json({ message: "You cant access this" })
    return;

})

app.post("/chat", async (req, res) => {
    const messages = req.body.messages;
    const response = await anthropic.messages.create({
        messages: messages,
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8000,
        system: getSystemPrompt()
    })

    console.log(response);

    res.json({
        response: (response.content[0] as TextBlock)?.text
    });
})


app.get("/chat/stream", async (req, res) => {
    try {
        console.log(req);
        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const messagesStr = req.query.messages as string;
        const messages = JSON.parse(messagesStr);

        // Validate messages format
        if (!Array.isArray(messages)) {
            throw new Error('Messages must be an array');
        }

        // Log the messages for debugging
        console.log('Received messages:', JSON.stringify(messages, null, 2));

        // Validate each message
        messages.forEach((msg, index) => {
            if (!msg.role || !msg.content) {
                throw new Error(`Invalid message format at index ${index}. Each message must have 'role' and 'content'`);
            }
            if (!['user', 'assistant'].includes(msg.role)) {
                throw new Error(`Invalid role "${msg.role}" at index ${index}. Role must be 'user' or 'assistant'`);
            }
        });

        // Create a streaming response
        const stream = await anthropic.messages.create({
            messages: messages,
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 8000,
            system: getSystemPrompt(),
            stream: true
        });

        // Handle the stream
        for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                // Send the chunk to the client
                res.write(`data: ${JSON.stringify({
                    text: chunk.delta.text
                })}\n\n`);
            }
        }

        // End the stream
        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('Streaming error:', error);
        res.status(500).json({ error: 'Streaming failed' });
    }
});

app.get("/chat/stream2", async (req, res) => {
    try {
        console.log("Received request for streaming response");

        // Set headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Define your mock response chunks
        const mockChunks = [
            `data: {"text":"<boltArtifact id=\\"todo-app\\""}\n\n`,
            `data: {"text":" title=\\"Modern Todo Application\\">\\n"}\n\n`,
            `data: {"text":"<boltAction type=\\"file\\" filePath=\\""}\n\n`,
            `data: {"text":"src/components/TaskInput.tsx\\">import React"}\n\n`,
            `data: {"text":", { useState } from 'react';"}\n\n`,
            `data: {"text":"\\nimport { PlusCircle } from 'luc"}\n\n`,
            `data: {"text":"ide-react';\\n\\ninterface TaskInputProps {"}\n\n`,
            `data: {"text":"\\n  onAddTask: (task: string"}\n\n`,
            `data: {"text":") => void;\\n}\\n\\nexport"}\n\n`,
            `data: {"text":" default function TaskInput({ onAddTask }: Task"}\n\n`,
            `data: {"text":"InputProps) {\\n  const [input"}\n\n`,
            `data: {"text":", setInput] = useState('');\\n\\n  "} \n\n`,
            `data: {"text":"const handleSubmit = (e: React."}\n\n`,
            `data: {"text":"FormEvent) => {\\n    e.preventDefault"}\n\n`,
            `data: {"text":"();\\n    if (input.trim()) {"}\n\n`,
            `data: {"text":"\\n      onAddTask(input."}\n\n`,
            `data: {"text":"trim());\\n      setInput('');\\n    "} \n\n`,
            `data: {"text":"}\\n  };\\n\\n  return (\\n    "} \n\n`,
            `data: {"text":"<form onSubmit={handleSubmit} className=\\"w"}\n\n`,
            `data: {"text":"-full max-w-md\\">\\n      <div className"}\n\n`,
            `data: {"text":"=\\"relative flex items-center\\">\\n        <input"}\n\n`,
            `data: {"text":"\\n          type=\\"text\\"\\n          value"}\n\n`,
            `data: {"text":"={input}\\n          onChange={(e) =>"}\n\n`,
            `data: {"text":" setInput(e.target.value)}"}\n\n`,
            `data: {"text":"\\n          placeholder=\\"Add a new task...\\"\\n          className=\\"w"}\n\n`,
            `data: {"text":"-full px-4 py-3 "} \n\n`,
            `data: {"text":"rounded-lg border border-gray-"}\n\n`,
            `data: {"text":"300 focus:outline-none focus:ring"}\n\n`,
            `data: {"text":"-2 focus:ring-blue-500"}\n\n`,
            `data: {"text":" focus:border-transparent pr-12\\"\\n        "} \n\n`,
            `data: {"text":"/>\\n        <button\\n          type=\\"submit"}\n\n`,
            `data: {"text":"\\"\\n          className=\\"absolute right-2"}\n\n`,
            `data: {"text":" text-blue-500 hover:text-blue"}\n\n`,
            `data: {"text":"-600 transition-colors\\""}\n\n`,
            `data: {"text":"\\n          aria-label=\\"Ad"}\n\n`,
            `data: {"text":"d task\\"\\n        >\\n          <Plus"}\n\n`,
            `data: {"text":"Circle size={24} />\\n        </"}\n\n`,
            `data: {"text":"button>\\n      </div>\\n    </"}\n\n`,
            `data: {"text":"form>\\n  );\\n}\\n</b"}\n\n`,
            `data: {"text":"oltAction>\\n\\n<boltAction type=\\"file\\" fil"}\n\n`,
            `data: {"text":"ePath=\\"src/components/TaskItem.tsx\\">import React"}\n\n`,
            `data: {"text":" from 'react';\\nimport { Check"}\n\n`,
            `data: {"text":", Trash2, Circle } from '"}\n\n`,
            `data: {"text":"lucide-react';\\nimport { Task } from"}\n\n`,
            `data: {"text":" '../types';\\n\\ninterface TaskItemProps {"}\n\n`,
            `data: {"text":"\\n  task: Task;\\n  onToggle"}\n\n`,
            `data: {"text":": (id: string) => void;"}\n\n`,
            `data: {"text":"\\n  onDelete: (id: string) => void;"}\n\n`,
            `data: {"text":"\\n}\\n\\nexport default function TaskItem({ task,"}\n\n`,
            `data: {"text":" onToggle, onDelete }: TaskItem"}\n\n`,
            `data: {"text":"Props) {\\n  return (\\n    "} \n\n`,
            `data: {"text":"<div className=\\"flex items-center justify-between"}\n\n`,
            `data: {"text":" p-4 bg-white rounded-lg shadow-sm"}\n\n`,
            `data: {"text":" border border-gray-100 "} \n\n`,
            `data: {"text":"group\\">\\n      <div className=\\"flex items-"}\n\n`,
            `data: {"text":"center gap-3\\">\\n        <button"}\n\n`,
            `data: {"text":"\\n          onClick={() => onToggle(task"}\n\n`,
            `data: {"text":".id)}\\n          className={\`rounde"}\n\n`,
            `data: {"text":"d-full p-1 transition-colors \${"}\n\n`,
            `data: {"text":"task.completed"}\n\n`,
            `data: {"text":"              ? 'bg-green-500"}\n\n`,
            `data: {"text":" text-white'"}\n\n`,
            `data: {"text":"              : '"}\n\n`,
            `data: {"text":"text-gray-400 hover:text"}\n\n`,
            `data: {"text":"-blue-500'"}\n\n`,
            `data: {"text":"          }\`}\\n        "} \n\n`,
            `data: {"text":">\\n          {task.completed ? <Check"}\n\n`,
            `data: {"text":" size={18} /> : <Circle size={18} />"}\n\n`,
            `data: {"text":"}\\n        </button>\\n        <span"}\n\n`,
            `data: {"text":"\\n          className={\`text-gray-800"}\n\n`,
            `data: {"text":" \${"}\n\n`,
            `data: {"text":"            task.completed ? 'line-through"}\n\n`,
            `data: {"text":" text-gray-400' : ''"}\n\n`,
            `data: {"text":"          }\`}\\n        >\\n          {task."}\n\n`,
            `data: {"text":"text}\\n        </span"}\n\n`,
            `data: {"text":">\\n      </div>\\n      <button"}\n\n`,
            `data: {"text":"\\n        onClick={() => onDelete(task."}\n\n`,
            `data: {"text":"id)}\\n        className=\\"text-gray-"}\n\n`,
            `data: {"text":"400 hover:text-red-500 "} \n\n`,
            `data: {"text":"opacity-0 group-hover:opacity-100"}\n\n`,
            `data: {"text":" transition-opacity\\"\\n        aria-label=\\"Delete"}\n\n`,
            `data: {"text":" task\\"\\n      >\\n        <Trash"}\n\n`,
            `data: {"text":"2 size={18} />\\n      </"}\n\n`,
            `data: {"text":"button>\\n    </div>\\n  );"}\n\n`,
            `data: {"text":"\\n}\\n</boltAction>\\n\\n"}\n\n`,
            ` data: "[DONE]"`,
        ];
        // Send chunks at intervals to simulate streaming
        for (const chunk of mockChunks) {
            res.write(chunk);
            await new Promise(resolve => setTimeout(resolve, 500)); // Delay to simulate streaming
        }

        // End the stream
        res.end();
    } catch (error) {
        console.error("Streaming error:", error);
        res.status(500).json({ error: "Streaming failed" });
    }
});

app.get("/stream2", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream"); // Enable SSE   
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    async function sendChunk(chunk: { prompts?: string[]; uiPrompts?: string[]; }) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate delay
    }

    try {
        const responseData = {
            "prompts": [
                "For all designs I ask you to make, have them be beautiful, not cookie cutter. Make webpages that are fully featured and worthy for production.\n\nBy default, this template supports JSX syntax with Tailwind CSS classes, React hooks, and Lucide React for icons. Do not install other packages for UI themes, icons, etc unless absolutely necessary or I request them.\n\nUse icons from lucide-react for logos.\n\nUse stock photos from unsplash where appropriate, only valid URLs you know exist. Do not download the images, only link to them in image tags.\n\n",
                "Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n<boltArtifact id=\"project-import\" title=\"Project Files\"><boltAction type=\"file\" filePath=\"eslint.config.js\">import js from '@eslint/js';\nimport globals from 'globals';\nimport reactHooks from 'eslint-plugin-react-hooks';\nimport reactRefresh from 'eslint-plugin-react-refresh';\nimport tseslint from 'typescript-eslint';\n\nexport default tseslint.config(\n  { ignores: ['dist'] },\n  {\n    extends: [js.configs.recommended, ...tseslint.configs.recommended],\n    files: ['**/*.{ts,tsx}'],\n    languageOptions: {\n      ecmaVersion: 2020,\n      globals: globals.browser,\n    },\n    plugins: {\n      'react-hooks': reactHooks,\n      'react-refresh': reactRefresh,\n    },\n    rules: {\n      ...reactHooks.configs.recommended.rules,\n      'react-refresh/only-export-components': [\n        'warn',\n        { allowConstantExport: true },\n      ],\n    },\n  }\n);\n</boltAction><boltAction type=\"file\" filePath=\"index.html\"><!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <link rel=\"icon\" type=\"image/svg+xml\" href=\"/vite.svg\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>Vite + React + TS</title>\n  </head>\n  <body>\n    <div id=\"root\"></div>\n    <script type=\"module\" src=\"/src/main.tsx\"></script>\n  </body>\n</html>\n</boltAction><boltAction type=\"file\" filePath=\"package.json\">{\n  \"name\": \"vite-react-typescript-starter\",\n  \"private\": true,\n  \"version\": \"0.0.0\",\n  \"type\": \"module\",\n  \"scripts\": {\n    \"dev\": \"vite\",\n    \"build\": \"vite build\",\n    \"lint\": \"eslint .\",\n    \"preview\": \"vite preview\"\n  },\n  \"dependencies\": {\n    \"lucide-react\": \"^0.344.0\",\n    \"react\": \"^18.3.1\",\n    \"react-dom\": \"^18.3.1\"\n  },\n  \"devDependencies\": {\n    \"@eslint/js\": \"^9.9.1\",\n    \"@types/react\": \"^18.3.5\",\n    \"@types/react-dom\": \"^18.3.0\",\n    \"@vitejs/plugin-react\": \"^4.3.1\",\n    \"autoprefixer\": \"^10.4.18\",\n    \"eslint\": \"^9.9.1\",\n    \"eslint-plugin-react-hooks\": \"^5.1.0-rc.0\",\n    \"eslint-plugin-react-refresh\": \"^0.4.11\",\n    \"globals\": \"^15.9.0\",\n    \"postcss\": \"^8.4.35\",\n    \"tailwindcss\": \"^3.4.1\",\n    \"typescript\": \"^5.5.3\",\n    \"typescript-eslint\": \"^8.3.0\",\n    \"vite\": \"^5.4.2\"\n  }\n}\n</boltAction><boltAction type=\"file\" filePath=\"postcss.config.js\">export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n</boltAction><boltAction type=\"file\" filePath=\"tailwind.config.js\">/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n</boltAction><boltAction type=\"file\" filePath=\"tsconfig.app.json\">{\n  \"compilerOptions\": {\n    \"target\": \"ES2020\",\n    \"useDefineForClassFields\": true,\n    \"lib\": [\"ES2020\", \"DOM\", \"DOM.Iterable\"],\n    \"module\": \"ESNext\",\n    \"skipLibCheck\": true,\n\n    /* Bundler mode */\n    \"moduleResolution\": \"bundler\",\n    \"allowImportingTsExtensions\": true,\n    \"isolatedModules\": true,\n    \"moduleDetection\": \"force\",\n    \"noEmit\": true,\n    \"jsx\": \"react-jsx\",\n\n    /* Linting */\n    \"strict\": true,\n    \"noUnusedLocals\": true,\n    \"noUnusedParameters\": true,\n    \"noFallthroughCasesInSwitch\": true\n  },\n  \"include\": [\"src\"]\n}\n</boltAction><boltAction type=\"file\" filePath=\"tsconfig.json\">{\n  \"files\": [],\n  \"references\": [\n    { \"path\": \"./tsconfig.app.json\" },\n    { \"path\": \"./tsconfig.node.json\" }\n  ]\n}\n</boltAction><boltAction type=\"file\" filePath=\"tsconfig.node.json\">{\n  \"compilerOptions\": {\n    \"target\": \"ES2022\",\n    \"lib\": [\"ES2023\"],\n    \"module\": \"ESNext\",\n    \"skipLibCheck\": true,\n\n    /* Bundler mode */\n    \"moduleResolution\": \"bundler\",\n    \"allowImportingTsExtensions\": true,\n    \"isolatedModules\": true,\n    \"moduleDetection\": \"force\",\n    \"noEmit\": true,\n\n    /* Linting */\n    \"strict\": true,\n    \"noUnusedLocals\": true,\n    \"noUnusedParameters\": true,\n    \"noFallthroughCasesInSwitch\": true\n  },\n  \"include\": [\"vite.config.ts\"]\n}\n</boltAction><boltAction type=\"file\" filePath=\"vite.config.ts\">import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\n// https://vitejs.dev/config/\nexport default defineConfig({\n  plugins: [react()],\n  optimizeDeps: {\n    exclude: ['lucide-react'],\n  },\n});\n</boltAction><boltAction type=\"file\" filePath=\"src/App.tsx\">import React from 'react';\n\nfunction App() {\n  return (\n    <div className=\"min-h-screen bg-gray-100 flex items-center justify-center\">\n      <p>Start prompting (or editing) to see magic happen :)</p>\n    </div>\n  );\n}\n\nexport default App;\n</boltAction><boltAction type=\"file\" filePath=\"src/index.css\">@tailwind base;\n@tailwind components;\n@tailwind utilities;\n</boltAction><boltAction type=\"file\" filePath=\"src/main.tsx\">import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.tsx';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);\n</boltAction><boltAction type=\"file\" filePath=\"src/vite-env.d.ts\">/// <reference types=\"vite/client\" />\n</boltAction></boltArtifact>\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n"
            ],
            "uiPrompts": [
                "<boltArtifact id=\"project-import\" title=\"Project Files\"><boltAction type=\"file\" filePath=\"eslint.config.js\">import js from '@eslint/js';\nimport globals from 'globals';\nimport reactHooks from 'eslint-plugin-react-hooks';\nimport reactRefresh from 'eslint-plugin-react-refresh';\nimport tseslint from 'typescript-eslint';\n\nexport default tseslint.config(\n  { ignores: ['dist'] },\n  {\n    extends: [js.configs.recommended, ...tseslint.configs.recommended],\n    files: ['**/*.{ts,tsx}'],\n    languageOptions: {\n      ecmaVersion: 2020,\n      globals: globals.browser,\n    },\n    plugins: {\n      'react-hooks': reactHooks,\n      'react-refresh': reactRefresh,\n    },\n    rules: {\n      ...reactHooks.configs.recommended.rules,\n      'react-refresh/only-export-components': [\n        'warn',\n        { allowConstantExport: true },\n      ],\n    },\n  }\n);\n</boltAction><boltAction type=\"file\" filePath=\"index.html\"><!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <link rel=\"icon\" type=\"image/svg+xml\" href=\"/vite.svg\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <title>Vite + React + TS</title>\n  </head>\n  <body>\n    <div id=\"root\"></div>\n    <script type=\"module\" src=\"/src/main.tsx\"></script>\n  </body>\n</html>\n</boltAction><boltAction type=\"file\" filePath=\"package.json\">{\n  \"name\": \"vite-react-typescript-starter\",\n  \"private\": true,\n  \"version\": \"0.0.0\",\n  \"type\": \"module\",\n  \"scripts\": {\n    \"dev\": \"vite\",\n    \"build\": \"vite build\",\n    \"lint\": \"eslint .\",\n    \"preview\": \"vite preview\"\n  },\n  \"dependencies\": {\n    \"lucide-react\": \"^0.344.0\",\n    \"react\": \"^18.3.1\",\n    \"react-dom\": \"^18.3.1\"\n  },\n  \"devDependencies\": {\n    \"@eslint/js\": \"^9.9.1\",\n    \"@types/react\": \"^18.3.5\",\n    \"@types/react-dom\": \"^18.3.0\",\n    \"@vitejs/plugin-react\": \"^4.3.1\",\n    \"autoprefixer\": \"^10.4.18\",\n    \"eslint\": \"^9.9.1\",\n    \"eslint-plugin-react-hooks\": \"^5.1.0-rc.0\",\n    \"eslint-plugin-react-refresh\": \"^0.4.11\",\n    \"globals\": \"^15.9.0\",\n    \"postcss\": \"^8.4.35\",\n    \"tailwindcss\": \"^3.4.1\",\n    \"typescript\": \"^5.5.3\",\n    \"typescript-eslint\": \"^8.3.0\",\n    \"vite\": \"^5.4.2\"\n  }\n}\n</boltAction><boltAction type=\"file\" filePath=\"postcss.config.js\">export default {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n</boltAction><boltAction type=\"file\" filePath=\"tailwind.config.js\">/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n</boltAction><boltAction type=\"file\" filePath=\"tsconfig.app.json\">{\n  \"compilerOptions\": {\n    \"target\": \"ES2020\",\n    \"useDefineForClassFields\": true,\n    \"lib\": [\"ES2020\", \"DOM\", \"DOM.Iterable\"],\n    \"module\": \"ESNext\",\n    \"skipLibCheck\": true,\n\n    /* Bundler mode */\n    \"moduleResolution\": \"bundler\",\n    \"allowImportingTsExtensions\": true,\n    \"isolatedModules\": true,\n    \"moduleDetection\": \"force\",\n    \"noEmit\": true,\n    \"jsx\": \"react-jsx\",\n\n    /* Linting */\n    \"strict\": true,\n    \"noUnusedLocals\": true,\n    \"noUnusedParameters\": true,\n    \"noFallthroughCasesInSwitch\": true\n  },\n  \"include\": [\"src\"]\n}\n</boltAction><boltAction type=\"file\" filePath=\"tsconfig.json\">{\n  \"files\": [],\n  \"references\": [\n    { \"path\": \"./tsconfig.app.json\" },\n    { \"path\": \"./tsconfig.node.json\" }\n  ]\n}\n</boltAction><boltAction type=\"file\" filePath=\"tsconfig.node.json\">{\n  \"compilerOptions\": {\n    \"target\": \"ES2022\",\n    \"lib\": [\"ES2023\"],\n    \"module\": \"ESNext\",\n    \"skipLibCheck\": true,\n\n    /* Bundler mode */\n    \"moduleResolution\": \"bundler\",\n    \"allowImportingTsExtensions\": true,\n    \"isolatedModules\": true,\n    \"moduleDetection\": \"force\",\n    \"noEmit\": true,\n\n    /* Linting */\n    \"strict\": true,\n    \"noUnusedLocals\": true,\n    \"noUnusedParameters\": true,\n    \"noFallthroughCasesInSwitch\": true\n  },\n  \"include\": [\"vite.config.ts\"]\n}\n</boltAction><boltAction type=\"file\" filePath=\"vite.config.ts\">import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\n// https://vitejs.dev/config/\nexport default defineConfig({\n  plugins: [react()],\n  optimizeDeps: {\n    exclude: ['lucide-react'],\n  },\n});\n</boltAction><boltAction type=\"file\" filePath=\"src/App.tsx\">import React from 'react';\n\nfunction App() {\n  return (\n    <div className=\"min-h-screen bg-gray-100 flex items-center justify-center\">\n      <p>Start prompting (or editing) to see magic happen :)</p>\n    </div>\n  );\n}\n\nexport default App;\n</boltAction><boltAction type=\"file\" filePath=\"src/index.css\">@tailwind base;\n@tailwind components;\n@tailwind utilities;\n</boltAction><boltAction type=\"file\" filePath=\"src/main.tsx\">import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.tsx';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')!).render(\n  <StrictMode>\n    <App />\n  </StrictMode>\n);\n</boltAction><boltAction type=\"file\" filePath=\"src/vite-env.d.ts\">/// <reference types=\"vite/client\" />\n</boltAction></boltArtifact>"
            ]
        }
        // 🔹
        // Send Prompts
        await sendChunk({ prompts: responseData.prompts });

        // 🔹 Send UI Prompts (files)
        for (const uiPrompt of responseData.uiPrompts) {
            await sendChunk({ uiPrompts: [uiPrompt] });
        }

        // 🔹 Close Stream
        res.write("event: close\ndata: {}\n\n");
        res.end();
    } catch (error) {
        console.error("Error in streaming:", error);
        res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
        res.end();
    }
});

app.listen(3000, () => { console.info('Server running...') });

