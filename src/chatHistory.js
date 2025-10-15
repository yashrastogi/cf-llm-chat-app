// ChatHistory Durable Object - Manages conversation state and memory
export class ChatHistory {
    constructor(state, env) {
        this.state = state;
        this.env = env;
    }

    async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === '/messages' && request.method === 'GET') {
            // Retrieve conversation history
            return this.getMessages();
        } else if (url.pathname === '/messages' && request.method === 'POST') {
            // Add a new message to the conversation
            return this.addMessage(request);
        } else if (url.pathname === '/clear' && request.method === 'POST') {
            // Clear conversation history
            return this.clearMessages();
        }

        return new Response('Not found', { status: 404 });
    }

    async getMessages() {
        const messages = await this.state.storage.get('messages') || [];
        return new Response(JSON.stringify(messages), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async addMessage(request) {
        const message = await request.json();
        const messages = await this.state.storage.get('messages') || [];

        // Add the new message to the history
        messages.push({
            role: message.role,
            content: message.content,
            timestamp: Date.now()
        });

        // Keep only the last 20 messages to manage memory
        const trimmedMessages = messages.slice(-20);

        await this.state.storage.put('messages', trimmedMessages);

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async clearMessages() {
        await this.state.storage.put('messages', []);
        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
