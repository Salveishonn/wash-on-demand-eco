import { motion } from 'framer-motion';
import { Check, Sparkles, Droplet, Wind, Cog, Leaf, Sofa } from 'lucide-react';
import { ServiceAddon, SelectedAddon } from '@/hooks/useServiceAddons';

interface AddonsSelectorProps {
  addons: ServiceAddon[];
  selectedAddons: SelectedAddon[];
  onToggle: (addon: ServiceAddon) => void;
  isSelected: (addonId: string) => boolean;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Droplet,
  Wind,
  Cog,
  Leaf,
  Sofa,
};

const formatPrice = (cents: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(cents / 100);
};

export function AddonsSelector({ addons, selectedAddons, onToggle, isSelected }: AddonsSelectorProps) {
  if (addons.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-display text-lg font-bold text-foreground">
        Servicios Adicionales (Opcional)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {addons.map((addon) => {
          const IconComponent = iconMap[addon.icon || 'Sparkles'] || Sparkles;
          const selected = isSelected(addon.id);
          
          return (
            <motion.button
              key={addon.id}
              type="button"
              onClick={() => onToggle(addon)}
              whileTap={{ scale: 0.98 }}
              className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                selected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {selected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-washero-charcoal" />
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  selected ? 'bg-primary/20' : 'bg-muted'
                }`}>
                  <IconComponent className={`w-5 h-5 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground text-sm">
                    {addon.name}
                  </div>
                  {addon.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {addon.description}
                    </div>
                  )}
                  <div className={`text-sm font-bold mt-1 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
                    +{formatPrice(addon.price_cents)}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
      
      {selectedAddons.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm text-foreground">
            {selectedAddons.length} extra{selectedAddons.length > 1 ? 's' : ''} seleccionado{selectedAddons.length > 1 ? 's' : ''}
          </span>
          <span className="font-semibold text-primary">
            +{formatPrice(selectedAddons.reduce((sum, a) => sum + a.price_cents, 0))}
          </span>
        </div>
      )}
    </div>
  );
}
