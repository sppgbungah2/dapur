import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Insert a useEffect to clear localStorage
target_pattern = r"function App\(\) \{\n"
replacement = """function App() {
  // Clear deprecated local cache
  useEffect(() => {
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith('sppg_portions_')) {
          localStorage.removeItem(k);
        }
      }
    } catch (e) {}
  }, []);
"""

if "Clear deprecated local cache" not in content:
    content = content.replace("function App() {\n", replacement)
    with open('src/App.tsx', 'w') as f:
        f.write(content)

