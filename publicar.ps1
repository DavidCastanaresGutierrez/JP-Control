# Publica los cambios: commit + push a GitHub. Vercel despliega automaticamente.
# Uso:  .\publicar.ps1                        (mensaje automatico con fecha)
#       .\publicar.ps1 "descripcion corta"    (mensaje personalizado)
param([string]$mensaje = ("Actualizacion " + (Get-Date -Format "yyyy-MM-dd HH:mm")))

git add -A
git commit -m $mensaje
if ($LASTEXITCODE -ne 0) {
  Write-Host "Nada que publicar (sin cambios)." -ForegroundColor Yellow
  exit 0
}
git push
if ($LASTEXITCODE -eq 0) {
  Write-Host "Publicado. Vercel desplegara la nueva version en ~1 minuto." -ForegroundColor Green
}
