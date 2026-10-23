const fs = require('fs');
const p = 'src/components/CreditRow.tsx';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const start = lines.findIndex((l) => l.includes('const toggleFreeze = async'));
const end = lines.findIndex((l, i) => i > start && l.trim() === '};');
const replacement = `  const toggleFreeze = () => {
    // 1. вибрация — синхронно
    navigator.vibrate?.(25);
    // 2. закрыть шторку — синхронно
    setOpen(false);
    // 3. оптимистичное обновление кэша — синхронно
    queryClient.setQueryData(['credits'], (old: any) =>
      Array.isArray(old)
        ? old.map((c: any) => (c.id === credit.id ? { ...c, frozen: !credit.frozen } : c))
        : old,
    );
    // 4. мутация в фоне
    creditsApi
      .toggleFreeze(credit.id, !credit.frozen)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['credits'], refetchType: 'active' });
        queryClient.invalidateQueries({ queryKey: ['summary'], refetchType: 'active' });
        toast.show(credit.frozen ? 'Кредит разморожен' : 'Кредит заморожен');
      })
      .catch((err) => {
        queryClient.invalidateQueries({ queryKey: ['credits'], refetchType: 'active' });
        setError(extractErrorMessage(err));
        toast.show('Ошибка заморозки');
      });
  };`;
const out = [...lines.slice(0, start), ...replacement.split('\n'), ...lines.slice(end + 1)];
fs.writeFileSync(p, out.join('\n'), 'utf8');
console.log('done');
