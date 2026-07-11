# Applique toutes les migrations en attente sur votre projet Supabase.
# Prérequis (une seule fois) :
#   npx supabase login
#   npx supabase link
#
# Usage : npm run db:push

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ""
Write-Host ">> Migrations Supabase (supabase/migrations/)..." -ForegroundColor Cyan
Write-Host ""

npx supabase@latest db push

if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Echec. Verifiez que vous avez fait :" -ForegroundColor Yellow
  Write-Host "  1. npx supabase login"
  Write-Host "  2. npx supabase link   (ref projet dans l'URL Supabase)"
  Write-Host ""
  exit 1
}

Write-Host ""
Write-Host "Migrations appliquees avec succes." -ForegroundColor Green
Write-Host ""
