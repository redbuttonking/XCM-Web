const PanelButton = ({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    className={[
      'flex flex-col items-center justify-center gap-1 rounded-xl px-4 py-2 transition',
      'bg-white text-black',
      disabled ? 'text-gray-300' : 'hover:bg-blue hover:text-white',
      'min-w-[60px]',
    ].join(' ')}
    disabled={disabled}
    onClick={onClick}
  >
    {icon}
    <span className="text-xs font-bold">{label}</span>
  </button>
);

export default PanelButton;
