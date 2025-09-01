import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY');
    if (!googleApiKey) {
      throw new Error('Google API key not found');
    }

    console.log('Generating video prompt with Gemini');

    const prompt = `
Based on the following question and AI response, create a concise video prompt (max 100 words) for a text-to-video AI model. Focus on visual elements, scenes, and animations that would help explain the concept.

Question: ${userQuestion}
AI Response: ${aiResponse}

Create a video prompt that:
- Describes visual scenes and elements
- Includes relevant animations or transitions
- Keeps it under 100 words
- Focuses on educational/explanatory visuals
- Avoids complex technical details

Video Prompt:`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 200,
        }
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${data.error?.message || 'Unknown error'}`);
    }

    const videoPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (!videoPrompt) {
      throw new Error('No video prompt generated');
    }

    console.log('Video prompt generated successfully');

    return new Response(
      JSON.stringify({ videoPrompt }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-video-prompt function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});