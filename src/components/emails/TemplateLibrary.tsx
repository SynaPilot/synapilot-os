import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Eye, 
  ArrowRight, 
  Sparkles,
  Copy,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  PREDEFINED_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_CATEGORY_LABELS,
  EMAIL_TEMPLATE_CATEGORY_ICONS,
  type EmailTemplate,
  type EmailTemplateCategory,
} from '@/lib/email-templates';

interface TemplateLibraryProps {
  onSelectTemplate: (template: EmailTemplate) => void;
}

export function TemplateLibrary({ onSelectTemplate }: TemplateLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EmailTemplateCategory | 'all'>('all');
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories: (EmailTemplateCategory | 'all')[] = [
    'all',
    'onboarding',
    'followup',
    'mandate',
    'visit',
    'offer',
    'nurture',
  ];

  const filteredTemplates = useMemo(() => {
    return PREDEFINED_EMAIL_TEMPLATES.filter(template => {
      const matchesSearch = 
        template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const handleUseTemplate = (template: EmailTemplate) => {
    onSelectTemplate(template);
    toast.success(`Template "${template.title}" sélectionné`);
  };

  const handleCopyBody = (template: EmailTemplate) => {
    navigator.clipboard.writeText(template.body);
    setCopiedId(template.id);
    toast.success('Contenu copié !');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryCount = (cat: EmailTemplateCategory | 'all') => {
    if (cat === 'all') return PREDEFINED_EMAIL_TEMPLATES.length;
    return PREDEFINED_EMAIL_TEMPLATES.filter(t => t.category === cat).length;
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un template..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>
        <Select 
          value={selectedCategory} 
          onValueChange={(val) => setSelectedCategory(val as EmailTemplateCategory | 'all')}
        >
          <SelectTrigger className="w-[220px] bg-card border-border">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat === 'all' ? '📋 ' : EMAIL_TEMPLATE_CATEGORY_ICONS[cat] + ' '}
                {cat === 'all' ? 'Tous les templates' : EMAIL_TEMPLATE_CATEGORY_LABELS[cat]}
                {' '}({getCategoryCount(cat)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Category Tabs (Mobile) */}
      <Tabs 
        value={selectedCategory} 
        onValueChange={(val) => setSelectedCategory(val as EmailTemplateCategory | 'all')}
        className="sm:hidden"
      >
        <TabsList className="w-full flex overflow-x-auto">
          <TabsTrigger value="all" className="text-xs">Tous</TabsTrigger>
          {(Object.keys(EMAIL_TEMPLATE_CATEGORY_LABELS) as EmailTemplateCategory[]).map((cat) => (
            <TabsTrigger key={cat} value={cat} className="text-xs">
              {EMAIL_TEMPLATE_CATEGORY_ICONS[cat]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Templates Grid */}
      <AnimatePresence mode="popLayout">
        {filteredTemplates.length > 0 ? (
          <motion.div 
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            layout
          >
            {filteredTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full bg-card/50 border-border/50 hover:border-purple-500/50 transition-all group overflow-hidden">
                  <CardContent className="p-4 h-full flex flex-col">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{template.emoji}</span>
                        <div>
                          <h3 className="font-semibold text-foreground text-sm line-clamp-1">
                            {template.title}
                          </h3>
                          <Badge 
                            variant="outline" 
                            className="text-[10px] mt-1 bg-muted/50"
                          >
                            {EMAIL_TEMPLATE_CATEGORY_LABELS[template.category]}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground mb-3">
                      {template.description}
                    </p>

                    {/* Subject Preview */}
                    <div className="flex-1 mb-3">
                      <p className="text-xs text-muted-foreground mb-1">Objet :</p>
                      <p className="text-sm text-foreground/80 line-clamp-2 font-mono bg-muted/30 p-2 rounded">
                        {template.subject}
                      </p>
                    </div>

                    {/* Variables */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.variables.slice(0, 3).map((v) => (
                        <Badge 
                          key={v} 
                          variant="outline" 
                          className="text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20"
                        >
                          {`{${v}}`}
                        </Badge>
                      ))}
                      {template.variables.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{template.variables.length - 3}
                        </Badge>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        onClick={() => setPreviewTemplate(template)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        Aperçu
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleCopyBody(template)}
                      >
                        {copiedId === template.id ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                        onClick={() => handleUseTemplate(template)}
                      >
                        Utiliser
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Aucun template trouvé
            </h3>
            <p className="text-sm text-muted-foreground">
              Essayez une autre recherche ou catégorie
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">{previewTemplate?.emoji}</span>
              {previewTemplate?.title}
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.description}
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-4 mt-4">
              {/* Category Badge */}
              <Badge variant="outline" className="bg-muted/50">
                {EMAIL_TEMPLATE_CATEGORY_ICONS[previewTemplate.category]}{' '}
                {EMAIL_TEMPLATE_CATEGORY_LABELS[previewTemplate.category]}
              </Badge>

              {/* Subject */}
              <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-xs text-muted-foreground mb-1">Objet :</p>
                <p className="font-medium text-foreground">{previewTemplate.subject}</p>
              </div>

              {/* Body */}
              <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Contenu :</p>
                <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed">
                  {previewTemplate.body}
                </pre>
              </div>

              {/* Variables */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Variables utilisées :</p>
                <div className="flex flex-wrap gap-2">
                  {previewTemplate.variables.map((v) => (
                    <Badge 
                      key={v} 
                      variant="outline" 
                      className="bg-purple-500/10 text-purple-400 border-purple-500/20"
                    >
                      {`{${v}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="ghost" onClick={() => setPreviewTemplate(null)}>
              Fermer
            </Button>
            <Button
              onClick={() => {
                if (previewTemplate) {
                  handleUseTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }
              }}
              className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Utiliser ce template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
