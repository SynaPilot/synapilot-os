import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization, useProfile } from '@/hooks/useOrganization';
import { Skeleton } from '@/components/ui/skeleton';
import { Building2, User, Bell, Zap, Play } from 'lucide-react';
import { OnboardingProgress } from '@/components/OnboardingProgress';
import { useOnboarding } from '@/components/OnboardingTour';
import { motion } from 'framer-motion';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: organization, isLoading: orgLoading } = useOrganization();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { restartTour } = useOnboarding();

  return (
    <motion.div 
      className="space-y-6 max-w-2xl"
      initial="initial"
      animate="animate"
      variants={pageVariants}
      transition={{ duration: 0.3 }}
    >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Réglages</h1>
          <p className="text-muted-foreground">Gérez votre compte et votre organisation</p>
        </div>

        {/* Onboarding Progress Card */}
        <OnboardingProgress 
          onNavigate={(path) => navigate(path)} 
          onRestartTour={restartTour}
        />

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
                  <Label className="text-xs text-muted-foreground">Nom</Label>
                  <Input value={organization?.name || ''} disabled className="bg-secondary/50 font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Identifiant</Label>
                  <Input value={organization?.slug || ''} disabled className="bg-secondary/50 font-mono" />
                </div>
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
                  <Label className="text-xs text-muted-foreground">Nom</Label>
                  <Input value={profile?.full_name || ''} disabled className="bg-secondary/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={user?.email || ''} disabled className="bg-secondary/50 font-mono" />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4 text-primary" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Bientôt disponible.</p>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4 text-primary" />
              Intégrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">n8n Webhooks</p>
                <p className="text-xs text-muted-foreground">Automatisez vos workflows</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium text-sm">Twilio SMS</p>
                <p className="text-xs text-muted-foreground">Envoyez des SMS automatiques</p>
              </div>
            </div>
          </CardContent>
        </Card>
    </motion.div>
  );
}
