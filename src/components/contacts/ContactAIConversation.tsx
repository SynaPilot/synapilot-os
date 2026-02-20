import { useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Bot,
  Gauge,
  User as UserIcon,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'contacts'>;

const PIPELINE_LABELS: Record<string, string> = {
  nouveau: 'Nouveau',
  qualification: 'Qualification',
  estimation: 'Estimation',
  mandat: 'Mandat',
  commercialisation: 'Commercialisation',
  visite: 'Visite',
  offre: 'Offre',
  negociation: 'Négociation',
  compromis: 'Compromis',
  financement: 'Financement',
  acte: 'Acte',
  vendu: 'Vendu',
  perdu: 'Perdu',
};

const ROLE_LABELS: Record<string, string> = {
  vendeur: 'Vendeur',
  acheteur: 'Acheteur',
  vendeur_acheteur: 'Vendeur/Acheteur',
  locataire: 'Locataire',
  proprietaire: 'Propriétaire',
  prospect: 'Prospect',
  partenaire: 'Partenaire',
  notaire: 'Notaire',
  banquier: 'Banquier',
  autre: 'Autre',
};

interface ContactAIConversationProps {
  contact: Contact;
}

interface Message {
  id: string;
  sender: 'contact' | 'ai';
  text: string;
  timestamp: string;
}

interface Insight {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}

function getUrgencyLevel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Chaud', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
  if (score >= 50) return { label: 'Tiède', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };
  return { label: 'Froid', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
}

function buildInsights(contact: Contact): Insight[] {
  const score = contact.urgency_score || 0;
  const urgency = getUrgencyLevel(score);

  return [
    {
      label: 'Score urgence',
      value: `${score}/100`,
      icon: Gauge,
      color: urgency.color,
    },
    {
      label: 'Rôle',
      value: contact.role ? (ROLE_LABELS[contact.role] || contact.role) : 'Non défini',
      icon: UserIcon,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    },
    {
      label: 'Pipeline',
      value: contact.pipeline_stage ? (PIPELINE_LABELS[contact.pipeline_stage] || contact.pipeline_stage) : 'Non défini',
      icon: GitBranch,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    },
  ];
}

function buildConversation(contact: Contact): Message[] {
  const firstName = contact.full_name.split(' ')[0];
  const score = contact.urgency_score || 0;
  const urgency = getUrgencyLevel(score);
  const role = contact.role ? (ROLE_LABELS[contact.role] || contact.role) : 'prospect';
  const stage = contact.pipeline_stage ? (PIPELINE_LABELS[contact.pipeline_stage] || contact.pipeline_stage) : 'Nouveau';

  const messages: Message[] = [
    {
      id: '1',
      sender: 'ai',
      text: `Analyse du dossier de ${firstName}. Rôle : ${role}. Étape pipeline : ${stage}.`,
      timestamp: '',
    },
  ];

  if (score >= 80) {
    messages.push({
      id: '2',
      sender: 'ai',
      text: `Lead chaud (score ${score}/100). Ce contact montre un fort engagement et un projet avancé. Priorité maximale : appeler dans les 24h pour convertir.`,
      timestamp: '',
    });
  } else if (score >= 50) {
    messages.push({
      id: '2',
      sender: 'ai',
      text: `Lead tiède (score ${score}/100). Intérêt confirmé mais qualification à approfondir. Recommandation : planifier un rendez-vous ou envoyer une relance personnalisée.`,
      timestamp: '',
    });
  } else {
    messages.push({
      id: '2',
      sender: 'ai',
      text: `Lead froid (score ${score}/100). Profil incomplet ou inactif. Recommandation : enrichir la fiche contact (téléphone, email) et planifier une prise de contact initiale.`,
      timestamp: '',
    });
  }

  if (!contact.phone) {
    messages.push({
      id: '3',
      sender: 'ai',
      text: `Point d'attention : numéro de téléphone manquant. Cela réduit le score et empêche le suivi direct.`,
      timestamp: '',
    });
  }

  if (!contact.email) {
    messages.push({
      id: String(messages.length + 1),
      sender: 'ai',
      text: `Point d'attention : email manquant. Impossible d'envoyer des relances automatiques.`,
      timestamp: '',
    });
  }

  return messages;
}

function InsightsBar({ insights }: { insights: Insight[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {insights.map((insight) => {
        const Icon = insight.icon;
        return (
          <div
            key={insight.label}
            className={`flex items-center gap-3 rounded-xl border p-3 ${insight.color}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider opacity-70">
                {insight.label}
              </p>
              <p className="text-sm font-semibold truncate">{insight.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChatBubble({ message, contactInitials }: { message: Message; contactInitials: string }) {
  const isAI = message.sender === 'ai';

  return (
    <div className={`flex gap-3 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
      <Avatar className="w-8 h-8 shrink-0 mt-0.5">
        <AvatarFallback
          className={
            isAI
              ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white text-xs font-bold'
              : 'bg-white/10 text-muted-foreground text-xs font-bold'
          }
        >
          {isAI ? <Bot className="w-4 h-4" /> : contactInitials}
        </AvatarFallback>
      </Avatar>

      <div className={`max-w-[80%] space-y-1 ${isAI ? '' : 'items-end'}`}>
        <div
          className={`
            rounded-2xl px-4 py-2.5 text-sm leading-relaxed
            ${
              isAI
                ? 'bg-gradient-to-br from-blue-500/15 to-purple-500/15 border border-blue-500/20 text-white rounded-tl-sm'
                : 'bg-white/10 border border-white/10 text-white/90 rounded-tr-sm'
            }
          `}
        >
          {message.text}
        </div>
        {message.timestamp && (
          <p
            className={`text-[10px] text-muted-foreground px-1 ${
              isAI ? 'text-left' : 'text-right'
            }`}
          >
            {isAI ? 'Agent Syna' : ''} {message.timestamp}
          </p>
        )}
      </div>
    </div>
  );
}

export function ContactAIConversation({ contact }: ContactAIConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const insights = useMemo(() => buildInsights(contact), [contact]);
  const messages = useMemo(() => buildConversation(contact), [contact]);

  const contactInitials = contact.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            Qualification IA
          </CardTitle>
          <Badge className="bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs">
            Agent Syna
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Key Insights — from real contact data */}
        <InsightsBar insights={insights} />

        {/* Conversation */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Analyse
          </p>
          <ScrollArea className="h-[360px] pr-3" ref={scrollRef}>
            <div className="space-y-4 pb-2">
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  contactInitials={contactInitials}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Read-only notice */}
        <p className="text-[11px] text-center text-muted-foreground/60 italic">
          Analyse en lecture seule — générée par l'IA de qualification
        </p>
      </CardContent>
    </Card>
  );
}
