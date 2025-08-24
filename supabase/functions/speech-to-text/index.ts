import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const assemblyAIApiKey = Deno.env.get('ASSEMBLYAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Processing speech-to-text request with AssemblyAI...');

    if (!assemblyAIApiKey) {
      throw new Error('AssemblyAI API key not configured');
    }

    // Process audio in chunks
    const binaryAudio = processBase64Chunks(audio);
    
    // Step 1: Upload the audio file to AssemblyAI
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        'Authorization': assemblyAIApiKey,
        'Content-Type': 'application/octet-stream',
      },
      body: binaryAudio,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('AssemblyAI upload error:', errorText);
      throw new Error(`AssemblyAI upload error: ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    const audioUrl = uploadResult.upload_url;

    console.log('Audio uploaded successfully, URL:', audioUrl);

    // Step 2: Submit the transcription request
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': assemblyAIApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'en_us', // You can make this configurable
      }),
    });

    if (!transcriptResponse.ok) {
      const errorText = await transcriptResponse.text();
      console.error('AssemblyAI transcript error:', errorText);
      throw new Error(`AssemblyAI transcript error: ${errorText}`);
    }

    const transcriptResult = await transcriptResponse.json();
    const transcriptId = transcriptResult.id;

    console.log('Transcription submitted, ID:', transcriptId);

    // Step 3: Poll for the transcription result
    let transcript;
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (attempts < maxAttempts) {
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': assemblyAIApiKey,
        },
      });

      if (!pollResponse.ok) {
        const errorText = await pollResponse.text();
        console.error('AssemblyAI poll error:', errorText);
        throw new Error(`AssemblyAI poll error: ${errorText}`);
      }

      transcript = await pollResponse.json();

      if (transcript.status === 'completed') {
        break;
      } else if (transcript.status === 'error') {
        throw new Error(`Transcription failed: ${transcript.error}`);
      }

      // Wait 1 second before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Transcription timeout - please try again');
    }

    console.log('Speech-to-text successful:', transcript.text);

    return new Response(
      JSON.stringify({ text: transcript.text || '' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in speech-to-text function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});