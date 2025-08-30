import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log(`[${new Date().toISOString()}] Chat completion function starting`);
const envKeys = Object.keys(Deno.env.toObject());
console.log('Environment variables:', envKeys);
console.log('GOOGLE_API_KEY exists:', envKeys.includes('GOOGLE_API_KEY'));

// Get API key immediately and log details
const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
console.log('API key retrieved:', !!googleApiKey);
console.log('API key length:', googleApiKey?.length || 0);
console.log('API key value (first 10 chars):', googleApiKey?.substring(0, 10) || 'NONE');

if (!googleApiKey) {
  console.error('CRITICAL: Google API key is not set!');
} else if (googleApiKey.trim().length === 0) {
  console.error('CRITICAL: Google API key is empty string!');
} else if (googleApiKey.length < 20) {
  console.error('CRITICAL: Google API key seems too short!');
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
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    console.log('In handler - API key configured:', !!googleApiKey);
    console.log('In handler - API key length:', googleApiKey ? googleApiKey.length : 0);
    
    if (!googleApiKey) {
      console.error('FATAL: No GOOGLE_API_KEY found in environment');
      return jsonResponse({ 
        error: 'GOOGLE_API_KEY not found',
        debug: 'Environment variable GOOGLE_API_KEY is not set'
      }, 500);
    }
    
    if (googleApiKey.trim() === '') {
      console.error('FATAL: GOOGLE_API_KEY is empty string');
      return jsonResponse({ 
        error: 'GOOGLE_API_KEY is empty',
        debug: 'Environment variable GOOGLE_API_KEY is an empty string'
      }, 500);
    }
    
    if (googleApiKey.length < 20) {
      console.error('FATAL: GOOGLE_API_KEY too short:', googleApiKey.length);
      return jsonResponse({ 
        error: 'GOOGLE_API_KEY too short',
        debug: `API key length is ${googleApiKey.length}, expected at least 20 characters`
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

    // Build contents array for Gemini API
    const contents = [];
    
    // Add conversation history
    for (const msg of validHistory) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    // Build user message content - handle files if present
    const userParts = [{ text: message }];
    
    if (files && files.length > 0) {
      // Add each file as an image
      for (const file of files) {
        if (file.type?.startsWith('image/')) {
          // Extract base64 data from data URL
          const base64Data = file.data.includes(',') ? file.data.split(',')[1] : file.data;
          userParts.push({
            inline_data: {
              mime_type: file.type || 'image/jpeg',
              data: base64Data
            }
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: userParts
    });

    console.log('Sending request to Gemini...');
    console.log('Making request to Gemini with model: gemini-1.5-flash');
    
    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1000,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Gemini response status:', response.status);
    console.log('Gemini response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini upstream error', response.status, errorText);
      
      // Handle rate limit errors specifically
      if (response.status === 429) {
        return jsonResponse({ 
          error: 'Gemini rate limit exceeded. Please try again in a moment.',
          type: 'rate_limit',
          retryAfter: response.headers.get('retry-after')
        }, 429);
      }
      
      return jsonResponse({ 
        error: 'Gemini upstream error',
        status: response.status,
        details: safeSlice(errorText),
        geminiStatus: response.status
      }, response.status >= 500 ? 502 : 400);
    }

    const data = await response.json();
    console.log('Gemini response data:', JSON.stringify(data, null, 2));

    // Check if response has the expected structure
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Invalid Gemini response structure:', JSON.stringify(data, null, 2));
      return jsonResponse({ 
        error: 'Invalid response structure from Gemini',
        geminiResponse: data
      }, 502);
    }

    const assistantMessage = data.candidates[0].content.parts[0].text;

    // Use the actual content that was sent to Gemini for conversation history
    const userContentForHistory = message || 'Message with attachments';

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