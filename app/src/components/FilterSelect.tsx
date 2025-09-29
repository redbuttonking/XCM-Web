import { cn } from '@/lib/utils'; // 없다면 className join 유틸 대신 템플릿만 써도 OK
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from '@/components/ui/select';

export type Option = { label: string; value: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string; // Trigger에 추가할 클래스
  contentClassName?: string; // Content에 추가할 클래스
  triggerWidthClass?: string; // w-[160px] 같은 폭 제어
};

export default function FilterSelect({
  options,
  value,
  onChange,
  placeholder = '선택',
  className,
  contentClassName,
  triggerWidthClass = 'w-[160px]',
}: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(triggerWidthClass, className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>

      {/* 스크롤 컨테이너 안에서도 겹치지 않게 팝퍼 + z-index 부여 */}
      <SelectContent position="popper" sideOffset={6} className={cn('z-50', contentClassName)}>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
