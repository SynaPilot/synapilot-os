import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    if (!anthropicKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return jsonResponse({ error: 'Clé API Anthropic non configurée' }, 500);
    }

    // ========== JWT AUTHENTICATION ==========
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Non autorisé - Token manquant' }, 401);
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getUser(token);

    if (claimsError || !claimsData?.user) {
      console.error('JWT validation failed:', claimsError?.message);
      return jsonResponse({ error: 'Non autorisé - Token invalide' }, 401);
    }

    const userId = claimsData.user.id;
    console.log('Authenticated user:', userId);

    // ========== PARSE REQUEST ==========
    const { file_url, organization_id, property_id } = await req.json();

    if (!file_url) {
      return jsonResponse({ error: 'URL du fichier DPE requise (file_url)' }, 400);
    }

    if (!organization_id) {
      return jsonResponse({ error: 'organization_id requis' }, 400);
    }

    // ========== ORGANIZATION CHECK ==========
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (profileError || !userProfile) {
      console.error('Profile fetch failed:', profileError?.message);
      return jsonResponse({ error: 'Profil utilisateur non trouvé' }, 403);
    }

    if (userProfile.organization_id !== organization_id) {
      console.error('Organization mismatch:', {
        user: userProfile.organization_id,
        requested: organization_id,
      });
      return jsonResponse({ error: 'Accès non autorisé à cette organisation' }, 403);
    }

    console.log('Analyzing DPE for org:', organization_id);

    // ========== FETCH FILE ==========
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      console.error('Failed to fetch file:', fileResponse.status);
      return jsonResponse({ error: 'Impossible de télécharger le fichier DPE' }, 400);
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const base64File = btoa(
      new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Detect media type from Content-Type header
    const contentType = fileResponse.headers.get('Content-Type') || '';
    let mediaType: string;
    if (contentType.includes('pdf')) {
      mediaType = 'application/pdf';
    } else if (contentType.includes('png')) {
      mediaType = 'image/png';
    } else if (contentType.includes('webp')) {
      mediaType = 'image/webp';
    } else if (contentType.includes('gif')) {
      mediaType = 'image/gif';
    } else {
      // Default to JPEG for images
      mediaType = 'image/jpeg';
    }

    // ========== CALL ANTHROPIC CLAUDE VISION ==========
    const anthropicBody: Record<string, unknown> = {
      model: ANTHROPIC_MODEL,
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: mediaType === 'application/pdf' ? 'document' : 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64File,
              },
            },
            {
              type: 'text',
              text: `Extract DPE and GES energy ratings from this French DPE (Diagnostic de Performance Énergétique) document. The ratings are letters from A to G. Return ONLY a JSON object with this exact format, no other text: {"dpe": "X", "ges": "Y"} where X and Y are single uppercase letters from A to G.`,
            },
          ],
        },
      ],
    };

    console.log('Calling Anthropic API with model:', ANTHROPIC_MODEL);

    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(anthropicBody),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      console.error('Anthropic API Error:', anthropicResponse.status, errorText);

      if (anthropicResponse.status === 429) {
        return jsonResponse({ error: 'Quota API Anthropic dépassé. Réessayez plus tard.' }, 429);
      }

      return jsonResponse(
        { error: 'Erreur API Anthropic', details: errorText },
        500
      );
    }

    const anthropicData = await anthropicResponse.json();
    console.log('Anthropic response received, usage:', anthropicData.usage);

    // ========== PARSE AI RESPONSE ==========
    const aiContent = anthropicData.content?.[0]?.text || '';
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.error('No JSON found in AI response:', aiContent);
      return jsonResponse({ error: "Impossible d'extraire les données DPE de la réponse IA" }, 500);
    }

    let parsed: { dpe: string; ges: string };
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI JSON:', parseError);
      return jsonResponse({ error: 'Erreur de parsing de la réponse IA' }, 500);
    }

    // Validate labels are A-G
    const validLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const dpeLabel = parsed.dpe?.toUpperCase();
    const gesLabel = parsed.ges?.toUpperCase();

    if (!validLabels.includes(dpeLabel) || !validLabels.includes(gesLabel)) {
      console.error('Invalid labels extracted:', { dpe: dpeLabel, ges: gesLabel });
      return jsonResponse(
        { error: 'Labels DPE/GES invalides extraits', raw: parsed },
        422
      );
    }

    // ========== UPDATE PROPERTY (if property_id provided) ==========
    if (property_id) {
      const { error: updateError } = await supabase
        .from('properties')
        .update({
          dpe_label: dpeLabel,
          ges_label: gesLabel,
          dpe_analyzed_at: new Date().toISOString(),
        })
        .eq('id', property_id)
        .eq('organization_id', organization_id);

      if (updateError) {
        console.error('Failed to update property:', updateError.message);
        // Still return the extracted data even if DB update fails
      } else {
        console.log('Property updated:', property_id);
      }
    }

    // ========== RETURN RESULT ==========
    return jsonResponse({
      dpe: dpeLabel,
      ges: gesLabel,
      analyzed_at: new Date().toISOString(),
      property_id: property_id || null,
      usage: anthropicData.usage,
    });

  } catch (error) {
    console.error('Edge Function Error:', error);
    return jsonResponse(
      {
        error: 'Erreur serveur',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});
