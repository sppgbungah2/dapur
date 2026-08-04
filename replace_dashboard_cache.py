import re

with open('src/components/DashboardAdminView.tsx', 'r') as f:
    content = f.read()

# Add import
if "import { supabase" not in content:
    content = content.replace("import { generateInitialDocsAsync } from '../utils/generateDocs';", 
                              "import { generateInitialDocsAsync } from '../utils/generateDocs';\nimport { supabase, isSupabaseConfigured } from '../lib/supabase';")

# Replace the portions state and useEffect
target_pattern = r"  const \[portions, setPortions\] = useState<PortionConfig>\(\(\) => \{.*?\n  \}, \[selectedDate\]\);"
replacement = """  const [portions, setPortions] = useState<PortionConfig>({ ...DEFAULT_PORTIONS });
  const [isCustomPortion, setIsCustomPortion] = useState(false);

  useEffect(() => {
    const fetchPortions = async () => {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data, error } = await supabase
            .from('master_porsi')
            .select('portions')
            .eq('date', selectedDate)
            .maybeSingle();
            
          if (data && data.portions) {
            setPortions(data.portions as PortionConfig);
            setIsCustomPortion(true);
            return;
          }
          
          // Try template
          const { data: tplData } = await supabase
            .from('master_porsi')
            .select('portions')
            .eq('date', '1970-01-01')
            .maybeSingle();
            
          if (tplData && tplData.portions) {
            setPortions(tplData.portions as PortionConfig);
            setIsCustomPortion(false);
            return;
          }
        } catch (err) {
          console.warn('Error fetching portions:', err);
        }
      }
      
      // Fallback
      setPortions({ ...DEFAULT_PORTIONS });
      setIsCustomPortion(false);
    };
    
    fetchPortions();
  }, [selectedDate]);"""

content = re.sub(target_pattern, replacement, content, flags=re.DOTALL)

with open('src/components/DashboardAdminView.tsx', 'w') as f:
    f.write(content)

