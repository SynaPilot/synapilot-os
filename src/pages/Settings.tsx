import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization, useProfile } from '@/hooks/useOrganization';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, User, Bell, Shield, Palette } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const { data: organization, isLoading: orgLoading } = useOrganization();
  const { data: profile, isLoading: profileLoading } = useProfile();

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-3xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Réglages</h1>
          <p className="text-muted-foreground">Gérez votre compte et votre organisation</p>
        </div>

        {/* Organization Settings */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Organisation
            </CardTitle>
            <CardDescription>Informations de votre agence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {orgLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="org-name">Nom de l'agence</Label>
                  <Input 
                    id="org-name" 
                    value={organization?.name || ''} 
                    disabled 
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-slug">Identifiant unique</Label>
                  <Input 
                    id="org-slug" 
                    value={organization?.slug || ''} 
                    disabled 
                    className="bg-muted/50"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Profile Settings */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Profil
            </CardTitle>
            <CardDescription>Vos informations personnelles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="full-name">Nom complet</Label>
                  <Input 
                    id="full-name" 
                    value={profile?.full_name || ''} 
                    disabled 
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    value={user?.email || ''} 
                    disabled 
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <Input 
                    value={(profile as any)?.user_roles?.[0]?.role || 'Agent'} 
                    disabled 
                    className="bg-muted/50"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>Gérez vos préférences de notification</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              La configuration des notifications sera disponible prochainement.
            </p>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card className="glass border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Intégrations
            </CardTitle>
            <CardDescription>Connectez vos outils externes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div>
                <p className="font-medium">n8n Webhooks</p>
                <p className="text-sm text-muted-foreground">Automatisez vos workflows</p>
              </div>
              <Button variant="outline" disabled>
                Configurer
              </Button>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
              <div>
                <p className="font-medium">Twilio SMS</p>
                <p className="text-sm text-muted-foreground">Envoyez des SMS automatiques</p>
              </div>
              <Button variant="outline" disabled>
                Configurer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
