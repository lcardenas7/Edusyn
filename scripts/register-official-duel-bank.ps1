param(
  [Parameter(Mandatory = $true)][string]$BankFile,
  [string]$CatalogFile = 'apps/api/src/modules/classroom/official-duel-banks.ts',
  [switch]$UpdateExisting
)

$ErrorActionPreference = 'Stop'
$bankPath = [System.IO.Path]::GetFullPath($BankFile)
$catalogPath = [System.IO.Path]::GetFullPath($CatalogFile)
$bank = Get-Content -LiteralPath $bankPath -Raw -Encoding UTF8 | ConvertFrom-Json
$catalog = Get-Content -LiteralPath $catalogPath -Raw -Encoding UTF8

function Get-CanonicalText([string]$Value) {
  $normalized = $Value.Normalize([Text.NormalizationForm]::FormD)
  $normalized = [regex]::Replace($normalized, '\p{Mn}', '').ToLowerInvariant()
  $normalized = [regex]::Replace($normalized, '\s+', ' ')
  return [regex]::Replace($normalized, '^[\s.,;:!?¿¡"“”‘’()…]+|[\s.,;:!?¿¡"“”‘’()…]+$', '').Trim()
}

foreach ($question in $bank.questions) {
  if ($question.options -cnotcontains $question.correctAnswer) {
    throw "La respuesta correcta debe coincidir exactamente con una opción: $($question.id)."
  }
  if ($question.type -eq 'TRUE_FALSE' -and $question.correctAnswer -cnotin @('Verdadero', 'Falso')) {
    throw "V/F solo admite las respuestas exactas Verdadero o Falso: $($question.id)."
  }
  $canonicalOptions = @($question.options | ForEach-Object { Get-CanonicalText ([string]$_) })
  if (($canonicalOptions | Select-Object -Unique).Count -ne $canonicalOptions.Count) {
    throw "Hay opciones duplicadas después de normalizar tildes, mayúsculas y puntuación: $($question.id)."
  }
}

$catalogIdMarker = '"catalogId": "' + $bank.catalogId + '"'
$existingIndex = $catalog.IndexOf($catalogIdMarker, [System.StringComparison]::Ordinal)
if ($existingIndex -ge 0 -and -not $UpdateExisting) {
  throw "El catálogo ya contiene $($bank.catalogId); usa -UpdateExisting para actualizarlo."
}
if ($bank.editorialStatus -ne 'ready-for-import' -or $bank.questions.Count -ne 150) {
  throw 'Solo se pueden registrar bancos completos marcados ready-for-import.'
}
if (-not [regex]::IsMatch($catalog, '(?s)\r?\n\];\s*$')) {
  throw 'No se encontró el cierre esperado del catálogo TypeScript.'
}

$json = Get-Content -LiteralPath $bankPath -Raw -Encoding UTF8
$indentedJson = (($json.TrimEnd() -split '\r?\n') | ForEach-Object { '  ' + $_ }) -join [Environment]::NewLine
if ($existingIndex -ge 0) {
  $objectStart = $catalog.LastIndexOf('{', $existingIndex)
  $bankEnd = [regex]::Match($catalog.Substring($objectStart), '\r?\n    \]\r?\n  \}')
  if (-not $bankEnd.Success) { throw 'No se encontró el final del banco existente en el catálogo.' }
  $objectEnd = $objectStart + $bankEnd.Index + $bankEnd.Length
  $updatedCatalog = $catalog.Substring(0, $objectStart) + $indentedJson + $catalog.Substring($objectEnd)
} else {
  $closing = [regex]::Match($catalog, '\r?\n\];\s*$')
  $replacement = ',' + [Environment]::NewLine + $indentedJson + [Environment]::NewLine + '];'
  $updatedCatalog = $catalog.Substring(0, $closing.Index) + $replacement
}
[System.IO.File]::WriteAllText($catalogPath, $updatedCatalog, [System.Text.UTF8Encoding]::new($false))
Write-Output "Registered $($bank.catalogId) with $($bank.questions.Count) questions in $catalogPath."
