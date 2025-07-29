
import { FileNode, ModelInfo } from './types.ts';

const GITIGNORE_CONTENT = `# Dependencies
node_modules/

# Build artifacts
dist/
build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Log files
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# System files
.DS_Store
Thumbs.db
`;

const LICENSE_CONTENT = `MIT License

Copyright (c) 2024 Cosmic AI Builder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const README_CONTENT = `# Cosmic AI Builder

An AI-powered web development environment that allows you to build, preview, and chat with an AI assistant to create and modify code in real-time. This project provides a complete, self-contained IDE in the browser.

## ✨ Features

- **🤖 AI-Powered Coding**: Interact with a powerful AI (Google Gemini or DeepSeek) to generate, modify, and refactor code.
- **📁 File Explorer**: Manage your project's file structure, including creating, deleting, and organizing files and folders.
- **📝 Live Code Editor**: A feature-rich code editor based on Monaco (the engine behind VS Code) with syntax highlighting for various languages.
- **⚡ Real-time Preview**: Instantly see the results of your code changes in a live preview pane.
- **🛠️ AI Auto-Fix**: If the AI's code generates an error in the preview, it will automatically attempt to fix it.
- **📦 Project Download**: Download your entire project as a \`.zip\` file to continue development locally.
- **🎨 Modern UI**: A sleek, responsive, and aesthetically pleasing interface built with Tailwind CSS.

## 🚀 Getting Started

To run this project, you need to provide API keys for the AI models.

### Prerequisites

- A Google Gemini API Key.
- (Optional) A DeepSeek API Key.

### Installation & Setup

1.  **Clone the repository:**
    \`\`\`bash
    git clone https://github.com/your-username/cosmic-ai-builder.git
    cd cosmic-ai-builder
    \`\`\`

2.  **Set up environment variables:**
    This project is designed to run in an environment where \`process.env.API_KEY\` is available. For local development or self-hosting, you would typically use a \`.env\` file. Create a file named \`.env\` in the project root:

    \`\`\`
    # Your Google Gemini API Key
    API_KEY="YOUR_GEMINI_API_KEY"

    # (Optional) Your DeepSeek API Key
    DEEPSEEK_API_KEY="YOUR_DEEPSEEK_API_KEY"
    \`\`\`
    *Note: The \`.env\` file is included in \`.gitignore\` and should not be committed to your repository.*

3.  **Run the application:**
    Since this is a client-side application without a build step in this setup, you can serve the files with a simple local server.
    \`\`\`bash
    # If you have Python 3
    python -m http.server

    # Or with Node.js \`serve\` package
    npx serve
    \`\`\`
    Then, open your browser and navigate to the provided local address (e.g., \`http://localhost:8000\`).

## 💻 How to Use

1.  **Select an AI Model**: Use the dropdown in the chat panel to choose between Google Gemini and DeepSeek.
2.  **Interact with the AI**: Type your requests in the chat input. For example:
    - \`"Create a new file named 'about.html' and add a basic page structure."\`
    - \`"Add a red border to all buttons in style.css."\`
    - \`"Refactor the greet function in script.js to be an arrow function."\`
3.  **Edit Code Directly**: Click on a file in the explorer to open it in the editor. You can make changes manually at any time.
4.  **Preview Changes**: Click the "Preview" button to see your web application live. Any errors will be reported back to the AI for a potential auto-fix.
5.  **Download Your Work**: Click the "Download Project" button to get a zip archive of all files at the root level.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript
- **Styling**: Tailwind CSS
- **Code Editor**: Monaco Editor
- **AI Integration**: Google GenAI SDK (\`@google/genai\`)
- **Icons**: Heroicons (via React components)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
`;


export const INITIAL_FILES: FileNode[] = [
  {
    id: '1',
    name: 'project',
    type: 'folder',
    children: [
      { id: '1-1', name: 'index.html', type: 'file', content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cosmic App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
</head>
<body class="bg-gray-900 text-white flex items-center justify-center h-screen flex-col font-sans">
  
  <header class="p-4 text-center">
    <h1 class="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-cyan-400">
      Welcome to Your AI Site
    </h1>
  </header>
  
  <main class="p-8">
    <div class="glass-card p-8 text-center">
      <p class="text-lg">This is a modern landing page generated by your AI assistant.</p>
      <button id="cta-button" class="mt-6 px-6 py-3 bg-purple-600 rounded-full font-semibold hover:bg-purple-700 transition-all transform hover:scale-105">
        Get Started
      </button>
    </div>
  </main>
  
  <footer class="mt-8 text-gray-500">
    <p>Powered by Cosmic AI Builder</p>
  </footer>

  <script src="script.js"></script>
</body>
</html>` },
      { id: '1-2', name: 'style.css', type: 'file', content: `/* Custom styles that complement Tailwind */
body {
  font-family: 'Inter', sans-serif;
}

.glass-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}` },
      { id: '1-3', name: 'script.js', type: 'file', content: `console.log("Welcome to your AI-powered website!");

// Example of interactivity
const button = document.getElementById('cta-button');
if (button) {
  button.addEventListener('click', () => {
    alert('Button clicked! You can add more functionality here.');
  });
}` },
    ],
  },
  {
    id: '2',
    name: 'README.md',
    type: 'file',
    content: README_CONTENT,
  },
  {
    id: '3',
    name: '.gitignore',
    type: 'file',
    content: GITIGNORE_CONTENT,
  },
  {
    id: '4',
    name: 'LICENSE',
    type: 'file',
    content: LICENSE_CONTENT,
  }
];

export const AI_MODELS: ModelInfo[] = [
  { id: 'gemini', name: 'Google Gemini', apiKeyEnvVar: 'API_KEY' },
  { id: 'deepseek', name: 'DeepSeek', apiKeyEnvVar: 'DEEPSEEK_API_KEY' },
];