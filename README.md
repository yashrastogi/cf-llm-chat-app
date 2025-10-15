# Cloudflare AI Chat App

This is a simple web-based chat application powered by Cloudflare AI and deployed on Cloudflare Workers. It demonstrates how to build a serverless AI chat with streaming responses and persistent chat history using Durable Objects.

## Features

- **AI-Powered Chat:** Interact with a friendly AI assistant (Llama 3.3).
- **Streaming Responses:** AI responses are streamed in real-time for a better user experience.
- **Persistent Chat History:** Conversations are saved per-session using Cloudflare Durable Objects.
- **Serverless:** The entire application is deployed on the Cloudflare serverless platform.
- **Simple UI:** A clean and simple chat interface.

## Tech Stack

- **Backend:**
  - [Cloudflare Workers](https://workers.cloudflare.com/) for serverless functions.
  - [Cloudflare AI](https://developers.cloudflare.com/workers-ai/) for the chat model.
  - [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) for storing chat history.
- **Frontend:**
  - HTML, CSS, and vanilla JavaScript.
- **Tooling:**
  - [Wrangler](https://developers.cloudflare.com/workers/wrangler/) for developing and deploying the application.
  - [Node.js](https://nodejs.org/) for the development environment.

## Prerequisites

- [Node.js and npm](https://nodejs.org/en/download/) installed.
- A [Cloudflare account](https://dash.cloudflare.com/sign-up).

## Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd cloudflare-ai-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Running Locally

To start the local development server, run the following command:

```bash
npm start
```

This will start a local server, and you can access the application at `http://localhost:8787`.