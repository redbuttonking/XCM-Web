const EmptySlot = () => {
  return (
    <div className="rounded-2xl border-2 border-[#F0F0F0] p-2 text-[#444444] shadow-xl">
      <h3 className="my-[8px] h-[24px] text-center text-xs text-gray-300">빈 자리</h3>
      <div className="aspect-video w-full rounded-lg bg-[#CDCDCD]" />
    </div>
  );
};

export default EmptySlot;
