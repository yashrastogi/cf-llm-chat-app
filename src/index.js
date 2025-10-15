import { ChatHistory } from './chatHistory.js';

export { ChatHistory };

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // CORS headers for frontend communication
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        // Serve static files from public directory
        if (url.pathname === '/' || url.pathname === '/index.html') {
            return env.ASSETS.fetch(request);
        }

        if (url.pathname.startsWith('/styles.css') || url.pathname.startsWith('/app.js')) {
            return env.ASSETS.fetch(request);
        }

        // API endpoint for chat
        if (url.pathname === '/api/chat' && request.method === 'POST') {
            return handleChat(request, env, corsHeaders);
        }

        // API endpoint to clear chat history
        if (url.pathname === '/api/clear' && request.method === 'POST') {
            return handleClear(request, env, corsHeaders);
        }

        return new Response('Not found', { status: 404, headers: corsHeaders });
    },
};

async function handleChat(request, env, corsHeaders) {
    try {
        const { message, sessionId } = await request.json();

        if (!message) {
            return new Response(JSON.stringify({ error: 'Message is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Get or create a Durable Object instance for this session
        const id = env.CHAT_HISTORY.idFromName(sessionId || 'default-session');
        const stub = env.CHAT_HISTORY.get(id);

        // Store user message
        await stub.fetch('https://fake-host/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'user', content: message })
        });

        // Get conversation history
        const historyResponse = await stub.fetch('https://fake-host/messages');
        const history = await historyResponse.json();

        // Prepare messages for AI (only role and content, no timestamp)
        const messages = history.map(({ role, content }) => ({ role, content }));

        // Add system prompt if this is the first message
        if (messages.length === 1) {
            messages.unshift({
                role: 'system',
                content: 'You are a helpful, friendly AI assistant. Provide clear, concise, and engaging responses.'
            });
        }

        // Call Cloudflare Workers AI with streaming
        const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
            messages: messages,
            stream: true
        });

        // Create a readable stream to forward AI responses
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();
        const decoder = new TextDecoder('utf-8');

        let fullResponse = '';

        (async () => {
            try {
                let buffer = '';

                // Read and decode streamed chunks
                for await (const chunk of aiResponse) {
                    const text = decoder.decode(chunk, { stream: true });
                    buffer += text;

                    // Split by newlines for SSE-style chunks
                    let lineEnd;
                    while ((lineEnd = buffer.indexOf('\n')) >= 0) {
                        const line = buffer.slice(0, lineEnd).trim();
                        buffer = buffer.slice(lineEnd + 1);

                        // Ignore empty lines or keep-alive pings
                        if (!line || !line.startsWith('data:')) continue;

                        const jsonStr = line.slice(5).trim();
                        if (jsonStr === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(jsonStr);
                            const content = parsed.response ?? '';

                            if (content) {
                                fullResponse += content;

                                // Stream to client in real time
                                await writer.write(
                                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                                );
                            }
                        } catch {
                            // Incomplete JSON; wait for next chunk
                            buffer = jsonStr + '\n' + buffer;
                            break;
                        }
                    }
                }

                // Send final "done" signal
                await writer.write(encoder.encode('data: [DONE]\n\n'));
                await writer.close();

                // Store the assistant's complete response
                await stub.fetch('https://fake-host/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        role: 'assistant',
                        content: fullResponse
                    }),
                });
            } catch (error) {
                console.error('Streaming error:', error);
                await writer.abort(error);
            }
        })();

        // Return the stream with SSE headers
        return new Response(readable, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (error) {
        console.error('Chat error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

async function handleClear(request, env, corsHeaders) {
    try {
        const { sessionId } = await request.json();

        // Get the Durable Object instance for this session
        const id = env.CHAT_HISTORY.idFromName(sessionId || 'default-session');
        const stub = env.CHAT_HISTORY.get(id);

        // Clear the conversation history
        await stub.fetch('https://fake-host/clear', { method: 'POST' });

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Clear error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
