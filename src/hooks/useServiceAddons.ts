import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceAddon {
  id: string;
  name: string;
  price_cents: number;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface SelectedAddon {
  addon_id: string;
  name: string;
  price_cents: number;
}

export function useServiceAddons() {
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAddons = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('service_addons')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setAddons(data || []);
      } catch (error) {
        console.error('Error fetching addons:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAddons();
  }, []);

  const toggleAddon = useCallback((addon: ServiceAddon) => {
    setSelectedAddons(prev => {
      const exists = prev.find(a => a.addon_id === addon.id);
      if (exists) {
        return prev.filter(a => a.addon_id !== addon.id);
      } else {
        return [...prev, { 
          addon_id: addon.id, 
          name: addon.name, 
          price_cents: addon.price_cents 
        }];
      }
    });
  }, []);

  const isSelected = useCallback((addonId: string) => {
    return selectedAddons.some(a => a.addon_id === addonId);
  }, [selectedAddons]);

  const getAddonsTotal = useCallback(() => {
    return selectedAddons.reduce((sum, a) => sum + a.price_cents, 0);
  }, [selectedAddons]);

  const clearAddons = useCallback(() => {
    setSelectedAddons([]);
  }, []);

  return {
    addons,
    selectedAddons,
    isLoading,
    toggleAddon,
    isSelected,
    getAddonsTotal,
    clearAddons,
    setSelectedAddons,
  };
}
