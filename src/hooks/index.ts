// Entity hooks - centralized exports
export { useContacts, useContact, type Contact, type ContactInsert, type ContactUpdate } from './useContacts';
export { useProperties, useProperty, type Property, type PropertyInsert, type PropertyUpdate } from './useProperties';
export { useActivities, useActivity, type Activity, type ActivityInsert, type ActivityUpdate } from './useActivities';
export { useDeals, useDeal, type Deal, type DealInsert, type DealUpdate } from './useDeals';

// Query hooks
export { useOrgQuery, useOrganizationId } from './useOrgQuery';
export { useOrganization } from './useOrganization';

// UI hooks
export { useIsMobile } from './use-mobile';
export { useToast, toast } from './use-toast';
export { useKonamiCode } from './useKonamiCode';
export { usePerformanceMonitor } from './usePerformanceMonitor';
