import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, Plus, Search, Edit2, Trash2, Copy, 
  Eye, ArrowLeft, Save, Wand2, User, Building2, Calendar, Loader2, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { motion } from 'framer-motion';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  category: string;
  variables: string[];
  is_predefined: boolean;
  usage_count: number;
  created_at: string;
  organization_id: string;
  created_by: string | null;
}

const availableVariables = [
  { key: '{contact_prenom}', label: 'Prénom contact', icon: User },
  { key: '{contact_nom}', label: 'Nom contact', icon: User },
  { key: '{contact_civilite}', label: 'Civilité', icon: User },
  { key: '{agent_prenom}', label: 'Prénom agent', icon: User },
  { key: '{agent_nom}', label: 'Nom agent', icon: User },
  { key: '{bien_type}', label: 'Type de bien', icon: Building2 },
  { key: '{bien_adresse}', label: 'Adresse bien', icon: Building2 },
  { key: '{bien_prix}', label: 'Prix bien', icon: Building2 },
  { key: '{bien_surface}', label: 'Surface bien', icon: Building2 },
  { key: '{agence_nom}', label: 'Nom agence', icon: Building2 },
  { key: '{date_rdv}', label: 'Date RDV', icon: Calendar },
];

const categoryLabels: Record<string, string> = {
  all: 'Tous les templates',
  first_contact: 'Première prise de contact',
  followup: 'Relance',
  property_proposal: 'Proposition de biens',
  post_visit: 'Suivi post-visite',
  appointment: 'Confirmation RDV',
  newsletter: 'Newsletter',
  custom: 'Personnalisés',
};

