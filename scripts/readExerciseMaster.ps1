param([string]$Path = 'Nevfit_Exercise_Master_Research_Draft-NB Program.xlsx', [switch]$Json)

$fullPath = (Resolve-Path -LiteralPath $Path).Path
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($fullPath)
try {
  function Read-XmlEntry([string]$name) {
    $entry = $zip.GetEntry($name)
    if (-not $entry) { return $null }
    $stream = $entry.Open()
    try {
      $reader = [System.IO.StreamReader]::new($stream)
      try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
    } finally { $stream.Dispose() }
  }
  $sharedXml = Read-XmlEntry 'xl/sharedStrings.xml'
  $shared = @()
  if ($sharedXml) {
    foreach ($item in $sharedXml.SelectNodes("//*[local-name()='si']")) {
      $shared += ($item.SelectNodes(".//*[local-name()='t']") | ForEach-Object { $_.InnerText }) -join ''
    }
  }
  $workbook = Read-XmlEntry 'xl/workbook.xml'
  $rels = Read-XmlEntry 'xl/_rels/workbook.xml.rels'
  $sheets = foreach ($sheet in $workbook.SelectNodes("//*[local-name()='sheet']")) {
    $rid = $sheet.GetAttribute('id', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
    $rel = $rels.SelectSingleNode("//*[local-name()='Relationship' and @Id='$rid']")
    $target = $rel.GetAttribute('Target').TrimStart('/')
    if (-not $target.StartsWith('xl/')) { $target = "xl/$target" }
    $sheetXml = Read-XmlEntry $target
    $rows = foreach ($row in $sheetXml.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']")) {
      $cells = [ordered]@{}
      foreach ($cell in $row.SelectNodes("*[local-name()='c']")) {
        $value = $cell.SelectSingleNode("*[local-name()='v']")
        $inline = $cell.SelectSingleNode("*[local-name()='is']")
        $text = if ($cell.GetAttribute('t') -eq 's') { $shared[[int]$value.InnerText] } elseif ($inline) { ($inline.SelectNodes(".//*[local-name()='t']") | ForEach-Object { $_.InnerText }) -join '' } elseif ($value) { $value.InnerText } else { '' }
        $cells[$cell.GetAttribute('r')] = $text
      }
      [pscustomobject]@{ row = [int]$row.GetAttribute('r'); cells = $cells }
    }
    [pscustomobject]@{ sheet = $sheet.GetAttribute('name'); rows = @($rows) }
  }
  if ($Json) { ConvertTo-Json -InputObject @($sheets) -Depth 8 } else { $sheets }
} finally { $zip.Dispose() }
