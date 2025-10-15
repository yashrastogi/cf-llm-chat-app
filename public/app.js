class ChatApp {
    constructor() {
        this.messagesContainer = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.sessionId = this.getOrCreateSessionId();
        this.isProcessing = false;

        this.init();
    }

    init() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.clearBtn.addEventListener('click', () => this.clearChat());

        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
        });

        // Focus input on load
        this.messageInput.focus();
    }

    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('chatSessionId');
        if (!sessionId) {
            sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('chatSessionId', sessionId);
        }
        return sessionId;
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();

        if (!message || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.sendBtn.disabled = true;
        this.messageInput.disabled = true;

        // Hide welcome message if it exists
        const welcomeMsg = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        // Add user message to UI
        this.addMessage('user', message);

        // Clear input
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';

        // Add typing indicator
        const typingIndicator = this.addTypingIndicator();

        try {
            // Send message to API with streaming
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            // Remove typing indicator
            typingIndicator.remove();

            // Create assistant message element
            const assistantMessage = this.addMessage('assistant', '');
            const contentDiv = assistantMessage.querySelector('.message-text');

            // Process streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        if (data === '[DONE]') {
                            break;
                        }

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                contentDiv.textContent += parsed.content;
                                this.scrollToBottom();
                            }
                        } catch (e) {
                            console.error('Error parsing SSE data:', e);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error:', error);
            if (typingIndicator.parentNode) {
                typingIndicator.remove();
            }
            this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        } finally {
            this.isProcessing = false;
            this.sendBtn.disabled = false;
            this.messageInput.disabled = false;
            this.messageInput.focus();
        }
    }

    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        if (role === 'assistant') {
            const label = document.createElement('div');
            label.className = 'message-label';
            label.textContent = 'AI Assistant';
            contentDiv.appendChild(label);
        }

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = content;

        contentDiv.appendChild(textDiv);
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);

        this.scrollToBottom();
        return messageDiv;
    }

    addTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';
        messageDiv.id = 'typing-indicator';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        const label = document.createElement('div');
        label.className = 'message-label';
        label.textContent = 'AI Assistant';

        const typingDiv = document.createElement('div');
        typingDiv.className = 'typing-indicator';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';

        contentDiv.appendChild(label);
        contentDiv.appendChild(typingDiv);
        messageDiv.appendChild(contentDiv);
        this.messagesContainer.appendChild(messageDiv);

        this.scrollToBottom();
        return messageDiv;
    }

    async clearChat() {
        if (!confirm('Are you sure you want to clear the conversation?')) {
            return;
        }

        try {
            const response = await fetch('/api/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId
                })
            });

            if (response.ok) {
                // Clear UI
                this.messagesContainer.innerHTML = `
                    <div class="welcome-message">
                        <div class="welcome-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                <line x1="15" y1="9" x2="15.01" y2="9"></line>
                            </svg>
                        </div>
                        <h2>Welcome to AI Chat!</h2>
                        <p>I'm here to help you with questions, ideas, or just have a friendly conversation. What would you like to talk about?</p>
                    </div>
                `;

                // Create new session
                this.sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('chatSessionId', this.sessionId);
            }
        } catch (error) {
            console.error('Error clearing chat:', error);
            alert('Failed to clear conversation. Please try again.');
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
