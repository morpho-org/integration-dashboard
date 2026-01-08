import React, { useEffect, useRef, useState } from 'react';

// Utility function to format numbers with K, M, B, T suffixes like in utils.ts
const formatAmountWithSuffix = (amount: number, symbol: string, precision = 2): string => {
  if (amount === 0) return '0';
  if (amount < 1000) return amount.toFixed(precision).replace(/\.?0+$/, '');
  
  if (amount < 1e6) return `${(amount / 1000).toFixed(precision).replace(/\.?0+$/, '')}K`;
  if (amount < 1e9) return `${(amount / 1e6).toFixed(precision).replace(/\.?0+$/, '')}M`;  
  if (amount < 1e12) return `${(amount / 1e9).toFixed(precision).replace(/\.?0+$/, '')}B`;
  return `${(amount / 1e12).toFixed(precision).replace(/\.?0+$/, '')}T`;
};

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  maxValue: string;
  symbol: string;
  decimals?: number; // For internal precision, not display
  displayDecimals?: number; // For user display (default: 2)
  className?: string;
  placeholder?: string;
}

const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  maxValue,
  symbol,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decimals = 18,
  displayDecimals = 2,
  className = "",
  placeholder = "0"
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [internalValue, setInternalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);

  // Sync internal value with external value changes (legitimate sync pattern)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isFocused) {
      setInternalValue(value);
    }
  }, [value, isFocused]);

  // Restore cursor position after value updates (one-time effect pattern)
  useEffect(() => {
    if (cursorPosition !== null && inputRef.current) {
      inputRef.current.setSelectionRange(cursorPosition, cursorPosition);
      setCursorPosition(null);
    }
  }, [cursorPosition]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const formatDisplayValue = (val: string): string => {
    if (!val || val === '') return '0';
    
    const num = parseFloat(val);
    if (isNaN(num)) return '0';
    if (num === 0) return '0';
    
    // For large numbers (≥1000), use K, M, B, T formatting for better readability
    if (num >= 1000) {
      return formatAmountWithSuffix(num, symbol, 1);
    }
    
    // For small numbers, format with appropriate decimals
    if (num < 0.01 && num > 0) {
      // For very small numbers, show more decimals
      return num.toFixed(6).replace(/\.?0+$/, '');
    } else {
      // For normal numbers, show the specified decimals
      const formatted = num.toFixed(displayDecimals);
      return formatted.replace(/\.?0+$/, '');
    }
  };

  const parseInputValue = (input: string): string => {
    // Remove any non-numeric characters except decimal point
    let cleaned = input.replace(/[^0-9.]/g, '');
    
    // Handle multiple decimal points - keep only the first one
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Prevent leading zeros (except for 0.xxx)
    if (cleaned.length > 1 && cleaned[0] === '0' && cleaned[1] !== '.') {
      cleaned = cleaned.substring(1);
    }
    
    return cleaned;
  };

  const isAtMax = (): boolean => {
    const current = parseFloat(internalValue || '0');
    const max = parseFloat(maxValue);
    return current >= max && current > 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    
    // Parse and clean the input
    const cleaned = parseInputValue(input);
    
    // Validate against max value
    const numericValue = parseFloat(cleaned || '0');
    const maxNumeric = parseFloat(maxValue);
    
    let finalValue = cleaned;
    if (numericValue > maxNumeric) {
      finalValue = maxNumeric.toFixed(displayDecimals).replace(/\.?0+$/, '');
    }
    
    // Ensure minimum value of 0
    if (numericValue < 0) {
      finalValue = '0';
    }
    
    setInternalValue(finalValue);
    
    // Store cursor position for restoration
    if (finalValue === cleaned) {
      setCursorPosition(cursorPos);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    // Format and validate final value
    const numericValue = parseFloat(internalValue || '0');
    const maxNumeric = parseFloat(maxValue);
    let finalValue = internalValue;
    
    if (isNaN(numericValue) || numericValue < 0) {
      finalValue = '0';
    } else if (numericValue > maxNumeric) {
      finalValue = maxNumeric.toFixed(displayDecimals).replace(/\.?0+$/, '');
    }
    
    setInternalValue(finalValue);
    onChange(finalValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow: backspace, delete, tab, escape, enter, decimal point
    if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', '.', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
        // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
        (e.key === 'a' && e.ctrlKey) ||
        (e.key === 'c' && e.ctrlKey) ||
        (e.key === 'v' && e.ctrlKey) ||
        (e.key === 'x' && e.ctrlKey) ||
        // Allow numbers
        /^[0-9]$/.test(e.key)) {
      return;
    }
    
    // Prevent any other keys
    e.preventDefault();
  };

  const handleMaxClick = () => {
    const formattedMax = parseFloat(maxValue).toFixed(displayDecimals).replace(/\.?0+$/, '');
    setInternalValue(formattedMax);
    onChange(formattedMax);
    inputRef.current?.focus();
  };

  const handleMinClick = () => {
    setInternalValue('0');
    onChange('0');
    inputRef.current?.focus();
  };

  const displayValue = isFocused ? internalValue : formatDisplayValue(internalValue);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={handleMaxClick}
        className="px-2 py-1 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
        type="button"
      >
        MAX
      </button>
      
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`
            w-full min-w-[100px] px-2 py-1.5 text-2xs font-mono text-center rounded border transition-all
            ${isAtMax() 
              ? 'border-orange-400 bg-orange-50 text-orange-800' 
              : 'border-gray-300 bg-white text-gray-900'
            }
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            hover:border-gray-400 cursor-text
          `}
        />
        
      </div>
      
      <button
        onClick={handleMinClick}
        className="px-2 py-1 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        type="button"
      >
        MIN
      </button>
    
    </div>
  );
};

export default AmountInput;