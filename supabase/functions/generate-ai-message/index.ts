import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');

    if (!deepseekKey) {
      console.error('DEEPSEEK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Clé API DeepSeek non configurée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      organization_id, 
      contact_id, 
      property_id, 
      activity_type, 
      additional_context,
      user_name 
    } = await req.json();

    console.log('Generating AI message for:', { organization_id, contact_id, activity_type });

    // 1. Fetch contact details
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('full_name, role, pipeline_stage, last_contact_date, urgency_score, notes')
      .eq('id', contact_id)
      .eq('organization_id', organization_id)
      .single();

    if (contactError || !contact) {
      console.error('Contact not found:', contactError);
      return new Response(
        JSON.stringify({ error: 'Contact non trouvé' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch property details if applicable
    let property = null;
    if (property_id) {
      const { data } = await supabase
        .from('properties')
        .select('address, type, price, status, surface, rooms')
        .eq('id', property_id)
        .eq('organization_id', organization_id)
        .single();
      property = data;
    }

    // 3. Fetch last activity with this contact
    const { data: lastActivity } = await supabase
      .from('activities')
      .select('type, description, created_at')
      .eq('contact_id', contact_id)
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Calculate days since last contact
    const daysSinceContact = contact.last_contact_date
      ? Math.floor((Date.now() - new Date(contact.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // 5. Build enriched context
    const enrichedContext = `
Contact: ${contact.full_name}
Rôle: ${contact.role || 'Non spécifié'}
Étape pipeline: ${contact.pipeline_stage || 'À qualifier'}
Urgence: ${contact.urgency_score || 5}/10
${daysSinceContact !== null ? `Dernier contact: il y a ${daysSinceContact} jour(s)` : 'Premier contact'}
${contact.notes ? `Notes: ${contact.notes.substring(0, 200)}` : ''}
${property ? `
Bien concerné:
- Type: ${property.type}
- Adresse: ${property.address}
- Prix: ${property.price}€
- Surface: ${property.surface}m²
- Statut: ${property.status}
` : 'Aucun bien spécifique'}
${lastActivity ? `
Dernière interaction (${lastActivity.type}): ${lastActivity.description?.substring(0, 150) || 'Pas de description'}...
` : ''}
${additional_context ? `
Contexte additionnel: ${additional_context}
` : ''}
`.trim();

    // 6. System prompt optimized for DeepSeek
    const systemPrompt = `Tu es un assistant IA spécialisé pour agents immobiliers français. Ta mission est de générer des messages de relance professionnels, personnalisés et efficaces.

RÈGLES STRICTES :
- Ton respectueux et professionnel (vouvoiement par défaut, tutoiement si contexte le suggère)
- Personnalisation maximale avec contexte fourni (nom, bien, historique)
- Appel à l'action CLAIR (proposer RDV, demander retour, relancer estimation)
- Empathie et compréhension du parcours client
- Max 120 mots par message (concision = efficacité)
- Structure : Accroche personnalisée → Valeur ajoutée → Appel à l'action
- TOUJOURS terminer par signature formatée : "Cordialement,\\n[Prénom Agent]"
- Éviter jargon technique, privilégier langage naturel
- Aucune promesse impossible ou pression commerciale

GÉNÈRE EXACTEMENT 3 VARIATIONS :
1. **Professionnel** : Vouvoiement, formel, structuré, très courtois
2. **Chaleureux** : Tutoiement approprié, empathique, humain, proximité
3. **Direct** : Court (60-80 mots), actionable, focus RDV/réponse immédiate

FORMAT JSON STRICT (ne pas ajouter de texte avant ou après) :
{
  "variations": [
    { "tone": "professional", "text": "..." },
    { "tone": "warm", "text": "..." },
    { "tone": "direct", "text": "..." }
  ]
}`;

    const userPrompt = `Génère 3 variations de message ${activity_type === 'email' ? 'email' : 'SMS/relance'} pour :

${enrichedContext}

Type d'activité: ${activity_type}
Objectif: ${activity_type === 'relance' ? 'Relancer le contact sans nouvelles pour obtenir une réponse' : 'Envoyer email de suivi professionnel'}

Agent immobilier: ${user_name || '[Prénom Agent]'}

Génère maintenant les 3 variations en JSON uniquement.`;

    console.log('Calling DeepSeek API...');

    // 7. Call DeepSeek API
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
        max_tokens: 1500,
      })
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error('DeepSeek API Error:', deepseekResponse.status, errorText);
      
      if (deepseekResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Quota DeepSeek dépassé. Réessayez plus tard.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Erreur API DeepSeek', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const deepseekData = await deepseekResponse.json();
    console.log('DeepSeek response received:', deepseekData.usage);

    // Parse the response content
    let result;
    try {
      const content = deepseekData.choices?.[0]?.message?.content || '';
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse DeepSeek response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Erreur de parsing de la réponse IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        variations: result.variations,
        usage: deepseekData.usage
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erreur serveur', 
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
