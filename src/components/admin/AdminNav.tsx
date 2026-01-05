import { useState } from 'react';
import { LucideIcon, Calendar, Bell, Shield, Users, Clock, DollarSign, MessageCircle, CalendarDays, ChevronDown, Menu, MoreHorizontal, Settings, Tag, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

export type AdminTabType = 'bookings' | 'notifications' | 'kipper' | 'subscriptions' | 'calendario' | 'finanzas' | 'facturas' | 'mensajes' | 'disponibilidad' | 'whatsapp-config' | 'pricing';

interface AdminSection {
  key: AdminTabType;
  label: string;
  icon: LucideIcon;
  activeClass?: string;
}

export const adminSections: AdminSection[] = [
  { key: 'bookings', label: 'Reservas', icon: Calendar },
  { key: 'notifications', label: 'Notificaciones', icon: Bell },
  { key: 'kipper', label: 'Leads Kipper', icon: Shield, activeClass: 'bg-[#8B1E2F] hover:bg-[#6B1726] text-white' },
  { key: 'subscriptions', label: 'Suscripciones', icon: Users },
  { key: 'calendario', label: 'Calendario', icon: CalendarDays },
  { key: 'finanzas', label: 'Finanzas', icon: DollarSign, activeClass: 'bg-green-600 hover:bg-green-700 text-white' },
  { key: 'facturas', label: 'Facturas', icon: FileText, activeClass: 'bg-blue-600 hover:bg-blue-700 text-white' },
  { key: 'pricing', label: 'Precios', icon: Tag, activeClass: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  { key: 'mensajes', label: 'Mensajes', icon: MessageCircle, activeClass: 'bg-green-600 hover:bg-green-700 text-white' },
  { key: 'disponibilidad', label: 'Disponibilidad', icon: Clock, activeClass: 'bg-orange-600 hover:bg-orange-700 text-white' },
  { key: 'whatsapp-config', label: 'WhatsApp Config', icon: Settings, activeClass: 'bg-purple-600 hover:bg-purple-700 text-white' },
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

  // Number of visible tabs on desktop before overflow
  const VISIBLE_TABS_DESKTOP = 6;
  const visibleSections = adminSections.slice(0, VISIBLE_TABS_DESKTOP);
  const overflowSections = adminSections.slice(VISIBLE_TABS_DESKTOP);
  const isOverflowActive = overflowSections.some(s => s.key === activeTab);

  const handleSelectTab = (tab: AdminTabType) => {
    onTabChange(tab);
    setIsDrawerOpen(false);
  };

  // Mobile: Dropdown + Hamburger menu
  if (isMobile) {
    return (
      <div className="flex items-center gap-2 mb-6">
        {/* Dropdown Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="flex-1 justify-between bg-background border-border"
            >
              <div className="flex items-center gap-2">
                <CurrentIcon className="w-4 h-4 text-primary" />
                <span className="font-medium">{currentSection.label}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="start" 
            className="w-[calc(100vw-2rem)] max-w-sm bg-background border border-border z-50"
          >
            {adminSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.key === activeTab;
              return (
                <DropdownMenuItem
                  key={section.key}
                  onClick={() => handleSelectTab(section.key)}
                  className={cn(
                    "flex items-center gap-3 py-3 cursor-pointer",
                    isActive && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span>{section.label}</span>
                  {isActive && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-primary" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hamburger for quick access */}
        <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0">
              <Menu className="w-4 h-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="p-4 border-b bg-muted/30">
              <SheetTitle className="text-left flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <span>Admin Panel</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="p-2">
              {adminSections.map((section) => {
                const Icon = section.icon;
                const isActive = section.key === activeTab;
                return (
                  <button
                    key={section.key}
                    onClick={() => handleSelectTab(section.key)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  // Desktop: Horizontal tabs with overflow dropdown
  return (
    <div className="flex items-center gap-2 mb-6 flex-wrap lg:flex-nowrap">
      {/* Admin label */}
      <div className="hidden lg:flex items-center gap-2 pr-3 border-r border-border mr-1">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Calendar className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-muted-foreground">Admin</span>
      </div>

      {/* Visible tabs */}
      {visibleSections.map((section) => {
        const Icon = section.icon;
        const isActive = section.key === activeTab;
        const activeClass = section.activeClass || '';
        
        return (
          <Button
            key={section.key}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onTabChange(section.key)}
            className={cn(
              "gap-2 transition-all",
              isActive && activeClass
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{section.label}</span>
          </Button>
        );
      })}

      {/* Overflow dropdown for extra items */}
      {overflowSections.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={isOverflowActive ? 'default' : 'outline'}
              size="sm"
              className={cn(
                "gap-2",
                isOverflowActive && "bg-primary"
              )}
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Más</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-background border border-border z-50">
            {overflowSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.key === activeTab;
              return (
                <DropdownMenuItem
                  key={section.key}
                  onClick={() => onTabChange(section.key)}
                  className={cn(
                    "flex items-center gap-3 py-2 cursor-pointer",
                    isActive && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{section.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
