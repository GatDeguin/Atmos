from pathlib import Path
def inline_html(path):
 path=Path(path);s=path.read_text()
 for name,old,start,end in [("horizon.css",'<link rel="stylesheet" href="./horizon.css">',"<style>","</style>"),("horizon.js",'<script src="./horizon.js"></script>',"<script>","</script>")]:
  f=path.parent/name
  if f.exists():s=s.replace(old,start+f.read_text()+end)
 return s
