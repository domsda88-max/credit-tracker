param(
    [string]$OutDir = (Get-Location).Path,
    [string]$PgDump = "pg_dump",
    [string]$Host = "aws-0-eu-west-1.pooler.supabase.com",
    [int]$Port = 5432,
    [string]$User = "postgres.ycxoqwjvtjydiyvhvmaa",
    [string]$Database = "postgres"
)

$ErrorActionPreference = 'Stop'

$backupDir = Join-Path $OutDir "backups"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$outFile = Join-Path $backupDir "credit_tracker-$timestamp.dump"

$securePassword = Read-Host -AsSecureString "Пароль БД (Supabase)"
$ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $env:PGPASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
    & $PgDump -Fc -h $Host -p $Port -U $User -d $Database -f $outFile
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump завершился с кодом $LASTEXITCODE"
    }
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "OK: $outFile" -ForegroundColor Green