param(
  [Parameter(Mandatory = $true)][string]$InputFile,
  [Parameter(Mandatory = $true)][string]$OutputFile,
  [Parameter(Mandatory = $true)][string]$CatalogId,
  [Parameter(Mandatory = $true)][string]$Title,
  [Parameter(Mandatory = $true)][string]$Category,
  [Parameter(Mandatory = $true)][int]$Grade
)

$ErrorActionPreference = 'Stop'

function Remove-MarkdownEmphasis([string]$Text) {
  $plainText = [regex]::Replace($Text, '\*\*(.+?)\*\*', '$1')
  return [regex]::Replace($plainText, '(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', '$1')
}

$markdown = Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8
$questionMatches = [regex]::Matches(
  $markdown,
  '(?ms)^###\s+(?<number>\d+)\.\s+(?<difficulty>[^·\r\n]+?)\s+·\s+(?<topic>.+?)\r?\n(?<body>.*?)(?=^###\s+\d+\.|^## Fuentes|\z)'
)

$questions = [System.Collections.Generic.List[object]]::new()
$answerPositions = @{ A = 0; B = 0; C = 0; D = 0 }
foreach ($match in $questionMatches) {
  $number = [int]$match.Groups['number'].Value
  $difficultyLabel = $match.Groups['difficulty'].Value.Trim()
  $difficulty = switch -Regex ($difficultyLabel) {
    '^Básica$' { 'BASIC'; break }
    '^Intermedia$' { 'INTERMEDIATE'; break }
    '^Aplicación$' { 'APPLICATION'; break }
    default { throw "Dificultad no reconocida en la pregunta ${number}: $difficultyLabel" }
  }
  $body = $match.Groups['body'].Value
  $answerMatch = [regex]::Match($body, '(?m)^\*\*Respuesta:\*\*\s+(?<answer>[^\r\n]+)')
  $explanationMatch = [regex]::Match($body, '(?m)^\*\*Explicación:\*\*\s*(?<explanation>[^\r\n]+)')
  $conceptMatch = [regex]::Match($body, '(?m)^\*\*Concepto:\*\*\s*(?<concept>[^\r\n]+)')
  if (-not $answerMatch.Success -or -not $explanationMatch.Success -or -not $conceptMatch.Success) {
    throw "Falta respuesta, explicación o concepto en la pregunta $number."
  }

  $optionMatches = [regex]::Matches($body, '(?m)^([ABCD])\.\s+(.+?)\s*$')
  $answerValue = $answerMatch.Groups['answer'].Value.Trim().TrimEnd('.').Trim()
  $type = if ($answerValue -in @('Verdadero', 'Falso')) { 'TRUE_FALSE' } else { 'MULTIPLE_CHOICE' }
  $options = @()
  if ($type -eq 'MULTIPLE_CHOICE') {
    if ($optionMatches.Count -ne 4) { throw "La pregunta $number no tiene cuatro opciones." }
    foreach ($option in $optionMatches) { $options += (Remove-MarkdownEmphasis $option.Groups[2].Value.Trim()) }
    $answerLetter = [regex]::Match($answerMatch.Groups['answer'].Value, '^([ABCD])\.').Groups[1].Value
    if (-not $answerLetter) { throw "La clave MC de la pregunta $number no es A/B/C/D." }
    $optionIndex = [array]::IndexOf([string[]]@('A', 'B', 'C', 'D'), $answerLetter)
    $correctAnswer = $options[$optionIndex]
    $answerPositions[$answerLetter]++
  } else {
    $options = @('Verdadero', 'Falso')
    $correctAnswer = $answerValue
  }

  $prompt = $body.Substring(0, $answerMatch.Index)
  if ($type -eq 'MULTIPLE_CHOICE') {
    $firstOption = [regex]::Match($prompt, '(?m)^[ABCD]\.\s+')
    if ($firstOption.Success) { $prompt = $prompt.Substring(0, $firstOption.Index) }
  }
  $prompt = $prompt.Trim()
  $prompt = [regex]::Replace($prompt, '\s+', ' ')
  $prompt = Remove-MarkdownEmphasis $prompt
  if (-not $prompt) { throw "Enunciado vacío en la pregunta $number." }
  $concept = $conceptMatch.Groups['concept'].Value.Trim()
  if (-not $concept) { throw "Concepto vacío en la pregunta $number." }

  $questions.Add([ordered]@{
    id = ('LEN{0}-{1:D3}' -f $Grade, $number)
    number = $number
    topic = $match.Groups['topic'].Value.Trim()
    concept = $concept
    difficulty = $difficulty
    type = $type
    text = $prompt
    options = $options
    correctAnswer = $correctAnswer
    explanation = Remove-MarkdownEmphasis $explanationMatch.Groups['explanation'].Value.Trim()
    stability = 'STABLE'
    source = $null
  })
}

$numberSequence = @($questions | ForEach-Object { $_.number })
$expectedSequence = @(1..150)
$sequenceDiff = @(Compare-Object $numberSequence $expectedSequence)
if ($questions.Count -ne 150 -or $sequenceDiff.Count -ne 0) {
  throw "El banco debe incluir 150 preguntas numeradas del 1 al 150; encontró $($questions.Count)."
}
$conceptCount = @($questions | ForEach-Object { $_['concept'] } | Sort-Object -Unique).Count
if ($conceptCount -ne 150) { throw "Hay conceptos repetidos: $conceptCount/150 únicos." }
$typeCounts = $questions | Group-Object { $_['type'] } -AsHashTable -AsString
$difficultyCounts = $questions | Group-Object { $_['difficulty'] } -AsHashTable -AsString
if ($typeCounts['MULTIPLE_CHOICE'].Count -ne 120 -or $typeCounts['TRUE_FALSE'].Count -ne 30) {
  throw 'La distribución requerida es 120 opción múltiple y 30 verdadero/falso.'
}
if ($difficultyCounts['BASIC'].Count -ne 50 -or $difficultyCounts['INTERMEDIATE'].Count -ne 70 -or $difficultyCounts['APPLICATION'].Count -ne 30) {
  throw 'La distribución requerida es 50 básicas, 70 intermedias y 30 de aplicación.'
}
if (@($answerPositions.Values | Where-Object { $_ -ne 30 }).Count -gt 0) {
  throw "Las claves MC deben tener 30 respuestas por letra: $($answerPositions | ConvertTo-Json -Compress)"
}

$sourceMatches = [regex]::Matches($markdown, '(?m)^- .+?:\s+(https?://\S+)')
$sources = @($sourceMatches | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$bank = [ordered]@{
  catalogId = $CatalogId
  title = $Title
  grade = $Grade
  subjectArea = 'Duelos'
  category = $Category
  version = '1.0'
  availability = 'institution-opt-in'
  editorialStatus = 'ready-for-import'
  audit = [ordered]@{
    questions = 150
    multipleChoice = 120
    trueFalse = 30
    difficulty = [ordered]@{ basic = 50; intermediate = 70; application = 30 }
    answerPositions = [ordered]@{ A = 30; B = 30; C = 30; D = 30 }
    conceptsPresent = 150
    conceptsMissing = 0
  }
  sources = $sources
  questions = @($questions)
}

$json = $bank | ConvertTo-Json -Depth 20
$outputPath = [System.IO.Path]::GetFullPath($OutputFile)
[System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($outputPath)) | Out-Null
[System.IO.File]::WriteAllText($outputPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Write-Output "Generated $outputPath with $($questions.Count) questions; answer positions $($answerPositions | ConvertTo-Json -Compress)."
