import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SequenceStep {
  delay_days: number;
  subject: string;
  body: string;
}

serve(async (_req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Fetch all active enrollments that are due (next_send_at <= now)
    const { data: enrollments, error: enrollError } = await supabase
      .from('sequence_enrollments')
      .select(`
        id,
        contact_id,
        sequence_id,
        organization_id,
        current_step,
        enrolled_at,
        email_sequences!inner(
          name,
          steps,
          is_active
        ),
        contacts!inner(
          full_name,
          email
        )
      `)
      .eq('status', 'active')
      .lte('next_send_at', new Date().toISOString())
      .limit(50); // process at most 50 per run for safety

    if (enrollError) {
      console.error('Error fetching enrollments:', enrollError);
      return new Response(JSON.stringify({ error: enrollError.message }), { status: 500 });
    }

    if (!enrollments || enrollments.length === 0) {
      console.log('No enrollments due');
      return new Response(JSON.stringify({ processed: 0, sent: 0, failed: 0, completed: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${enrollments.length} enrollment(s)`);

    let sent = 0;
    let failed = 0;
    let completed = 0;

    for (const enrollment of enrollments) {
      try {
        const sequence = enrollment.email_sequences as unknown as { name: string; steps: SequenceStep[]; is_active: boolean };
        const contact = enrollment.contacts as unknown as { full_name: string; email: string | null };

        // Skip paused sequences
        if (!sequence.is_active) {
          console.log(`Skipping enrollment ${enrollment.id}: sequence is paused`);
          continue;
        }

        // Skip contacts without email
        if (!contact.email) {
          console.warn(`Skipping enrollment ${enrollment.id}: contact has no email address`);
          continue;
        }

        const steps: SequenceStep[] = sequence.steps || [];
        const currentStepIndex = enrollment.current_step ?? 0;

        // Guard: already past last step
        if (currentStepIndex >= steps.length) {
          await supabase
            .from('sequence_enrollments')
            .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', enrollment.id);
          completed++;
          continue;
        }

        const step = steps[currentStepIndex];

        // 2. Send email via Resend
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SynaPilot <noreply@synapilot.fr>',
            to: contact.email,
            subject: step.subject,
            html: step.body.replace(/\n/g, '<br>'),
          }),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          console.error(`Resend error for enrollment ${enrollment.id}:`, errorText);
          failed++;
          continue;
        }

        // 3. Advance step or mark complete
        const nextStepIndex = currentStepIndex + 1;

        if (nextStepIndex >= steps.length) {
          // Last step was just sent — mark completed
          await supabase
            .from('sequence_enrollments')
            .update({
              current_step: nextStepIndex,
              status: 'completed',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id);
          completed++;
        } else {
          // Compute next_send_at: enrolled_at + next step's delay_days
          const enrolledAt = new Date(enrollment.enrolled_at);
          const nextStep = steps[nextStepIndex];
          const nextSendAt = new Date(enrolledAt);
          nextSendAt.setDate(nextSendAt.getDate() + nextStep.delay_days);

          await supabase
            .from('sequence_enrollments')
            .update({
              current_step: nextStepIndex,
              next_send_at: nextSendAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', enrollment.id);
        }

        // 4. Log a completed activity for traceability
        await supabase.from('activities').insert({
          organization_id: enrollment.organization_id,
          name: `\u{1F4E7} Envoyé : ${step.subject}`,
          description: `Email automatique — séquence "${sequence.name}" étape ${currentStepIndex + 1}/${steps.length}`,
          type: 'email',
          status: 'termine',
          priority: 'normale',
          date: new Date().toISOString(),
          contact_id: enrollment.contact_id,
          ai_generated: true,
          completed_at: new Date().toISOString(),
        });

        sent++;
        console.log(`Sent step ${currentStepIndex + 1}/${steps.length} to ${contact.email} (enrollment ${enrollment.id})`);

      } catch (err) {
        console.error(`Error processing enrollment ${enrollment.id}:`, err);
        failed++;
      }
    }

    const result = { processed: enrollments.length, sent, failed, completed };
    console.log('Run complete:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Fatal error in process-email-sequences:', error);
    return new Response(
      JSON.stringify({ error: 'Erreur serveur', message: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
