import re

with open('src/components/PerencanaanMenuPorsi.tsx', 'r') as f:
    content = f.read()

# Replace localStorage logic with initialPortions prop logic or Supabase fetch
# Actually, since it's already fetching menus, let's just fetch portions from Supabase too!
target_pattern = r"    const loadPortions = \(\) => \{\n      const saved = localStorage\.getItem\(`sppg_portions_\$\{selectedDate\}`\);\n      if \(saved\) \{\n        setPortions\(JSON\.parse\(saved\)\);\n      \} else \{\n        setPortions\(\{ \.\.\.DEFAULT_PORTIONS \}\);\n      \}\n    \};\n    loadPortions\(\);"

replacement = """    const loadPortions = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase.from('master_porsi').select('portions').eq('date', selectedDate).maybeSingle();
          if (data && data.portions) {
            setPortions(data.portions as PortionConfig);
            return;
          }
          const { data: tplData } = await supabase.from('master_porsi').select('portions').eq('date', '1970-01-01').maybeSingle();
          if (tplData && tplData.portions) {
            setPortions(tplData.portions as PortionConfig);
            return;
          }
        } catch (err) {}
      }
      setPortions({ ...DEFAULT_PORTIONS });
    };
    loadPortions();"""

content = re.sub(target_pattern, replacement, content, flags=re.DOTALL)

# Remove localStorage setItem in handleSave
content = re.sub(r"    localStorage\.setItem\(`sppg_portions_\$\{selectedDate\}`\, JSON\.stringify\(portions\)\);\n", "", content)

with open('src/components/PerencanaanMenuPorsi.tsx', 'w') as f:
    f.write(content)

