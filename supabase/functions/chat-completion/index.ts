import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log(`[${new Date().toISOString()}] Chat completion function starting`);
const envKeys = Object.keys(Deno.env.toObject());
console.log('Environment variables:', envKeys);
console.log('OPENAI_API_KEY exists:', envKeys.includes('OPENAI_API_KEY'));

// Get API key immediately and log details
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
console.log('API key retrieved:', !!openAIApiKey);
console.log('API key length:', openAIApiKey?.length || 0);
console.log('API key value (first 10 chars):', openAIApiKey?.substring(0, 10) || 'NONE');

if (!openAIApiKey) {
  console.error('CRITICAL: OpenAI API key is not set!');
} else if (openAIApiKey.trim().length === 0) {
  console.error('CRITICAL: OpenAI API key is empty string!');
} else if (openAIApiKey.length < 20) {
  console.error('CRITICAL: OpenAI API key seems too short!');
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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    console.log('In handler - API key configured:', !!openAIApiKey);
    console.log('In handler - API key length:', openAIApiKey ? openAIApiKey.length : 0);
    
    if (!openAIApiKey) {
      console.error('FATAL: No OPENAI_API_KEY found in environment');
      return jsonResponse({ 
        error: 'OPENAI_API_KEY not found',
        debug: 'Environment variable OPENAI_API_KEY is not set'
      }, 500);
    }
    
    if (openAIApiKey.trim() === '') {
      console.error('FATAL: OPENAI_API_KEY is empty string');
      return jsonResponse({ 
        error: 'OPENAI_API_KEY is empty',
        debug: 'Environment variable OPENAI_API_KEY is an empty string'
      }, 500);
    }
    
    if (openAIApiKey.length < 20) {
      console.error('FATAL: OPENAI_API_KEY too short:', openAIApiKey.length);
      return jsonResponse({ 
        error: 'OPENAI_API_KEY too short',
        debug: `API key length is ${openAIApiKey.length}, expected at least 20 characters`
      }, 500);
    }
    
    console.log('API key validation passed');

    const { message, conversationHistory = [], files = [] } = await req.json().catch(() => ({}));

    if (!message) {
      return jsonResponse({ error: 'Missing "message" in request body' }, 400);
    }

    console.log('Chat completion request:', { message, historyLength: conversationHistory.length, filesCount: files.length });

    // Build messages array with conversation history
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant. Provide clear, well-formatted responses using markdown for better readability. Use **bold** for emphasis, *italics* for subtle emphasis, bullet points for lists, and code blocks for technical content. Be friendly and engaging while staying focused on the user\'s questions. When analyzing images, provide detailed descriptions and insights.'
      },
      ...conversationHistory,
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

    console.log('Sending request to OpenAI...');
    console.log('Making request to OpenAI with model: gpt-4o-mini');
    
    const requestBody = {
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('OpenAI response status:', response.status);
    console.log('OpenAI response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI upstream error', response.status, errorText);
      
      return jsonResponse({ 
        error: 'OpenAI upstream error',
        status: response.status,
        details: safeSlice(errorText),
        openaiStatus: response.status
      }, response.status >= 500 ? 502 : 400);
    }

    const data = await response.json();
    console.log('OpenAI response data:', JSON.stringify(data, null, 2));

    // Check if response has the expected structure
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid OpenAI response structure:', JSON.stringify(data, null, 2));
      return jsonResponse({ 
        error: 'Invalid response structure from OpenAI',
        openaiResponse: data
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