const fs=require('fs');
const p='src/api/payments.ts';
let s=fs.readFileSync(p,'utf8');
if(!s.includes('cancelSchedule')){
  s=s.replace(
    "  async earlyRepayment(creditId: string, payload: EarlyRepaymentPayload) {",
    "  async cancelSchedule(installmentId: string) {\n    const { data } = await api.post(`/payments/schedule/${installmentId}/cancel`);\n    return data;\n  },\n\n  async earlyRepayment(creditId: string, payload: EarlyRepaymentPayload) {"
  );
  fs.writeFileSync(p,s,'utf8');
  console.log('api ok');
} else {
  console.log('api exists');
}
