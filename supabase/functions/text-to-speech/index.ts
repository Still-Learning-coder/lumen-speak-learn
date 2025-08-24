import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');

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

    console.log('Processing text-to-speech request with ElevenLabs:', { textLength: text.length, voice });

    if (!elevenlabsApiKey) {
      console.log('ElevenLabs API key not configured, falling back to OpenAI');
      
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw new Error('No text-to-speech API keys configured');
      }

      // Use OpenAI text-to-speech as fallback
      const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: 'alloy',
          response_format: 'mp3',
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI TTS API error:', errorText);
        throw new Error(`OpenAI TTS API error: ${openaiResponse.status} - ${errorText}`);
      }

      const arrayBuffer = await openaiResponse.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binaryString);

      console.log('OpenAI text-to-speech successful');
      return new Response(
        JSON.stringify({ audioContent: base64Audio }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Use a default voice if none specified (Aria - high quality voice)
    const voiceId = voice || '9BWtsMINqrJLrRacOk9x'; // Aria voice ID

    try {
      // Generate speech from text using ElevenLabs
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenlabsApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_turbo_v2', // Fast, high-quality model
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`ElevenLabs API failed: ${response.status} - ${errorText}`);
        
        // Log specific error details for debugging
        if (response.status === 401) {
          console.error('ElevenLabs: Invalid API key or unauthorized');
        } else if (response.status === 429) {
          console.error('ElevenLabs: Rate limit exceeded');
        } else if (errorText.includes('unusual_activity')) {
          console.error('ElevenLabs: Unusual activity detected');
        }
        
        // If ElevenLabs fails, fallback to OpenAI
        console.log('🔄 ElevenLabs failed, falling back to OpenAI TTS');
        const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
        if (!openaiApiKey) {
          throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
        }

        const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'tts-1',
            input: text,
            voice: 'alloy',
            response_format: 'mp3',
          }),
        });

        if (!openaiResponse.ok) {
          const openaiErrorText = await openaiResponse.text();
          console.error(`OpenAI TTS API failed: ${openaiResponse.status} - ${openaiErrorText}`);
          
          // Log specific OpenAI error details
          if (openaiResponse.status === 429) {
            console.error('OpenAI: API quota exceeded or rate limit');
          } else if (openaiResponse.status === 401) {
            console.error('OpenAI: Invalid API key');
          }
          
          throw new Error(`Both TTS services failed. ElevenLabs: ${response.status} - ${errorText}. OpenAI: ${openaiResponse.status} - ${openaiErrorText}`);
        }

        const arrayBuffer = await openaiResponse.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        let binaryString = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64Audio = btoa(binaryString);

        console.log('✅ OpenAI text-to-speech successful (fallback)');
        return new Response(
          JSON.stringify({ audioContent: base64Audio }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      // Convert audio buffer to base64 efficiently (avoiding stack overflow)
      const arrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to base64 in chunks to avoid stack overflow
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binaryString);

      console.log('✅ Text-to-speech successful with ElevenLabs');

      return new Response(
        JSON.stringify({ audioContent: base64Audio }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    } catch (elevenlabsError) {
      console.error('ElevenLabs processing error:', elevenlabsError);
      
      // Fallback to OpenAI if ElevenLabs throws an error
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openaiApiKey) {
        throw elevenlabsError;
      }

      console.log('ElevenLabs failed with error, falling back to OpenAI TTS');
      const openaiResponse = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: 'alloy',
          response_format: 'mp3',
        }),
      });

      if (!openaiResponse.ok) {
        const openaiErrorText = await openaiResponse.text();
        console.error('OpenAI TTS API error:', openaiErrorText);
        throw new Error(`Both TTS services failed. ElevenLabs error: ${elevenlabsError.message}. OpenAI: ${openaiResponse.status} - ${openaiErrorText}`);
      }

      const arrayBuffer = await openaiResponse.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      const base64Audio = btoa(binaryString);

      console.log('OpenAI text-to-speech successful (error fallback)');
      return new Response(
        JSON.stringify({ audioContent: base64Audio }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
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