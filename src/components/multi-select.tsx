'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from './ui/badge';

export type Option = {
  value: string;
  label: string;
};

interface MultiSelectProps {
  options: Option[];
  selected: Option[];
  onChange: (selected: Option[]) => void;
  className?: string;
  placeholder?: string;
  max?: number;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  className,
  placeholder = 'Select...',
  max,
  ...props
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (option: Option) => {
    onChange(
      selected.some(s => s.value === option.value)
        ? selected.filter(s => s.value !== option.value)
        : [...selected, option]
    );
  };
  
  const handleRemove = (option: Option, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((s) => s.value !== option.value));
  }

  const isMaxReached = max !== undefined && selected.length >= max;

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-10", selected.length > 0 ? "py-1" : "", className)}
        >
          <div className="flex gap-1 flex-wrap">
            {selected.length > 0 ? (
              selected.map(option => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className="rounded-sm"
                >
                  {option.label}
                  <button className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2" onClick={(e) => handleRemove(option, e)}>
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map(option => {
                const isSelected = selected.some(s => s.value === option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                        handleSelect(option)
                        if (max === 1) {
                          setOpen(false);
                        }
                    }}
                    disabled={!isSelected && isMaxReached}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
