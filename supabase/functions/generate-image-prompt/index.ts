import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not found');
    }

    const { userQuestion, aiResponse } = await req.json();

    if (!userQuestion || !aiResponse) {
      return new Response(
        JSON.stringify({ error: 'Missing userQuestion or aiResponse' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Generating image prompt for question:', userQuestion);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at creating detailed, visual prompts for image generation. Your task is to analyze a user question and AI response, then create a clear, descriptive prompt that will generate an educational image explaining the topic. Focus on creating visually appealing, informative imagery that helps explain concepts. Be specific about visual elements, colors, composition, and style. Keep prompts under 1000 characters.'
          },
          {
            role: 'user',
            content: `User Question: ${userQuestion}\n\nAI Response: ${aiResponse}\n\nCreate a detailed image prompt that visually explains this topic in an educational and engaging way.`
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const imagePrompt = data.choices[0].message.content;

    console.log('Generated image prompt:', imagePrompt);

    return new Response(
      JSON.stringify({ imagePrompt }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-image-prompt function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});