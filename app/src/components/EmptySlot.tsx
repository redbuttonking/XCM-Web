const EmptySlot = () => {
  return (
    <div className="rounded-xl bg-gray-800 p-2 shadow-md">
      <h3 className="mb-1 text-center text-xs text-gray-300">빈 자리</h3>
      <div className="aspect-video w-full rounded-lg bg-black opacity-40" />
    </div>
  );
};

export default EmptySlot;
