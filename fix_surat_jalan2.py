import re

with open('src/components/SuratJalanView.tsx', 'r') as f:
    content = f.read()

# find where viewDate is declared
match = re.search(r"  // Dashboard / List View\n  const viewDate = activeDateView \|\| selectedDate;\n", content)
if match:
    # remove it from there
    content = content.replace(match.group(0), "  // Dashboard / List View\n")
    
    # insert it at the top of the component
    # search for the component declaration
    component_start = "export default function SuratJalanView({\n  selectedDate,\n  allDayMenus,\n  loggedInUser,\n  currentUserRole,\n  shippingDocs,\n  setShippingDocs,\n  onGoToTab\n}: SuratJalanViewProps) {"
    if component_start in content:
        content = content.replace(component_start, component_start + "\n  const viewDate = activeDateView || selectedDate;\n")
        print("Fixed viewDate in SuratJalanView")
    else:
        # maybe activeDateView is not defined yet at the top?
        pass

with open('src/components/SuratJalanView.tsx', 'w') as f:
    f.write(content)