export default function EmailsIA() {
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  
  // Form states
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateCategory, setTemplateCategory] = useState('custom');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch templates
  useEffect(() => {
    if (organizationId) {
      fetchTemplates();
    }
  }, [organizationId]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      toast.error('Erreur lors du chargement des templates');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       template.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchSearch && matchCategory;
  });

  // Generate with AI
  const handleGenerateAI = async () => {
    if (!templateName) {
      toast.error("Donnez d'abord un nom au template");
      return;
    }

    setIsGeneratingAI(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await supabase.functions.invoke('generate-email-template', {
        body: {
          template_name: templateName,
          category: templateCategory,
          context: templateContent || null
        }
      });
      
      if (res.error) throw new Error(res.error.message);
      
      const { subject, content } = res.data;
      
      setTemplateSubject(subject);
      setTemplateContent(content);
      
      toast.success('Template généré par IA ✨');
      
    } catch (err) {
      console.error('Generation error:', err);
      toast.error("Erreur lors de la génération IA");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Insert variable
  const insertVariable = (variable: string) => {
    setTemplateContent(prev => prev + ' ' + variable);
    toast.success('Variable insérée');
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!templateName || !templateSubject || !templateContent) {
      toast.error('Remplissez tous les champs obligatoires');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Extract used variables
      const usedVariables = availableVariables
        .filter(v => templateContent.includes(v.key))
        .map(v => v.key);

      if (editingTemplate) {
        // Update existing
        const { error } = await supabase
          .from('email_templates')
          .update({
            name: templateName,
            subject: templateSubject,
            content: templateContent,
            category: templateCategory,
            variables: usedVariables,
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template mis à jour ✅');
      } else {
        // Create new
        const { error } = await supabase.from('email_templates').insert({
          organization_id: organizationId,
          name: templateName,
          subject: templateSubject,
          content: templateContent,
          category: templateCategory,
          variables: usedVariables,
          is_predefined: false,
          usage_count: 0,
          created_by: user?.id
        });

        if (error) throw error;
        toast.success('Template créé ✅');
      }

      setShowCreateModal(false);
      resetForm();
      fetchTemplates();
      
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (template: EmailTemplate) => {
    if (template.is_predefined) {
      toast.error('Impossible de supprimer un template prédéfini');
      return;
    }

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;
      toast.success('Template supprimé');
      fetchTemplates();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Erreur lors de la suppression');
    }
  };

  // Duplicate template
  const handleDuplicateTemplate = async (template: EmailTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from('email_templates').insert({
        organization_id: organizationId,
        name: `${template.name} (copie)`,
        subject: template.subject,
        content: template.content,
        category: template.category,
        variables: template.variables,
        is_predefined: false,
        usage_count: 0,
        created_by: user?.id
      });

      if (error) throw error;
      toast.success('Template dupliqué');
      fetchTemplates();
    } catch (err) {
      console.error('Duplicate error:', err);
      toast.error('Erreur lors de la duplication');
    }
  };

  // Edit template
  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateSubject(template.subject);
    setTemplateContent(template.content);
    setTemplateCategory(template.category);
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setTemplateName('');
    setTemplateSubject('');
    setTemplateContent('');
    setTemplateCategory('custom');
    setEditingTemplate(null);
  };

  const getCategoryCount = (cat: string) => {
    if (cat === 'all') return templates.length;
    return templates.filter(t => t.category === cat).length;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/activities')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Emails IA</h1>
                <p className="text-sm text-muted-foreground">
                  Créez des templates intelligents et personnalisés
                </p>
              </div>
            </div>
          </div>
          
          <Button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau template
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 bg-card/50 border-border/50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un template..."
                className="pl-10 bg-background/50 border-border/50"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-64 bg-background/50 border-border/50">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label} ({getCategoryCount(value)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : filteredTemplates.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="p-4 bg-card/50 border-border/50 hover:border-purple-500/50 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{template.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{template.subject}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {template.is_predefined && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                          Prédéfini
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[template.category] || template.category}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {template.content.substring(0, 120)}...
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">
                      {template.usage_count} utilisation{template.usage_count !== 1 ? 's' : ''}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setShowPreviewModal(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDuplicateTemplate(template)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      {!template.is_predefined && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditTemplate(template)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteTemplate(template)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="p-12 bg-card/50 border-border/50 text-center">
            <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Aucun template trouvé
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Créez votre premier template d'email IA
            </p>
            <Button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="bg-gradient-to-r from-purple-500 to-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              Créer un template
            </Button>
          </Card>
        )}

        {/* Create/Edit Modal */}
        <Dialog open={showCreateModal} onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                {editingTemplate ? 'Modifier le template' : 'Créer un template d\'email'}
              </DialogTitle>
              <DialogDescription>
                Utilisez DeepSeek pour générer automatiquement le contenu
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="edit" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="edit">Édition</TabsTrigger>
                <TabsTrigger value="preview">Prévisualisation</TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-4 mt-4">
                {/* Name and Category */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nom du template *</label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Ex: Premier contact acheteur"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Catégorie</label>
                    <Select value={templateCategory} onValueChange={setTemplateCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first_contact">Première prise de contact</SelectItem>
                        <SelectItem value="followup">Relance</SelectItem>
                        <SelectItem value="property_proposal">Proposition de biens</SelectItem>
                        <SelectItem value="post_visit">Suivi post-visite</SelectItem>
                        <SelectItem value="appointment">Confirmation RDV</SelectItem>
                        <SelectItem value="newsletter">Newsletter</SelectItem>
                        <SelectItem value="custom">Personnalisé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* AI Generation */}
                <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-foreground">Génération IA</h4>
                      <p className="text-sm text-muted-foreground">
                        Laissez DeepSeek créer le template pour vous
                      </p>
                    </div>
                    <Button
                      onClick={handleGenerateAI}
                      disabled={isGeneratingAI || !templateName}
                      className="bg-gradient-to-r from-purple-500 to-blue-500"
                    >
                      {isGeneratingAI ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4 mr-2" />
                      )}
                      {isGeneratingAI ? 'Génération...' : 'Générer'}
                    </Button>
                  </div>
                </Card>

                {/* Subject */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Objet de l'email *</label>
                  <Input
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    placeholder="Ex: Nouvelle opportunité immobilière pour vous"
                  />
                </div>

                {/* Variables */}
                <Card className="p-4 bg-card/50 border-border/50">
                  <h4 className="font-medium text-foreground mb-3">Variables disponibles</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableVariables.map(variable => (
                      <Button
                        key={variable.key}
                        variant="outline"
                        size="sm"
                        onClick={() => insertVariable(variable.key)}
                        className="justify-start text-xs h-8"
                      >
                        <variable.icon className="w-3 h-3 mr-2 flex-shrink-0" />
                        <span className="truncate">{variable.label}</span>
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Cliquez pour insérer une variable dans votre email
                  </p>
                </Card>

                {/* Content */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Contenu de l'email *</label>
                  <Textarea
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    placeholder={`Bonjour {contact_civilite} {contact_nom},

Je me permets de vous contacter...

Cordialement,
{agent_prenom} {agent_nom}`}
                    rows={12}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Utilisez les variables pour personnaliser automatiquement vos emails
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <Card className="p-6 bg-card/50 border-border/50">
                  <div className="mb-4 pb-4 border-b border-border/50">
                    <p className="text-sm text-muted-foreground mb-1">Objet :</p>
                    <p className="font-medium text-foreground">
                      {templateSubject || 'Aucun objet défini'}
                    </p>
                  </div>
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 bg-transparent p-0 border-0">
                      {templateContent || 'Aucun contenu défini'}
                    </pre>
                  </div>
                  {availableVariables.some(v => templateContent.includes(v.key)) && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs text-purple-400 mb-2">
                        Variables détectées :
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {availableVariables
                          .filter(v => templateContent.includes(v.key))
                          .map(v => (
                            <Badge 
                              key={v.key}
                              variant="outline"
                              className="bg-purple-500/10 text-purple-400 border-purple-500/20"
                            >
                              {v.label}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                </Card>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSaveTemplate}
                disabled={!templateName || !templateSubject || !templateContent || isSaving}
                className="bg-gradient-to-r from-purple-500 to-blue-500"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {editingTemplate ? 'Mettre à jour' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Modal */}
        <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedTemplate?.name}</DialogTitle>
              <DialogDescription>
                Prévisualisation du template
              </DialogDescription>
            </DialogHeader>

            {selectedTemplate && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-card/50 border border-border/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Objet :</p>
                  <p className="font-medium text-foreground">{selectedTemplate.subject}</p>
                </div>
                <div className="p-4 bg-card/50 border border-border/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Contenu :</p>
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90">
                    {selectedTemplate.content}
                  </pre>
                </div>
                {selectedTemplate.variables.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">Variables :</span>
                    {selectedTemplate.variables.map(v => (
                      <Badge key={v} variant="outline" className="text-xs">
                        {v}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowPreviewModal(false)}>
                Fermer
              </Button>
              {selectedTemplate && (
                <Button
                  onClick={() => {
                    handleDuplicateTemplate(selectedTemplate);
                    setShowPreviewModal(false);
                  }}
                  className="bg-gradient-to-r from-purple-500 to-blue-500"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Dupliquer
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
