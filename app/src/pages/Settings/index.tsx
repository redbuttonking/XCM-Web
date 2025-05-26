import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const Settings = () => {
  return (
    <div className="flex flex-col">
      <Button>button</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button disabled>
        <Loader2 className="animate-spin" />
        Please wait
      </Button>
      <span>
        <img src="/icons/monitor.svg"></img>
      </span>
    </div>
  );
};

export default Settings;
