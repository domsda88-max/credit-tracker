const fs = require('fs');
const p = 'src/components/CreditRow.tsx';
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const start = lines.findIndex((l) => l.includes('const toggleFreeze = () => {'));
const end = lines.findIndex((l, i) => i > start && l.trim() === '};');
const replacement = `  const freezeMutation = useMutation({
    mutationFn: ({ id, newFrozenState }: { id: string; newFrozenState: boolean }) =>
      creditsApi.toggleFreeze(id, newFrozenState),
    onMutate: async ({ id, newFrozenState }) => {
      await queryClient.cancelQueries({ queryKey: ['credits'] });
      const previousCredits = queryClient.getQueryData(['credits']);
      queryClient.setQueryData(['credits'], (old: any) =>
        Array.isArray(old)
          ? old.map((c: any) => (c.id === id ? { ...c, frozen: newFrozenState } : c))
          : old,
      );
      return { previousCredits };
    },
    onError: (err, variables, context: any) => {
      queryClient.setQueryData(['credits'], context?.previousCredits);
      setError(extractErrorMessage(err));
      toast.show('Ошибка заморозки');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['summary'], refetchType: 'none' });
    },
  });

  const handleFreezeClick = () => {
    navigator.vibrate?.(25);
    setOpen(false);
    freezeMutation.mutate({ id: credit.id, newFrozenState: !credit.frozen });
  };`;
const out = [...lines.slice(0, start), ...replacement.split('\n'), ...lines.slice(end + 1)];
// Replace toggleFreeze references in JSX with handleFreezeClick
let result = out.join('\n');
result = result.replace('onClick={toggleFreeze}', 'onClick={handleFreezeClick}');
fs.writeFileSync(p, result, 'utf8');
console.log('done');
