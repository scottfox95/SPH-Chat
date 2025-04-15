import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, X, Pencil } from 'lucide-react';

interface EditableTitleProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  className?: string;
  isPending?: boolean;
}

export default function EditableTitle({ value, onSave, className = "", isPending = false }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleSave = async () => {
    if (editValue.trim() === '') return;
    if (editValue === value) {
      setIsEditing(false);
      return;
    }
    
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch (error) {
      // If there's an error, reset to the original value
      setEditValue(value);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue(value);
  };

  if (isEditing) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          autoFocus
          className="max-w-sm focus-visible:ring-[#D2B48C]"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            } else if (e.key === 'Escape') {
              handleCancel();
            }
          }}
          disabled={isPending}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSave}
          disabled={isPending}
          className="h-8 w-8"
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCancel}
          disabled={isPending}
          className="h-8 w-8"
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-2 ${className}`}>
      <span className="text-xl font-semibold">{value}</span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
      >
        <Pencil className="h-4 w-4 text-gray-500" />
      </Button>
    </div>
  );
}