'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { COACH_SPECIALTIES } from '@/lib/validators/coach-onboarding';

export type SortOption = 'newest' | 'price_low' | 'price_high';

interface CoachSearchFiltersProps {
  totalCount: number;
}

export function CoachSearchFilters({ totalCount }: CoachSearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state for inputs
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(() => {
    const specs = searchParams.get('specialties');
    return specs ? specs.split(',') : [];
  });
  const [sortBy, setSortBy] = useState<SortOption>(
    (searchParams.get('sort') as SortOption) || 'newest'
  );

  // Update URL params
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Reset to page 1 when filters change
      params.delete('page');

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      startTransition(() => {
        router.push(`/coaches${params.toString() ? `?${params.toString()}` : ''}`);
      });
    },
    [router, searchParams]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentSearch = searchParams.get('q') || '';
      if (searchValue !== currentSearch) {
        updateParams({ q: searchValue || null });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue, searchParams, updateParams]);

  // Handle specialty toggle
  const toggleSpecialty = (specialty: string) => {
    const newSpecialties = selectedSpecialties.includes(specialty)
      ? selectedSpecialties.filter((s) => s !== specialty)
      : [...selectedSpecialties, specialty];

    setSelectedSpecialties(newSpecialties);
    updateParams({ specialties: newSpecialties.length > 0 ? newSpecialties.join(',') : null });
  };

  // Handle sort change
  const handleSortChange = (value: SortOption) => {
    setSortBy(value);
    updateParams({ sort: value === 'newest' ? null : value });
  };

  // Handle price range change (on blur to avoid too many updates)
  const handlePriceChange = () => {
    updateParams({
      minPrice: minPrice || null,
      maxPrice: maxPrice || null,
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchValue('');
    setMinPrice('');
    setMaxPrice('');
    setSelectedSpecialties([]);
    setSortBy('newest');
    startTransition(() => {
      router.push('/coaches');
    });
  };

  const hasActiveFilters =
    searchValue || minPrice || maxPrice || selectedSpecialties.length > 0 || sortBy !== 'newest';

  return (
    <div className="mb-6 space-y-4">
      {/* Search and Sort Row */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search coaches by name, headline, or bio..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-10"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <Select value={sortBy} onValueChange={(value: SortOption) => handleSortChange(value)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="price_low">Price: Low to High</SelectItem>
            <SelectItem value="price_high">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Specialty Multi-Select */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-9">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Specialty
              {selectedSpecialties.length > 0 && (
                <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {selectedSpecialties.length}
                </span>
              )}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="mb-2 text-sm font-medium">Filter by Specialty</div>
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {COACH_SPECIALTIES.map((specialty) => (
                <label
                  key={specialty}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <Checkbox
                    checked={selectedSpecialties.includes(specialty)}
                    onCheckedChange={() => toggleSpecialty(specialty)}
                  />
                  <span className="text-sm">{specialty}</span>
                </label>
              ))}
            </div>
            {selectedSpecialties.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full"
                onClick={() => {
                  setSelectedSpecialties([]);
                  updateParams({ specialties: null });
                }}
              >
                Clear Selection
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {/* Price Range */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min $"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            onBlur={handlePriceChange}
            onKeyDown={(e) => e.key === 'Enter' && handlePriceChange()}
            className="h-9 w-24"
            min={0}
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            placeholder="Max $"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            onBlur={handlePriceChange}
            onKeyDown={(e) => e.key === 'Enter' && handlePriceChange()}
            className="h-9 w-24"
            min={0}
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X className="mr-1 h-4 w-4" />
            Clear filters
          </Button>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {totalCount} coach{totalCount !== 1 ? 'es' : ''} found
          {isPending && <span className="ml-2 animate-pulse">Updating...</span>}
        </span>
        {hasActiveFilters && (
          <span className="text-xs">
            {selectedSpecialties.length > 0 && `${selectedSpecialties.length} specialties`}
            {selectedSpecialties.length > 0 && (minPrice || maxPrice) && ' • '}
            {minPrice && `$${minPrice}+`}
            {minPrice && maxPrice && ' - '}
            {maxPrice && !minPrice && `Up to $${maxPrice}`}
            {maxPrice && minPrice && `$${maxPrice}`}
          </span>
        )}
      </div>
    </div>
  );
}
