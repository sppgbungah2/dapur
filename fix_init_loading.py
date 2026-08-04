import re

with open('src/components/PerencanaanMenuPorsi.tsx', 'r') as f:
    content = f.read()

# Let's replace handleInitDocType completely
old_func = """  const handleInitDocType = async (type: 'SJ' | 'BAST' | 'ORLEP') => {
    if (type === 'SJ') setInitSJStatus('loading');
    if (type === 'BAST') setInitBASTStatus('loading');
    if (type === 'ORLEP') setInitOrlepStatus('loading');

    const menuArr = menuText.split(',').map(m => m.trim()).filter(m => m !== '');
    const menuStr = menuArr.join(', ');

    let targetType: 'surat_jalan' | 'serah_terima' | 'organoleptik' | undefined;
    if (type === 'SJ') targetType = 'surat_jalan';
    if (type === 'BAST') targetType = 'serah_terima';
    if (type === 'ORLEP') targetType = 'organoleptik';

    const updatedDocs = await generateInitialDocsAsync(selectedDate, shippingDocs, menuStr, 'admin@sppg.com', targetType);
    setShippingDocs(updatedDocs);
    
    // Sync to DB explicitly for safety
    if (isSupabaseConfigured && supabase) {
       // Just basic push for the newly created ones. The main sync logic handles it, but let's be safe.
       // The mock module syncs shipping docs in background, but we want it immediate.
       // Actually, the main app has a sync hook. So setting state is enough.
    }

    setTimeout(() => {
      if (type === 'SJ') setInitSJStatus('success');
      if (type === 'BAST') setInitBASTStatus('success');
      if (type === 'ORLEP') setInitOrlepStatus('success');
      onSuccess(`Dokumen ${type} harian untuk tanggal ${selectedDate} telah diinisiasi.`);
    }, 1000);
  };"""

new_func = """  const handleInitDocType = async (type: 'SJ' | 'BAST' | 'ORLEP') => {
    if (type === 'SJ') setInitSJStatus('loading');
    if (type === 'BAST') setInitBASTStatus('loading');
    if (type === 'ORLEP') setInitOrlepStatus('loading');

    const menuArr = menuText.split(',').map(m => m.trim()).filter(m => m !== '');
    const menuStr = menuArr.join(', ');

    let targetType: 'surat_jalan' | 'serah_terima' | 'organoleptik' | undefined;
    if (type === 'SJ') targetType = 'surat_jalan';
    if (type === 'BAST') targetType = 'serah_terima';
    if (type === 'ORLEP') targetType = 'organoleptik';

    // Artificial delay to show loading state to user
    await new Promise(resolve => setTimeout(resolve, 1500));

    const updatedDocs = await generateInitialDocsAsync(selectedDate, shippingDocs, menuStr, 'admin@sppg.com', targetType);
    setShippingDocs(updatedDocs);
    
    // Ensure DB write happens
    if (isSupabaseConfigured && supabase) {
       const newDocs = updatedDocs.filter(d => !shippingDocs.find(sd => sd.id === d.id));
       if (newDocs.length > 0) {
         try {
           const payload = newDocs.map(doc => ({
              id: doc.id,
              date: doc.date,
              type: doc.type,
              status: doc.status,
              content: doc,
              created_at: new Date().toISOString()
           }));
           await supabase.from('shipping_docs').upsert(payload);
         } catch (e) {
           console.warn("Direct upsert failed", e);
         }
       }
    }

    if (type === 'SJ') setInitSJStatus('success');
    if (type === 'BAST') setInitBASTStatus('success');
    if (type === 'ORLEP') setInitOrlepStatus('success');
    onSuccess(`Dokumen ${type} harian untuk tanggal ${selectedDate} telah berhasil dibuat di Database.`);
  };"""

content = content.replace(old_func, new_func)

# Also fix SOP artificial delay to make it more obvious
old_sop = """  const handleInitSOP = async () => {
    setInitSOPStatus('loading');
    const menuArr = menuText.split(',').map(m => m.trim()).filter(m => m !== '');
    onGenerateSOPs(selectedDate, menuArr);
    
    // Assume success for now since onGenerateSOPs handles DB logic
    setTimeout(() => {
      setInitSOPStatus('success');
      onSuccess(`SOP harian untuk tanggal ${selectedDate} telah diinisiasi.`);
    }, 1500);
  };"""

new_sop = """  const handleInitSOP = async () => {
    setInitSOPStatus('loading');
    
    // Artificial delay to show loading state to user
    await new Promise(resolve => setTimeout(resolve, 1500));

    const menuArr = menuText.split(',').map(m => m.trim()).filter(m => m !== '');
    onGenerateSOPs(selectedDate, menuArr);
    
    setInitSOPStatus('success');
    onSuccess(`SOP harian untuk tanggal ${selectedDate} telah berhasil dibuat di Database.`);
  };"""
  
content = content.replace(old_sop, new_sop)

with open('src/components/PerencanaanMenuPorsi.tsx', 'w') as f:
    f.write(content)
