import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface StringListInputProps {
  value: string[];
  onChange: React.Dispatch<React.SetStateAction<string[]>>;
  placeholder?: string;
  className?: string;
}

const StringListInput: React.FC<StringListInputProps> = ({ value, onChange, placeholder, className }) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (inputValue.trim()) {
      if (value && value.includes(inputValue)) {
        return;
      }

      if (value) {
        onChange([...value, inputValue]);
      } else {
        onChange([inputValue]);
      }
      setInputValue('');
    }
  };

  const handleRemove = (itemToRemove: string) => {
    onChange(value.filter(item => item !== itemToRemove));
  };

  return (
    <div className={cn("mx-auto", className)}>
      <div className="flex items-center mb-4">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder={placeholder || t('input.list.placeholder')}
        />
        <Button
          disabled={!inputValue || value && value.includes(inputValue)}
          onClick={handleAdd}
          className="ml-2 px-4 py-2"
        >
          {t('input.list.add')}
        </Button>
      </div>
      {
        value && <div className="flex flex-wrap gap-2">
          {value.map((item, index) => (
            <Badge key={index} className='flex flex-row items-center justify-start'>{item}
              <div
                onClick={() => handleRemove(item)}
                className="ml-1 h-4 w-4 text-center rounded-full hover:text-red-500 cursor-pointer"
              >
                ×
              </div>
            </Badge>
          ))}
        </div>
      }
    </div>
  );
};

export default StringListInput;

export interface PortsRange {
  start?: number;
  end?: number;
  single?: number;
}

const formatRange = (r: PortsRange) => (r.single !== undefined ? `${r.single}` : `${r.start}-${r.end}`);

const inRange = (n: number) => Number.isInteger(n) && n >= 1 && n <= 65535;

/**
 * Parses frp's own `1000-2000,3000` shorthand. That syntax is a TOML/flag convenience in
 * frp -- types.PortsRange has no UnmarshalJSON -- so the wire form must be the object
 * array, and all three fields are omitempty, meaning 0 must never be emitted.
 */
export const parsePortRanges = (input: string): { ranges: PortsRange[]; error?: string } => {
  const ranges: PortsRange[] = [];
  for (const part of input.split(',')) {
    const chunk = part.trim();
    if (!chunk) continue;
    if (chunk.includes('-')) {
      const [rawStart, rawEnd, ...rest] = chunk.split('-');
      const start = Number(rawStart);
      const end = Number(rawEnd);
      if (rest.length || !inRange(start) || !inRange(end) || start > end) {
        return { ranges: [], error: chunk };
      }
      ranges.push({ start, end });
    } else {
      const single = Number(chunk);
      if (!inRange(single)) {
        return { ranges: [], error: chunk };
      }
      ranges.push({ single });
    }
  }
  return { ranges };
};

interface PortRangeListInputProps {
  value?: PortsRange[];
  onChange: (value: PortsRange[] | undefined) => void;
  placeholder?: string;
  className?: string;
}

export const PortRangeListInput: React.FC<PortRangeListInputProps> = ({
  value,
  onChange,
  placeholder,
  className,
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | undefined>();

  const handleAdd = () => {
    const { ranges, error: bad } = parsePortRanges(inputValue);
    if (bad || !ranges.length) {
      setError(t('validation.portRangeList'));
      return;
    }
    setError(undefined);
    onChange([...(value || []), ...ranges]);
    setInputValue('');
  };

  const handleRemove = (index: number) => {
    const next = (value || []).filter((_, i) => i !== index);
    onChange(next.length ? next : undefined);
  };

  return (
    <div className={cn('mx-auto', className)}>
      <div className="flex items-center mb-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="flex-1 text-sm"
          placeholder={placeholder || '1000-2000, 3000'}
        />
        <Button disabled={!inputValue} onClick={handleAdd} className="ml-2 px-4 py-2">
          {t('input.list.add')}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {(value || []).map((r, index) => (
          <Badge key={`${formatRange(r)}-${index}`} className="flex flex-row items-center justify-start">
            {formatRange(r)}
            <div
              onClick={() => handleRemove(index)}
              className="ml-1 h-4 w-4 text-center rounded-full hover:text-red-500 cursor-pointer"
            >
              ×
            </div>
          </Badge>
        ))}
      </div>
    </div>
  );
};

interface KeyValueListInputProps {
  value?: Record<string, string>;
  onChange: (value: Record<string, string> | undefined) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  className?: string;
  /** Return a message to block the key, or undefined to accept it. */
  keyValidator?: (key: string) => string | undefined;
  /** Keys the caller owns; rendered as disabled badges and never editable here. */
  reservedEntries?: Record<string, string>;
}

/**
 * Map editor for frp's `metadatas`, `annotations` and `requestHeaders.set`.
 * Deliberately dumb: reserved-key policy lives with the caller, which passes the
 * reserved entries in for display and merges them back on submit.
 */
export const KeyValueListInput: React.FC<KeyValueListInputProps> = ({
  value,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
  className,
  keyValidator,
  reservedEntries,
}) => {
  const { t } = useTranslation();
  const [keyInput, setKeyInput] = useState('');
  const [valueInput, setValueInput] = useState('');

  const keyError = keyInput ? keyValidator?.(keyInput) : undefined;
  const duplicate = !!value && Object.prototype.hasOwnProperty.call(value, keyInput);

  const handleAdd = () => {
    if (!keyInput.trim() || keyError || duplicate) {
      return;
    }
    onChange({ ...(value || {}), [keyInput]: valueInput });
    setKeyInput('');
    setValueInput('');
  };

  const handleRemove = (keyToRemove: string) => {
    const next = { ...(value || {}) };
    delete next[keyToRemove];
    onChange(Object.keys(next).length ? next : undefined);
  };

  return (
    <div className={cn('mx-auto', className)}>
      <div className="flex items-center gap-2 mb-2">
        <Input
          type="text"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          className="flex-1 text-sm"
          placeholder={keyPlaceholder || t('input.kv.key_placeholder')}
        />
        <Input
          type="text"
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
          className="flex-1 text-sm"
          placeholder={valuePlaceholder || t('input.kv.value_placeholder')}
        />
        <Button disabled={!keyInput || !!keyError || duplicate} onClick={handleAdd} className="px-4 py-2">
          {t('input.kv.add')}
        </Button>
      </div>
      {keyError && <p className="text-sm text-destructive mb-2">{keyError}</p>}
      <div className="flex flex-wrap gap-2">
        {reservedEntries &&
          Object.entries(reservedEntries).map(([k, v]) => (
            <Badge key={`reserved-${k}`} variant="secondary" className="opacity-60" title={t('input.kv.reserved')}>
              {k}: {v}
            </Badge>
          ))}
        {value &&
          Object.entries(value).map(([k, v]) => (
            <Badge key={k} className="flex flex-row items-center justify-start">
              {k}: {v}
              <div
                onClick={() => handleRemove(k)}
                className="ml-1 h-4 w-4 text-center rounded-full hover:text-red-500 cursor-pointer"
              >
                ×
              </div>
            </Badge>
          ))}
      </div>
    </div>
  );
};