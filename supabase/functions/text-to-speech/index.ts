import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const murfApiKey = Deno.env.get('MURF_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { text, voice } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    console.log('Processing text-to-speech request with Murf AI:', { textLength: text.length, voice });

    if (!murfApiKey) {
      throw new Error('Murf AI API key not configured');
    }

    // Generate speech from text using Murf AI
    const response = await fetch('https://api.murf.ai/v1/speech/generate', {
      method: 'POST',
      headers: {
        'api-key': murfApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        voiceId: voice || 'en-US-natalie', // Default to Natalie voice if none specified
        audioDuration: 0, // Let Murf determine the duration
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Murf API error:', errorText);
      throw new Error(`Murf API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('Murf API response received:', { audioFile: result.audioFile });

    if (!result.audioFile) {
      throw new Error('No audio file URL returned from Murf API');
    }

    // Download the audio file from Murf's URL
    const audioResponse = await fetch(result.audioFile);
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio from Murf');
    }

    const arrayBuffer = await audioResponse.arrayBuffer();
    const base64Audio = btoa(
      String.fromCharCode(...new Uint8Array(arrayBuffer))
    );

    console.log('Text-to-speech successful with Murf AI');

    return new Response(
      JSON.stringify({ audioContent: base64Audio }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error in text-to-speech function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});