import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!deepseekKey) {
      console.error('DEEPSEEK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { template_name, category, context } = await req.json();

    console.log('Generating email template:', { template_name, category, context });

    const categoryDescriptions: Record<string, string> = {
      first_contact: "première prise de contact professionnel avec un prospect immobilier",
      followup: "relance bienveillante d'un prospect sans nouvelles depuis quelques jours",
      property_proposal: "proposition commerciale d'un bien immobilier correspondant aux critères du client",
      post_visit: "suivi après une visite de bien immobilier",
      appointment: "confirmation de rendez-vous pour une visite ou un entretien",
      newsletter: "newsletter informative sur le marché immobilier",
      custom: "email professionnel personnalisé pour un agent immobilier"
    };

    const systemPrompt = `Tu es un expert en rédaction d'emails immobiliers professionnels français.

RÈGLES STRICTES :
- Ton professionnel et courtois, vouvoiement
- Structure claire : accroche personnalisée, corps informatif, appel à action, signature
- Utilise les variables entre accolades pour personnalisation automatique
- Max 200 mots pour le contenu
- Pas de promesses irréalistes ni de pression commerciale
- Français impeccable

VARIABLES DISPONIBLES :
- {contact_civilite} : M. ou Mme
- {contact_prenom} : Prénom du contact
- {contact_nom} : Nom du contact
- {agent_prenom} : Prénom de l'agent
- {agent_nom} : Nom de l'agent
- {agence_nom} : Nom de l'agence
- {bien_type} : Type de bien (appartement, maison, etc.)
- {bien_adresse} : Adresse du bien
- {bien_prix} : Prix du bien
- {bien_surface} : Surface en m²
- {date_rdv} : Date et heure du rendez-vous

GÉNÈRE UN OBJET ET UN CONTENU D'EMAIL.

FORMAT JSON STRICT :
{
  "subject": "Objet accrocheur de max 60 caractères",
  "content": "Contenu complet de l'email avec variables"
}`;

    const userPrompt = `Génère un template d'email professionnel pour : "${template_name}"

Type d'email : ${categoryDescriptions[category] || category}
${context ? `Contexte additionnel : ${context}` : ''}

Intègre les variables appropriées selon le contexte du template.
Génère maintenant en JSON.`;

    const deepseekResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" }
      })
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error('DeepSeek API Error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erreur API DeepSeek', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deepseekData = await deepseekResponse.json();
    console.log('DeepSeek response:', deepseekData);

    const result = JSON.parse(deepseekData.choices[0].message.content);

    return new Response(
      JSON.stringify({
        subject: result.subject,
        content: result.content,
        usage: deepseekData.usage
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge Function Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', message: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
