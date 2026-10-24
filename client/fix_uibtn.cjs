const fs=require('fs');
const p='src/pages/CreditDetailPage.tsx';
let s=fs.readFileSync(p,'utf8');
const old=`                    {item.status === 'PAID' ? (
                      earlyKeys.has(\`${String.fromCharCode(36)}{new Date(item.paidAt ?? item.dueDate).toISOString().slice(0, 10)}|\${Number(item.paidAmount ?? item.amount)}\`) ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Досрочно</span>
                      ) : (
                        <StatusBadge status="PAID" />
                      )
                    ) : (`;
const neu=`                    {item.status === 'PAID' ? (
                      <div className="flex items-center gap-2">
                        {earlyKeys.has(\`${String.fromCharCode(36)}{new Date(item.paidAt ?? item.dueDate).toISOString().slice(0, 10)}|\${Number(item.paidAmount ?? item.amount)}\`) ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Досрочно</span>
                        ) : (
                          <StatusBadge status="PAID" />
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(\`Отменить платёж \${formatMoney(item.amount)} от \${formatDate(item.dueDate)}? Статус изменится на «Не оплачен», график пересчитается.\`) return;
                            setCancelingId(item.id);
                            try {
                              await (paymentsApi as any).cancelSchedule(item.id);
                              await queryClient.invalidateQueries({ queryKey: ['credit', id] });
                              await queryClient.invalidateQueries({ queryKey: ['credits'] });
                              await queryClient.invalidateQueries({ queryKey: ['summary'] });
                              toast.show('Платёж отменён');
                            } catch (err) {
                              setError(extractErrorMessage(err));
                            } finally {
                              setCancelingId(null);
                            }
                          }}
                          disabled={cancelingId === item.id}
                          className="rounded-lg border border-danger/40 px-2 py-1 text-[11px] font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                        >
                          {cancelingId === item.id ? 'Отменяю…' : 'Отменить'}
                        </button>
                      </div>
                    ) : (`;
if(!s.includes(old)){ console.log('old not found'); process.exit(1); }
s=s.replace(old,neu);
// ensure cancelingId state exists
if(!s.includes('const [cancelingId, setCancelingId]')) {
  s=s.replace(
    "  const [preview, setPreview] = useState<EarlyPreview | null>(null);",
    "  const [preview, setPreview] = useState<EarlyPreview | null>(null);\n  const [cancelingId, setCancelingId] = useState<string | null>(null);"
  );
}
fs.writeFileSync(p,s,'utf8');
console.log('ok');
