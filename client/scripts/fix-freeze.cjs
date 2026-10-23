const fs = require('fs');
const p = 'src/components/CreditRow.tsx';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const start = lines.findIndex((l) => l.includes('const toggleFreeze = async'));
const end = lines.findIndex((l, i) => i > start && l.trim() === '};');
const replacement = `  const toggleFreeze = async () => {
    const nextFrozen = !credit.frozen;
    navigator.vibrate?.(25);
    // Optimistic update: reflect immediately in cache
    queryClient.setQueryData(['credits'], (old: any) =>
      Array.isArray(old)
        ? old.map((c: any) => (c.id === credit.id ? { ...c, frozen: nextFrozen } : c))
        : old,
    );
    try {
      await creditsApi.toggleFreeze(credit.id, nextFrozen);
      await queryClient.invalidateQueries({ queryKey: ['credits'], refetchType: 'active' });
      await queryClient.invalidateQueries({ queryKey: ['summary'], refetchType: 'active' });
      toast.show(nextFrozen ? 'Кредит заморожен' : 'Кредит разморожен');
      setOpen(false);
    } catch (err) {
      // Rollback
      queryClient.setQueryData(['credits'], (old: any) =>
        Array.isArray(old)
          ? old.map((c: any) => (c.id === credit.id ? { ...c, frozen: credit.frozen } : c))
          : old,
      );
      setError(extractErrorMessage(err));
      toast.show('Ошибка заморозки');
    }
  };`;
const out = [...lines.slice(0, start), ...replacement.split('\n'), ...lines.slice(end + 1)];
fs.writeFileSync(p, out.join('\n'), 'utf8');
console.log('done');
