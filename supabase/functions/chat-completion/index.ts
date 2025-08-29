import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log(`[${new Date().toISOString()}] Chat completion function starting`);
const envKeys = Object.keys(Deno.env.toObject());
console.log('Environment variables:', envKeys);
console.log('GROK_API_KEY exists:', envKeys.includes('GROK_API_KEY'));

// Get API key immediately and log details
const grokApiKey = Deno.env.get('GROK_API_KEY');
console.log('API key retrieved:', !!grokApiKey);
console.log('API key length:', grokApiKey?.length || 0);
console.log('API key value (first 10 chars):', grokApiKey?.substring(0, 10) || 'NONE');

if (!grokApiKey) {
  console.error('CRITICAL: Grok API key is not set!');
} else if (grokApiKey.trim().length === 0) {
  console.error('CRITICAL: Grok API key is empty string!');
} else if (grokApiKey.length < 20) {
  console.error('CRITICAL: Grok API key seems too short!');
} else {
  console.log('API key looks valid (length check passed)');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeSlice(s: string, n = 800) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[${new Date().toISOString()}] Processing request...`);
    
    // Re-check API key in the request handler
    const grokApiKey = Deno.env.get('GROK_API_KEY');
    console.log('In handler - API key configured:', !!grokApiKey);
    console.log('In handler - API key length:', grokApiKey ? grokApiKey.length : 0);
    
    if (!grokApiKey) {
      console.error('FATAL: No GROK_API_KEY found in environment');
      return jsonResponse({ 
        error: 'GROK_API_KEY not found',
        debug: 'Environment variable GROK_API_KEY is not set'
      }, 500);
    }
    
    if (grokApiKey.trim() === '') {
      console.error('FATAL: GROK_API_KEY is empty string');
      return jsonResponse({ 
        error: 'GROK_API_KEY is empty',
        debug: 'Environment variable GROK_API_KEY is an empty string'
      }, 500);
    }
    
    if (grokApiKey.length < 20) {
      console.error('FATAL: GROK_API_KEY too short:', grokApiKey.length);
      return jsonResponse({ 
        error: 'GROK_API_KEY too short',
        debug: `API key length is ${grokApiKey.length}, expected at least 20 characters`
      }, 500);
    }
    
    console.log('API key validation passed');

    const { message, conversationHistory = [], files = [] } = await req.json().catch(() => ({}));

    if (!message) {
      return jsonResponse({ error: 'Missing "message" in request body' }, 400);
    }

    console.log('Chat completion request:', { message, historyLength: conversationHistory.length, filesCount: files.length });

    // Filter out error messages and validate conversation history
    const validHistory = conversationHistory.filter((msg: any) => {
      // Remove error messages, empty messages, and messages with invalid content
      return msg && 
             msg.role && 
             msg.content && 
             typeof msg.content === 'string' &&
             msg.content.trim().length > 0 &&
             !msg.content.includes('Error:') &&
             !msg.content.includes('Function invoke error') &&
             !msg.content.includes('Sorry, I encountered an error') &&
             !msg.content.includes('rate limit exceeded') &&
             !msg.content.includes('quota exceeded');
    }).slice(-10); // Keep only last 10 messages to avoid token limits

    console.log('Filtered history length:', validHistory.length);

    // Build messages array with conversation history
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant. Provide clear, well-formatted responses using markdown for better readability. Use **bold** for emphasis, *italics* for subtle emphasis, bullet points for lists, and code blocks for technical content. Be friendly and engaging while staying focused on the user\'s questions. When analyzing images, provide detailed descriptions and insights.'
      },
      ...validHistory,
    ];

    // Build user message content - handle files if present
    let userMessageContent;
    if (files && files.length > 0) {
      // Create multimodal content array
      userMessageContent = [
        {
          type: 'text',
          text: message || 'Please analyze the uploaded files.'
        }
      ];

      // Add each file as an image or document
      for (const file of files) {
        if (file.type?.startsWith('image/')) {
          userMessageContent.push({
            type: 'image_url',
            image_url: {
              url: file.data, // base64 data URL
              detail: 'high'
            }
          });
        } else {
          // For non-image files, add as text description
          userMessageContent[0].text += `\n\nAttached file: ${file.name} (${file.type || 'unknown type'})`;
        }
      }
    } else {
      userMessageContent = message;
    }

    messages.push({
      role: 'user',
      content: userMessageContent
    });

    console.log('Sending request to Grok...');
    console.log('Making request to Grok with model: grok-beta');
    
    const requestBody = {
      model: 'grok-beta',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${grokApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Grok response status:', response.status);
    console.log('Grok response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Grok upstream error', response.status, errorText);
      
      // Handle rate limit errors specifically
      if (response.status === 429) {
        return jsonResponse({ 
          error: 'Grok rate limit exceeded. Please try again in a moment.',
          type: 'rate_limit',
          retryAfter: response.headers.get('retry-after')
        }, 429);
      }
      
      return jsonResponse({ 
        error: 'Grok upstream error',
        status: response.status,
        details: safeSlice(errorText),
        grokStatus: response.status
      }, response.status >= 500 ? 502 : 400);
    }

    const data = await response.json();
    console.log('Grok response data:', JSON.stringify(data, null, 2));

    // Check if response has the expected structure
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid Grok response structure:', JSON.stringify(data, null, 2));
      return jsonResponse({ 
        error: 'Invalid response structure from Grok',
        grokResponse: data
      }, 502);
    }

    const assistantMessage = data.choices[0].message.content;

    // Use the actual content that was sent to OpenAI for conversation history
    const userContentForHistory = typeof userMessageContent === 'string' 
      ? userMessageContent 
      : message || 'Message with attachments';

    return jsonResponse({ 
      response: assistantMessage,
      conversationHistory: [...conversationHistory, 
        { role: 'user', content: userContentForHistory },
        { role: 'assistant', content: assistantMessage }
      ]
    });

  } catch (error) {
    console.error('Edge function crashed:', error);
    return jsonResponse({ 
      error: 'Edge function crashed', 
      details: String(error?.message || error) 
    }, 500);
  }
});