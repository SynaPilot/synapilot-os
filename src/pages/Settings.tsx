import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/hooks/useRole';
import { useOrganization, useProfile } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, User, Bell, Zap, Users, UserPlus, KeyRound, Copy, Loader2, Send, Save, Eye, EyeOff, Pencil } from 'lucide-react';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { useOnboarding } from '@/components/OnboardingTour';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import type { Database, Json } from '@/integrations/supabase/types';
import type { OrgSettings, ProfileSettings, NotificationSettings } from '@/types/settings';

type AppRole = Database['public']['Enums']['app_role'];

interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  user_roles: { role: AppRole }[];
}

interface ActivationKey {
  id: string;
  key: string;
  is_used: boolean;
  used_by: string | null;
  expires_at: string | null;
  created_at: string;
}

const ROLE_BADGE_VARIANT: Record<AppRole, 'destructive' | 'warning' | 'default' | 'secondary'> = {
  admin: 'destructive',
  manager: 'warning',
  agent: 'default',
  viewer: 'secondary',
};

const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  agent: 'Agent',
  viewer: 'Lecteur',
};

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function generateActivationKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ==================== TEAM MEMBERS SECTION ====================
function TeamMembersSection({ organizationId, isAdmin }: { organizationId: string; isAdmin: boolean }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, full_name, email, avatar_url, user_roles!inner(role)')
        .eq('organization_id', organizationId);

      if (error) {
        toast.error('Erreur lors du chargement des membres');
        console.error(error);
        return;
      }

      setMembers((data as unknown as TeamMember[]) || []);
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    setUpdatingRole(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId)
        .eq('organization_id', organizationId);

      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }

      toast.success('Role mis a jour');
      await fetchMembers();
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setUpdatingRole(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {members.map((member) => {
        const memberRole = member.user_roles?.[0]?.role ?? 'agent';
        return (
          <div
            key={member.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {getInitials(member.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{member.full_name || 'Sans nom'}</p>
              <p className="text-xs text-muted-foreground truncate">{member.email}</p>
            </div>
            {isAdmin ? (
              <Select
                value={memberRole}
                onValueChange={(val) => handleRoleChange(member.user_id, val as AppRole)}
                disabled={updatingRole === member.user_id}
              >
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="viewer">Lecteur</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge variant={ROLE_BADGE_VARIANT[memberRole]}>
                {ROLE_LABELS[memberRole]}
              </Badge>
            )}
          </div>
        );
      })}
      {members.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Aucun membre trouve.</p>
      )}
    </div>
  );
}

// ==================== INVITE SECTION ====================
function InviteAgentSection({ organizationId }: { organizationId: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'agent' | 'manager'>('agent');
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error('Veuillez entrer un email');
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée, veuillez vous reconnecter');
        return;
      }

      const { data, error } = await supabase.functions.invoke('invite-agent', {
        body: { email: email.trim(), organization_id: organizationId, role },
      });

      if (error) {
        toast.error(error.message || 'Erreur lors de l\'envoi');
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(data?.message || `Invitation envoyee a ${email}`);
      setEmail('');
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          type="email"
          placeholder="email@agence.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <Select value={role} onValueChange={(val) => setRole(val as 'agent' | 'manager')}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleInvite} disabled={sending} className="shrink-0">
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Envoyer
        </Button>
      </div>
    </div>
  );
}

// ==================== ACTIVATION KEYS SECTION ====================
function ActivationKeysSection() {
  const [keys, setKeys] = useState<ActivationKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('activation_keys')
        .select('id, key, is_used, used_by, expires_at, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Erreur lors du chargement des cles');
        console.error(error);
        return;
      }

      setKeys(data || []);
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const newKey = generateActivationKey();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase
        .from('activation_keys')
        .insert({
          key: newKey,
          is_used: false,
          expires_at: expiresAt.toISOString(),
        });

      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }

      toast.success('Cle generee avec succes');
      await fetchKeys();
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success('Cle copiee !');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button onClick={handleGenerate} disabled={generating} variant="outline" size="sm">
        {generating ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <KeyRound className="w-4 h-4 mr-2" />
        )}
        Generer une cle
      </Button>

      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Aucune cle d'activation.</p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => {
            const isExpired = k.expires_at ? new Date(k.expires_at) < new Date() : false;
            return (
              <div
                key={k.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
              >
                <code className="font-mono text-sm flex-1 truncate">
                  {k.key}
                </code>
                {k.is_used ? (
                  <Badge variant="secondary">Utilisee</Badge>
                ) : isExpired ? (
                  <Badge variant="destructive">Expiree</Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                )}
                {k.expires_at && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Expire : {new Date(k.expires_at).toLocaleDateString('fr-FR')}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={() => handleCopy(k.key)}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== MAIN SETTINGS PAGE ====================
export default function Settings() {
  const { user, organizationId, profileId } = useAuth();
  const { canManageTeam, isAdmin } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: organization, isLoading: orgLoading } = useOrganization();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { restartTour } = useOnboarding();

  // Editable profile state
  const [profileName, setProfileName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Editable org state
  const [orgName, setOrgName] = useState('');
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // n8n integration state
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');
  const [n8nEnabled, setN8nEnabled] = useState(false);
  const [isSavingN8n, setIsSavingN8n] = useState(false);
  const [isTestingN8n, setIsTestingN8n] = useState(false);

  // Twilio integration state
  const [twilioSid, setTwilioSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioAuthTokenSaved, setTwilioAuthTokenSaved] = useState(false);
  const [twilioAuthTokenEditMode, setTwilioAuthTokenEditMode] = useState(false);
  const [twilioAuthTokenVisible, setTwilioAuthTokenVisible] = useState(false);
  const [twilioFromNumber, setTwilioFromNumber] = useState('');
  const [twilioEnabled, setTwilioEnabled] = useState(false);
  const [isSavingTwilio, setIsSavingTwilio] = useState(false);

  // Notification settings state
  const defaultNotifs: NotificationSettings = {
    email_followup_reminder: true,
    email_new_lead: true,
    in_app_deal_update: true,
    daily_brief: true,
  };
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(defaultNotifs);

  // Initialise local state from query data once loaded
  useEffect(() => {
    if (profile?.full_name) setProfileName(profile.full_name);
  }, [profile?.full_name]);

  useEffect(() => {
    if (organization?.name) setOrgName(organization.name);
  }, [organization?.name]);

  useEffect(() => {
    if (!organization) return;
    const s = organization.settings as unknown as OrgSettings | null;
    const n8n = s?.integrations?.n8n;
    if (n8n) {
      setN8nWebhookUrl(n8n.webhook_url || '');
      setN8nEnabled(n8n.enabled ?? false);
    }
    const twilio = s?.integrations?.twilio;
    if (twilio) {
      setTwilioSid(twilio.account_sid || '');
      setTwilioAuthTokenSaved(!!twilio.auth_token);
      setTwilioFromNumber(twilio.from_number || '');
      setTwilioEnabled(twilio.enabled ?? false);
    }
  }, [organization]);

  useEffect(() => {
    if (!profile) return;
    const s = profile.settings as unknown as ProfileSettings | null;
    const notifs = s?.notifications;
    if (notifs) {
      setNotifSettings({
        email_followup_reminder: notifs.email_followup_reminder ?? true,
        email_new_lead: notifs.email_new_lead ?? true,
        in_app_deal_update: notifs.in_app_deal_update ?? true,
        daily_brief: notifs.daily_brief ?? true,
      });
    }
  }, [profile]);

  const handleTestN8n = async () => {
    if (!n8nWebhookUrl.trim()) {
      toast.error('Veuillez entrer une URL de webhook');
      return;
    }
    setIsTestingN8n(true);
    try {
      const response = await fetch(n8nWebhookUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', source: 'synapilot' }),
      });
      if (response.ok) {
        toast.success('Connexion réussie ✅');
      } else {
        toast.error('Erreur de connexion ❌');
      }
    } catch {
      toast.error('Erreur de connexion ❌');
    } finally {
      setIsTestingN8n(false);
    }
  };

  const handleSaveN8n = async () => {
    if (!organizationId) return;
    setIsSavingN8n(true);
    try {
      const current = organization?.settings as unknown as OrgSettings | null;
      const newSettings: OrgSettings = {
        ...current,
        integrations: {
          ...current?.integrations,
          n8n: { webhook_url: n8nWebhookUrl.trim(), enabled: n8nEnabled },
        },
      };
      const { error } = await supabase
        .from('organizations')
        .update({ settings: newSettings as unknown as Json })
        .eq('id', organizationId);
      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }
      toast.success('Intégration n8n sauvegardée');
      queryClient.invalidateQueries({ queryKey: ['organization', user?.id] });
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setIsSavingN8n(false);
    }
  };

  const handleSaveTwilio = async () => {
    if (!organizationId) return;
    setIsSavingTwilio(true);
    try {
      const current = organization?.settings as unknown as OrgSettings | null;
      const existingToken = current?.integrations?.twilio?.auth_token ?? '';
      const tokenToSave = twilioAuthTokenEditMode && twilioAuthToken.trim()
        ? twilioAuthToken.trim()
        : existingToken;
      const newSettings: OrgSettings = {
        ...current,
        integrations: {
          ...current?.integrations,
          twilio: {
            account_sid: twilioSid.trim(),
            auth_token: tokenToSave,
            from_number: twilioFromNumber.trim(),
            enabled: twilioEnabled,
          },
        },
      };
      const { error } = await supabase
        .from('organizations')
        .update({ settings: newSettings as unknown as Json })
        .eq('id', organizationId);
      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }
      toast.success('Intégration Twilio sauvegardée');
      setTwilioAuthTokenSaved(!!tokenToSave);
      setTwilioAuthToken('');
      setTwilioAuthTokenEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['organization', user?.id] });
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setIsSavingTwilio(false);
    }
  };

  const handleToggleNotification = async (key: keyof NotificationSettings, value: boolean) => {
    if (!profileId) return;
    const updated = { ...notifSettings, [key]: value };
    setNotifSettings(updated);
    const current = profile?.settings as unknown as ProfileSettings | null;
    const newProfileSettings: ProfileSettings = {
      ...current,
      notifications: updated,
    };
    const { error } = await supabase
      .from('profiles')
      .update({ settings: newProfileSettings as unknown as Json })
      .eq('id', profileId);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      setNotifSettings(prev => ({ ...prev, [key]: !value }));
    } else {
      toast.success('Sauvegardé');
    }
  };

  const handleSaveProfile = async () => {
    if (!profileId) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: profileName.trim() })
        .eq('id', profileId);

      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }
      toast.success('Profil mis à jour');
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveOrg = async () => {
    if (!organizationId) return;
    setIsSavingOrg(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: orgName.trim() })
        .eq('id', organizationId);

      if (error) {
        toast.error(`Erreur : ${error.message}`);
        return;
      }
      toast.success('Organisation mise à jour');
      queryClient.invalidateQueries({ queryKey: ['organization', user?.id] });
    } catch {
      toast.error('Erreur inattendue');
    } finally {
      setIsSavingOrg(false);
    }
  };

  return (
    <motion.div
      className="space-y-6 max-w-2xl"
      initial="initial"
      animate="animate"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
    >
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Reglages</h1>
        <p className="text-muted-foreground">Gerez votre compte et votre organisation</p>
      </div>

      <OnboardingProgress
        onNavigate={(path) => navigate(path)}
        onRestartTour={restartTour}
      />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="general">General</TabsTrigger>
          {canManageTeam && <TabsTrigger value="team">Equipe</TabsTrigger>}
        </TabsList>

        {/* ====== GENERAL TAB ====== */}
        <TabsContent value="general" className="space-y-6">
          <Card className="glass">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="w-4 h-4 text-primary" />
                Organisation
              </CardTitle>
              <CardDescription>Informations de votre agence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {orgLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Nom de l'agence</Label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Nom de votre agence"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Identifiant (slug)</Label>
                    <Input value={organization?.slug || ''} disabled className="bg-secondary/50 font-mono text-xs" />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveOrg}
                    disabled={isSavingOrg || !orgName.trim()}
                  >
                    {isSavingOrg ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                    ) : (
                      <Save className="w-3.5 h-3.5 mr-2" />
                    )}
                    Enregistrer
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="w-4 h-4 text-primary" />
                Profil
              </CardTitle>
              <CardDescription>Vos informations personnelles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Nom complet</Label>
                    <Input
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="Votre nom"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <Input value={user?.email || ''} disabled className="bg-secondary/50 font-mono text-xs" />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile || !profileName.trim()}
                  >
                    {isSavingProfile ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                    ) : (
                      <Save className="w-3.5 h-3.5 mr-2" />
                    )}
                    Enregistrer
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* ====== NOTIFICATIONS CARD ====== */}
          <Card className="glass">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="w-4 h-4 text-primary" />
                Notifications
              </CardTitle>
              <CardDescription>Gérez vos préférences de notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <>
                  {([
                    {
                      key: 'email_followup_reminder' as const,
                      label: 'Rappels de relance par email',
                      description: 'Recevez un rappel quand un contact n\'a pas été relancé',
                    },
                    {
                      key: 'email_new_lead' as const,
                      label: 'Nouveau lead assigné',
                      description: 'Soyez notifié lorsqu\'un lead vous est assigné',
                    },
                    {
                      key: 'in_app_deal_update' as const,
                      label: 'Mises à jour des deals',
                      description: 'Notifications en temps réel sur l\'avancement des deals',
                    },
                    {
                      key: 'daily_brief' as const,
                      label: 'Brief quotidien IA',
                      description: 'Résumé intelligent de votre journée chaque matin',
                    },
                  ] as const).map(({ key, label, description }) => (
                    <div key={key} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                      <Switch
                        checked={notifSettings[key]}
                        onCheckedChange={(v) => handleToggleNotification(key, v)}
                      />
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          {/* ====== INTEGRATIONS CARD ====== */}
          <Card className="glass">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="w-4 h-4 text-primary" />
                Intégrations
              </CardTitle>
              <CardDescription>Connectez vos outils externes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {orgLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
                </div>
              ) : (
                <>
                  {/* n8n */}
                  <div className="space-y-4 p-4 rounded-lg border bg-secondary/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">n8n Webhooks</p>
                        <p className="text-xs text-muted-foreground">Automatisez vos workflows</p>
                      </div>
                      <Switch
                        checked={n8nEnabled}
                        onCheckedChange={setN8nEnabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">URL du Webhook n8n</Label>
                      <Input
                        value={n8nWebhookUrl}
                        onChange={(e) => setN8nWebhookUrl(e.target.value)}
                        placeholder="https://your-instance.n8n.cloud/webhook/..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleTestN8n}
                        disabled={isTestingN8n || !n8nWebhookUrl.trim()}
                      >
                        {isTestingN8n ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                        Tester la connexion
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveN8n}
                        disabled={isSavingN8n}
                      >
                        {isSavingN8n ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                        ) : (
                          <Save className="w-3.5 h-3.5 mr-2" />
                        )}
                        Enregistrer
                      </Button>
                    </div>
                  </div>

                  {/* Twilio */}
                  <div className="space-y-4 p-4 rounded-lg border bg-secondary/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Twilio SMS</p>
                        <p className="text-xs text-muted-foreground">Envoyez des SMS automatiques</p>
                      </div>
                      <Switch
                        checked={twilioEnabled}
                        onCheckedChange={setTwilioEnabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Account SID</Label>
                      <Input
                        value={twilioSid}
                        onChange={(e) => setTwilioSid(e.target.value)}
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Auth Token</Label>
                      {twilioAuthTokenSaved && !twilioAuthTokenEditMode ? (
                        <div className="flex gap-2">
                          <Input
                            value="••••••••••••••••"
                            disabled
                            className="bg-secondary/50 font-mono text-xs flex-1"
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="shrink-0 h-9 w-9"
                            onClick={() => { setTwilioAuthTokenEditMode(true); setTwilioAuthToken(''); }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Input
                            type={twilioAuthTokenVisible ? 'text' : 'password'}
                            value={twilioAuthToken}
                            onChange={(e) => setTwilioAuthToken(e.target.value)}
                            placeholder="Votre Auth Token Twilio"
                            className="pr-10"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setTwilioAuthTokenVisible((v) => !v)}
                          >
                            {twilioAuthTokenVisible
                              ? <EyeOff className="w-3.5 h-3.5" />
                              : <Eye className="w-3.5 h-3.5" />
                            }
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Numéro expéditeur</Label>
                      <Input
                        value={twilioFromNumber}
                        onChange={(e) => setTwilioFromNumber(e.target.value)}
                        placeholder="+33XXXXXXXXX"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveTwilio}
                      disabled={isSavingTwilio}
                    >
                      {isSavingTwilio ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                      ) : (
                        <Save className="w-3.5 h-3.5 mr-2" />
                      )}
                      Enregistrer
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== TEAM TAB ====== */}
        {canManageTeam && (
          <TabsContent value="team" className="space-y-6">
            {/* Members */}
            <Card className="glass">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-4 h-4 text-primary" />
                  Membres
                </CardTitle>
                <CardDescription>Membres de votre organisation</CardDescription>
              </CardHeader>
              <CardContent>
                {organizationId ? (
                  <TeamMembersSection organizationId={organizationId} isAdmin={isAdmin} />
                ) : (
                  <Skeleton className="h-16 w-full" />
                )}
              </CardContent>
            </Card>

            {/* Invite — admin only */}
            {isAdmin && (
              <Card className="glass">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserPlus className="w-4 h-4 text-primary" />
                    Inviter un agent
                  </CardTitle>
                  <CardDescription>Envoyez une invitation par email</CardDescription>
                </CardHeader>
                <CardContent>
                  {organizationId ? (
                    <InviteAgentSection organizationId={organizationId} />
                  ) : (
                    <Skeleton className="h-10 w-full" />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Activation Keys — admin only */}
            {isAdmin && (
              <Card className="glass">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <KeyRound className="w-4 h-4 text-primary" />
                    Cles d'activation
                  </CardTitle>
                  <CardDescription>Gerez les cles d'acces a la plateforme</CardDescription>
                </CardHeader>
                <CardContent>
                  <ActivationKeysSection />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </motion.div>
  );
}
