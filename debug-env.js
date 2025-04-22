// Simple script to check environment variables
console.log('Checking environment variables:');
console.log('ASANA_PAT exists:', !!process.env.ASANA_PAT);

if (process.env.ASANA_PAT) {
  console.log('ASANA_PAT length:', process.env.ASANA_PAT.length);
  console.log('ASANA_PAT first 5 chars:', process.env.ASANA_PAT.substring(0, 5));
  console.log('ASANA_PAT format valid (starts with "2/"):', process.env.ASANA_PAT.startsWith('2/'));
} else {
  console.log('ASANA_PAT is not defined');
}