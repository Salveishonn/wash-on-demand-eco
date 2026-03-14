import { useState } from 'react';
import { LucideIcon, Calendar, Bell, Shield, Users, Clock, DollarSign, MessageCircle, CalendarDays, ChevronDown, Menu, MoreHorizontal, Settings, Tag, FileText, Sparkles, Mail, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export type AdminTabType = 'bookings' | 'notifications' | 'kipper' | 'subscriptions' | 'calendario' | 'finanzas' | 'facturas' | 'mensajes' | 'disponibilidad' | 'whatsapp-config' | 'pricing' | 'early-access' | 'contacts' | 'demand-map';

interface AdminSection {
  key: AdminTabType;
  label: string;
  icon: LucideIcon;
  group: 'ops' | 'crm' | 'config';
}

const adminSectionGroups = {
  ops: { label: 'Operaciones', color: 'text-primary' },
  crm: { label: 'CRM & Ventas', color: 'text-blue-600' },
  config: { label: 'Configuración', color: 'text-muted-foreground' },
};

export const adminSections: AdminSection[] = [
  // Operations
  { key: 'bookings', label: 'Reservas', icon: Calendar, group: 'ops' },
  { key: 'calendario', label: 'Calendario', icon: CalendarDays, group: 'ops' },
  { key: 'mensajes', label: 'Mensajes', icon: MessageCircle, group: 'ops' },
  { key: 'disponibilidad', label: 'Disponibilidad', icon: Clock, group: 'ops' },
  // CRM & Ventas — includes Finanzas and Mapa Demanda now
  { key: 'subscriptions', label: 'Suscripciones', icon: Users, group: 'crm' },
  { key: 'contacts', label: 'Contactos', icon: Mail, group: 'crm' },
  { key: 'early-access', label: 'Early Access', icon: Sparkles, group: 'crm' },
  { key: 'kipper', label: 'Leads Kipper', icon: Shield, group: 'crm' },
  { key: 'finanzas', label: 'Finanzas', icon: DollarSign, group: 'crm' },
  { key: 'demand-map', label: 'Mapa Demanda', icon: Map, group: 'crm' },
  // Config
  { key: 'facturas', label: 'Facturas', icon: FileText, group: 'config' },
  { key: 'pricing', label: 'Precios', icon: Tag, group: 'config' },
  { key: 'notifications', label: 'Notificaciones', icon: Bell, group: 'config' },
  { key: 'whatsapp-config', label: 'WhatsApp Config', icon: Settings, group: 'config' },
];

interface AdminNavProps {
  activeTab: AdminTabType;
  onTabChange: (tab: AdminTabType) => void;
}

export function AdminNav({ activeTab, onTabChange }: AdminNavProps) {
  const isMobile = useIsMobile();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const currentSection = adminSections.find(s => s.key === activeTab) || adminSections[0];
  const CurrentIcon = currentSection.icon;

  const handleSelectTab = (tab: AdminTabType) => {
    onTabChange(tab);
    setIsDrawerOpen(false);
  };

  // Primary tabs always visible on desktop
  const primaryTabs: AdminTabType[] = ['bookings', 'calendario', 'mensajes', 'disponibilidad', 'subscriptions'];
  const secondaryTabs = adminSections.filter(s => !primaryTabs.includes(s.key));
  const primarySections = adminSections.filter(s => primaryTabs.includes(s.key));
  const isSecondaryActive = secondaryTabs.some(s => s.key === activeTab);

  // Mobile: full-width dropdown + drawer
  if (isMobile) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="flex-1 justify-between h-12 bg-background border-border"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <CurrentIcon className="w-4 h-4 text-primary" />
                </div>
                <span className="font-semibold text-sm">{currentSection.label}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-[calc(100vw-2rem)] max-w-sm max-h-[70vh] overflow-y-auto bg-background border border-border z-50"
          >
            {(['ops', 'crm', 'config'] as const).map((group) => (
              <div key={group}>
                <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-3 py-1.5">
                  {adminSectionGroups[group].label}
                </DropdownMenuLabel>
                {adminSections.filter(s => s.group === group).map((section) => {
                  const Icon = section.icon;
                  const isActive = section.key === activeTab;
                  return (
                    <DropdownMenuItem
                      key={section.key}
                      onClick={() => handleSelectTab(section.key)}
                      className={cn(
                        "flex items-center gap-3 py-3 px-3 cursor-pointer rounded-md mx-1",
                        isActive && "bg-primary/10 text-primary font-semibold"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-sm">{section.label}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
                {group !== 'config' && <DropdownMenuSeparator />}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 h-12 w-12">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col h-full">
            <SheetHeader className="p-4 border-b bg-muted/30 shrink-0">
              <SheetTitle className="text-left flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <span className="font-display">Panel Admin</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1 -webkit-overflow-scrolling-touch">
              {(['ops', 'crm', 'config'] as const).map((group) => (
                <div key={group} className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-2">
                    {adminSectionGroups[group].label}
                  </p>
                  {adminSections.filter(s => s.group === group).map((section) => {
                    const Icon = section.icon;
                    const isActive = section.key === activeTab;
                    return (
                      <button
                        key={section.key}
                        onClick={() => handleSelectTab(section.key)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-all text-sm",
                          isActive 
                            ? "bg-primary text-primary-foreground font-semibold shadow-sm" 
                            : "hover:bg-muted/60 text-foreground active:bg-muted"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{section.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {/* Bottom padding for safe area */}
              <div className="h-8" />
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop: Horizontal tabs with grouped overflow
  return (
    <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-none">
      {primarySections.map((section) => {
        const Icon = section.icon;
        const isActive = section.key === activeTab;
        
        return (
          <Button
            key={section.key}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onTabChange(section.key)}
            className={cn(
              "gap-2 transition-all shrink-0 h-9",
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm font-semibold" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{section.label}</span>
          </Button>
        );
      })}

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-1 shrink-0" />

      {/* Overflow dropdown for secondary items */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={isSecondaryActive ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              "gap-2 shrink-0 h-9",
              isSecondaryActive 
                ? "bg-primary text-primary-foreground shadow-sm font-semibold" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            {isSecondaryActive ? (
              <>
                {(() => { const S = adminSections.find(s => s.key === activeTab); return S ? <S.icon className="w-4 h-4" /> : null; })()}
                <span>{adminSections.find(s => s.key === activeTab)?.label}</span>
              </>
            ) : (
              <>
                <MoreHorizontal className="w-4 h-4" />
                <span>Más</span>
              </>
            )}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-background border border-border z-50">
          {(['crm', 'config'] as const).map((group) => {
            const groupItems = secondaryTabs.filter(s => s.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group}>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {adminSectionGroups[group].label}
                </DropdownMenuLabel>
                {groupItems.map((section) => {
                  const Icon = section.icon;
                  const isActive = section.key === activeTab;
                  return (
                    <DropdownMenuItem
                      key={section.key}
                      onClick={() => onTabChange(section.key)}
                      className={cn(
                        "flex items-center gap-3 py-2 cursor-pointer",
                        isActive && "bg-primary/10 text-primary font-semibold"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-sm">{section.label}</span>
                      {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                    </DropdownMenuItem>
                  );
                })}
                {group !== 'config' && <DropdownMenuSeparator />}
              </div>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
