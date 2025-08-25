import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log('Chat completion function starting - redeploying to pick up new API key');
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [], files = [] } = await req.json();

    console.log('Chat completion request:', { message, historyLength: conversationHistory.length, filesCount: files.length });
    console.log('OpenAI API key configured:', !!openAIApiKey);
    console.log('API key length:', openAIApiKey ? openAIApiKey.length : 0);

    if (!openAIApiKey) {
      console.error('OpenAI API key not found - edge function redeployed to pick up new secrets');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: messages,
        max_completion_tokens: 500,
      }),
    });

    const data = await response.json();
    console.log('OpenAI response received');

    if (!response.ok) {
      console.error('OpenAI API error:', data);
      return new Response(JSON.stringify({ 
        error: data.error?.message || 'Failed to get response from OpenAI'
      }), {
        status: 200, // Return 200 so client can handle the error properly
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const assistantMessage = data.choices[0].message.content;

    return new Response(JSON.stringify({ 
      response: assistantMessage,
      conversationHistory: [...conversationHistory, 
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage }
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chat-completion function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});