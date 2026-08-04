import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function test() {
  const { data: mData } = await supabase.from('master_porsi').select('*');
  console.log('master_porsi:', mData);
  
  const { data: sjData } = await supabase.from('surat_jalan_docs').select('*');
  console.log('surat_jalan_docs:', sjData);
  
  const { data: orData } = await supabase.from('organoleptik_docs').select('*');
  console.log('organoleptik_docs:', orData);
}
test();
